// The wrapping world: coordinate arithmetic and terrain.
//
// This is the highest-risk module in the project (functional spec, section
// 19.1). Every position comparison in the game goes through deltaX, and every
// position that moves goes through wrapX. A plain `a.x - b.x` anywhere else
// produces a bug that only shows up near x = 0 and is miserable to reproduce.
//
// Pure. No DOM.

import {
  WORLD_WIDTH,
  HALF_WORLD,
  WORLD_HEIGHT,
  TERRAIN_POINTS,
  TERRAIN_SEGMENT,
  TERRAIN_MIN_HEIGHT,
  TERRAIN_MAX_HEIGHT,
  TERRAIN_MAX_STEP,
  TERRAIN_BLEND_POINTS,
} from '../config/tuning.js';
import { makeRng } from './rng.js';

/** Bring any x into [0, WORLD_WIDTH). Handles negatives and values several
 *  worlds out, which the modulo operator alone does not. */
export function wrapX(x) {
  const m = x % WORLD_WIDTH;
  return m < 0 ? m + WORLD_WIDTH : m;
}

/** The shortest signed distance from `from` to `to`, in
 *  [-HALF_WORLD, +HALF_WORLD).
 *
 *  At exactly half a world apart the two directions are equally short. This
 *  returns -HALF_WORLD in that case, consistently, rather than picking
 *  differently depending on the inputs: a caller that gets a different answer
 *  for the same geometry is a caller that jitters. */
export function deltaX(from, to) {
  let d = (wrapX(to) - wrapX(from)) % WORLD_WIDTH;
  if (d >= HALF_WORLD) d -= WORLD_WIDTH;
  if (d < -HALF_WORLD) d += WORLD_WIDTH;
  return d;
}

/** Absolute shortest distance between two x positions. */
export function distX(a, b) {
  return Math.abs(deltaX(a, b));
}

/** Generate the terrain for a wave.
 *
 *  A seeded random walk of TERRAIN_POINTS heights, each clamped to the allowed
 *  band. Because the world wraps, the last point joins the first: the final
 *  TERRAIN_BLEND_POINTS are pulled back toward the starting height so the seam
 *  is a slope, not a cliff. The blend reaches the start height at the virtual
 *  index TERRAIN_POINTS, which is point 0 again, so the last real point lands
 *  within one step of it.
 *
 *  Deterministic: the same wave number always gives the same landscape
 *  (functional spec, section 4.2). */
export function generateTerrain(waveNumber) {
  const rng = makeRng(waveNumber * 2654435761 + 12345);
  const mid = (TERRAIN_MIN_HEIGHT + TERRAIN_MAX_HEIGHT) / 2;
  const heights = new Array(TERRAIN_POINTS);

  let h = rng.range(TERRAIN_MIN_HEIGHT + 10, TERRAIN_MAX_HEIGHT - 10);
  const start = h;

  for (let i = 0; i < TERRAIN_POINTS; i++) {
    heights[i] = h;
    // Nudge gently back toward the middle so the walk does not stick to a
    // clamp edge for long stretches and go flat.
    const pull = (mid - h) * 0.06;
    h = clamp(
      h + pull + rng.spread(TERRAIN_MAX_STEP),
      TERRAIN_MIN_HEIGHT,
      TERRAIN_MAX_HEIGHT,
    );
  }

  const blendFrom = TERRAIN_POINTS - TERRAIN_BLEND_POINTS;
  for (let i = blendFrom; i < TERRAIN_POINTS; i++) {
    const t = (i - blendFrom + 1) / (TERRAIN_BLEND_POINTS + 1);
    heights[i] = heights[i] * (1 - t) + start * t;
  }

  return heights;
}

/** Flat, barren terrain, for after the planet dies (functional spec, 7.4). */
export function makeBarren() {
  return new Array(TERRAIN_POINTS).fill(TERRAIN_MIN_HEIGHT);
}

/** The terrain height (above the bottom of the world) at any x, interpolating
 *  between the two nearest points and wrapping at the seam. */
export function terrainHeightAt(terrain, x) {
  const wx = wrapX(x);
  const fi = wx / TERRAIN_SEGMENT;
  const i0 = Math.floor(fi) % TERRAIN_POINTS;
  const i1 = (i0 + 1) % TERRAIN_POINTS;
  const t = fi - Math.floor(fi);
  return terrain[i0] * (1 - t) + terrain[i1] * t;
}

/** The y coordinate of the ground at any x. The world's origin is the top, so
 *  a taller hill has a smaller y. */
export function groundYAt(terrain, x) {
  return WORLD_HEIGHT - terrainHeightAt(terrain, x);
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
