// The player ship.
//
// The feel of Defender lives in one asymmetry: horizontal movement has inertia
// and no brake, vertical movement is direct. Thrust accelerates, releasing it
// decays, and the only way to reverse is to flip and thrust back. Up and down,
// by contrast, respond instantly. Make both axes inertial and the ship becomes
// Asteroids; make both direct and it becomes Scramble.
//
// The ship takes an `intent` object rather than reading the keyboard, so this
// module stays free of the DOM and the input mapping can change without
// touching the physics (functional spec, section 6).
//
// Pure. No DOM.

import { SHIP, VIEW_WIDTH, WORLD_HEIGHT } from '../config/tuning.js';
import { wrapX, clamp } from '../core/world.js';

export function createShip(x = 0) {
  return {
    kind: 'ship',
    x: wrapX(x),
    y: WORLD_HEIGHT / 2,
    vx: 0,
    facing: 1,
    w: SHIP.WIDTH,
    h: SHIP.HEIGHT,
    dead: false,
    thrusting: false,
    vyDir: 0, // which way the vertical key is held, for the speed ramp
    vyHeld: 0, // how long it has been held
    faults: 0, // times a corrupted position had to be recovered (KI-06)
    invuln: SHIP.INVULN_TIME,
    flipCooldown: 0,
    fireCooldown: 0,
    hyperCooldown: 0,
    holding: null, // the humanoid being carried, if any
  };
}

/** The intent shape the ship expects. Kept here so the input mapping in main.js
 *  has one place to match. */
export function emptyIntent() {
  return {
    thrust: false,
    up: false,
    down: false,
    // `flip` is a toggle: reverse whichever way you currently face. `face` is
    // absolute: +1 or -1 to point that way, 0 to leave it alone. A directional
    // key sets `face`; the cabinet's REVERSE button sets `flip`.
    flip: false,
    face: 0,
    fire: false,
    bomb: false,
    hyperspace: false,
  };
}

/**
 * Advance the ship one fixed step.
 *
 * Returns the actions the caller should carry out: firing a shot, detonating a
 * bomb, jumping. The ship does not create shots or award points itself, because
 * doing so would drag the shot pool and the score into this module and make the
 * physics untestable.
 */
