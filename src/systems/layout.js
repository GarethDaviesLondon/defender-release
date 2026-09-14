// Where the game and the controls go, for any screen.
//
// One pure function decides the whole arrangement, and both the renderer and the
// touch input read it. That matters more than it looks: if drawing a button and
// deciding whether a finger hit it used two different sets of rectangles, they
// would drift, and the buttons would stop matching where they appear. Hit
// testing and drawing come from here, or they come from nowhere.
//
// The trick for a phone is the order of operations. Reserve the control gutters
// first, then fit the game into what is left. A phone in landscape is about
// 19.5:9 and the game is 3:2, so today it letterboxes with dead bars either
// side. Taking the gutters out of that dead space costs the play area nothing.
//
// Pure. No DOM.

import {
  VIRTUAL_WIDTH,
  VIRTUAL_HEIGHT,
  CONTROLS,
} from '../config/tuning.js';

/**
 * @param screenW  the canvas width in device-independent pixels
 * @param screenH  the canvas height
 * @param options  { touch } whether to reserve gutters and place controls
 * @returns {{
 *   scale: number, gameX: number, gameY: number,
 *   gameW: number, gameH: number, gutter: number,
 *   controls: Array<{action: string, x: number, y: number, w: number, h: number,
 *                    label: string, shape: string}>
 * }}
 */
export function computeLayout(screenW, screenH, options = {}) {
  const touch = !!options.touch;

  // Guard the degenerate cases rather than dividing by them. A canvas can be
  // reported as zero-sized mid-resize, and a zero or negative scale would put
  // NaN through every draw call downstream.
  const w = Number.isFinite(screenW) && screenW > 0 ? screenW : 1;
  const h = Number.isFinite(screenH) && screenH > 0 ? screenH : 1;

  // A notch and a home indicator eat the edges, and in landscape the notch is on
  // one side: exactly where a thumb goes. Inset the usable area rather than
  // drawing a button underneath the hardware.
  const inset = normaliseInsets(options.insets, w, h);
  const usableW = Math.max(1, w - inset.left - inset.right);
  const usableH = Math.max(1, h - inset.top - inset.bottom);

  // Reserve the gutters first, but never more than a third of the screen each:
  // on a very narrow window the controls must not squeeze the game out.
  let gutter = 0;
  if (touch) {
    const wanted = usableW * CONTROLS.GUTTER_FRACTION;
    gutter = Math.min(
      Math.max(wanted, CONTROLS.GUTTER_MIN),
      CONTROLS.GUTTER_MAX,
      usableW / 3,
    );
  }

  const availableW = Math.max(1, usableW - gutter * 2);
  const scale = Math.min(availableW / VIRTUAL_WIDTH, usableH / VIRTUAL_HEIGHT);
  const gameW = VIRTUAL_WIDTH * scale;
  const gameH = VIRTUAL_HEIGHT * scale;
  // Centre within the usable area, not the screen, so a one-sided notch does
  // not push the game off centre to the eye.
  const gameX = inset.left + (usableW - gameW) / 2;
  const gameY = inset.top + (usableH - gameH) / 2;

  return {
    screenW: w,
    screenH: h,
    inset,
    scale,
    gameX,
    gameY,
    gameW,
    gameH,
    gutter,
    controls: touch ? placeControls(inset, usableW, usableH, gutter) : [],
  };
}

/** Insets are untrusted: they come from a browser API and are absent on most
 *  devices. Anything not a sensible number is treated as zero, and the total is
 *  capped so a bad report cannot squeeze the screen out of existence. */
function normaliseInsets(insets, w, h) {
  const clean = (v, limit) =>
    Number.isFinite(v) && v > 0 ? Math.min(v, limit) : 0;
  const source = insets ?? {};
  return {
    left: clean(source.left, w * 0.2),
    right: clean(source.right, w * 0.2),
    top: clean(source.top, h * 0.2),
    bottom: clean(source.bottom, h * 0.2),
  };
}

