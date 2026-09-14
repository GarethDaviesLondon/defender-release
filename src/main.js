// Boot and wiring.
//
// This is the one module allowed to know about everything. It owns the game
// object, maps input to intent, runs the systems in order, resolves collisions,
// and calls the renderers. Everything it calls is either pure (core, systems,
// state, entities) or purely a drawing or sound sink (render, audio).
//
// Update order matters and is deliberate: input, ship, enemies, humanoids,
// projectiles, collisions, spawning, then the state machine. Collisions run
// after everything has moved, so nothing is tested against a stale position,
// and the state machine runs last so a death or a cleared wave is acted on with
// the frame already fully resolved.

import {
  VIEW_WIDTH,
  WORLD_WIDTH,
  COLOURS,
  SCORE,
  SHOT,
  SHIP,
  TIMING,
  HUMANOID,
  BAITER,
} from './config/tuning.js';
import { startLoop } from './core/loop.js';
import { createInput } from './core/input.js';
import { createTouch, combineInputs } from './core/touch.js';
import { readIntent } from './core/intent.js';
import { makeRng } from './core/rng.js';
import {
  generateTerrain,
  makeBarren,
  groundYAt,
  wrapX,
  deltaX,
} from './core/world.js';
import { createCamera, updateCamera, snapCamera } from './systems/camera.js';
import { computeLayout } from './systems/layout.js';
import { overlaps, withinView } from './systems/collision.js';
import {
  waveComposition,
  descentMultiplier,
  landerFireInterval,
  baiterInterval,
  pickSpawn,
} from './systems/waves.js';
import {
  Phase,
  createGameState,
  advance,
  isSimulating,
} from './state/game.js';
import {
  createScoreState,
  addScore,
  addBomb,
  spendBomb,
  scoreFor,
  isBonusWave,
  waveBonus,
} from './state/scoring.js';
import {
  createShip,
  updateShip,
  noteShotFired,
  isVulnerable,
  respawnShip,
  hyperspaceTo,
} from './entities/ship.js';
import {
  placeHumanoids,
  updateHumanoid,
  beginAbduction,
  catchHumanoid,
  countAlive,
  HumanoidState,
} from './entities/humanoid.js';
import { createLander, updateLander, LanderMode } from './entities/lander.js';
import { createMutant, updateMutant, mutateFrom } from './entities/mutant.js';
import { createBaiter, updateBaiter } from './entities/baiter.js';
import { createBomber, createMine, updateBomber, updateMine } from './entities/bomber.js';
import { createPod, updatePod } from './entities/pod.js';
import { updateSwarmer, burstPod } from './entities/swarmer.js';
import {
  createPlayerShot,
  createEnemyShot,
  updateShot,
  prune,
} from './entities/shot.js';
import { createBurst, updateParticle } from './entities/particles.js';
import { drawWorld } from './render/renderer.js';
import { drawScanner } from './render/scanner.js';
import { drawHud, drawOverlays } from './render/hud.js';
import { drawControls, drawRotatePrompt } from './render/controls.js';
import { createAudio } from './audio/sfx.js';

// --- Canvas ---------------------------------------------------------------

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d', { alpha: false });

// The canvas now fills the window rather than being a fixed 960 by 640 element,
// and the game is drawn into a centred box inside it through a transform. Two
// reasons. The surround is ours to draw into, which is where the touch controls
// go; and the drawing modules keep working entirely in virtual coordinates, so
// none of them had to change (functional spec, section 20).
// Whether to show the on-screen controls is decided by what the player is
// actually using, not by what the device is capable of. Plenty of laptops have
// a touchscreen and report `maxTouchPoints > 0` while being driven entirely by
// a keyboard, and drawing thumb pads for them is simply wrong.
//
// So: guess from the primary pointer, then let the first real input settle it.
// Touch the screen and the controls appear; press a key and they go away.
let showControls = (() => {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return 'ontouchstart' in window;
  }
})();

function setControlsVisible(visible) {
  if (showControls === visible) return;
  showControls = visible;
  game.isTouch = visible;
  fitCanvas(); // the gutters change, so the game box does too
}

let layout = computeLayout(1, 1, { touch: showControls });
let dpr = 1;

