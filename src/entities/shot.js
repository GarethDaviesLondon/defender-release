// Shots: the player's laser and the enemies' dots.
//
// A player shot is a long thin box, not a point. The original's laser was a
// stretched beam, and the length is what makes it read as one, so the collision
// box is 180 wide (functional spec, sections 6.3 and 10).
//
// Pure. No DOM.

import { SHOT, ENEMY_SHOT } from '../config/tuning.js';
import { wrapX, deltaX } from '../core/world.js';

export function createPlayerShot(x, y, facing) {
  return {
    kind: 'shot',
    x: wrapX(x),
    y,
    w: SHOT.LENGTH,
    h: SHOT.THICKNESS,
    vx: facing * SHOT.SPEED,
    life: SHOT.LIFETIME,
    dead: false,
  };
}

/** An enemy shot, aimed at where the player was when it was fired. Leading the
 *  player would make enemies lethal at any range; firing at the last known
 *  position gives the player a way to dodge by moving. */
export function createEnemyShot(x, y, targetX, targetY) {
  const dx = deltaX(x, targetX);
  const dy = targetY - y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    kind: 'enemyShot',
    x: wrapX(x),
    y,
    w: ENEMY_SHOT.SIZE,
    h: ENEMY_SHOT.SIZE,
    vx: (dx / len) * ENEMY_SHOT.SPEED,
    vy: (dy / len) * ENEMY_SHOT.SPEED,
    life: ENEMY_SHOT.LIFETIME,
    dead: false,
  };
}

export function updateShot(shot, dt) {
  shot.x = wrapX(shot.x + shot.vx * dt);
  if (shot.vy) shot.y += shot.vy * dt;
  shot.life -= dt;
  if (shot.life <= 0) shot.dead = true;
}

/** Drop dead entries from a pool, in place. Called once a frame rather than
 *  splicing during iteration, which is how you lose an entity. */
export function prune(list) {
  let write = 0;
  for (let read = 0; read < list.length; read++) {
    if (!list[read].dead) list[write++] = list[read];
  }
  list.length = write;
  return list;
}
