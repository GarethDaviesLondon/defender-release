// Score and smart bombs.
//
// Pure: numbers and the rules for changing them. It knows nothing about
// entities, drawing or time. Every value comes from the functional spec,
// section 11, by way of the tuning module.
//
// Lives deliberately live in the state machine (state/game.js) and not here.
// Two modules that both think they own the life count is exactly the kind of
// split ownership that produces a game where the HUD and the game-over
// condition disagree. This module reports that a life has been earned; the
// machine is the one place that adds or removes one.
//
// The awkward case this module exists to get right is the extra-life
// threshold. A smart bomb that kills eight enemies at once can push the score
// past two thresholds in a single call, and the obvious implementation ("if the
// score crossed the next multiple, award one") silently loses the second. It is
// tested (functional spec, 17.4).

import { SCORE, SHIP } from '../config/tuning.js';

const ENEMY_SCORES = {
  lander: SCORE.LANDER,
  mutant: SCORE.MUTANT,
  baiter: SCORE.BAITER,
  bomber: SCORE.BOMBER,
  pod: SCORE.POD,
  swarmer: SCORE.SWARMER,
  mine: SCORE.MINE,
};

/** What an enemy of this kind is worth. An unknown kind scores nothing rather
 *  than throwing: a missing entry should not end the game. */
export function scoreFor(kind) {
  return ENEMY_SCORES[kind] ?? 0;
}

export function createScoreState() {
  return {
    score: 0,
    bombs: SHIP.START_BOMBS,
    // The highest 10,000 boundary already paid out. Tracking this, rather than
    // recomputing from the score each time, is what makes a double crossing
    // pay twice.
    thresholdsAwarded: 0,
  };
}

/**
 * Add points.
 * @returns the number of extra-life bonuses earned by this call, which may be
 *   more than one. The caller adds the lives and the bombs, because the life
 *   count lives in the state machine.
 */
export function addScore(state, points) {
  if (points <= 0) return 0;
  state.score += points;

  const earned = Math.floor(state.score / SCORE.EXTRA_LIFE_EVERY);
  const owed = earned - state.thresholdsAwarded;
  if (owed <= 0) return 0;

  state.thresholdsAwarded = earned;
  for (let i = 0; i < owed; i++) addBomb(state);
  return owed;
}

/** One smart bomb, capped. Used by the score threshold and by every fifth
 *  wave. */
export function addBomb(state) {
  state.bombs = Math.min(state.bombs + 1, SHIP.MAX_BOMBS);
  return state.bombs;
}

export function spendBomb(state) {
  if (state.bombs <= 0) return false;
  state.bombs -= 1;
  return true;
}

/** Is this wave one of the ones that grants a bonus. */
export function isBonusWave(waveNumber) {
  return waveNumber > 0 && waveNumber % SCORE.BONUS_WAVE_INTERVAL === 0;
}

/** End-of-wave bonus: 100 per surviving humanoid, times the wave number. */
export function waveBonus(humanoidsAlive, waveNumber) {
  return humanoidsAlive * SCORE.WAVE_BONUS_PER_HUMANOID * waveNumber;
}
