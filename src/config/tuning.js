// Every tuned number in the game, and the palette, in one place.
//
// The rule this module exists to enforce: a magic number in a source file is a
// decision nobody can revisit. Values live here; the reasoning lives in
// docs/design/functional_spec.md, section by section. If you change a number
// here, change the spec too, or the two stop agreeing and the spec becomes a
// lie (agents/roles/profiles/game-design.md).
//
// Pure data. This module imports nothing and must never touch the DOM.

// --- Screen layout (functional spec, section 3) ---------------------------

export const VIRTUAL_WIDTH = 960;
export const VIRTUAL_HEIGHT = 640;

export const SCANNER_TOP = 0;
export const SCANNER_HEIGHT = 96;
export const STATUS_TOP = 96;
export const STATUS_HEIGHT = 32;
export const VIEW_TOP = 128;
export const VIEW_WIDTH = 960;
export const VIEW_HEIGHT = 512;

// --- The world (functional spec, section 4) -------------------------------

export const WORLD_WIDTH = 5760; // exactly six viewport widths
export const WORLD_HEIGHT = 512; // same as the viewport: no vertical scroll
export const HALF_WORLD = WORLD_WIDTH / 2;

export const TERRAIN_POINTS = 96;
export const TERRAIN_SEGMENT = WORLD_WIDTH / TERRAIN_POINTS; // 60
export const TERRAIN_MIN_HEIGHT = 40;
export const TERRAIN_MAX_HEIGHT = 140;
export const TERRAIN_MAX_STEP = 14; // per point, which also bounds the seam gap
export const TERRAIN_BLEND_POINTS = 12; // last N points blend back to the first

// --- Camera (functional spec, section 5) ----------------------------------

export const CAMERA_LEAD_RIGHT = 1 / 3; // ship sits here when facing right
export const CAMERA_LEAD_LEFT = 2 / 3;
export const CAMERA_LERP = 6.0; // per second, toward the target offset

// --- Player ship (functional spec, section 6) -----------------------------

export const SHIP = {
  WIDTH: 34,
  HEIGHT: 14,
  THRUST: 1100, // px/s/s in the facing direction
  MAX_SPEED_X: 560,
  DRAG_X: 0.45, // exponential decay per second when not thrusting
  // Vertical speed ramps while a key is held: slow at first so a tap is a nudge,
  // full speed once you commit. Flat 300 px/s made a tap a leap of roughly 30,
  // and a Lander's hit window is only 14 either side of the shot, so a single
  // press could not land inside it: you shot over, tapped again, shot under
  // (EH-05).
  //
  // A 100ms tap now moves about 13, inside that window. Holding still crosses
  // the full play height in about 1.6s, the same as before, so nothing is lost.
  // Releasing stops the ship dead: this is a ramp on speed, not inertia.
  SPEED_Y_START: 100,
  SPEED_Y_MAX: 330,
  SPEED_Y_RAMP: 0.35, // seconds of holding to reach full speed
  Y_MIN: 16,
  Y_MAX: 496,
  FLIP_COOLDOWN: 0.2,
  RESPAWN_HOLD: 2.0,
  INVULN_TIME: 2.5,
  RESPAWN_CLEAR_RADIUS: 200, // enemies this close are pushed away on respawn
  START_LIVES: 3,
  MAX_LIVES: 6,
  START_BOMBS: 3,
  MAX_BOMBS: 9,
  HYPERSPACE_FAIL_CHANCE: 1 / 6,
  HYPERSPACE_COOLDOWN: 1.5,
};

// --- Player shots (functional spec, section 6.3) --------------------------

export const SHOT = {
  LENGTH: 180,
  THICKNESS: 4,
  SPEED: 1400,
  LIFETIME: 0.55,
  MAX_ALIVE: 6,
  FIRE_INTERVAL: 0.12,
};

// --- Humanoids (functional spec, section 7) -------------------------------

export const HUMANOID = {
  COUNT: 10,
  WIDTH: 10,
  HEIGHT: 16,
  WALK_SPEED: 18,
  TURN_MIN: 1.5, // seconds between direction changes
  TURN_MAX: 4.0,
  GRAVITY: 420,
  CARRY_OFFSET: 22, // how far below its captor a carried humanoid hangs
  EATEN_Y: 24, // reaching this y means the abduction succeeded
};

// --- Enemies (functional spec, section 8) ---------------------------------

export const LANDER = {
  WIDTH: 24,
  HEIGHT: 24,
  SPEED: 90,
  DESCENT: 34,
  SEEK_DESCENT: 70,
  ABDUCT_RISE: 70,
  SEEK_RANGE: 900,
  FIRE_RANGE: 700,
  FIRE_INTERVAL: 2.4,
  SCORE: 150,
};

