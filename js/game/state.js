// Central game state. `newGame` builds a fresh run; `hydrateGame` merges a
// saved state back over defaults so old saves survive new fields.

import { PLOTS } from '../world/map.js';

export function newGame(axieDef) {
  return {
    // Axie identity (see axie/ for the integration architecture)
    axieId: axieDef.id,
    axieName: axieDef.name,
    axieCls: axieDef.cls,

    // player
    px: 470,
    py: 1990,
    facing: 1,
    walkT: 0,
    moving: false,
    // the player IS the Axie — happy anim after savoring a treat
    axieHappyT: 0,

    phaseT: 0,
    time: 0,

    // economy (fictional soft currency — no token mechanics by design)
    glowdust: 10,

    // farming
    plots: PLOTS.map(() => ({ crop: null, progress: 0, wateredT: 0 })),

    // inventory: { seeds, produce, fuel, treats, special }
    inv: {
      seeds: { glowberry: 3 },
      produce: { glowberry: 0, mooncap: 0, starroot: 0, sunbud: 0, lunapear: 0, whisperfern: 0, dreamleaf: 0, moonflower: 0 },
      // Moonspore is crafted by the player (first crafting lesson);
      // one of each other fuel comes from the old lantern cache.
      fuel: { moonspore: 0, sunpetal: 1, dreamcap: 1 },
      treats: { bun: 0, tea: 0 },
      special: {},
    },
    fuel: null, // currently lit fuel: 'moonspore' | 'sunpetal' | 'dreamcap' | null
    selectedSeed: 'glowberry',

    // restoration
    restored: { seedkeeper: false, workshop: false, teahouse: false },

    // puzzles
    puzzles: {
      flowerSeq: 0,
      flowersDone: false,
      bridgeRevealed: false,
      stoneSeq: 0,
      stonesDone: false,
    },

    // spirits
    spirits: {
      mori: { met: false, requestDone: false, lastPet: 0 },
      luma: { met: false, lastHint: 0 },
      nix: { met: false, lastGift: 0 },
    },

    // exploration
    areas: { grove: true, 'forest-entrance': false, stream: false, 'stone-circle': false, garden: false, clearing: false, deep: false },
    deepest: 0,

    // bond
    bondXp: 0,
    bondLevel: 1,

    // grovekeeper progression
    level: 1,

    // journal (arrays so JSON save stays simple)
    journal: {
      plants: [],
      seeds: ['glowberry'],
      spirits: [],
      fuels: [],
      objects: [],
      recent: [],
    },

    flags: {
      planted: false,
      harvested: false,
      firstFuel: false,
      enteredForest: false,
      moonflower: false,
      deepPath: false,
      endingSeen: false,
      restCooldown: 0,
    },

    // soft timers / effects
    fx: {
      flash: 0,
      songT: 0,
      pulseT: 0,
      bonusSeed: null, // {x,y}
      bonusTimer: 60,
      endingDelay: -1,
    },

    // cooldown bookkeeping
    times: { save: 0 },
  };
}

export function hydrateGame(saved, axieDef) {
  const g = newGame(axieDef);
  for (const k of Object.keys(saved)) {
    if (k in g) {
      if (saved[k] && typeof saved[k] === 'object' && !Array.isArray(saved[k]) && typeof g[k] === 'object' && g[k] && !Array.isArray(g[k])) {
        g[k] = { ...g[k], ...saved[k] };
        // second level merge for nested objects
        for (const sub of Object.keys(g[k])) {
          if (g[k][sub] && typeof g[k][sub] === 'object' && saved[k][sub] && typeof saved[k][sub] === 'object') {
            g[k][sub] = { ...g[k][sub], ...saved[k][sub] };
          }
        }
      } else {
        g[k] = saved[k];
      }
    }
  }
  return g;
}

export function addJournalRecent(game, text) {
  game.journal.recent.unshift({ text, at: game.time });
  if (game.journal.recent.length > 6) game.journal.recent.pop();
}
