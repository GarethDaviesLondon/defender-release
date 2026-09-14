// Keyboard input, edge-aware.
//
// Two different questions get asked of the keyboard, and answering only one of
// them is a common bug. Thrust asks "is it held right now". Flip, fire and
// hyperspace ask "was it pressed since the last frame". A system that only
// tracks held state makes a tapped flip key flutter; one that only tracks
// presses makes thrust unusable.
//
// Key mapping follows the functional spec, section 15.

// Two control schemes over the same ship, on purpose.
//
// `thrust` and `reverse` are the arcade cabinet's own: a THRUST button that
// pushes whichever way you face, and a REVERSE button that flips you. That is
// the authentic feel and it is what Z and X do.
//
// `moveLeft` and `moveRight` are what anyone sitting at a keyboard expects an
// arrow key to mean: go that way. They turn the ship and thrust in one action.
// Mapping the arrows onto the cabinet's buttons instead made the left arrow a
// flip toggle that fired once and never accelerated, so moving left meant
// tapping Left and then holding Right (KI-04).
const ACTIONS = {
  thrust: ['KeyZ'],
  reverse: ['KeyX'],
  moveLeft: ['ArrowLeft'],
  moveRight: ['ArrowRight'],
  up: ['ArrowUp', 'KeyQ'],
  down: ['ArrowDown', 'KeyA'],
  fire: ['Space', 'ControlLeft', 'ControlRight'],
  smartBomb: ['KeyS', 'ShiftLeft', 'ShiftRight'],
  hyperspace: ['KeyH'],
  pause: ['KeyP'],
  mute: ['KeyM'],
  start: ['Enter', 'Space'],
};

// Keys the browser would otherwise act on: arrows and space scroll the page.
const SWALLOW = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
]);

export function createInput(target = window) {
  const held = new Set();
  const pressedThisFrame = new Set();
  let anyKeyYet = false;

  function onKeyDown(e) {
    if (SWALLOW.has(e.code)) e.preventDefault();
    if (e.repeat) return; // auto-repeat is not a new press
    anyKeyYet = true;
    held.add(e.code);
    pressedThisFrame.add(e.code);
  }

  function onKeyUp(e) {
    if (SWALLOW.has(e.code)) e.preventDefault();
    held.delete(e.code);
  }

  // A tab switch drops the keyup, leaving a key stuck down for ever.
  function onBlur() {
    held.clear();
  }

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);

  return {
    /** Is the action's key down right now. */
    isDown(action) {
      return ACTIONS[action].some((code) => held.has(code));
    },
    /** Did the action's key go down since the last endFrame(). */
    wasPressed(action) {
      return ACTIONS[action].some((code) => pressedThisFrame.has(code));
    },
    /** Has the player touched the keyboard at all yet. Audio needs this,
     *  because browsers block sound before a user gesture. */
    hasInteracted() {
      return anyKeyYet;
    },
    /** Clear the per-frame edge set. Call once at the end of every update. */
    endFrame() {
      pressedThisFrame.clear();
    },
    destroy() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
    },
  };
}
