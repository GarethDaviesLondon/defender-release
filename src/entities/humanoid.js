// Humanoids: the thing the whole game is actually about.
//
// A humanoid moves through five states (functional spec, section 7.2). The
// transitions between them are small pure functions rather than branches buried
// in an update loop, because they are the rules the game is judged on and they
// are the ones under test (functional spec, 17.8).
//
// The rule that carries the most weight: killing a Lander mid-abduction drops
// the humanoid, it does not kill it. Get that wrong and rescuing becomes
// impossible, which removes the point of the game.
//
// Pure. No DOM.

import { HUMANOID, WORLD_HEIGHT } from '../config/tuning.js';
import { wrapX, groundYAt } from '../core/world.js';

export const HumanoidState = {
  WALKING: 'walking',
  CARRIED: 'carried',
  FALLING: 'falling',
  HELD: 'held',
  DEAD: 'dead',
};

export function createHumanoid(x, terrain) {
  return {
    kind: 'humanoid',
    x: wrapX(x),
    y: groundYAt(terrain, x) - HUMANOID.HEIGHT / 2,
    w: HUMANOID.WIDTH,
    h: HUMANOID.HEIGHT,
    vy: 0,
    dir: 1,
    turnIn: 2,
    state: HumanoidState.WALKING,
    captor: null,
    dead: false,
  };
}

/** Place the wave-1 humanoids: evenly spaced, with jitter so they do not look
 *  like fence posts. */
export function placeHumanoids(terrain, rng, worldWidth) {
  const spacing = worldWidth / HUMANOID.COUNT;
  const out = [];
  for (let i = 0; i < HUMANOID.COUNT; i++) {
    const x = i * spacing + rng.range(spacing * 0.2, spacing * 0.8);
    out.push(createHumanoid(x, terrain));
  }
  return out;
}

// --- Transitions ----------------------------------------------------------

/** A Lander has touched a walking humanoid. */
export function beginAbduction(h, captor) {
  if (h.state !== HumanoidState.WALKING) return false;
  h.state = HumanoidState.CARRIED;
  h.captor = captor;
  return true;
}

/** The captor died. The humanoid falls; it does not die with it. */
export function dropHumanoid(h) {
  if (h.state !== HumanoidState.CARRIED) return false;
  h.state = HumanoidState.FALLING;
  h.captor = null;
  h.vy = 0;
  return true;
}

/** The player has flown into a falling humanoid. */
export function catchHumanoid(h, ship) {
  if (h.state !== HumanoidState.FALLING) return false;
  h.state = HumanoidState.HELD;
  h.captor = ship;
  h.vy = 0;
  return true;
}

/** The player carried one down to the ground. Worth points. */
export function landHumanoid(h, terrain) {
  if (h.state !== HumanoidState.HELD) return false;
  h.state = HumanoidState.WALKING;
  h.captor = null;
  h.y = groundYAt(terrain, h.x) - HUMANOID.HEIGHT / 2;
  return true;
}

/** A Lander got one to the top. The humanoid dies and its captor mutates. */
export function eatHumanoid(h) {
  if (h.state !== HumanoidState.CARRIED) return null;
  const captor = h.captor;
  h.state = HumanoidState.DEAD;
  h.dead = true;
  h.captor = null;
  return { mutate: captor };
}

export function countAlive(humanoids) {
  return humanoids.filter((h) => !h.dead).length;
}

/** True when the last humanoid has just died and the planet should go. */
export function planetShouldDie(humanoids) {
  return humanoids.length > 0 && countAlive(humanoids) === 0;
}

// --- Per-frame update -----------------------------------------------------

/**
 * Advance one humanoid. Returns a list of events for the caller to act on,
 * rather than reaching out and changing the world itself: this module has no
 * business spawning Mutants or adding score.
 */
export function updateHumanoid(h, dt, terrain, rng, ship) {
  if (h.dead) return [];
  const events = [];

  switch (h.state) {
    case HumanoidState.WALKING: {
      h.turnIn -= dt;
      if (h.turnIn <= 0) {
        h.dir = rng.chance(0.5) ? 1 : -1;
        h.turnIn = rng.range(HUMANOID.TURN_MIN, HUMANOID.TURN_MAX);
      }
      h.x = wrapX(h.x + h.dir * HUMANOID.WALK_SPEED * dt);
      h.y = groundYAt(terrain, h.x) - HUMANOID.HEIGHT / 2;
      break;
    }

    case HumanoidState.CARRIED: {
      if (!h.captor || h.captor.dead) {
        dropHumanoid(h);
        break;
      }
      h.x = h.captor.x;
      h.y = h.captor.y + HUMANOID.CARRY_OFFSET;
      if (h.captor.y <= HUMANOID.EATEN_Y) {
        const result = eatHumanoid(h);
        if (result) events.push({ type: 'eaten', captor: result.mutate });
      }
      break;
    }

    case HumanoidState.FALLING: {
      h.vy += HUMANOID.GRAVITY * dt;
      h.y += h.vy * dt;
      const ground = groundYAt(terrain, h.x) - HUMANOID.HEIGHT / 2;
      if (h.y >= ground) {
        // Survives any fall. This softens the original deliberately, and the
        // functional spec records it as the first thing to revisit (19.2).
        h.y = ground;
        h.vy = 0;
        h.state = HumanoidState.WALKING;
        events.push({ type: 'landedSafely' });
      }
      break;
    }

    case HumanoidState.HELD: {
      if (!ship || ship.dead) {
        h.state = HumanoidState.FALLING;
        h.captor = null;
        break;
      }
      h.x = ship.x;
      h.y = ship.y + HUMANOID.CARRY_OFFSET;
      const ground = groundYAt(terrain, h.x) - HUMANOID.HEIGHT / 2;
      if (h.y >= ground) {
        landHumanoid(h, terrain);
        events.push({ type: 'rescued' });
      }
      break;
    }

    default:
      break;
  }

  if (h.y > WORLD_HEIGHT) h.y = WORLD_HEIGHT;
  return events;
}
