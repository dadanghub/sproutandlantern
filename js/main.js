// Axie: Sprout & Lantern — main orchestrator.
// Owns the game loop, mode state machine, input routing and save timing.

import { Input, movementVector } from './core/input.js';
import { Save } from './core/save.js';
import { audio } from './core/audio.js';
import { Particles } from './core/particles.js';
import { camera } from './core/camera.js';
import { clamp, lerp, TAU } from './core/utils.js';
import { onProgressionEvent } from './core/events.js';

import { newGame, hydrateGame } from './game/state.js';
import { axieProvider } from './axie/provider.js';
import { DEMO_AXIES } from './axie/axies.js';
import { WORLD, isWalkable, phaseAt } from './world/map.js';

import { updateFarming, plantCrop } from './systems/farming.js';
import { updateFlowerPuzzle, updateBridgePuzzle, updateStonePuzzle } from './systems/puzzles.js';
import { updateZones, updateEnding, refreshLevel } from './systems/progression.js';
import { currentInteraction, performInteraction } from './systems/interactions.js';
import { FUELS } from './systems/lantern.js';
import { addBondXp } from './axie/bond.js';

import { renderGame } from './world/render.js';
import { buildHud, updateHud, setPrompt, setHudHandlers, refreshPortrait, getMinimapCanvas } from './ui/hud.js';
import { minimapTick, minimapDraw } from './ui/minimap.js';
import { buildToasts, toast, banner } from './ui/toasts.js';
import { buildDialogue, dialogueActive, advance as advanceDialogue, tickDialogue, showDialogue as dialogueShow } from './ui/dialogue.js';
import * as menus from './ui/menus.js';
import { buildScreens, showScreen, setIntroStep, introHasCta, hasContinueSave } from './ui/screens.js';

// ---------------------------------------------------------------- canvas --
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// tiny debug/inspection handle (also handy for demoing the architecture)
if (typeof window !== 'undefined') {
  window.__sproutDebug = {
    get game() { return game; },
    get mode() { return mode; },
    frameErrors: 0,
  };
}
let W = 0, H = 0, DPR = 1;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
}
window.addEventListener('resize', resize);
resize();

// ------------------------------------------------------------- state -----
const input = new Input();
let mode = 'title'; // title | intro | select | play | ending
let game = null;
let idleGame = null;
let introStep = 0;
let currentTarget = null;
let endingT = 0;
let endingCardShown = false;
let endingPos = null;
let stars = [];
for (let i = 0; i < 90; i++) stars.push({ x: Math.random(), y: Math.random() * 0.7, s: Math.random() * 1.6 + 0.4, ph: Math.random() * TAU });

// ui callback bag handed to systems
const ui = {
  toast,
  banner,
  markDirty() {
    if (game && mode === 'play') Save.save(game);
  },
  openMenu(kind) {
    if (!game) return;
    if (kind === 'shop') menus.openShop(game, ui);
    else if (kind === 'craft') menus.openLantern(game, ui);
    else if (kind === 'workbench') menus.openWorkbench(game, ui);
    else if (kind === 'board') menus.openBoard(game, ui);
  },
  openPlant(plotIdx) {
    menus.openPlantPicker(game, plotIdx, (i, seed) => {
      if (plantCrop(game, i, seed)) {
        refreshLevel(game);
        ui.toast(`Planted ${seedName(seed)}`);
        ui.markDirty();
      }
    });
  },
  showDialogue(steps, onDone) {
    showDialogue(steps, onDone);
  },
  toTitle() {
    if (game && mode === 'play') Save.save(game);
    game = idleGame;
    mode = 'title';
    menus.closeModal();
    showScreen('title');
    hasContinueSave();
  },
};

function seedName(id) {
  const names = {
    glowberry: 'Glowberry', mooncap: 'Mooncap', starroot: 'Starroot',
    whisperfern: 'Whisper Fern', sunbud: 'Sunbud', lunapear: 'Lunapear',
    dreamleaf: 'Dreamleaf', moonflower: 'Moonflower',
  };
  return names[id] || id;
}

// progression events: console trace is built in; mark dirty for saves.
onProgressionEvent(() => {
  if (game && mode === 'play') Save.save(game);
});

