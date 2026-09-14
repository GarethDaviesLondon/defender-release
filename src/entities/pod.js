// The Pod: a decision rather than a threat.
//
// A Pod drifts slowly and does nothing at all. Shooting one is worth 1000
// points, ten times a Lander, and releases four Swarmers that are fast and
// erratic. Whether to shoot it, and when, is the entire point of the enemy: a
// Pod left alone is free safety, a Pod shot at the wrong moment is four new
// problems (functional spec, section 8.5).
//
// Pure. No DOM.

import { POD, WORLD_HEIGHT } from '../config/tuning.js';
import { wrapX, clamp } from '../core/world.js';

export function createPod(x, y, rng) {
  return {
    kind: 'pod',
    x: wrapX(x),
    y,
    w: POD.WIDTH,
    h: POD.HEIGHT,
    vx: rng ? rng.spread(POD.SPEED) : POD.SPEED,
    vy: rng ? rng.spread(POD.SPEED * 0.4) : 0,
    dead: false,
    score: POD.SCORE,
  };
}

export function updatePod(pod, dt) {
  if (pod.dead) return [];
  pod.x = wrapX(pod.x + pod.vx * dt);
  const next = pod.y + pod.vy * dt;
  // Bounce off the top and bottom rather than clamping, so a Pod never parks
  // itself against an edge where it is hard to hit.
  if (next < 24 || next > WORLD_HEIGHT - 80) pod.vy = -pod.vy;
  pod.y = clamp(next, 24, WORLD_HEIGHT - 80);
  return [];
}
