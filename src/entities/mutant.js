// The Mutant: what a Lander becomes when it gets a humanoid to the top.
//
// Fast and aggressive, and the reason losing humanoids hurts rather than just
// costing points. A Mutant accelerates toward the player with a perpendicular
// wobble, so it cannot be led cleanly but does not track perfectly either. The
// wobble constant is a first guess and needs a human at the keyboard: too
// little and they are trivially dodged, too much and they are unfair
// (functional spec, section 19.4).
//
// Pure. No DOM.

import { MUTANT, WORLD_HEIGHT } from '../config/tuning.js';
import { wrapX, deltaX, distX, clamp } from '../core/world.js';

export function createMutant(x, y) {
  return {
    kind: 'mutant',
    x: wrapX(x),
    y,
    w: MUTANT.WIDTH,
    h: MUTANT.HEIGHT,
    vx: 0,
    vy: 0,
    fireIn: MUTANT.FIRE_INTERVAL,
    dead: false,
    score: MUTANT.SCORE,
  };
}

/** Promote a Lander in place, keeping its position. The Lander is marked dead
 *  so the caller's prune drops it, but it must not award points: the player did
 *  not kill it, they failed to. */
export function mutateFrom(lander) {
  lander.dead = true;
  return createMutant(lander.x, lander.y);
}

export function updateMutant(mutant, dt, ctx) {
  if (mutant.dead) return [];
  const events = [];
  const { ship, rng, onScreen } = ctx;

  if (ship && !ship.dead) {
    const dx = deltaX(mutant.x, ship.x);
    const dy = ship.y - mutant.y;
    const len = Math.hypot(dx, dy) || 1;
    // Pursuit, plus a perpendicular nudge so the path is not a straight line.
    const perp = rng.spread(1);
    mutant.vx += ((dx / len) * MUTANT.ACCEL + (-dy / len) * MUTANT.WOBBLE * perp) * dt;
    mutant.vy += ((dy / len) * MUTANT.ACCEL + (dx / len) * MUTANT.WOBBLE * perp) * dt;
  }

  const speed = Math.hypot(mutant.vx, mutant.vy);
  if (speed > MUTANT.SPEED) {
    mutant.vx = (mutant.vx / speed) * MUTANT.SPEED;
    mutant.vy = (mutant.vy / speed) * MUTANT.SPEED;
  }

  mutant.x = wrapX(mutant.x + mutant.vx * dt);
  mutant.y = clamp(mutant.y + mutant.vy * dt, 8, WORLD_HEIGHT - 40);

  mutant.fireIn -= dt;
  if (mutant.fireIn <= 0) {
    mutant.fireIn = MUTANT.FIRE_INTERVAL * (0.7 + rng.next() * 0.6);
    if (onScreen && ship && !ship.dead && distX(mutant.x, ship.x) < 800) {
      events.push({ type: 'fire', x: mutant.x, y: mutant.y });
    }
  }

  return events;
}