// ------------------------------------------------------------- boot ------
async function boot() {
  const root = document.getElementById('ui');
  buildToasts(root);
  buildDialogue(root);
  menus.buildMenus(root);
  const axies = await axieProvider.listAxies();
  buildScreens(root, {
    axies,
    onPlayDemo: () => {
      audio.init();
      audio.sfx('click');
      introStep = 0;
      setIntroStep(0);
      mode = 'intro';
      showScreen('intro');
    },
    onContinue: () => {
      audio.init();
      const saved = Save.load();
      if (!saved) {
        toast('No saved grove found.');
        return;
      }
      const def = axies.find((a) => a.id === saved.axieId) || axies[0];
      game = hydrateGame(saved, def);
      beginRun(def, true);
    },
    onSelectAxie: (def) => {
      audio.init();
      game = newGame(def);
      beginRun(def, false);
    },
    onConnect: () => menus.openConnect(),
    onIntroAdvance: () => {
      audio.sfx('click');
      introStep++;
      if (introStep < 4) setIntroStep(introStep);
      else {
        mode = 'select';
        showScreen('select');
      }
    },
    onPlayAgain: () => {
      Save.clear();
      location.reload();
    },
    onKeepExploring: () => {
      if (endingPos) {
        game.px = endingPos.px;
        game.py = endingPos.py;
        endingPos = null;
      }
      camera.targetZoom = 1;
      camera.snap(game.px, game.py);
      mode = 'play';
      showScreen(null);
      ui.toast('The Twilight keeps its secrets — for a while longer.');
    },
  });

  setHudHandlers({
    journal: () => {
      if (mode === 'play' && game && !menus.isModalOpen()) menus.openJournal(game);
    },
    fuelSlot: (id) => {
      if (mode === 'play' && !menus.isModalOpen() && !dialogueActive()) tryFuel(id);
    },
  });

  idleGame = newGame(axies[0]);
  game = idleGame;
  hasContinueSave();
  showScreen('title');
  mode = 'title';

  // audio needs a user gesture
  const startAudio = () => {
    audio.init();
    window.removeEventListener('pointerdown', startAudio);
    window.removeEventListener('keydown', startAudio);
  };
  window.addEventListener('pointerdown', startAudio);
  window.addEventListener('keydown', startAudio);
  window.addEventListener('beforeunload', () => {
    if (game && mode === 'play') Save.save(game);
  });

  last = performance.now();
  requestAnimationFrame(frame);
}

function beginRun(def, isContinue) {
  camera.snap(game.px, game.py);
  camera.zoom = 1;
  camera.targetZoom = 1;
  mode = 'play';
  audio.startMusic();
  showScreen(null);
  menus.closeModal();
  buildHudFor(game);
  refreshPortrait(game);
  if (isContinue) {
    ui.toast('Welcome back to the grove.');
  } else {
    showDialogue(
      [
        { who: 'The Grove', text: 'A forgotten garden, and a lantern that has never been lit. But the SLP spores in your glass still glow, little one.' },
        { who: 'The Grove', text: 'In the old lantern cache you find one Sunpetal and one Dreamcap fuel. The rest, you will grow and craft yourself. The forest is waiting to be purified.' },
      ],
      () => ui.toast('Plant your first Glowberry — walk to a plot and press E.')
    );
  }
  ui.markDirty();
}

let hudBuiltFor = null;
function buildHudFor(g) {
  const old = document.getElementById('hud');
  if (old) old.remove();
  buildHud(document.getElementById('ui'), g);
  hudBuiltFor = g;
}

// ---------------------------------------------------------------- loop ---
let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  // Defense in depth: an exception must never silently kill the loop and
  // leave the game as a frozen tab. Log it, tell the player once, carry on.
  try {
    update(dt, now);
    render(dt, now);
  } catch (err) {
    window.__sproutDebug.frameErrors++;
    console.error('[Axie] frame error (loop kept alive):', err);
    if (now - lastFrameErrorToast > 10000) {
      lastFrameErrorToast = now;
      toast(`The grove hiccuped (${String(err && err.message || err)}) — but it keeps going.`);
    }
  }
  input.endFrame();
  requestAnimationFrame(frame);
}

let lastFrameErrorToast = -1e9;

function update(dt, now) {
  Particles.update(dt);
  tickDialogue();

  if (mode === 'title') {
    camera.zoom = lerp(camera.zoom, 1, dt * 2);
    const t = now * 0.0001;
    camera.x = lerp(camera.x, 900 + Math.sin(t) * 280, dt);
    camera.y = lerp(camera.y, 1820 + Math.cos(t * 0.8) * 170, dt);
    audio.update(dt, 0);
    return;
  }

  if (mode === 'intro') {
    if (input.consume('KeyE') || input.consume('Space') || input.consume('Enter')) onIntroAdvance();
    audio.update(dt, 0.15);
    return;
  }

  if (mode === 'select') {
    audio.update(dt, 0.15);
    return;
  }

  if (mode === 'ending') {
    endingT += dt;
    camera.targetZoom = 0.92;
    camera.update(900, 1930, dt, WORLD);
    audio.update(dt, 1);
    if (endingT > 5.2 && !endingCardShown) {
      endingCardShown = true;
      showScreen('ending');
    }
    return;
  }

  // ------------------------------------------------------------ play -----
  updatePlay(dt, now);
}

