// ---------------------------------------------------------------------------
// AXIE ECOSYSTEM ARCHITECTURE — bond.
//
// The player IS the Axie, so this is a harmony-with-the-grove system: a
// small, non-punishing measure of how attuned you are to Lunacia. Nothing
// to lose; caring for the grove (and yourself) only ever rewards you.
//
//   L1 (start)  the lantern is lit; the grove wakes to your care
//   L2          you scent bonus seeds left in the soil
//   L3          you sense hidden luminous things
//   L4          you can sing the Grove Song (grove-wide growth)
//   L5          the lantern learns Ember Pulse (a wave that reveals all)
// ---------------------------------------------------------------------------

import { emitProgressionEvent } from '../core/events.js';
import { clamp } from '../core/utils.js';

export const BOND_LEVELS = [
  { level: 1, xp: 0, name: 'Kindled', perk: 'The lantern is lit. The grove wakes to your care.' },
  { level: 2, xp: 40, name: 'Trusted', perk: 'You scent bonus seeds left in the soil.' },
  { level: 3, xp: 100, name: 'Kindred', perk: 'You sense hidden luminous things.' },
  { level: 4, xp: 180, name: 'Cherished', perk: 'You can sing the Grove Song.' },
  { level: 5, xp: 300, name: 'Soulbound', perk: 'The lantern learns Ember Pulse (press L).' },
];

export function bondLevelFor(xp) {
  let level = 1;
  for (const b of BOND_LEVELS) if (xp >= b.xp) level = b.level;
  return level;
}

export function addBondXp(game, amount, reason = '') {
  const before = game.bondLevel;
  game.bondXp = clamp(game.bondXp + amount, 0, 9999);
  game.bondLevel = bondLevelFor(game.bondXp);
  if (game.bondLevel > before) {
    emitProgressionEvent('AXIE_BOND_CHANGED', {
      axieId: game.axieId,
      from: before,
      to: game.bondLevel,
      reason,
    });
  }
  return game.bondLevel;
}