/** The notch and the home indicator eat into the screen on a modern handset,
 *  and in landscape the notch is on one side, exactly where a thumb goes. Read
 *  the insets the browser reports rather than guessing at a device. */
function safeAreaInsets() {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;' +
    'padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);' +
    'padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);';
  document.body.appendChild(probe);
  const s = getComputedStyle(probe);
  const px = (v) => (Number.parseFloat(v) || 0);
  const insets = {
    left: px(s.paddingLeft), right: px(s.paddingRight),
    top: px(s.paddingTop), bottom: px(s.paddingBottom),
  };
  probe.remove();
  return insets;
}

function fitCanvas() {
  dpr = window.devicePixelRatio || 1;
  const cssW = Math.max(1, window.innerWidth);
  const cssH = Math.max(1, window.innerHeight);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  // Layout is computed in CSS pixels; the device pixel ratio is folded into the
  // transform at draw time. Touch coordinates arrive in CSS pixels too, so hit
  // testing and drawing share one coordinate space.
  layout = computeLayout(cssW, cssH, {
    touch: showControls,
    insets: showControls ? safeAreaInsets() : null,
  });
}
window.addEventListener('resize', fitCanvas);
window.addEventListener('orientationchange', fitCanvas);
fitCanvas();

// --- Game object ----------------------------------------------------------

const keyboard = createInput(window, {
  onFirstKey: () => setControlsVisible(false),
});
// The touch source needs the current layout to know where the buttons are, and
// the layout changes on every resize, so it is passed a getter rather than a
// snapshot that would go stale.
// The touch source is always created: its listeners cost nothing on a device
// nobody touches, and it is what tells us a finger has arrived.
const touch = createTouch(canvas, () => layout, {
  onFirstTouch: () => setControlsVisible(true),
});
const input = combineInputs(keyboard, touch);
const audio = createAudio();

const game = {
  state: createGameState(),
  scoreState: createScoreState(),
  camera: createCamera(),
  ship: createShip(0),
  rng: makeRng(Date.now() & 0xffffffff),
  terrain: generateTerrain(1),
  humanoids: [],
  enemies: [],
  mines: [],
  shots: [],
  enemyShots: [],
  particles: [],
  planetDestroyed: false,
  flash: 0,
  lastBonus: 0,
  baiterIn: Infinity,
  humanoidsAlive: 0,
  muted: audio.muted,
  isTouch: showControls,
};

/** Enemies that must die for the wave to end. Baiters keep arriving for as
 *  long as the wave lasts, so counting them would make a wave unendable
 *  (functional spec, section 8.3). */
function wavePopulation() {
  return game.enemies.filter((e) => !e.dead && e.kind !== 'baiter').length;
}

function award(points) {
  if (points <= 0) return;
  const bonuses = addScore(game.scoreState, points);
  game.pendingEvents.push({ type: 'addScore', points });
  for (let i = 0; i < bonuses; i++) {
    game.pendingEvents.push({ type: 'addLife' });
    audio.extraLife();
  }
}

function boom(x, y, colour, count, speed) {
  game.particles.push(...createBurst(x, y, game.rng, colour, count, speed));
}

// --- Wave setup -----------------------------------------------------------

function startWave() {
  const w = game.state.wave;
  game.terrain = game.planetDestroyed ? makeBarren() : generateTerrain(w);

  if (w === 1 && game.humanoids.length === 0) {
    game.humanoids = placeHumanoids(game.terrain, game.rng, WORLD_WIDTH);
  } else {
    // Survivors carry over and are never replenished. Re-seat them on the new
    // terrain so nobody is left standing in mid-air.
    for (const h of game.humanoids) {
      if (h.state === HumanoidState.WALKING) {
        h.y = groundYAt(game.terrain, h.x) - HUMANOID.HEIGHT / 2;
      }
    }
  }

  game.enemies = [];
  game.mines = [];
  game.shots = [];
  game.enemyShots = [];
  game.baiterIn = BAITER.WAVE_GRACE;

  // Put the ship where it will actually start BEFORE spawning anything. The
  // spawn clearance in pickSpawn is measured against game.ship.x, so doing
  // this afterwards would clear a space around the ship's *previous* position
  // and then teleport it, possibly right next to a Lander.
  respawnShip(game.ship, game.camera.x);
  snapCamera(game.camera, game.ship.x, game.ship.facing);

  const comp = waveComposition(w, game.planetDestroyed);
  const spawn = () => pickSpawn(game.rng, game.ship.x);

  for (let i = 0; i < comp.landers; i++) {
    const p = spawn();
    game.enemies.push(createLander(p.x, p.y));
  }
  for (let i = 0; i < comp.mutants; i++) {
    const p = spawn();
    game.enemies.push(createMutant(p.x, p.y));
  }
  for (let i = 0; i < comp.bombers; i++) {
    const p = spawn();
    game.enemies.push(createBomber(p.x, p.y, game.rng));
  }
  for (let i = 0; i < comp.pods; i++) {
    const p = spawn();
    game.enemies.push(createPod(p.x, p.y, game.rng));
  }

  if (isBonusWave(w)) {
    addBomb(game.scoreState);
    game.pendingEvents.push({ type: 'addLife' });
    audio.extraLife();
  }
}

