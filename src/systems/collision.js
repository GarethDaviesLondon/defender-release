// Collision: axis-aligned box overlap in a wrapping world.
//
// Boxes are centred: an entity carries x and y at its centre, and w and h as
// its full extents. The x comparison goes through deltaX, which is the whole
// reason this module exists rather than being three lines inlined at each call
// site. A box at x = 5755 and one at x = 5 are 10 apart, not 5750 apart
// (functional spec, section 10).
//
// The inequality is strict, so two boxes sharing exactly one edge do not
// collide. That is an arbitrary choice, but it has to be made once and stated,
// or it drifts between call sites and produces off-by-one deaths.
//
// Pure. No DOM.

import { deltaX } from '../core/world.js';

/** Do two centred boxes overlap, accounting for world wrap. */
export function boxesOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  const dx = Math.abs(deltaX(ax, bx));
  if (dx * 2 >= aw + bw) return false;
  const dy = Math.abs(ay - by);
  return dy * 2 < ah + bh;
}

/** Do two entities overlap. Each needs x, y, w, h. */
export function overlaps(a, b) {
  return boxesOverlap(a.x, a.y, a.w, a.h, b.x, b.y, b.w, b.h);
}

/** The first entity in `list` that overlaps `a` and is still alive, or null.
 *  Callers that need every hit should filter instead; this is the common case
 *  of a shot finding one target. */
export function firstHit(a, list) {
  for (const b of list) {
    if (b.dead) continue;
    if (overlaps(a, b)) return b;
  }
  return null;
}

/** Every alive entity in `list` overlapping `a`. */
export function allHits(a, list) {
  const out = [];
  for (const b of list) {
    if (b.dead) continue;
    if (overlaps(a, b)) out.push(b);
  }
  return out;
}

/** Is a world position inside the camera's viewport, with a margin. Used by the
 *  smart bomb, which kills what is on screen and nothing else. */
export function withinView(cameraX, viewWidth, x, margin = 0) {
  const d = deltaX(cameraX, x);
  return d >= -margin && d <= viewWidth + margin;
}
