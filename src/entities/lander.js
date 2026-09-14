// The Lander: the heart of the game.
//
// Three modes (functional spec, section 8.1). Hunting drifts and descends,
// looking for work. Seeking closes on a chosen humanoid. Abducting rises with
// one attached. A Lander that reaches the top eats its humanoid and becomes a
// Mutant, which is how the player's carelessness is turned into the thing that
// kills them.
//
// The pickup itself happens in the collision system, not here: this module
// decides where a Lander wants to be, and something else decides what it has
// touched (functional spec, section 10).
//
// Pure. No DOM.

import { LANDER, WORLD_HEIGHT } from '../config/tuning.js';
import { wrapX, deltaX, distX, clamp } from '../core/world.js';
import { HumanoidState } from './humanoid.js';

export const LanderMode = {
  HUNTING: 'hunting',
  SEEKING: 'seeking',
  ABDUCTING: 'abducting',
};

export function createLander(x, y) {
  return {
    kind: 'lander',
    x: wrapX(x),
    y,
    w: LANDER.WIDTH,
    h: LANDER.HEIGHT,
    vx: 0,
    mode: LanderMode.HUNTING,
    target: null,
    carrying: null,
    fireIn: LANDER.FIRE_INTERVAL,
    drift: 1,
    dead: false,
    score: LANDER.SCORE,
  };
}

/**
 * @param ctx { humanoids, ship, rng, descentMul, fireInterval, onScreen }
 * @returns events for the caller: a fire request, if any
 */
export function updateLander(lander, dt, ctx) {
  if (lander.dead) return [];
  const events = [];
  const { humanoids, ship, rng, descentMul, fireInterval, onScreen } = ctx;

  // A carried humanoid may have been shot free, or the target taken by another
  // Lander. Re-derive the mode every frame rather than trusting a stale flag.
  if (lander.carrying && lander.carrying.state === HumanoidState.CARRIED) {
    lander.mode = LanderMode.ABDUCTING;
  } else {
    lander.carrying = null;
    if (
      lander.target &&
      !lander.target.dead &&
      lander.target.state === HumanoidState.WALKING
    ) {
      lander.mode = LanderMode.SEEKING;
    } else {
      lander.target = null;
      lander.mode = LanderMode.HUNTING;
    }
  }

  switch (lander.mode) {
    case LanderMode.ABDUCTING:
      lander.y -= LANDER.ABDUCT_RISE * dt;
      break;

    case LanderMode.SEEKING: {
      const dx = deltaX(lander.x, lander.target.x);
      lander.vx = Math.sign(dx) * LANDER.SPEED;
      lander.x = wrapX(lander.x + lander.vx * dt);
      lander.y += LANDER.SEEK_DESCENT * descentMul * dt;
      break;
    }

    case LanderMode.HUNTING:
    default: {
      lander.target = nearestWalkingHumanoid(lander, humanoids);
      lander.vx = lander.drift * LANDER.SPEED;
      lander.x = wrapX(lander.x + lander.vx * dt);
      lander.y += LANDER.DESCENT * descentMul * dt;
      if (rng.chance(0.4 * dt)) lander.drift = -lander.drift;
      break;
    }
  }

  lander.y = clamp(lander.y, 0, WORLD_HEIGHT - 60);

  // Fire only at a player who is near and can see it coming. An enemy shooting
  // from off screen is not a threat the player can answer.
  lander.fireIn -= dt;
  if (lander.fireIn <= 0) {
    lander.fireIn = fireInterval * (0.75 + rng.next() * 0.5);
    if (
      onScreen &&
      ship &&
      !ship.dead &&
      distX(lander.x, ship.x) < LANDER.FIRE_RANGE
    ) {
      events.push({ type: 'fire', x: lander.x, y: lander.y });
    }
  }

  return events;
}

function nearestWalkingHumanoid(lander, humanoids) {
  let best = null;
  let bestDist = LANDER.SEEK_RANGE;
  for (const h of humanoids) {
    if (h.dead || h.state !== HumanoidState.WALKING) continue;
    const d = distX(lander.x, h.x);
    if (d < bestDist) {
      bestDist = d;
      best = h;
    }
  }
  return best;
}
