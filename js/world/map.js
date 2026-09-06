// The handcrafted world: a compact Grove (day) connected to the Twilight
// forest (night) through a tree arch. All layout data lives here so the
// renderer, physics and systems share one source of truth.

import { clamp, mulberry32, inRect } from '../core/utils.js';

export const WORLD = { w: 3000, h: 2200 };

// Twilight region (northeast). The grove is everything else.
export const FOREST = { x: 1350, y: 0, w: 1650, h: 1450 };
const BLEND = 170;

/** 0 = full day (grove), 1 = full twilight (forest). Smooth at the border. */
export function phaseAt(x, y) {
  const dx = clamp((x - (FOREST.x - BLEND)) / (BLEND * 2), 0, 1);
  const dy = clamp(((FOREST.y + FOREST.h) + BLEND - y) / (BLEND * 2), 0, 1);
  return dx * dy;
}

// ---------------------------------------------------------------- farming --
export const PLOTS = [];
for (let r = 0; r < 2; r++) {
  for (let c = 0; c < 4; c++) {
    PLOTS.push({ id: r * 4 + c, x: 660 + c * 135, y: 1660 + r * 155, w: 100, h: 100 });
  }
}

// ------------------------------------------------------------- structures --
export const BUILT = {
  cottage: { x: 330, y: 1740, w: 240, h: 180 },
  shelf: { x: 585, y: 1875, w: 70, h: 46 },
  workbench: { x: 880, y: 1470, w: 110, h: 80 },
  lanternStation: { x: 1060, y: 1490, w: 130, h: 92 },
  board: { x: 268, y: 1512, w: 84, h: 62 },
  bigTree: { x: 940, y: 2050 }, // center of trunk
  arch: { x: 1350, y: 1250 },
  // restored structures (appear once restored)
  seedkeeperHut: { x: 600, y: 1340, w: 150, h: 110 },
  workshop: { x: 1210, y: 1360, w: 150, h: 110 },
  teahouse: { x: 220, y: 1960, w: 160, h: 120 },
};

export const RESTORE_PROJECTS = [
  {
    id: 'seedkeeper', name: 'Seedkeeper Hut', cost: 40,
    at: BUILT.seedkeeperHut,
    desc: 'Unlocks rare seeds for the plots (Dreamleaf).',
  },
  {
    id: 'workshop', name: 'Lantern Workshop', cost: 60,
    at: BUILT.workshop,
    desc: 'Unlocks Dreamcap fuel and a brighter lantern.',
  },
  {
    id: 'teahouse', name: 'Tea House', cost: 50,
    at: BUILT.teahouse,
    desc: 'Unlocks Moonlight Tea — a warm treat to savor.',
  },
];

// ---------------------------------------------------------------- forest ---
export const STREAM = { x0: 2090, x1: 2210, y0: 130, y1: 1430 };
export const BRIDGE = { x: 2050, y: 918, w: 200, h: 64 };
export const THICKET = { x: 2280, y: 1120, w: 190, h: 170 };
export const DEEP_PATH = { x: 2392, y: 236, w: 116, h: 250 }; // locked until stone circle solved
export const DEEP_ARCH = { x: 2450, y: 268 };
export const STONE_CIRCLE = { x: 2450, y: 600, r: 96 };
export const STONES = [
  { id: 'spore', x: 2450, y: 492, glyph: 'moonspore' },
  { id: 'petal', x: 2358, y: 656, glyph: 'sunpetal' },
  { id: 'cap', x: 2542, y: 656, glyph: 'dreamcap' },
];
export const STONE_ORDER = ['sunpetal', 'moonspore', 'dreamcap']; // "gold first, blue next, violet last"

export const FLOWERS = [
  { id: 0, x: 1798, y: 836, color: 'moonspore' },
  { id: 1, x: 1862, y: 872, color: 'sunpetal' },
  { id: 2, x: 1826, y: 916, color: 'dreamcap' },
];
export const FLOWER_ORDER = ['moonspore', 'sunpetal', 'dreamcap']; // "blue first, then gold, violet last"

export const SPIRIT_POS = {
  mori: { x: 2010, y: 1258 },
  luma: { x: 2450, y: 585 },
  nix: { x: 2842, y: 436 },
};

