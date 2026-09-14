// The game state machine.
//
// Pure: state and events in, new state out. It advances timers, counts waves
// and lives, and decides what phase the game is in. It draws nothing, owns no
// entities, and imports nothing that touches the DOM, which is what makes it
// testable (functional spec, sections 12 and 17.7).
//
// Every transition returns a new object rather than mutating in place. That
// costs an allocation per frame and buys a state machine that cannot be
// corrupted halfway through a transition by something holding a stale
// reference.

import { TIMING, SHIP } from '../config/tuning.js';

export const Phase = {
  ATTRACT: 'ATTRACT',
  PLAYING: 'PLAYING',
  DYING: 'DYING',
  WAVE_CLEARED: 'WAVE_CLEARED',
  GAME_OVER: 'GAME_OVER',
  PAUSED: 'PAUSED',
};

export function createGameState() {
  return {
    phase: Phase.ATTRACT,
    timer: 0, // time in the current phase
    waveTime: 0, // time since this wave started; drives Baiter arrivals
    wave: 1,
    lives: SHIP.START_LIVES,
    score: 0,
    resumePhase: null, // what to go back to when unpausing
    // Set for one frame when the machine wants the world rebuilt. The caller
    // acts on it and it is cleared by the next advance.
    startWave: false,
    respawn: false,
    // Set for one frame on every start. Start is accepted from GAME_OVER as
    // well as ATTRACT, so the caller cannot infer a new game from the phase it
    // left: it must rebuild the world whenever this is set (KI-08).
    newGame: false,
  };
}

/** Apply events, then let time pass. Events are applied first so a death and
 *  the frame it happened in do not race. */
export function advance(state, dt, events = []) {
  let s = { ...state, startWave: false, respawn: false, newGame: false };
  for (const event of events) s = applyEvent(s, event);
  return tick(s, dt);
}

function applyEvent(s, event) {
  switch (event.type) {
    case 'start':
      if (s.phase !== Phase.ATTRACT && s.phase !== Phase.GAME_OVER) return s;
      return {
        ...createGameState(),
        phase: Phase.PLAYING,
        startWave: true,
        newGame: true,
      };

    case 'shipDestroyed': {
      if (s.phase !== Phase.PLAYING) return s;
      return { ...s, phase: Phase.DYING, timer: 0, lives: s.lives - 1 };
    }

    case 'waveCleared':
      if (s.phase !== Phase.PLAYING) return s;
      return { ...s, phase: Phase.WAVE_CLEARED, timer: 0 };

    case 'pause':
      if (s.phase === Phase.PAUSED) {
        return { ...s, phase: s.resumePhase ?? Phase.PLAYING, resumePhase: null };
      }
      if (s.phase !== Phase.PLAYING) return s;
      return { ...s, phase: Phase.PAUSED, resumePhase: s.phase };

    case 'addScore':
      return { ...s, score: s.score + (event.points ?? 0) };

    // Lives live here and nowhere else, so the HUD and the game-over condition
    // cannot disagree (see state/scoring.js).
    case 'addLife':
      return { ...s, lives: Math.min(s.lives + 1, SHIP.MAX_LIVES) };

    default:
      return s;
  }
}

function tick(s, dt) {
  // Paused freezes every clock. A Baiter must not arrive while the player is
  // reading the pause overlay.
  if (s.phase === Phase.PAUSED) return s;

  const timer = s.timer + dt;

  switch (s.phase) {
    case Phase.PLAYING:
      return { ...s, timer, waveTime: s.waveTime + dt };

    case Phase.DYING:
      if (timer < TIMING.DYING_HOLD) return { ...s, timer };
      if (s.lives > 0) {
        return { ...s, phase: Phase.PLAYING, timer: 0, respawn: true };
      }
      return { ...s, phase: Phase.GAME_OVER, timer: 0 };

    case Phase.WAVE_CLEARED:
      if (timer < TIMING.WAVE_CLEARED_HOLD) return { ...s, timer };
      return {
        ...s,
        phase: Phase.PLAYING,
        timer: 0,
        waveTime: 0,
        wave: s.wave + 1,
        startWave: true,
      };

    case Phase.GAME_OVER:
      if (timer < TIMING.GAME_OVER_HOLD) return { ...s, timer };
      return { ...createGameState(), phase: Phase.ATTRACT };

    case Phase.ATTRACT:
    default:
      return { ...s, timer };
  }
}

/** Does the simulation run in this phase. */
export function isSimulating(phase) {
  return phase === Phase.PLAYING || phase === Phase.DYING;
}
