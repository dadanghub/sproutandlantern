// Crafting: lantern fuel at the Lantern Station, treats at the Workbench.
// Recipes appear once their ingredients are known (discovery-driven unlock).

import { emitProgressionEvent } from '../core/events.js';
import { hasIngredients, spendIngredients } from './inventory.js';
import { FUELS } from './lantern.js';

export const FUEL_RECIPES = [
  {
    id: 'moonspore', name: 'Moonspore Fuel',
    needs: [['glowberry', 3]],
    unlock: (g) => g.journal.plants.includes('glowberry') || g.journal.seeds.includes('glowberry'),
    desc: FUELS.moonspore.desc,
  },
  {
    id: 'sunpetal', name: 'Sunpetal Fuel',
    needs: [['sunbud', 2], ['glowberry', 1]],
    unlock: (g) => g.journal.plants.includes('sunbud') || g.journal.seeds.includes('sunbud'),
    desc: FUELS.sunpetal.desc,
  },
  {
    id: 'dreamcap', name: 'Dreamcap Fuel',
    needs: [['dreamleaf', 2], ['mooncap', 1]],
    unlock: (g) => g.restored.workshop && (g.journal.plants.includes('dreamleaf') || g.journal.seeds.includes('dreamleaf')),
    desc: 'Unlocked by the Lantern Workshop. ' + FUELS.dreamcap.desc,
  },
];

export function visibleFuelRecipes(game) {
  return FUEL_RECIPES.filter((r) => r.unlock(game));
}

export function craftFuel(game, recipeId) {
  const r = FUEL_RECIPES.find((x) => x.id === recipeId);
  if (!r || !r.unlock(game)) return false;
  if (!hasIngredients(game, r.needs)) return false;
  spendIngredients(game, r.needs);
  game.inv.fuel[recipeId] += 1;
  game.flags.firstFuel = true;
  if (!game.journal.fuels.includes(recipeId)) {
    game.journal.fuels.push(recipeId);
    emitProgressionEvent('AXIE_DISCOVERED_FUEL', { axieId: game.axieId, fuel: recipeId });
  }
  emitProgressionEvent('AXIE_CRAFTED_FUEL', { axieId: game.axieId, fuel: recipeId });
  return true;
}

// ---------------------------------------------------------------- treats --
export const TREAT_RECIPES = [
  {
    id: 'bun', name: 'Honey Bun',
    needs: [['glowberry', 1]],
    unlock: (g) => true,
    bond: 8,
    desc: 'A warm little treat. (Bond +)',
  },
  {
    id: 'tea', name: 'Moonlight Tea',
    needs: [['mooncap', 1], ['glowberry', 1]],
    unlock: (g) => g.restored.teahouse,
    bond: 18,
    desc: 'Unlocked by the Tea House. Steeped in mooncap. (Bond ++)',
  },
];

export function visibleTreatRecipes(game) {
  return TREAT_RECIPES.filter((r) => r.unlock(game));
}

export function craftTreat(game, recipeId) {
  const r = TREAT_RECIPES.find((x) => x.id === recipeId);
  if (!r || !r.unlock(game) || !hasIngredients(game, r.needs)) return false;
  spendIngredients(game, r.needs);
  game.inv.treats[r.id] = (game.inv.treats[r.id] || 0) + 1;
  emitProgressionEvent('AXIE_CRAFTED_TREAT', { axieId: game.axieId, treat: r.id });
  return true;
}

export function feedTreat(game, treatId) {
  if ((game.inv.treats[treatId] || 0) <= 0) return null;
  const r = TREAT_RECIPES.find((x) => x.id === treatId);
  if (!r) return null;
  game.inv.treats[treatId]--;
  return r;
}