export const GARDEN = { x: 2610, y: 300, w: 340, h: 260 };
export const MOONFLOWER_PLOT = { x: 2766, y: 372, w: 74, h: 64 };
export const DREAM_POD = { x: 2676, y: 476 };
export const POUCH = { x: 2380, y: 1215 }; // inside the thicket (Beast only)
export const REST_STONE = { x: 2706, y: 1150 };
export const TRAIL = [ // hidden trail: entrance area -> hidden garden
  [1980, 820], [2150, 760], [2330, 700], [2470, 640], [2560, 590], [2620, 540], [2680, 500], [2740, 460],
];

export const POSTS = [
  { x: 1650, y: 1120, key: 'flowers' },
  { x: 2050, y: 1010, key: 'bridge' },
  { x: 2296, y: 872, key: 'stones' },
  { x: 2630, y: 420, key: 'moonflower' },
];

// -------------------------------------------------------- zones & explore --
export const ZONES = [
  { id: 'grove', name: 'The Grove', layer: 0, rect: { x: 0, y: 0, w: 3000, h: 2200 } },
  { id: 'forest-entrance', name: 'Forest Entrance', layer: 1, rect: { x: 1350, y: 860, w: 620, h: 590 } },
  { id: 'stream', name: 'Glowing Stream', layer: 1, rect: { x: 1970, y: 900, w: 330, h: 550 } },
  { id: 'stone-circle', name: 'Ancient Stone Circle', layer: 2, rect: { x: 2270, y: 380, w: 380, h: 460 } },
  { id: 'garden', name: 'Hidden Garden', layer: 2, rect: GARDEN },
  { id: 'clearing', name: 'Spirit Clearing', layer: 2, rect: { x: 2520, y: 950, w: 460, h: 400 } },
  { id: 'deep', name: 'Deep Twilight', layer: 3, rect: { x: 2360, y: 200, w: 190, h: 330 } },
];

// ----------------------------------------------------------- walkability ---
export function inStream(x, y) {
  return x >= STREAM.x0 && x <= STREAM.x1 && y >= STREAM.y0 && y <= STREAM.y1;
}

export function inBridge(x, y) {
  return inRect(x, y, BRIDGE.x, BRIDGE.y, BRIDGE.w, BRIDGE.h);
}

function buildCollisions(restored) {
  const list = [
    BUILT.cottage, BUILT.shelf, BUILT.workbench, BUILT.lanternStation, BUILT.board,
    { x: STONE_CIRCLE.x - 26, y: STONE_CIRCLE.y - 22, w: 52, h: 44 }, // pedestal
    { x: STONES[0].x - 20, y: STONES[0].y - 26, w: 40, h: 52 },
    { x: STONES[1].x - 20, y: STONES[1].y - 26, w: 40, h: 52 },
    { x: STONES[2].x - 20, y: STONES[2].y - 26, w: 40, h: 52 },
    { x: REST_STONE.x - 42, y: REST_STONE.y - 30, w: 84, h: 60 },
    { x: DEEP_ARCH.x - 40, y: DEEP_ARCH.y - 30, w: 80, h: 60 },
    { x: BUILT.bigTree.x - 46, y: BUILT.bigTree.y - 40, w: 92, h: 80 },
  ];
  if (restored.seedkeeper) list.push(BUILT.seedkeeperHut);
  if (restored.workshop) list.push(BUILT.workshop);
  if (restored.teahouse) list.push(BUILT.teahouse);
  return list;
}
let _collisionCache = null;
let _collisionKey = '';

export function isWalkable(x, y, axieCls, game) {
  if (x < 18 || y < 18 || x > WORLD.w - 18 || y > WORLD.h - 18) return false;

  // water
  if (inStream(x, y)) {
    if (axieCls === 'aquatic') return true; // Ripple Step
    if (game.puzzles.bridgeRevealed && inBridge(x, y)) return true;
    return false;
  }

  // brambles (Beast: Vinebreaker)
  if (inRect(x, y, THICKET.x, THICKET.y, THICKET.w, THICKET.h) && axieCls !== 'beast') return false;

  // locked deep path
  if (inRect(x, y, DEEP_PATH.x, DEEP_PATH.y, DEEP_PATH.w, DEEP_PATH.h) && !game.puzzles.stonesDone) return false;

  // buildings & solid objects
  const key = `${game.restored.seedkeeper}|${game.restored.workshop}|${game.restored.teahouse}`;
  if (key !== _collisionKey) {
    _collisionCache = buildCollisions(game.restored);
    _collisionKey = key;
  }
  for (const c of _collisionCache) {
    if (inRect(x, y, c.x, c.y, c.w, c.h, 8)) return false;
  }
  return true;
}

