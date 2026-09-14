// The scanner: the whole world, squashed into the top band.
//
// This is the real interface of Defender. The player cannot see the world, so
// they play the scanner and use the viewport to shoot. One rule governs it: the
// scanner must never lie. If an entity exists, it is on the scanner. An enemy
// that is invisible up there is an enemy that arrives from nowhere, and the
// game stops being fair (functional spec, section 13).

import {
  SCANNER_TOP,
  SCANNER_HEIGHT,
  VIEW_WIDTH,
  VIEW_HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  COLOURS,
} from '../config/tuning.js';
import { wrapX } from '../core/world.js';

const SCALE_X = VIEW_WIDTH / WORLD_WIDTH; // 1/6
const SCALE_Y = SCANNER_HEIGHT / WORLD_HEIGHT; // 3/16

const DOT_COLOURS = {
  lander: COLOURS.lander,
  mutant: COLOURS.mutant,
  baiter: COLOURS.baiter,
  bomber: COLOURS.bomber,
  pod: COLOURS.pod,
  swarmer: COLOURS.swarmer,
};

function scanX(worldX) {
  return wrapX(worldX) * SCALE_X;
}

function scanY(worldY) {
  return SCANNER_TOP + worldY * SCALE_Y;
}

export function drawScanner(ctx, game) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, SCANNER_TOP, VIEW_WIDTH, SCANNER_HEIGHT);
  ctx.clip();

  ctx.fillStyle = COLOURS.background;
  ctx.fillRect(0, SCANNER_TOP, VIEW_WIDTH, SCANNER_HEIGHT);

  drawScannerTerrain(ctx, game);

  for (const h of game.humanoids) {
    if (h.dead) continue;
    dot(ctx, h.x, h.y, COLOURS.humanoid, 2);
  }
  for (const m of game.mines) dot(ctx, m.x, m.y, COLOURS.mine, 2);
  for (const e of game.enemies) {
    dot(ctx, e.x, e.y, DOT_COLOURS[e.kind] ?? COLOURS.hud, 3);
  }
  if (!game.ship.dead) dot(ctx, game.ship.x, game.ship.y, COLOURS.ship, 4);

  drawViewportBox(ctx, game.camera.x);

  ctx.strokeStyle = COLOURS.hudDim;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, SCANNER_TOP + SCANNER_HEIGHT - 0.5);
  ctx.lineTo(VIEW_WIDTH, SCANNER_TOP + SCANNER_HEIGHT - 0.5);
  ctx.stroke();

  ctx.restore();
}

function dot(ctx, worldX, worldY, colour, size) {
  ctx.fillStyle = colour;
  ctx.fillRect(scanX(worldX) - size / 2, scanY(worldY) - size / 2, size, size);
}

function drawScannerTerrain(ctx, game) {
  ctx.strokeStyle = game.planetDestroyed
    ? COLOURS.terrainBarren
    : COLOURS.terrain;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const n = game.terrain.length;
  for (let i = 0; i <= n; i++) {
    const h = game.terrain[i % n];
    const x = (i / n) * VIEW_WIDTH;
    const y = scanY(WORLD_HEIGHT - h);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/** The box showing what the play viewport covers. It is drawn in two pieces
 *  when it straddles x = 0, because a single rectangle cannot wrap. */
function drawViewportBox(ctx, cameraX) {
  const left = scanX(cameraX);
  const width = VIEW_WIDTH * SCALE_X; // one viewport, in scanner pixels
  const top = SCANNER_TOP + 1;
  const height = VIEW_HEIGHT * SCALE_Y - 2;

  ctx.strokeStyle = COLOURS.scannerBox;
  ctx.lineWidth = 1;

  if (left + width <= VIEW_WIDTH) {
    ctx.strokeRect(left + 0.5, top + 0.5, width, height);
    return;
  }
  const firstWidth = VIEW_WIDTH - left;
  ctx.strokeRect(left + 0.5, top + 0.5, firstWidth, height);
  ctx.strokeRect(0.5, top + 0.5, width - firstWidth, height);
}
