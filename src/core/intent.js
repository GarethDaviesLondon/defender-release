// Keyboard state to ship intent.
//
// This lived inside main.js and was therefore untestable, which is exactly how
// KI-04 shipped: the arrow keys were wired to the cabinet's buttons rather than
// to directions, so the left arrow flipped the ship once and never accelerated
// it. No unit test could have caught that, because the mapping was not in a
// module a test could reach.
//
// It takes anything with `isDown` and `wasPressed`, so a test can pass a plain
// object instead of a real keyboard.
//
// Pure. No DOM.

import { emptyIntent } from '../entities/ship.js';

export function readIntent(input) {
  const intent = emptyIntent();

  const left = input.isDown('moveLeft');
  const right = input.isDown('moveRight');

  // A directional key means turn that way and go: it sets facing outright and
  // thrusts, in one action. Holding both cancels out, keeping the current
  // facing rather than picking one arbitrarily.
  if (left !== right) intent.face = right ? 1 : -1;

  // Thrust comes from either scheme: the cabinet's own THRUST button, or a
  // directional key. The ship cannot tell the difference and should not.
  intent.thrust = input.isDown('thrust') || left || right;

  intent.up = input.isDown('up');
  intent.down = input.isDown('down');

  // The reverse toggle is edge-triggered: held, it would flutter. Everything
  // above is level-triggered, because holding thrust must keep thrusting.
  intent.flip = input.wasPressed('reverse');

  intent.fire = input.isDown('fire');
  intent.bomb = input.wasPressed('smartBomb');
  intent.hyperspace = input.wasPressed('hyperspace');

  return intent;
}