function onIntroAdvance() {
  audio.sfx('click');
  introStep++;
  if (introStep < 4) setIntroStep(introStep);
  else {
    mode = 'select';
    showScreen('select');
  }
}

function updatePlay(dt, now) {
  const locked = menus.isModalOpen() || dialogueActive();

  // --- movement
  if (!locked) {
    const { dx, dy } = movementVector(input);
    if (dx !== 0 || dy !== 0) {
      game.moving = true;
      if (dx !== 0) game.facing = dx < 0 ? -1 : 1;
      const sp = 235;
      tryMove(game, dx * sp * dt, dy * sp * dt);
      game.walkT += dt;
      // soft dust puffs underfoot
      game.fx.stepT = (game.fx.stepT || 0) + dt;
      if (game.fx.stepT > 0.32) {
        game.fx.stepT = 0;
        Particles.puff(game.px, game.py + 12, phaseAt(game.px, game.py) < 0.5 ? '#c8b489' : '#7a7aa0', 2, 14);
      }
    } else {
      game.moving = false;
      game.fx.stepT = 0;
    }

  }

  // --- phase + camera
  game.phaseT = lerp(game.phaseT, phaseAt(game.px, game.py), 1 - Math.pow(0.03, dt));
  camera.update(game.px, game.py, dt, WORLD);

  // --- world systems
  game.time += dt;
  const lvBefore = game.level;
  const fBefore = game.puzzles.flowersDone;
  const bBefore = game.puzzles.bridgeRevealed;
  const sBefore = game.puzzles.stonesDone;
  const areasBefore = Object.values(game.areas).filter(Boolean).length;

  updateFarming(game, dt);
  updateFlowerPuzzle(game, dt);
  updateBridgePuzzle(game);
  updateStonePuzzle(game);
  updateZones(game);
  refreshLevel(game);

  if (!fBefore && game.puzzles.flowersDone) {
    banner('The Old Flowers Awaken', 'They remember the light you carried. +25✦ · +2 Mooncap Seeds', '#9cc8ff');
    audio.sfx('big');
  }
  if (!bBefore && game.puzzles.bridgeRevealed) {
    toast('The mist lifts — an old bridge, solid as moonlight.');
    audio.sfx('big');
  }
  if (!sBefore && game.puzzles.stonesDone) {
    banner('The Deep Twilight Opens', 'Layer 3 — the edge of the forest breathes. +40✦', '#c79bff');
    audio.sfx('big');
  }
  if (Object.values(game.areas).filter(Boolean).length > areasBefore) {
    ui.markDirty();
  }
  if (game.level > lvBefore) {
    const titles = { 1: 'Gardener', 2: 'Lightmaker', 3: 'Twilight Walker', 4: 'Restorer', 5: 'Grovekeeper' };
    toast(`Grovekeeper Level ${game.level} — ${titles[game.level]}`);
    audio.sfx('level');
    ui.markDirty();
  }

  // --- cooldowns & effects
  if (game.flags.restCooldown > 0) game.flags.restCooldown -= dt;
  if (game.axieHappyT > 0) game.axieHappyT -= dt;
  if (game.fx.songT > 0) game.fx.songT -= dt;
  if (game.fx.pulseT > 0) game.fx.pulseT -= dt;
  if (game.fx.flash > 0) game.fx.flash = Math.max(0, game.fx.flash - dt * 1.4);

  // Bond 2: the Axie finds bonus seeds
  if (game.bondLevel >= 2) {
    game.fx.bonusTimer -= dt;
    if (game.fx.bonusTimer <= 0) {
      if (!game.fx.bonusSeed) {
        game.fx.bonusSeed = { x: game.px, y: game.py };
        ui.toast('You dig and find something!');
        Particles.sparkle(game.px, game.py, '#ff9ec4', 8, 40);
      }
      game.fx.bonusTimer = 90 + Math.random() * 60;
    }
  }

  // --- ending check
  const endBefore = game.flags.endingSeen;
  updateEnding(game, dt);
  if (!endBefore && game.flags.endingSeen) {
    Save.save(game);
    endingPos = { px: game.px, py: game.py };
    game.px = 872;
    game.py = 1940;
    endingT = 0;
    endingCardShown = false;
    mode = 'ending';
    camera.snap(900, 1930);
    camera.targetZoom = 1.1;
    menus.closeModal();
    audio.sfx('big');
    return;
  }

  // --- interaction target
  if (!locked && !dialogueActive()) {
    currentTarget = currentInteraction(game);
  } else {
    currentTarget = null;
  }
  setPrompt(currentTarget ? currentTarget.label : null, currentTarget ? currentTarget.enabled : true);

  // --- autosave
  game.times.save += dt;
  if (game.times.save > 10) {
    game.times.save = 0;
    Save.save(game);
  }

  // --- input actions
  handlePlayInput();

  audio.update(dt, game.phaseT);
}

