// The Baiter: the anti-camping measure.
//
// A player who clears most of a wave and then hides has beaten the game's
// pacing rather than its enemies. The Baiter answers that: once a wave has run
// past its grace period, one arrives, then another, faster each time. They are
// quick and fragile.
//
// Baiters do not hold a wave open (functional spec, section 8.3). A wave that
// only has Baiters left is finished; they die with it. Getting that backwards
// would make waves unendable, since the spawner keeps producing them.
//
// Pure. No DOM.

import { BAITER, WORLD_HEIGHT } from '../config/tuning.js';
import { wrapX, deltaX, distX, clamp } from '../core/world.js';

export function createBaiter(x, y) {
  return {
    kind: 'baiter',
    x: wrapX(x),
    y,
    w: BAITER.WIDTH,
    h: BAITER.HEIGHT,
    vx: 0,
    vy: 0,
    fireIn: BAITER.FIRE_INTERVAL,
    dead: false,
    score: BAITER.SCORE,
    holdsWaveOpen: false,
  };
}

export function updateBaiter(baiter, dt, ctx) {
  if (baiter.dead) return [];
  const events = [];
  const { ship, rng, onScreen } = ctx;

  if (ship && !ship.dead) {
    const dx = deltaX(baiter.x, ship.x);
    const dy = ship.y - baiter.y;
    baiter.vx += Math.sign(dx) * BAITER.ACCEL * dt;
    baiter.vy += Math.sign(dy) * BAITER.ACCEL * 0.5 * dt;
  }

  baiter.vx = clamp(baiter.vx, -BAITER.SPEED, BAITER.SPEED);
  baiter.vy = clamp(baiter.vy, -BAITER.SPEED * 0.5, BAITER.SPEED * 0.5);
  baiter.x = wrapX(baiter.x + baiter.vx * dt);
  baiter.y = clamp(baiter.y + baiter.vy * dt, 8, WORLD_HEIGHT - 40);

  baiter.fireIn -= dt;
  if (baiter.fireIn <= 0) {
    baiter.fireIn = BAITER.FIRE_INTERVAL * (0.7 + rng.next() * 0.6);
    if (onScreen && ship && !ship.dead && distX(baiter.x, ship.x) < 700) {
      events.push({ type: 'fire', x: baiter.x, y: baiter.y });
    }
  }

  return events;
}