export function updateShip(ship, dt, intent, rng) {
  const actions = {
    fired: false, bombed: false, jumped: false, jumpFailed: false, corrupted: false,
  };
  if (ship.dead) return actions;

  // Remember a known-good position. One NaN anywhere in the maths below would
  // otherwise erase the ship in total silence: it gets drawn at NaN, so it
  // vanishes; collision tests against NaN are all false, so it cannot be hit;
  // and its shots spawn at NaN, so they are invisible. Nothing throws. See the
  // recovery at the end of this function, and KI-05 and KI-06.
  const lastGoodX = ship.x;
  const lastGoodY = ship.y;

  ship.invuln = Math.max(0, ship.invuln - dt);
  ship.flipCooldown = Math.max(0, ship.flipCooldown - dt);
  ship.fireCooldown = Math.max(0, ship.fireCooldown - dt);
  ship.hyperCooldown = Math.max(0, ship.hyperCooldown - dt);

  // --- Facing ---
  //
  // Velocity is deliberately untouched by either path. The ship keeps drifting
  // the way it was going while now pointing the other way, which is the whole
  // trick: there is no brake, only thrust in the new direction.
  //
  // `face` is validated rather than merely tested against 0. It used to be
  // `intent.face !== 0`, which quietly accepted `undefined` from any caller
  // handing over a partial intent and assigned it straight to `ship.facing`.
  // From there `vx += undefined * THRUST * dt` is NaN, `x` is NaN, and the ship
  // is drawn at NaN: invisible, unhittable, firing shots nobody can see. A
  // browser serving a stale cached module is enough to cause it, since ES
  // modules are cached independently of the page (KI-05).
  if (intent.face === 1 || intent.face === -1) {
    // A directional key. No cooldown: holding a direction cannot flutter, and
    // the cooldown exists only to debounce the toggle below. Making a player
    // wait 0.2s to turn would feel broken in a game this twitchy.
    ship.facing = intent.face;
  } else if (intent.flip && ship.flipCooldown <= 0) {
    ship.facing = -ship.facing;
    ship.flipCooldown = SHIP.FLIP_COOLDOWN;
  }

  // --- Horizontal: inertia, no brake ---
  ship.thrusting = !!intent.thrust;
  if (ship.thrusting) {
    ship.vx += ship.facing * SHIP.THRUST * dt;
  } else {
    // Exponential decay, frame-rate independent. Not a brake: it never reaches
    // zero quickly enough to feel like one.
    ship.vx *= Math.exp(-SHIP.DRAG_X * dt);
  }
  ship.vx = clamp(ship.vx, -SHIP.MAX_SPEED_X, SHIP.MAX_SPEED_X);
  ship.x = wrapX(ship.x + ship.vx * dt);

  // --- Vertical: direct, no inertia, but ramped ---
  //
  // Speed climbs while the key is held and resets the moment it is let go or
  // reversed. That is not inertia: release still stops the ship dead, with no
  // drift, which is the half of the asymmetry that makes this feel like
  // Defender. What it buys is a tap that nudges rather than leaps, so the
  // player can settle onto a Lander's altitude instead of straddling it
  // (EH-05).
  const vdir = (intent.down ? 1 : 0) - (intent.up ? 1 : 0);
  if (vdir !== ship.vyDir) {
    ship.vyDir = vdir;
    ship.vyHeld = 0;
  }
  if (vdir !== 0) {
    const ramp = SHIP.SPEED_Y_RAMP > 0
      ? Math.min(ship.vyHeld / SHIP.SPEED_Y_RAMP, 1)
      : 1;
    const speed =
      SHIP.SPEED_Y_START + (SHIP.SPEED_Y_MAX - SHIP.SPEED_Y_START) * ramp;
    ship.y = clamp(ship.y + vdir * speed * dt, SHIP.Y_MIN, SHIP.Y_MAX);
    ship.vyHeld += dt;
  }

  // --- Weapons ---
  if (intent.fire && ship.fireCooldown <= 0) {
    ship.fireCooldown = 0;
    actions.fired = true;
  }
  if (intent.bomb) actions.bombed = true;

  if (intent.hyperspace && ship.hyperCooldown <= 0) {
    ship.hyperCooldown = SHIP.HYPERSPACE_COOLDOWN;
    actions.jumped = true;
    // The original's bargain: a way out of trouble that sometimes kills you.
    actions.jumpFailed = rng.chance(SHIP.HYPERSPACE_FAIL_CHANCE);
  }

  // Refuse to hand a corrupted position downstream. A missing tuning constant
  // or a caller passing an intent of the wrong shape produces NaN here, and a
  // NaN ship is invisible and unhittable rather than obviously broken. Fall
  // back to the last good position, stop, and count it so something can say so
  // out loud (KI-06).
  if (!Number.isFinite(ship.x) || !Number.isFinite(ship.y) || !Number.isFinite(ship.vx)) {
    ship.x = Number.isFinite(lastGoodX) ? lastGoodX : 0;
    ship.y = Number.isFinite(lastGoodY) ? lastGoodY : WORLD_HEIGHT / 2;
    ship.vx = 0;
    ship.vyDir = 0;
    ship.vyHeld = 0;
    ship.faults += 1;
    actions.corrupted = true;
  }

  return actions;
}

/** Called by the caller when a shot is actually created, so the rate cap is
 *  applied only when a shot really left the ship (the pool may have been full). */
export function noteShotFired(ship, interval) {
  ship.fireCooldown = interval;
}

export function isVulnerable(ship) {
  return !ship.dead && ship.invuln <= 0;
}

/** Put the ship back after a death: centre of the viewport, facing right,
 *  briefly untouchable. */
export function respawnShip(ship, cameraX) {
  ship.x = wrapX(cameraX + VIEW_WIDTH / 2);
  ship.y = WORLD_HEIGHT / 2;
  ship.vx = 0;
  ship.facing = 1;
  ship.dead = false;
  ship.invuln = SHIP.INVULN_TIME;
  ship.holding = null;
  ship.vyDir = 0;
  ship.vyHeld = 0;
  return ship;
}

/** Teleport somewhere random in the upper half of the world. */
export function hyperspaceTo(ship, rng, worldWidth) {
  ship.x = rng.range(0, worldWidth);
  ship.y = rng.range(SHIP.Y_MIN, WORLD_HEIGHT / 2);
  ship.vx = 0;
  return ship;
}
