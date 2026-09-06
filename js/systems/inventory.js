// AXIE ECOSYSTEM ARCHITECTURE — inventory.
// The Axie's satchel: seeds, produce, lantern fuel, treats, special objects.
// Kept as plain counts so a future provider can back it with real data.

import { emitProgressionEvent } from '../core/events.js';
import { addJournalRecent } from '../game/state.js';

export const SEED_NAMES = {
  glowberry: 'Glowberry Seed',
  mooncap: 'Mooncap Seed',
  starroot: 'Starroot Seed',
  whisperfern: 'Whisper Fern Seed',
  sunbud: 'Sunbud Seed',
  lunapear: 'Lunapear Seed',
  dreamleaf: 'Dreamleaf Seed',
  moonflower: 'Moonflower Seed',
};

export function addSeed(game, id, n = 1) {
  game.inv.seeds[id] = (game.inv.seeds[id] || 0) + n;
  if (!game.journal.seeds.includes(id)) {
    game.journal.seeds.push(id);
    emitProgressionEvent('AXIE_DISCOVERED_SEED', { axieId: game.axieId, seed: id });
  }
}

export function addProduce(game, id, n = 1) {
  game.inv.produce[id] = (game.inv.produce[id] || 0) + n;
}

export function removeProduce(game, id, n = 1) {
  if ((game.inv.produce[id] || 0) < n) return false;
  game.inv.produce[id] -= n;
  return true;
}

export function hasIngredients(game, list) {
  return list.every(([id, n]) => (game.inv.produce[id] || 0) >= n);
}

export function spendIngredients(game, list) {
  for (const [id, n] of list) game.inv.produce[id] -= n;
}

/** Record a newly discovered seed (rare finds, gifts). */
export function discoverSeed(game, id) {
  if (!game.journal.seeds.includes(id)) game.journal.seeds.push(id);
}

export function hasSpecial(game, id) {
  return !!game.inv.special[id];
}

export function setSpecial(game, id) {
  game.inv.special[id] = true;
  if (!game.journal.objects.includes(id)) {
    game.journal.objects.push(id);
    emitProgressionEvent('AXIE_DISCOVERED_OBJECT', { axieId: game.axieId, object: id });
    addJournalRecent(game, `Found ${OBJECT_NAMES[id] || id}`);
  }
}

export const OBJECT_NAMES = {
  'dream-pod': 'Dream Pod',
  'starroot-pouch': 'Starroot Pouch',
};