function tryMove(game, mx, my) {
  const nx = game.px + mx;
  const ny = game.py + my;
  const r = 9;
  // axis-separated with corner sampling
  if (mx !== 0) {
    const testX = nx + (mx > 0 ? r : -r);
    if (
      isWalkable(testX, game.py - r + 4, game.axieCls, game) &&
      isWalkable(testX, game.py + r - 4, game.axieCls, game)
    ) {
      game.px = nx;
    }
  }
  if (my !== 0) {
    const testY = ny + (my > 0 ? r : -r);
    if (
      isWalkable(game.px - r + 4, testY, game.axieCls, game) &&
      isWalkable(game.px + r - 4, testY, game.axieCls, game)
    ) {
      game.py = ny;
    }
  }
}

function tryFuel(id) {
  if (game.inv.fuel[id] <= 0) {
    audio.sfx('error');
    toast(`No ${FUELS[id].name} fuel yet — craft it at the Lantern Station.`);
    return;
  }
  game.fuel = game.fuel === id ? null : id;
  audio.sfx('craft');
}

function handlePlayInput() {
  // NB: modals and dialogues are separate locks — the dialogue branch below
  // must be reachable while a dialogue is up (it is the only way to advance it).
  if (input.consume('KeyM')) {
    const m = audio.toggleMute();
    toast(m ? 'Sound off' : 'Sound on');
    return;
  }

  if (menus.isModalOpen()) {
    if (input.consume('Escape')) menus.closeModal();
    return;
  }

  if (dialogueActive()) {
    if (input.consume('KeyE') || input.consume('Space') || input.consume('Enter')) advanceDialogue();
    return;
  }

  if (input.consume('Digit1') || input.consume('Numpad1')) tryFuel('moonspore');
  if (input.consume('Digit2') || input.consume('Numpad2')) tryFuel('sunpetal');
  if (input.consume('Digit3') || input.consume('Numpad3')) tryFuel('dreamcap');

  if (input.consume('KeyL')) {
    if (game.bondLevel >= 5) {
      if (game.fx.pulseT <= 0) {
        game.fx.pulseT = 5;
        Particles.ring(game.px, game.py, '#c79bff', 560);
        audio.sfx('pulse');
        toast('Ember Pulse — the Twilight reveals everything, briefly.');
      }
    } else {
      toast('Your lantern isn’t ready for that yet. (Bond 5)');
    }
  }

  if (input.consume('KeyJ')) {
    menus.openJournal(game);
    return;
  }
  if (input.consume('KeyI')) {
    menus.openInventory(game, null);
    return;
  }
  if (input.consume('Escape')) {
    menus.openPause(game, ui);
    return;
  }
  if (input.consume('KeyE')) {
    if (currentTarget) performInteraction(game, ui, currentTarget);
  }
}

// ---------------------------------------------------------------- render --
function render(dt, now) {
  const g = game || idleGame;
  if (mode === 'ending') {
    renderGame(ctx, W, H, g, dt, now, { nightT: 1 });
    // stars
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of stars) {
      const a = 0.25 + 0.45 * Math.abs(Math.sin(now * 0.001 + s.ph));
      ctx.fillStyle = `rgba(220,230,255,${a})`;
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.s, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  } else {
    renderGame(ctx, W, H, g, dt, now, {});
  }

  if ((mode === 'play' || mode === 'ending') && hudBuiltFor === game) {
    updateHud(game);
    // Twilight minimap
    minimapTick(game, dt);
    const mm = getMinimapCanvas();
    if (mm) minimapDraw(mm.getContext('2d'), game, now);
  }
}

function showDialogue(steps, onDone) {
  dialogueShow(steps, onDone);
}

boot();
