// Grove restoration: paying in Glowdust visibly rebuilds the world
// (rubble -> lit building -> new function). No bare progress bars.

import { emitProgressionEvent } from '../core/events.js';
import { RESTORE_PROJECTS } from '../world/map.js';
import { Particles } from '../core/particles.js';
import { addJournalRecent } from '../game/state.js';

export function restoreCost(id) {
  const p = RESTORE_PROJECTS.find((x) => x.id === id);
  return p ? p.cost : 0;
}

export function tryRestore(game, id) {
  const p = RESTORE_PROJECTS.find((x) => x.id === id);
  if (!p || game.restored[id]) return false;
  if (game.glowdust < p.cost) return false;
  game.glowdust -= p.cost;
  game.restored[id] = true;
  emitProgressionEvent('AXIE_RESTORED_STRUCTURE', { axieId: game.axieId, structure: id });
  addJournalRecent(game, `Restored the ${p.name}`);
  Particles.puff(p.at.x + p.at.w / 2, p.at.y + p.at.h / 2, '#ffe9c4', 14, 60);
  Particles.ring(p.at.x + p.at.w / 2, p.at.y + p.at.h / 2, '#ffd98a', 110);
  return true;
}

export function restoredCount(game) {
  return [game.restored.seedkeeper, game.restored.workshop, game.restored.teahouse].filter(Boolean).length;
}
