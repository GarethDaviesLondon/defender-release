// A fixed-timestep game loop.
//
// The simulation always advances in steps of FIXED_STEP, whatever the display
// refresh rate, so a 144Hz monitor does not make the game run faster than a
// 60Hz one. Rendering happens once per animation frame.
//
// The accumulator is clamped to MAX_ACCUMULATOR. Without that clamp, a long
// stall (a background tab, a breakpoint) would queue up hundreds of steps and
// the loop would spend longer catching up than the stall itself lasted, which
// never ends well. Clamping means the game skips time rather than freezing.
// That is a deliberate trade of strict determinism for staying responsive, and
// it is recorded in the functional spec, section 19.5.
//
// This module touches requestAnimationFrame, which makes it browser-only, but
// it holds no game rules and nothing imports it in a test.

import { FIXED_STEP, MAX_ACCUMULATOR } from '../config/tuning.js';

/**
 * @param {(dt: number) => void} update  called with a constant dt
 * @param {(alpha: number) => void} render  called once per frame
 */
export function startLoop(update, render) {
  let last = performance.now() / 1000;
  let accumulator = 0;
  let running = true;

  function frame(nowMs) {
    if (!running) return;
    const now = nowMs / 1000;
    let frameTime = now - last;
    last = now;

    if (frameTime > MAX_ACCUMULATOR) frameTime = MAX_ACCUMULATOR;
    accumulator += frameTime;

    while (accumulator >= FIXED_STEP) {
      update(FIXED_STEP);
      accumulator -= FIXED_STEP;
    }

    render(accumulator / FIXED_STEP);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  return {
    stop() {
      running = false;
    },
  };
}
