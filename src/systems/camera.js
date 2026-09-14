// The camera: a window onto the wrapping world.
//
// The camera leads in the direction the ship faces, so the player sees where
// they are going rather than where they have been. Flipping moves the target
// to the other side of the screen and the camera swings across, which is what
// gives Defender its distinctive lurch on reversal (functional spec, section 5).
//
// Pure. No DOM.

import {
  VIEW_WIDTH,
  CAMERA_LEAD_RIGHT,
  CAMERA_LEAD_LEFT,
  CAMERA_LERP,
} from '../config/tuning.js';
import { wrapX, deltaX } from '../core/world.js';

export function createCamera() {
  return { x: 0 };
}

/** The offset within the viewport the ship should sit at, for a facing. */
export function leadOffset(facing) {
  return VIEW_WIDTH * (facing >= 0 ? CAMERA_LEAD_RIGHT : CAMERA_LEAD_LEFT);
}

/** Move the camera toward the position that puts the ship at its lead offset.
 *  Uses deltaX so the chase crosses the seam the short way instead of
 *  scrolling the whole world backwards. */
export function updateCamera(camera, shipX, facing, dt) {
  const targetX = wrapX(shipX - leadOffset(facing));
  const d = deltaX(camera.x, targetX);
  // Frame-rate independent exponential approach.
  camera.x = wrapX(camera.x + d * (1 - Math.exp(-CAMERA_LERP * dt)));
  return camera;
}

/** Snap straight to the target, for a respawn or a hyperspace jump, where
 *  swinging across half a world would be worse than cutting. */
export function snapCamera(camera, shipX, facing) {
  camera.x = wrapX(shipX - leadOffset(facing));
  return camera;
}

/** Where a world x appears on screen, or null if it is off the viewport.
 *  Everything drawn goes through this, which is what makes the seam work:
 *  a body at x = 5750 returns a small positive screen x when the camera is at
 *  5700. */
export function screenXOf(camera, worldX, margin = 0) {
  const d = deltaX(camera.x, worldX);
  if (d < -margin || d > VIEW_WIDTH + margin) return null;
  return d;
}