function destroyPlanet() {
  if (game.planetDestroyed) return;
  game.planetDestroyed = true;
  game.terrain = makeBarren();
  game.flash = 1;
  audio.planetDeath();

  // Every Lander alive becomes a Mutant at once. There is nothing left for
  // them to abduct, and the loss has to be felt.
  const promoted = [];
  for (const e of game.enemies) {
    if (e.kind === 'lander' && !e.dead) promoted.push(mutateFrom(e));
  }
  game.enemies.push(...promoted);
}

// --- Death ----------------------------------------------------------------

function killPlayer() {
  if (game.ship.dead) return;
  game.ship.dead = true;
  boom(game.ship.x, game.ship.y, COLOURS.ship, 28, 320);
  audio.explosion(true);
  audio.setThrust(false);
  if (game.ship.holding) {
    game.ship.holding = null;
  }
  game.pendingEvents.push({ type: 'shipDestroyed' });
}

function killEnemy(enemy) {
  if (enemy.dead) return;
  enemy.dead = true;
  award(scoreFor(enemy.kind));
  boom(enemy.x, enemy.y, COLOURS[enemy.kind] ?? COLOURS.particle, 14, 220);
  audio.explosion(enemy.kind === 'pod');

  // A Lander shot mid-abduction drops its humanoid rather than killing it.
  // Get this wrong and rescuing becomes impossible.
  if (enemy.kind === 'lander' && enemy.carrying) {
    enemy.carrying.captor = null;
    enemy.carrying = null;
  }
  if (enemy.kind === 'pod') {
    game.enemies.push(...burstPod(enemy, game.rng));
  }
}

// --- Update ---------------------------------------------------------------

game.pendingEvents = [];

function update(dt) {
  // pendingEvents is drained after advance(), not cleared here. startWave()
  // runs after advance() and queues its bonus-wave events for the next frame;
  // clearing at the top of update would throw them away.
  const phase = game.state.phase;

  if (input.wasPressed('mute')) {
    game.muted = audio.toggleMute();
  }
  if (input.hasInteracted()) audio.unlock();

  if (phase === Phase.ATTRACT || phase === Phase.GAME_OVER) {
    if (input.wasPressed('start')) game.pendingEvents.push({ type: 'start' });
  } else if (input.wasPressed('pause')) {
    game.pendingEvents.push({ type: 'pause' });
  }

  if (isSimulating(phase)) {
    simulate(dt);
  } else {
    audio.setThrust(false);
    audio.setSiren(false);
  }

  game.flash = Math.max(0, game.flash - dt / TIMING.PLANET_FLASH);
  for (const p of game.particles) updateParticle(p, dt);
  prune(game.particles);

  const before = game.state;
  game.state = advance(game.state, dt, game.pendingEvents);
  game.pendingEvents.length = 0;

  if (game.state.startWave) startWave();
  if (game.state.respawn) {
    respawnShip(game.ship, game.camera.x);
    pushEnemiesClear();
  }
  if (before.phase !== Phase.ATTRACT && game.state.phase === Phase.ATTRACT) {
    resetGame();
  }

  game.humanoidsAlive = countAlive(game.humanoids);
  input.endFrame();
}

