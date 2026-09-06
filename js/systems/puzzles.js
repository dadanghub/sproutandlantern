// Three light puzzles. All are gentle: wrong light does nothing but dim,
// and every puzzle is repeatable-safe (state persists).

import { emitProgressionEvent } from '../core/events.js';
import { Particles } from '../core/particles.js';
import { dist } from '../core/utils.js';
import { FLOWERS, FLOWER_ORDER, STONES, STONE_ORDER, BRIDGE, SPIRIT_POS } from '../world/map.js';
import { lightRadius } from './lantern.js';
import { addSeed } from './inventory.js';
import { addBondXp } from '../axie/bond.js';
import { addJournalRecent } from '../game/state.js';

// --- Puzzle 1: light the three old flowers in order (teaches the fuels) ---
export function updateFlowerPuzzle(game, dt) {
  if (game.puzzles.flowersDone) return;
  // only the *next expected* flower can be lit — order matters
  const next = FLOWERS.find((f) => f.id === game.puzzles.flowerSeq);
  if (next && dist(game.px, game.py, next.x, next.y) < 62) {
    if (game.fuel === next.color && game.inv.fuel[next.color] > 0) {
      lightFlower(game, next);
    }
  }
}

export function lightFlower(game, f) {
  game.puzzles.flowerSeq = f.id + 1;
  Particles.sparkle(f.x, f.y - 12, '#ffffff', 10, 60);
  if (game.puzzles.flowerSeq >= FLOWERS.length) {
    game.puzzles.flowersDone = true;
    game.glowdust += 25;
    addSeed(game, 'mooncap', 2);
    addBondXp(game, 15, 'solved puzzle');
    emitProgressionEvent('AXIE_SOLVED_PUZZLE', { axieId: game.axieId, puzzle: 'old-flowers' });
    addJournalRecent(game, 'The old flowers remembered the light');
  }
}

// --- Puzzle 2: Moonspore light reveals the invisible bridge ---
export function updateBridgePuzzle(game) {
  if (game.puzzles.bridgeRevealed) return false;
  const cx = BRIDGE.x + BRIDGE.w / 2;
  const cy = BRIDGE.y + BRIDGE.h / 2;
  if (dist(game.px, game.py, cx, cy) < lightRadius(game) * 0.8 && game.fuel === 'moonspore' && game.inv.fuel.moonspore > 0) {
    game.puzzles.bridgeRevealed = true;
    game.glowdust += 10;
    emitProgressionEvent('AXIE_SOLVED_PUZZLE', { axieId: game.axieId, puzzle: 'invisible-bridge' });
    addJournalRecent(game, 'Revealed the old bridge with moonlight');
    Particles.sparkle(cx, cy, '#9cc8ff', 20, 90);
    Particles.ring(cx, cy, '#9cc8ff', 90);
    return true;
  }
  return false;
}

// --- Puzzle 3: light the ancient stones as the carving tells ---
export function updateStonePuzzle(game) {
  if (game.puzzles.stonesDone) return;
  for (const s of STONES) {
    const idx = STONE_ORDER.indexOf(s.glyph);
    if (game.puzzles.stoneSeq === idx && dist(game.px, game.py, s.x, s.y) < 62) {
      if (game.fuel === s.glyph && game.inv.fuel[s.glyph] > 0) {
        game.puzzles.stoneSeq = idx + 1;
        Particles.sparkle(s.x, s.y - 20, '#ffffff', 12, 70);
        if (game.puzzles.stoneSeq >= STONE_ORDER.length) {
          game.puzzles.stonesDone = true;
          game.flags.deepPath = true;
          game.glowdust += 40;
          addSeed(game, 'whisperfern', 2);
          addBondXp(game, 15, 'solved puzzle');
          emitProgressionEvent('AXIE_SOLVED_PUZZLE', { axieId: game.axieId, puzzle: 'stone-circle' });
          addJournalRecent(game, 'The stone circle opened the Deep Twilight');
          Particles.ring(STONES[0].x, STONES[0].y - 40, '#c79bff', 140);
        }
      }
    }
  }
}

export function isStoneLit(game, s) {
  const idx = STONE_ORDER.indexOf(s.glyph);
  return game.puzzles.stoneSeq > idx;
}

export function isFlowerLit(game, f) {
  return game.puzzles.flowerSeq > f.id;
}
