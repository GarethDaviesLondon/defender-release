// Drawing the play viewport.
//
// Everything is drawn from code: filled polygons and lines in a bright palette
// on black. No images, no sprite sheets, no loading (functional spec, section
// 13). The whole payload is the source.
//
// Wrapping is handled by going through deltaX for every screen position rather
// than by drawing each body twice. A body at world x = 5750 with the camera at
// 5700 returns a screen x of 50, so it appears at the left edge with no special
// case. The terrain is the one thing that does need an explicit walk across the
// seam, because it is a continuous polyline rather than a point.

import {
  VIEW_TOP,
  VIEW_WIDTH,
  VIEW_HEIGHT,
  WORLD_HEIGHT,
  TERRAIN_POINTS,
  TERRAIN_SEGMENT,
  COLOURS,
  SHIP,
  HUMANOID,
} from '../config/tuning.js';
import { deltaX } from '../core/world.js';
import { HumanoidState } from '../entities/humanoid.js';

/** Screen x for a world x, or null when it is off the viewport. */
function sx(cameraX, worldX, margin = 64) {
  const d = deltaX(cameraX, worldX);
  if (d < -margin || d > VIEW_WIDTH + margin) return null;
  return d;
}

function sy(worldY) {
  return VIEW_TOP + worldY;
}

export function drawWorld(ctx, game) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, VIEW_TOP, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.clip();

  ctx.fillStyle = COLOURS.background;
  ctx.fillRect(0, VIEW_TOP, VIEW_WIDTH, VIEW_HEIGHT);

  drawTerrain(ctx, game);
  for (const p of game.particles) drawParticle(ctx, game.camera.x, p);
  for (const m of game.mines) drawMine(ctx, game.camera.x, m);
  for (const h of game.humanoids) drawHumanoid(ctx, game.camera.x, h);
  for (const e of game.enemies) drawEnemy(ctx, game.camera.x, e);
  for (const s of game.enemyShots) drawEnemyShot(ctx, game.camera.x, s);
  for (const s of game.shots) drawPlayerShot(ctx, game.camera.x, s);
  if (!game.ship.dead) drawShip(ctx, game.camera.x, game.ship);

  ctx.restore();
}