function simulate(dt) {
  const { ship, rng } = game;
  const waveNum = game.state.wave;

  // --- Ship ---
  if (!ship.dead) {
    const intent = readIntent(input);
    const actions = updateShip(ship, dt, intent, rng);
    audio.setThrust(intent.thrust);

    if (actions.fired && game.shots.length < SHOT.MAX_ALIVE) {
      game.shots.push(
        createPlayerShot(ship.x + ship.facing * 24, ship.y, ship.facing),
      );
      noteShotFired(ship, SHOT.FIRE_INTERVAL);
      audio.laser();
    }
    if (actions.bombed && spendBomb(game.scoreState)) {
      audio.smartBomb();
      for (const e of game.enemies) {
        if (!e.dead && withinView(game.camera.x, VIEW_WIDTH, e.x)) killEnemy(e);
      }
      for (const m of game.mines) {
        if (!m.dead && withinView(game.camera.x, VIEW_WIDTH, m.x)) m.dead = true;
      }
      game.flash = Math.max(game.flash, 0.6);
    }
    if (actions.jumped) {
      boom(ship.x, ship.y, COLOURS.shipInvuln, 12, 180);
      if (actions.jumpFailed) {
        killPlayer();
      } else {
        hyperspaceTo(ship, rng, WORLD_WIDTH);
        snapCamera(game.camera, ship.x, ship.facing);
      }
    }
  }

  updateCamera(game.camera, ship.x, ship.facing, dt);

  // --- Enemies ---
  const enemyCtx = {
    humanoids: game.humanoids,
    ship,
    rng,
    descentMul: descentMultiplier(waveNum),
    fireInterval: landerFireInterval(waveNum),
    onScreen: false,
  };

  for (const e of game.enemies) {
    if (e.dead) continue;
    enemyCtx.onScreen = withinView(game.camera.x, VIEW_WIDTH, e.x, 40);
    let events = [];
    switch (e.kind) {
      case 'lander': events = updateLander(e, dt, enemyCtx); break;
      case 'mutant': events = updateMutant(e, dt, enemyCtx); break;
      case 'baiter': events = updateBaiter(e, dt, enemyCtx); break;
      case 'bomber': events = updateBomber(e, dt); break;
      case 'pod': events = updatePod(e, dt); break;
      case 'swarmer': events = updateSwarmer(e, dt, enemyCtx); break;
      default: break;
    }
    for (const ev of events) {
      if (ev.type === 'fire' && !ship.dead) {
        game.enemyShots.push(createEnemyShot(ev.x, ev.y, ship.x, ship.y));
      } else if (ev.type === 'mine') {
        game.mines.push(createMine(ev.x, ev.y));
      }
    }
  }

  // --- Humanoids ---
  let sirenOn = false;
  for (const h of game.humanoids) {
    const events = updateHumanoid(h, dt, game.terrain, rng, ship);
    if (h.state === HumanoidState.CARRIED) sirenOn = true;
    for (const ev of events) {
      if (ev.type === 'eaten') {
        const captor = ev.captor;
        if (captor && !captor.dead) {
          game.enemies.push(mutateFrom(captor));
          audio.mutation();
        }
      } else if (ev.type === 'rescued') {
        award(SCORE.LAND_HUMANOID);
        audio.rescued();
        if (ship.holding === h) ship.holding = null;
      }
    }
  }
  audio.setSiren(sirenOn && !game.planetDestroyed);

  if (!game.planetDestroyed && game.humanoids.length > 0 && countAlive(game.humanoids) === 0) {
    destroyPlanet();
  }

  // --- Projectiles and mines ---
  for (const s of game.shots) updateShot(s, dt);
  for (const s of game.enemyShots) updateShot(s, dt);
  for (const m of game.mines) updateMine(m, dt);

  resolveCollisions();

  prune(game.shots);
  prune(game.enemyShots);
  prune(game.mines);
  prune(game.enemies);

  // --- Baiters ---
  game.baiterIn -= dt;
  if (game.baiterIn <= 0 && wavePopulation() > 0) {
    game.baiterIn = baiterInterval(waveNum);
    const p = pickSpawn(rng, ship.x);
    game.enemies.push(createBaiter(p.x, p.y));
  }

  // --- Wave end ---
  if (wavePopulation() === 0 && game.state.phase === Phase.PLAYING) {
    game.lastBonus = waveBonus(countAlive(game.humanoids), waveNum);
    award(game.lastBonus);
    for (const e of game.enemies) e.dead = true; // stray Baiters go with it
    game.pendingEvents.push({ type: 'waveCleared' });
  }
}


