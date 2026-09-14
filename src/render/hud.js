// The status band and the full-screen overlays.
//
// The status band answers, at a glance, the four questions a player has mid-
// wave: how am I doing, how many chances left, how much panic button is left,
// and how many humanoids are still down there. The last one matters most and is
// the one an arcade HUD usually leaves out (functional spec, section 3).

import {
  VIRTUAL_WIDTH,
  VIRTUAL_HEIGHT,
  STATUS_TOP,
  STATUS_HEIGHT,
  VIEW_TOP,
  VIEW_WIDTH,
  VIEW_HEIGHT,
  COLOURS,
} from '../config/tuning.js';
import { Phase } from '../state/game.js';

const FONT = 'bold 16px "Courier New", "DejaVu Sans Mono", monospace';
const BIG = 'bold 40px "Courier New", "DejaVu Sans Mono", monospace';
const MID = 'bold 22px "Courier New", "DejaVu Sans Mono", monospace';

export function drawHud(ctx, game) {
  const { state, scoreState, humanoidsAlive } = game;

  ctx.fillStyle = COLOURS.background;
  ctx.fillRect(0, STATUS_TOP, VIRTUAL_WIDTH, STATUS_HEIGHT);

  ctx.font = FONT;
  ctx.textBaseline = 'middle';
  const y = STATUS_TOP + STATUS_HEIGHT / 2;

  ctx.textAlign = 'left';
  ctx.fillStyle = COLOURS.hud;
  ctx.fillText(String(state.score).padStart(7, '0'), 16, y);

  // Lives come from the state machine, bombs from the score state: one owner
  // each, so the HUD and the game-over condition cannot disagree.
  ctx.fillStyle = COLOURS.ship;
  ctx.fillText(`SHIPS ${state.lives}`, 160, y);

  ctx.fillStyle = COLOURS.shot;
  ctx.fillText(`BOMBS ${scoreState.bombs}`, 280, y);

  ctx.textAlign = 'center';
  ctx.fillStyle = COLOURS.hud;
  ctx.fillText(`WAVE ${state.wave}`, VIRTUAL_WIDTH / 2 + 60, y);

  ctx.textAlign = 'right';
  ctx.fillStyle = game.planetDestroyed ? COLOURS.mutant : COLOURS.humanoid;
  ctx.fillText(
    game.planetDestroyed ? 'PLANET LOST' : `HUMANOIDS ${humanoidsAlive}`,
    VIRTUAL_WIDTH - 16,
    y,
  );
}

export function drawOverlays(ctx, game) {
  const { state } = game;

  if (game.flash > 0) {
    ctx.globalAlpha = Math.min(1, game.flash);
    ctx.fillStyle = COLOURS.flash;
    ctx.fillRect(0, VIEW_TOP, VIEW_WIDTH, VIEW_HEIGHT);
    ctx.globalAlpha = 1;
  }

  switch (state.phase) {
    case Phase.ATTRACT:
      centred(ctx, [
        { text: 'DEFENDER', font: BIG, colour: COLOURS.hud, dy: -110 },
        {
          text: 'PRESS ENTER TO START',
          font: MID,
          colour: COLOURS.ship,
          dy: -50,
        },
        { text: 'LEFT RIGHT  turn and thrust      Z  thrust    X  reverse', font: FONT, colour: COLOURS.hudDim, dy: 10 },
        { text: 'Q A or UP DOWN  climb and dive', font: FONT, colour: COLOURS.hudDim, dy: 36 },
        { text: 'SPACE  fire      S  smart bomb      H  hyperspace', font: FONT, colour: COLOURS.hudDim, dy: 62 },
        { text: 'P  pause      M  mute', font: FONT, colour: COLOURS.hudDim, dy: 88 },
        {
          text: 'save the humanoids. watch the scanner.',
          font: FONT,
          colour: COLOURS.humanoid,
          dy: 130,
        },
      ]);
      break;

    case Phase.PAUSED:
      dim(ctx);
      centred(ctx, [
        { text: 'PAUSED', font: BIG, colour: COLOURS.hud, dy: -20 },
        { text: 'P TO RESUME', font: MID, colour: COLOURS.hudDim, dy: 30 },
      ]);
      break;

    case Phase.WAVE_CLEARED:
      centred(ctx, [
        { text: `WAVE ${state.wave} CLEARED`, font: BIG, colour: COLOURS.hud, dy: -30 },
        {
          text: game.lastBonus > 0 ? `BONUS ${game.lastBonus}` : 'NO HUMANOIDS LEFT',
          font: MID,
          colour: game.lastBonus > 0 ? COLOURS.humanoid : COLOURS.mutant,
          dy: 25,
        },
      ]);
      break;

    case Phase.GAME_OVER:
      dim(ctx);
      centred(ctx, [
        { text: 'GAME OVER', font: BIG, colour: COLOURS.mutant, dy: -30 },
        { text: `FINAL SCORE ${state.score}`, font: MID, colour: COLOURS.hud, dy: 25 },
      ]);
      break;

    default:
      break;
  }

  if (game.muted) {
    ctx.font = FONT;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = COLOURS.hudDim;
    ctx.fillText('MUTED', VIRTUAL_WIDTH - 12, VIRTUAL_HEIGHT - 10);
  }
}

function dim(ctx) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, VIEW_TOP, VIEW_WIDTH, VIEW_HEIGHT);
}

function centred(ctx, lines) {
  const cx = VIRTUAL_WIDTH / 2;
  const cy = VIEW_TOP + VIEW_HEIGHT / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const line of lines) {
    ctx.font = line.font;
    ctx.fillStyle = line.colour;
    ctx.fillText(line.text, cx, cy + line.dy);
  }
}
