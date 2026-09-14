// A small seeded pseudo-random generator.
//
// Why not Math.random: terrain has to be reproducible from a wave number, so a
// given wave always looks the same and can be asserted in a test (functional
// spec, sections 4.2 and 17.6). Math.random cannot be seeded.
//
// The algorithm is mulberry32: 32 bits of state, good enough distribution for
// scattering rocks and picking spawn points, and short enough to read. It is
// not suitable for anything that needs to be unguessable, and nothing here
// does.
//
// Pure. No DOM.

/** Create a generator from a numeric seed. Two generators with the same seed
 *  produce the same sequence. */
export function makeRng(seed) {
  // Force the seed into a 32-bit integer, and avoid a zero state, which would
  // make the first few draws degenerate.
  let state = (Math.floor(seed) | 0) >>> 0;
  if (state === 0) state = 0x9e3779b9;

  /** Next float in [0, 1). */
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    /** Float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** Whole number in [0, n). */
    int(n) {
      return Math.floor(next() * n);
    },
    /** True with the given probability. */
    chance(p) {
      return next() < p;
    },
    /** One element of a non-empty array. */
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
    /** Float in [-magnitude, +magnitude). */
    spread(magnitude) {
      return (next() * 2 - 1) * magnitude;
    },
  };
}
