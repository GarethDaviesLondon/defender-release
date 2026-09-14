// The Swarmer: what comes out of a Pod.
//
// Fast, small, and erratic. Swarmers steer toward the player but with a large
// wander component, so a group of four spreads into a cloud rather than a queue.
// They rarely fire; the threat is their bodies (functional spec, section 8.5).
//
// Pure. No DOM.

import { SWARMER, POD, WORLD_HEIGHT } from '../config/tuning.js';
import { wrapX, deltaX, distX, clamp } from '../core/world.js';

export function createSwarmer(x, y, rng) {
  return {
    kind: 'swarmer',
    x: wrapX(x),
    y,
    w: SWARMER.WIDTH,
    h: SWARMER.HEIGHT,
    vx: rng.spread(SWARMER.SPEED),
    vy: rng.spread(SWARMER.SPEED),
    fireIn: SWARMER.FIRE_INTERVAL * (0.5 + rng.next()),
    dead: false,
    score: SWARMER.SCORE,
  };
}

/** Burst a Pod into its Swarmers. The Pod is already dead by this point; this
 *  only builds what replaces it. */
export function burstPod(pod, rng) {
  const out = [];
  for (let i = 0; i < POD.SWARMERS; i++) {
    out.push(createSwarmer(pod.x + rng.spread(20), pod.y + rng.spread(20), rng));
  }
  return out;
}

export function updateSwarmer(swarmer, dt, ctx) {
  if (swarmer.dead) return [];
  const events = [];
  const { ship, rng, onScreen } = ctx;

  if (ship && !ship.dead) {
    const dx = deltaX(swarmer.x, ship.x);
    const dy = ship.y - swarmer.y;
    const len = Math.hypot(dx, dy) || 1;
    swarmer.vx += ((dx / len) * SWARMER.ACCEL + rng.spread(SWARMER.WANDER)) * dt;
    swarmer.vy += ((dy / len) * SWARMER.ACCEL + rng.spread(SWARMER.WANDER)) * dt;
  }

  const speed = Math.hypot(swarmer.vx, swarmer.vy);
  if (speed > SWARMER.SPEED) {
    swarmer.vx = (swarmer.vx / speed) * SWARMER.SPEED;
    swarmer.vy = (swarmer.vy / speed) * SWARMER.SPEED;
  }

  swarmer.x = wrapX(swarmer.x + swarmer.vx * dt);
  swarmer.y = clamp(swarmer.y + swarmer.vy * dt, 8, WORLD_HEIGHT - 30);

  swarmer.fireIn -= dt;
  if (swarmer.fireIn <= 0) {
    swarmer.fireIn = SWARMER.FIRE_INTERVAL * (0.6 + rng.next() * 0.8);
    if (onScreen && ship && !ship.dead && distX(swarmer.x, ship.x) < 600) {
      events.push({ type: 'fire', x: swarmer.x, y: swarmer.y });
    }
  }

  return events;
}
