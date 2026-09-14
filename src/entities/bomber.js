// The Bomber and its mines.
//
// An area-denial enemy. Bombers neither shoot nor chase: they drift on a slow
// sine path and leave a trail of mines behind them. The danger is the field,
// not the Bomber, which is what makes them a different kind of problem from
// everything else in the roster (functional spec, section 8.4).
//
// Pure. No DOM.

import { BOMBER, MINE, WORLD_HEIGHT } from '../config/tuning.js';
import { wrapX, clamp } from '../core/world.js';

export function createBomber(x, y, rng) {
  return {
    kind: 'bomber',
    x: wrapX(x),
    y,
    w: BOMBER.WIDTH,
    h: BOMBER.HEIGHT,
    baseY: y,
    phase: rng ? rng.range(0, Math.PI * 2) : 0,
    dir: rng && rng.chance(0.5) ? -1 : 1,
    mineIn: BOMBER.MINE_INTERVAL,
    dead: false,
    score: BOMBER.SCORE,
  };
}

export function createMine(x, y) {
  return {
    kind: 'mine',
    x: wrapX(x),
    y,
    w: MINE.SIZE,
    h: MINE.SIZE,
    life: MINE.LIFETIME,
    dead: false,
    score: MINE.SCORE,
  };
}

export function updateBomber(bomber, dt) {
  if (bomber.dead) return [];
  const events = [];

  bomber.phase += BOMBER.SINE_RATE * dt;
  bomber.x = wrapX(bomber.x + bomber.dir * BOMBER.SPEED * dt);
  bomber.y = clamp(
    bomber.baseY + Math.sin(bomber.phase) * BOMBER.SINE_AMPLITUDE,
    20,
    WORLD_HEIGHT - 60,
  );

  bomber.mineIn -= dt;
  if (bomber.mineIn <= 0) {
    bomber.mineIn = BOMBER.MINE_INTERVAL;
    events.push({ type: 'mine', x: bomber.x, y: bomber.y });
  }

  return events;
}

export function updateMine(mine, dt) {
  mine.life -= dt;
  if (mine.life <= 0) mine.dead = true;
}
