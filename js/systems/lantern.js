// The Lantern — the heart of the night phase.
// Three fuels, three colors, three different ways to see the Twilight.

import { dist } from '../core/utils.js';

export const FUELS = {
  moonspore: {
    id: 'moonspore', name: 'Moonspore', color: '#9cc8ff', key: '1',
    desc: 'Pale blue light. Reveals hidden paths and old ways.',
  },
  sunpetal: {
    id: 'sunpetal', name: 'Sunpetal', color: '#ffd166', key: '2',
    desc: 'Golden light. Quickens the growth of nearby plants.',
  },
  dreamcap: {
    id: 'dreamcap', name: 'Dreamcap', color: '#c79bff', key: '3',
    desc: 'Violet light. Reveals forest spirits and hidden things.',
  },
};

export const FUEL_ORDER = ['moonspore', 'sunpetal', 'dreamcap'];

export function lightRadius(game) {
  let r = 175;
  if (game.restored.workshop) r += 55;
  if (game.axieCls === 'reptile') r *= 1.15; // Twilight Skin
  return r;
}

export function fuelColor(game) {
  return game.fuel ? FUELS[game.fuel].color : null;
}

/**
 * Is a hidden thing currently revealed at (x, y)?
 * kind: 'path' (moonspore) | 'secret' (dreamcap) | 'plant' (dreamcap)
 * Ember Pulse (bond 5) reveals everything briefly.
 */
export function isRevealed(game, kind, x, y) {
  if (game.fx.pulseT > 0) return true;
  const d = dist(game.px, game.py, x, y);
  if (d > lightRadius(game) + 30) return false;
  if (kind === 'path') return game.fuel === 'moonspore';
  if (kind === 'secret' || kind === 'plant') return game.fuel === 'dreamcap';
  return false;
}

/** Bond level 3: the Axie shimmers things that are hidden, close by. */
export function isSensed(game, x, y) {
  if (game.bondLevel >= 3 && dist(game.px, game.py, x, y) < 420) return true;
  return false;
}

/** Sunpetal light: crops inside the lantern radius grow faster. */
export function sunpetalBoost(game, x, y) {
  if (game.fuel === 'sunpetal' && dist(game.px, game.py, x, y) <= lightRadius(game)) return 1.3;
  return 1;
}