// --------------------------------------------------------------- decor ----
function seededDecor() {
  const rnd = mulberry32(20260906);
  const avoid = (x, y) => {
    if (inRect(x, y, 240, 1300, 1150, 850)) return true; // grove structure area
    if (inRect(x, y, 620, 1600, 560, 330)) return true; // plots
    if (inRect(x, y, STREAM.x0 - 60, STREAM.y0 - 40, STREAM.x1 - STREAM.x0 + 120, STREAM.y1 - STREAM.y0 + 80)) return true;
    if (inRect(x, y, GARDEN.x - 30, GARDEN.y - 30, GARDEN.w + 60, GARDEN.h + 60)) return true;
    if (inRect(x, y, THICKET.x - 20, THICKET.y - 20, THICKET.w + 40, THICKET.h + 40)) return true;
    if (inRect(x, y, REST_STONE.x - 90, REST_STONE.y - 90, 180, 180)) return true;
    if (inRect(x, y, STONE_CIRCLE.x - 170, STONE_CIRCLE.y - 170, 340, 340)) return true;
    if (inRect(x, y, DEEP_ARCH.x - 90, DEEP_ARCH.y - 140, 180, 260)) return true;
    return false;
  };

  const groveTrees = [];
  let tries = 0;
  while (groveTrees.length < 24 && tries++ < 400) {
    const x = 60 + rnd() * 1280;
    const y = 260 + rnd() * 1880;
    if (avoid(x, y)) continue;
    if (inRect(x, y, 1290, 1140, 140, 240)) continue; // keep arch approach clear
    groveTrees.push({ x, y, s: 0.7 + rnd() * 0.8, t: rnd() });
  }

  const groveFlowers = [];
  tries = 0;
  while (groveFlowers.length < 46 && tries++ < 500) {
    const x = 40 + rnd() * 1320;
    const y = 220 + rnd() * 1920;
    if (avoid(x, y)) continue;
    groveFlowers.push({ x, y, c: Math.floor(rnd() * 4), s: 0.6 + rnd() * 0.7 });
  }

  const forestTrees = [];
  tries = 0;
  while (forestTrees.length < 42 && tries++ < 600) {
    const x = 1390 + rnd() * 1580;
    const y = 60 + rnd() * 1350;
    if (avoid(x, y)) continue;
    if (x < 2050 && y > 1000 && x > 1600 && y < 1200) continue; // keep entrance path clear
    forestTrees.push({ x, y, s: 0.8 + rnd() * 0.9, t: rnd() });
  }

  const forestGlow = [];
  tries = 0;
  while (forestGlow.length < 30 && tries++ < 500) {
    const x = 1400 + rnd() * 1570;
    const y = 60 + rnd() * 1360;
    if (avoid(x, y)) continue;
    if (inStream(x, y)) continue;
    forestGlow.push({ x, y, c: Math.floor(rnd() * 3), s: 0.5 + rnd() * 0.8 });
  }

  const mottles = [];
  for (let i = 0; i < 90; i++) {
    mottles.push({ x: rnd() * WORLD.w, y: rnd() * WORLD.h, r: 30 + rnd() * 90, dark: rnd() > 0.5 });
  }

  return { groveTrees, groveFlowers, forestTrees, forestGlow, mottles };
}

export const DECOR = seededDecor();

// Points of interest for Bird "Sky Sight" beacons.
export const POIS = [
  { x: 1830, y: 875, label: 'Old flowers' },
  { x: 2150, y: 950, label: 'The stream crossing' },
  { x: 2450, y: 600, label: 'Stone circle' },
  { x: 2770, y: 420, label: 'Hidden garden' },
  { x: 2706, y: 1150, label: 'Spirit clearing' },
  { x: 2450, y: 268, label: 'Deep Twilight' },
];
