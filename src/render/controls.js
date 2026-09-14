// Drawing the on-screen controls, and the prompt to turn the phone round.
//
// The buttons are drawn on the canvas rather than laid out as DOM elements. They
// then scale with everything else automatically, cannot drift out of alignment
// with the rectangles the touch code hit-tests against (both read the same
// layout), and add no elements for a stray tap to select or focus.
//
// Everything here works in screen pixels, not the game's virtual coordinates:
// the caller resets the transform before calling in.

import { COLOURS, CONTROLS } from '../config/tuning.js';

export function drawControls(ctx, layout, touch) {
  if (!layout.controls.length) return;

  ctx.save();
  for (const control of layout.controls) {
    const pressed = touch ? touch.isPressed(control.action) : false;
    drawButton(ctx, control, pressed);
  }
  ctx.restore();
}

function drawButton(ctx, control, pressed) {
  const { x, y, w, h, shape, label } = control;
  const on = control.action === 'autoFire' && pressed;

  ctx.globalAlpha = pressed ? CONTROLS.OPACITY_PRESSED : CONTROLS.OPACITY;
  ctx.strokeStyle = on
    ? COLOURS.controlOn
    : pressed
      ? COLOURS.controlPressed
      : COLOURS.control;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = Math.max(1.5, Math.min(w, h) * 0.05);

  if (shape === 'round') {
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shape === 'pad') {
    // A rounded square, drawn as a path rather than with roundRect, which is
    // not available everywhere this has to run.
    strokeRounded(ctx, x, y, w, h, Math.min(w, h) * 0.22);
  } else {
    strokeRounded(ctx, x, y, w, h, Math.min(w, h) * 0.3);
  }

  // Labels sit at full strength: a control you cannot read is a control you
  // cannot use, and the dimming is there to keep the buttons off the game, not
  // to hide what they do.
  ctx.globalAlpha = pressed ? 1 : 0.75;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = shape === 'pad' || shape === 'round'
    ? Math.min(w, h) * 0.42
    : Math.min(h * 0.52, w * 0.28);
  ctx.font = `bold ${Math.round(size)}px "Courier New", monospace`;
  ctx.fillText(label, x + w / 2, y + h / 2 + size * 0.04);
}

function strokeRounded(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.stroke();
}

/** A phone held upright gives the game a box too small to read, and this is a
 *  side-scroller across six screens. Ask for landscape rather than render
 *  something unplayable and let the player conclude the game is broken. */
export function drawRotatePrompt(ctx, layout) {
  const cx = layout.screenW / 2;
  const cy = layout.screenH / 2;
  const unit = Math.min(layout.screenW, layout.screenH);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.strokeStyle = COLOURS.hud;
  ctx.lineWidth = Math.max(2, unit * 0.012);
  const pw = unit * 0.38;
  const ph = pw * 0.6;
  ctx.strokeRect(cx - pw / 2, cy - ph / 2 - unit * 0.08, pw, ph);

  ctx.fillStyle = COLOURS.hud;
  ctx.font = `bold ${Math.round(unit * 0.075)}px "Courier New", monospace`;
  ctx.fillText('TURN YOUR PHONE', cx, cy + unit * 0.14);

  ctx.fillStyle = COLOURS.hudDim;
  ctx.font = `${Math.round(unit * 0.05)}px "Courier New", monospace`;
  ctx.fillText('Defender needs landscape', cx, cy + unit * 0.24);
  ctx.restore();
}