function drawTerrain(ctx, game) {
  const { terrain, camera, planetDestroyed } = game;
  ctx.strokeStyle = planetDestroyed ? COLOURS.terrainBarren : COLOURS.terrain;
  ctx.lineWidth = 2;
  ctx.beginPath();

  // Walk one point beyond each edge so the polyline reaches off screen rather
  // than stopping short and leaving a gap at the viewport border.
  const first = Math.floor(camera.x / TERRAIN_SEGMENT) - 1;
  const count = Math.ceil(VIEW_WIDTH / TERRAIN_SEGMENT) + 3;

  for (let n = 0; n < count; n++) {
    const i = ((first + n) % TERRAIN_POINTS + TERRAIN_POINTS) % TERRAIN_POINTS;
    const worldX = (first + n) * TERRAIN_SEGMENT;
    const x = deltaX(camera.x, worldX);
    const y = sy(WORLD_HEIGHT - terrain[i]);
    if (n === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawShip(ctx, cameraX, ship) {
  const x = sx(cameraX, ship.x);
  if (x === null) return;
  const y = sy(ship.y);

  // Flash while invulnerable, so the player can see the grace period running
  // out rather than discovering it by dying.
  if (ship.invuln > 0 && Math.floor(ship.invuln * 12) % 2 === 0) return;

  const f = ship.facing;
  const hw = SHIP.WIDTH / 2;
  const hh = SHIP.HEIGHT / 2;

  ctx.fillStyle = ship.invuln > 0 ? COLOURS.shipInvuln : COLOURS.ship;
  ctx.beginPath();
  ctx.moveTo(x + f * hw, y);
  ctx.lineTo(x - f * hw * 0.4, y - hh);
  ctx.lineTo(x - f * hw, y - hh * 0.3);
  ctx.lineTo(x - f * hw, y + hh * 0.3);
  ctx.lineTo(x - f * hw * 0.4, y + hh);
  ctx.closePath();
  ctx.fill();

  if (ship.thrusting) {
    ctx.fillStyle = COLOURS.shot;
    ctx.beginPath();
    ctx.moveTo(x - f * hw, y - 3);
    ctx.lineTo(x - f * (hw + 10 + Math.random() * 8), y);
    ctx.lineTo(x - f * hw, y + 3);
    ctx.closePath();
    ctx.fill();
  }
}

function drawPlayerShot(ctx, cameraX, shot) {
  const x = sx(cameraX, shot.x, shot.w);
  if (x === null) return;
  ctx.fillStyle = COLOURS.shot;
  ctx.fillRect(x - shot.w / 2, sy(shot.y) - shot.h / 2, shot.w, shot.h);
}

function drawEnemyShot(ctx, cameraX, shot) {
  const x = sx(cameraX, shot.x);
  if (x === null) return;
  ctx.fillStyle = COLOURS.enemyShot;
  ctx.fillRect(x - shot.w / 2, sy(shot.y) - shot.h / 2, shot.w, shot.h);
}

function drawMine(ctx, cameraX, mine) {
  const x = sx(cameraX, mine.x);
  if (x === null) return;
  const y = sy(mine.y);
  ctx.strokeStyle = COLOURS.mine;
  ctx.lineWidth = 2;
  const r = mine.w / 2 + 3;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + mine.life;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.stroke();
}

function drawHumanoid(ctx, cameraX, h) {
  if (h.dead) return;
  const x = sx(cameraX, h.x);
  if (x === null) return;
  const y = sy(h.y);
  ctx.strokeStyle = COLOURS.humanoid;
  ctx.lineWidth = 2;
  const hh = HUMANOID.HEIGHT / 2;
  ctx.beginPath();
  ctx.moveTo(x, y - hh);
  ctx.lineTo(x, y + hh * 0.2);
  ctx.moveTo(x - 4, y + hh);
  ctx.lineTo(x, y + hh * 0.2);
  ctx.lineTo(x + 4, y + hh);
  ctx.moveTo(x - 5, y - hh * 0.3);
  ctx.lineTo(x + 5, y - hh * 0.3);
  ctx.stroke();

  // A carried humanoid gets a tether, so the abduction is legible from a
  // distance rather than looking like an enemy that happens to be nearby.
  if (h.state === HumanoidState.CARRIED && h.captor && !h.captor.dead) {
    ctx.strokeStyle = COLOURS.hudDim;
    ctx.beginPath();
    ctx.moveTo(x, y - hh);
    ctx.lineTo(x, sy(h.captor.y));
    ctx.stroke();
  }
}

function drawEnemy(ctx, cameraX, e) {
  if (e.dead) return;
  const x = sx(cameraX, e.x);
  if (x === null) return;
  const y = sy(e.y);
  const hw = e.w / 2;
  const hh = e.h / 2;

  switch (e.kind) {
    case 'lander':
      ctx.strokeStyle = COLOURS.lander;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - hw, y + hh);
      ctx.lineTo(x - hw * 0.5, y - hh * 0.2);
      ctx.lineTo(x, y - hh);
      ctx.lineTo(x + hw * 0.5, y - hh * 0.2);
      ctx.lineTo(x + hw, y + hh);
      ctx.moveTo(x - hw * 0.6, y + hh * 0.2);
      ctx.lineTo(x + hw * 0.6, y + hh * 0.2);
      ctx.stroke();
      break;

    case 'mutant':
      ctx.fillStyle = COLOURS.mutant;
      ctx.beginPath();
      ctx.moveTo(x, y - hh);
      ctx.lineTo(x + hw, y);
      ctx.lineTo(x + hw * 0.3, y + hh);
      ctx.lineTo(x - hw * 0.3, y + hh);
      ctx.lineTo(x - hw, y);
      ctx.closePath();
      ctx.fill();
      break;

    case 'baiter':
      ctx.fillStyle = COLOURS.baiter;
      ctx.beginPath();
      ctx.moveTo(x - hw, y);
      ctx.lineTo(x, y - hh);
      ctx.lineTo(x + hw, y);
      ctx.lineTo(x, y + hh);
      ctx.closePath();
      ctx.fill();
      break;

    case 'bomber':
      ctx.strokeStyle = COLOURS.bomber;
      ctx.lineWidth = 2;
      ctx.strokeRect(x - hw, y - hh, e.w, e.h);
      ctx.beginPath();
      ctx.moveTo(x - hw, y - hh);
      ctx.lineTo(x + hw, y + hh);
      ctx.moveTo(x + hw, y - hh);
      ctx.lineTo(x - hw, y + hh);
      ctx.stroke();
      break;

    case 'pod':
      ctx.strokeStyle = COLOURS.pod;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, hw, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, hw * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case 'swarmer':
    default:
      ctx.fillStyle = COLOURS.swarmer;
      ctx.fillRect(x - hw, y - hh, e.w, e.h);
      break;
  }
}

function drawParticle(ctx, cameraX, p) {
  const x = sx(cameraX, p.x);
  if (x === null) return;
  const y = sy(p.y);
  ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
  ctx.strokeStyle = p.colour;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - p.vx * 0.02, y - p.vy * 0.02);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
