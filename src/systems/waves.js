// Wave composition, difficulty scaling and spawn placement.
//
// Difficulty here is a curve, not a multiplier. What changes wave to wave is
// the number and mix of enemies, how fast Landers descend, and how often they
// fire. Enemy speeds themselves do not scale: making everything faster is the
// cheap lever and the least interesting one
// (agents/roles/profiles/game-design.md).
//
// The first five waves are a hand-written table because the opening of the game
// is where the teaching happens, and a formula would not put the Bomber in wave
// 2 and the Pod in wave 3 at the right moment. From wave 6 a formula takes over,
// with caps, so wave 40 is hard rather than impossible.
//
// Honest note: this table is a reasoned guess at the original's feel, not its
// recovered schedule (functional spec, sections 2 and 19.3). It is unproven
// until someone plays it.
//
// Pure. No DOM.

import {
  WAVE,
  WORLD_WIDTH,
  LANDER,
  BAITER,
} from '../config/tuning.js';
import { wrapX, distX } from '../core/world.js';

const OPENING_WAVES = [
  null, // index 0 unused: waves are 1-based
  { landers: 8, bombers: 0, pods: 0 },
  { landers: 10, bombers: 2, pods: 0 },
  { landers: 12, bombers: 2, pods: 1 },
  { landers: 14, bombers: 3, pods: 1 },
  { landers: 15, bombers: 3, pods: 2 },
];

/**
 * How many of each enemy a wave starts with.
 *
 * @param {number} waveNumber 1-based
 * @param {boolean} planetDestroyed after the planet dies there are no humanoids
 *   to abduct, so Landers have no job. They spawn as Mutants instead, which is
 *   the original's way of making the loss permanent (functional spec, 7.4).
 */
export function waveComposition(waveNumber, planetDestroyed = false) {
  const w = Math.max(1, Math.floor(waveNumber));
  const base =
    w < OPENING_WAVES.length
      ? { ...OPENING_WAVES[w] }
      : {
          landers: Math.min(12 + 2 * w, WAVE.MAX_LANDERS),
          bombers: Math.min(1 + Math.floor(w / 2), WAVE.MAX_BOMBERS),
          pods: Math.min(Math.floor(w / 3), WAVE.MAX_PODS),
        };

  const comp = { ...base, mutants: 0 };
  if (planetDestroyed) {
    comp.mutants = comp.landers;
    comp.landers = 0;
  }
  return comp;
}

/** How much faster Landers descend this wave. Capped, because a Lander that
 *  drops faster than the player can cross the screen is not a challenge, it is
 *  a coin flip. */
export function descentMultiplier(waveNumber) {
  const w = Math.max(1, Math.floor(waveNumber));
  return Math.min(1 + WAVE.DESCENT_PER_WAVE * w, WAVE.DESCENT_CAP);
}

/** Seconds between a Lander's shots this wave, with a floor. */
export function landerFireInterval(waveNumber) {
  const w = Math.max(1, Math.floor(waveNumber));
  const scaled = LANDER.FIRE_INTERVAL / (1 + WAVE.FIRE_SCALE_PER_WAVE * w);
  return Math.max(scaled, WAVE.FIRE_INTERVAL_FLOOR);
}

/** Seconds between Baiter arrivals once a wave has overrun its grace period. */
export function baiterInterval(waveNumber) {
  const w = Math.max(1, Math.floor(waveNumber));
  return Math.max(BAITER.INTERVAL_BASE - w * 0.5, BAITER.INTERVAL_FLOOR);
}

/**
 * Pick a spawn position that is not on top of the player.
 *
 * Tries repeatedly for a clear spot and, if the world is somehow too crowded to
 * find one, falls back to the point exactly half a world away, which is the
 * furthest place there is. Looping for ever here would hang the game, and
 * silently spawning next to the player would kill them for no reason.
 */
export function pickSpawn(rng, playerX, attempts = 24) {
  for (let i = 0; i < attempts; i++) {
    const x = rng.range(0, WORLD_WIDTH);
    if (distX(x, playerX) >= WAVE.SPAWN_CLEAR) {
      return { x: wrapX(x), y: rng.range(WAVE.SPAWN_Y_MIN, WAVE.SPAWN_Y_MAX) };
    }
  }
  return {
    x: wrapX(playerX + WORLD_WIDTH / 2),
    y: rng.range(WAVE.SPAWN_Y_MIN, WAVE.SPAWN_Y_MAX),
  };
}