/**
 * The buttons, in screen coordinates.
 *
 * Left thumb gets movement as a four-way pad, right thumb gets the weapons.
 * That split is the conventional one and it maps exactly onto the keyboard
 * actions already defined, so `readIntent` needs no special case: left and right
 * are `moveLeft` and `moveRight`, which already mean turn and thrust.
 *
 * Seven keyboard actions become six buttons because `thrust` on its own is not
 * needed: the direction buttons already thrust, exactly as the arrow keys do.
 */
function placeControls(inset, usableW, usableH, gutter) {
  const controls = [];
  if (gutter <= 0) return controls;

  // Work in screen coordinates, offset past the insets.
  const left = inset.left;
  const top = inset.top;
  const w = usableW;
  const h = usableH;

  const pad = gutter * 0.08;
  const halfGutter = (gutter - pad * 2) / 2;

  // --- Left: a four-way pad, sat low where a thumb rests ---
  const padSize = Math.min(gutter - pad * 2, h * 0.62);
  const padCx = left + gutter / 2;
  const padCy = top + h - padSize / 2 - pad - h * CONTROLS.THUMB_DROP;
  // Arms sit on a spacing grid and are drawn slightly smaller than their cell,
  // so there is a visible gap between them. Butted-up buttons read as one shape
  // and leave no room for error either side of the boundary.
  const spacing = padSize / 3;
  const arm = spacing * 0.92;
  const cell = (cx, cy) => ({ x: cx - arm / 2, y: cy - arm / 2, w: arm, h: arm });

  controls.push(
    { action: 'up', label: '▲', shape: 'pad', ...cell(padCx, padCy - spacing) },
    { action: 'down', label: '▼', shape: 'pad', ...cell(padCx, padCy + spacing) },
    { action: 'moveLeft', label: '◀', shape: 'pad', ...cell(padCx - spacing, padCy) },
    { action: 'moveRight', label: '▶', shape: 'pad', ...cell(padCx + spacing, padCy) },
  );

  // --- Right: fire large and lowest, because it is used most ---
  const rx = left + w - gutter;
  const fireSize = Math.min(gutter - pad * 2, h * 0.34);
  const fireCy = top + h - fireSize / 2 - pad - h * CONTROLS.THUMB_DROP;

  controls.push({
    action: 'fire', label: 'FIRE', shape: 'round',
    x: rx + (gutter - fireSize) / 2, y: fireCy - fireSize / 2,
    w: fireSize, h: fireSize,
  });

  const smallH = Math.min(halfGutter * 0.8, h * 0.13);
  const smallW = gutter - pad * 2;
  const stackBottom = fireCy - fireSize / 2 - pad;

  controls.push(
    { action: 'smartBomb', label: 'BOMB', shape: 'rect',
      x: rx + pad, y: stackBottom - smallH, w: smallW, h: smallH },
    { action: 'hyperspace', label: 'HYPER', shape: 'rect',
      x: rx + pad, y: stackBottom - smallH * 2 - pad, w: smallW, h: smallH },
    { action: 'autoFire', label: 'AUTO', shape: 'toggle',
      x: rx + pad, y: top + pad, w: smallW, h: smallH * 0.8 },
  );

  // --- Pause, top left, small and out of the way of a resting thumb ---
  controls.push({
    action: 'pause', label: 'II', shape: 'rect',
    x: left + pad, y: top + pad, w: smallW, h: smallH * 0.8,
  });

  return controls;
}

/** Which control, if any, is under a screen point. Buttons are given a margin
 *  of forgiveness, because a fingertip is far bigger than a pixel and the thing
 *  it covers is the thing it cannot see. */
export function controlAt(layout, x, y) {
  const slop = layout.gutter * CONTROLS.TOUCH_SLOP;
  for (const c of layout.controls) {
    if (
      x >= c.x - slop && x <= c.x + c.w + slop &&
      y >= c.y - slop && y <= c.y + c.h + slop
    ) {
      return c;
    }
  }
  return null;
}

/** Does a rectangle overlap the game box. Nothing should: the gutters are
 *  reserved before the game is fitted, and this is how that is checked. */
export function overlapsGame(layout, rect) {
  return (
    rect.x < layout.gameX + layout.gameW &&
    rect.x + rect.w > layout.gameX &&
    rect.y < layout.gameY + layout.gameH &&
    rect.y + rect.h > layout.gameY
  );
}