function resolveCollisions() {
  const { ship } = game;

  // Player shots against enemies and mines.
  for (const shot of game.shots) {
    if (shot.dead) continue;
    for (const e of game.enemies) {
      if (e.dead) continue;
      if (overlaps(shot, e)) {
        killEnemy(e);
        shot.dead = true;
        break;
      }
    }
    if (shot.dead) continue;
    for (const m of game.mines) {
      if (m.dead) continue;
      if (overlaps(shot, m)) {
        m.dead = true;
        award(scoreFor('mine'));
        boom(m.x, m.y, COLOURS.mine, 8, 140);
        shot.dead = true;
        break;
      }
    }
  }

  if (ship.dead) return;

  // Landers picking humanoids up.
  for (const e of game.enemies) {
    if (e.dead || e.kind !== 'lander' || e.carrying) continue;
    for (const h of game.humanoids) {
      if (h.dead || h.state !== HumanoidState.WALKING) continue;
      if (overlaps(e, h) && beginAbduction(h, e)) {
        e.carrying = h;
        e.mode = LanderMode.ABDUCTING;
        break;
      }
    }
  }

  // The player catching a falling humanoid.
  if (!ship.holding) {
    for (const h of game.humanoids) {
      if (h.dead || h.state !== HumanoidState.FALLING) continue;
      if (overlaps(ship, h) && catchHumanoid(h, ship)) {
        ship.holding = h;
        award(SCORE.CATCH_HUMANOID);
        audio.rescued();
        break;
      }
    }
  }

  if (!isVulnerable(ship)) return;

  for (const s of game.enemyShots) {
    if (!s.dead && overlaps(s, ship)) {
      s.dead = true;
      killPlayer();
      return;
    }
  }
  for (const e of game.enemies) {
    if (!e.dead && overlaps(e, ship)) {
      killEnemy(e);
      killPlayer();
      return;
    }
  }
  for (const m of game.mines) {
    if (!m.dead && overlaps(m, ship)) {
      m.dead = true;
      killPlayer();
      return;
    }
  }
}

/** After a respawn, shove anything sitting on the spawn point out of the way.
 *  Respawning inside a Mutant is not a death the player can learn from. */
function pushEnemiesClear() {
  for (const e of game.enemies) {
    if (e.dead) continue;
    const d = deltaX(game.ship.x, e.x);
    if (Math.abs(d) < SHIP.RESPAWN_CLEAR_RADIUS) {
      e.x = wrapX(game.ship.x + (d >= 0 ? 1 : -1) * SHIP.RESPAWN_CLEAR_RADIUS * 2);
    }
  }
}

function resetGame() {
  game.scoreState = createScoreState();
  game.planetDestroyed = false;
  game.humanoids = [];
  game.enemies = [];
  game.mines = [];
  game.shots = [];
  game.enemyShots = [];
  game.particles = [];
  game.flash = 0;
  game.lastBonus = 0;
  game.terrain = generateTerrain(1);
  game.ship = createShip(0);
  game.ship.dead = false;
}

// --- Render ---------------------------------------------------------------

function render() {
  // Screen space: clear the whole surround, including the gutters.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = COLOURS.background;
  ctx.fillRect(0, 0, layout.screenW, layout.screenH);

  // A phone held upright gives the game a box too small to read, and this is a
  // side-scroller. Say so rather than rendering something unplayable.
  if (showControls && layout.screenH > layout.screenW) {
    drawRotatePrompt(ctx, layout);
    return;
  }

  // Game space: the drawing modules work in virtual coordinates and know
  // nothing about any of this.
  ctx.setTransform(
    dpr * layout.scale, 0, 0, dpr * layout.scale,
    dpr * layout.gameX, dpr * layout.gameY,
  );
  drawWorld(ctx, game);
  drawScanner(ctx, game);
  drawHud(ctx, game);
  drawOverlays(ctx, game);

  // Back to screen space for the controls, which live in the gutters.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (showControls) drawControls(ctx, layout, touch);
}

startLoop(update, render);
