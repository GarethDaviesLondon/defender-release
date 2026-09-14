// Touch input, wearing the same face as the keyboard.
//
// It exports exactly the contract `src/core/input.js` does: isDown, wasPressed,
// hasInteracted, endFrame, destroy. `readIntent` therefore takes it unchanged,
// and no game logic knows a finger from a key. That seam already existed because
// KI-04 forced the intent mapping out of main.js; this is what it was worth.
//
// Two things make touch harder than a keyboard, and both are handled here rather
// than leaking outward.
//
// A finger has an identity. Several are down at once, and the player expects to
// turn, climb and fire together, so each touch is tracked by its
// `Touch.identifier` and the set of pressed actions is rebuilt from all of them.
// A source that only looked at the most recent touch would make the game feel
// broken in exactly the way a player cannot articulate.
//
// A finger also slides. Drag off a button and it should release; drag onto one
// and it should press. That falls out of re-resolving every active touch to a
// control on every move, rather than binding a touch to whatever it first hit.

import { controlAt } from '../systems/layout.js';

export function createTouch(target, getLayout, { onFirstTouch } = {}) {
  // touch identifier -> action name currently under that finger
  const active = new Map();
  const pressedThisFrame = new Set();
  let anyTouchYet = false;
  let autoFire = false;

  function resolve(touch) {
    const layout = getLayout();
    if (!layout) return null;
    const rect = target.getBoundingClientRect
      ? target.getBoundingClientRect()
      : { left: 0, top: 0 };
    const control = controlAt(
      layout,
      touch.clientX - rect.left,
      touch.clientY - rect.top,
    );
    return control ? control.action : null;
  }

  function press(id, action) {
    const previous = active.get(id);
    if (previous === action) return;
    if (action) {
      active.set(id, action);
      if (!heldElsewhere(action, id)) pressedThisFrame.add(action);
    } else {
      active.delete(id);
    }
  }

  /** Is this action already held by some other finger. Without this, a second
   *  finger landing on a button already held would fire `wasPressed` again. */
  function heldElsewhere(action, exceptId) {
    for (const [id, held] of active) {
      if (id !== exceptId && held === action) return true;
    }
    return false;
  }

  function onStart(event) {
    event.preventDefault();
    if (!anyTouchYet && onFirstTouch) onFirstTouch();
    anyTouchYet = true;
    for (const touch of event.changedTouches) {
      const action = resolve(touch);
      // A touch that hits no button is still a tap, and the attract screen
      // needs one to start the game.
      press(touch.identifier, action ?? 'start');
    }
    handleToggles();
  }

  function onMove(event) {
    event.preventDefault();
    for (const touch of event.changedTouches) {
      if (!active.has(touch.identifier)) continue;
      const action = resolve(touch);
      // A finger that started on a button and slid into empty space releases;
      // it does not become a fresh tap on 'start'.
      press(touch.identifier, action);
    }
  }

  function onEnd(event) {
    event.preventDefault();
    for (const touch of event.changedTouches) active.delete(touch.identifier);
  }

  /** `autoFire` is a latch, not a button: it stays on once tapped. Handled here
   *  so the rest of the game never sees a control that behaves differently from
   *  the others. */
  function handleToggles() {
    if (pressedThisFrame.has('autoFire')) autoFire = !autoFire;
  }

  const options = { passive: false };
  target.addEventListener('touchstart', onStart, options);
  target.addEventListener('touchmove', onMove, options);
  target.addEventListener('touchend', onEnd, options);
  target.addEventListener('touchcancel', onEnd, options);

  return {
    isDown(action) {
      if (action === 'fire' && autoFire) return true;
      for (const held of active.values()) if (held === action) return true;
      return false;
    },
    wasPressed(action) {
      return pressedThisFrame.has(action);
    },
    hasInteracted() {
      return anyTouchYet;
    },
    endFrame() {
      pressedThisFrame.clear();
    },
    destroy() {
      target.removeEventListener('touchstart', onStart, options);
      target.removeEventListener('touchmove', onMove, options);
      target.removeEventListener('touchend', onEnd, options);
      target.removeEventListener('touchcancel', onEnd, options);
      active.clear();
    },

    // --- For the renderer, so a pressed button can look pressed ---
    isPressed(action) {
      if (action === 'autoFire') return autoFire;
      for (const held of active.values()) if (held === action) return true;
      return false;
    },
    get autoFire() {
      return autoFire;
    },
  };
}

/**
 * Present two input sources as one.
 *
 * A tablet has both, and a player should be able to use either without the game
 * choosing for them. Held state is the union; a press from either counts.
 */
export function combineInputs(...sources) {
  const live = sources.filter(Boolean);
  return {
    isDown: (action) => live.some((s) => s.isDown(action)),
    wasPressed: (action) => live.some((s) => s.wasPressed(action)),
    hasInteracted: () => live.some((s) => s.hasInteracted()),
    endFrame: () => live.forEach((s) => s.endFrame()),
    destroy: () => live.forEach((s) => s.destroy()),
  };
}