export const MUTANT = {
  WIDTH: 24,
  HEIGHT: 20,
  SPEED: 220,
  ACCEL: 420,
  WOBBLE: 260, // perpendicular jitter: too little is trivial, too much is unfair
  FIRE_INTERVAL: 1.6,
  SCORE: 150,
};

export const BAITER = {
  WIDTH: 28,
  HEIGHT: 14,
  SPEED: 380,
  ACCEL: 600,
  FIRE_INTERVAL: 1.2,
  SCORE: 200,
  WAVE_GRACE: 45, // seconds of wave time before the first one appears
  INTERVAL_BASE: 12,
  INTERVAL_FLOOR: 6,
};

export const BOMBER = {
  WIDTH: 28,
  HEIGHT: 28,
  SPEED: 70,
  SINE_AMPLITUDE: 60,
  SINE_RATE: 0.8,
  MINE_INTERVAL: 1.1,
  SCORE: 250,
};

export const MINE = {
  SIZE: 10,
  LIFETIME: 12,
  SCORE: 25,
};

export const POD = {
  WIDTH: 30,
  HEIGHT: 30,
  SPEED: 60,
  SCORE: 1000,
  SWARMERS: 4,
};

export const SWARMER = {
  WIDTH: 12,
  HEIGHT: 12,
  SPEED: 300,
  ACCEL: 700,
  WANDER: 420,
  FIRE_INTERVAL: 3.2,
  SCORE: 150,
};

export const ENEMY_SHOT = {
  SIZE: 6,
  SPEED: 420,
  LIFETIME: 3.0,
};

// --- Waves (functional spec, section 9) -----------------------------------

export const WAVE = {
  SPAWN_Y_MIN: 40,
  SPAWN_Y_MAX: 200,
  SPAWN_CLEAR: 400, // minimum deltaX from the player at spawn
  DESCENT_PER_WAVE: 0.04,
  DESCENT_CAP: 2.0,
  FIRE_SCALE_PER_WAVE: 0.03,
  FIRE_INTERVAL_FLOOR: 0.9,
  CLEARED_HOLD: 3.0,
  MAX_LANDERS: 30,
  MAX_BOMBERS: 6,
  MAX_PODS: 4,
};

// --- Scoring (functional spec, section 11) --------------------------------

export const SCORE = {
  LANDER: 150,
  MUTANT: 150,
  BAITER: 200,
  BOMBER: 250,
  POD: 1000,
  SWARMER: 150,
  MINE: 25,
  CATCH_HUMANOID: 500,
  LAND_HUMANOID: 500,
  WAVE_BONUS_PER_HUMANOID: 100, // multiplied by the wave number
  EXTRA_LIFE_EVERY: 10000,
  BONUS_WAVE_INTERVAL: 5,
};

// --- State machine timings (functional spec, section 12) ------------------

export const TIMING = {
  DYING_HOLD: 2.0,
  WAVE_CLEARED_HOLD: 3.0,
  GAME_OVER_HOLD: 6.0,
  PLANET_FLASH: 0.4,
};

// --- Loop (functional spec, section 19.5) ---------------------------------

export const FIXED_STEP = 1 / 60;
export const MAX_ACCUMULATOR = 0.25; // clamp: trades strict determinism under a
                                     // slow frame for not freezing the tab

// --- On-screen controls (functional spec, section 20) ---------------------
//
// Used only on a touch device. The gutters are reserved out of the letterboxing
// that a phone in landscape already wastes, so on a typical handset the play
// area does not shrink at all.

export const CONTROLS = {
  GUTTER_FRACTION: 0.15, // of screen width, before the clamps below
  GUTTER_MIN: 72,
  GUTTER_MAX: 190,
  THUMB_DROP: 0.04, // lift the clusters off the very bottom edge
  TOUCH_SLOP: 0.12, // of a gutter, added around every button: a fingertip is
                    // far bigger than a pixel, and it hides what it touches
  OPACITY: 0.28,
  OPACITY_PRESSED: 0.6,
};

// --- Palette (functional spec, section 13) --------------------------------
//
// Defined once, here, never inline in draw code.

export const COLOURS = {
  background: '#000000',
  terrain: '#3b7dd8',
  terrainBarren: '#4a4a52',
  ship: '#ffffff',
  shipInvuln: '#8fd0ff',
  shot: '#ffe066',
  humanoid: '#4fe3d0',
  lander: '#4ade5c',
  mutant: '#ff4b3e',
  baiter: '#ff8ae2',
  bomber: '#c084fc',
  mine: '#f97316',
  pod: '#facc15',
  swarmer: '#fde68a',
  enemyShot: '#ff6b6b',
  particle: '#ffd7a0',
  hud: '#9ae6ff',
  hudDim: '#3d6b80',
  scannerBox: '#8899aa',
  flash: '#ffffff',
  control: '#9ae6ff',
  controlPressed: '#ffffff',
  controlOn: '#4ade5c',
};
