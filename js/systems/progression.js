// AXIE ECOSYSTEM ARCHITECTURE — progression + journal.
//
// AxieProgression: five short Grovekeeper levels. Each is a real milestone,
// not a number: plant -> craft light -> walk twilight -> restore workshop ->
// open the Deep Twilight.
//
// AxieJournal: the Axie's personal adventure history (see GROVE JOURNAL UI).

import { emitProgressionEvent } from '../core/events.js';
import { ZONES, DEEP_PATH } from '../world/map.js';
import { isWalkable } from '../world/map.js';
import { Particles } from '../core/particles.js';
import { dist } from '../core/utils.js';
import { addBondXp } from '../axie/bond.js';
import { addJournalRecent } from '../game/state.js';

export const LEVELS = [
  { id: 1, name: 'Gardener', desc: 'Plant, water, and harvest your first crop.' },
  { id: 2, name: 'Lightmaker', desc: 'Craft your first lantern fuel.' },
  { id: 3, name: 'Twilight Walker', desc: 'Enter the Twilight and light the old flowers.' },
  { id: 4, name: 'Restorer', desc: 'Restore the Lantern Workshop.' },
  { id: 5, name: 'Grovekeeper', desc: 'Open the path into the Deep Twilight.' },
];

export function computeLevel(game) {
  if (game.puzzles.stonesDone) return 5;
  if (game.restored.workshop) return 4;
  if (game.puzzles.flowersDone) return 3;
  if (game.flags.firstFuel) return 2;
  if (game.flags.harvested) return 1;
  return 0;
}

/** Call after any milestone event; handles level-up fanfare. */
export function refreshLevel(game) {
  const lv = computeLevel(game);
  if (lv > game.level) {
    game.level = lv;
    emitProgressionEvent('AXIE_LEVEL_UP', { axieId: game.axieId, level: lv, title: LEVELS[lv - 1].name });
    Particles.sparkle(game.px, game.py - 30, '#ffd98a', 18, 80);
  }
}

/** Gentle quest hint shown at the bottom-left of the HUD. */
export function questHint(game) {
  if (game.flags.endingSeen) return 'The Grove remembers. Wander as long as you like.';
  if (!game.flags.planted) return `Plant a Glowberry — walk to a plot and press E.`;
  if (!game.flags.harvested) return `Water your crop (E), let it grow, then harvest (E).`;
  if (!game.flags.firstFuel) return `Craft Moonspore at the Lantern Station (E). It needs 3 Glowberries.`;
  if (!game.puzzles.flowersDone) return `Enter the Twilight. Light the three old flowers — blue, then gold, then violet (press 1 / 2 / 3).`;
  if (!game.puzzles.bridgeRevealed) return `Hold Moonspore light (1) near the stream — something waits in the mist.`;
  if (!game.puzzles.stonesDone) return `Light the three stones as the carving tells: gold, blue, violet.`;
  if (!game.restored.workshop) return `Restore the Lantern Workshop (E at the Restoration Board). 60 Glowdust.`;
  if (!game.flags.moonflower) return `Follow the hidden trail. Dreamcap light (3) reveals shy things.`;
  if (!game.flags.endingSeen) return `The Grove stirs...`;
  return '';
}

/** Exploration: first entry into a zone. */
export function updateZones(game) {
  for (const z of ZONES) {
    const r = z.rect;
    if (game.px < r.x || game.px > r.x + r.w || game.py < r.y || game.py > r.y + r.h) continue;
    if (z.id === 'deep' && !game.puzzles.stonesDone) continue;
    if (game.areas[z.id]) continue;
    game.areas[z.id] = true;
    if (z.layer > game.deepest) {
      const prev = game.deepest;
      game.deepest = z.layer;
      if (z.id !== 'grove' && z.layer > prev) {
        addJournalRecent(game, `The Twilight deepens — Layer ${z.layer}`);
      }
    }
    if (z.id !== 'grove') {
      addBondXp(game, 8, `explored ${z.name}`);
      emitProgressionEvent('AXIE_EXPLORED_TWILIGHT', { axieId: game.axieId, zone: z.id, layer: z.layer });
      if (!game.flags.enteredForest) game.flags.enteredForest = true;
      addJournalRecent(game, `Explored ${z.name}`);
    }
    break;
  }
}

/** Ending: rare Moonflower found + Lantern Workshop restored. */
export function updateEnding(game, dt) {
  if (game.flags.endingSeen) return;
  if (game.flags.moonflower && game.restored.workshop) {
    if (game.fx.endingDelay < 0) game.fx.endingDelay = 3.5;
    game.fx.endingDelay -= dt;
    if (game.fx.endingDelay <= 0) {
      game.flags.endingSeen = true;
      emitProgressionEvent('AXIE_COMPLETED_GROVE', {
        axieId: game.axieId,
        level: game.level,
        bond: game.bondLevel,
        structures: [game.restored.seedkeeper, game.restored.workshop, game.restored.teahouse].filter(Boolean).length,
      });
    }
  }
}
