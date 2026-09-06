// Forest spirits: cute, curious, never hostile.
// Mori — a mushroom spirit by the stream (asks for a small gift)
// Luma — a firefly spirit at the stone circle (gives the riddle)
// Nix  — a shy shadow in the hidden garden (revealed by Dreamcap light)

import { emitProgressionEvent } from '../core/events.js';
import { Particles } from '../core/particles.js';
import { SPIRIT_POS } from '../world/map.js';
import { removeProduce, addSeed, setSpecial } from './inventory.js';
import { addBondXp } from '../axie/bond.js';
import { addJournalRecent } from '../game/state.js';

export const SPIRITS = [
  { id: 'mori', name: 'Mori', kind: 'mushroom', pos: SPIRIT_POS.mori },
  { id: 'luma', name: 'Luma', kind: 'firefly', pos: SPIRIT_POS.luma },
  { id: 'nix', name: 'Nix', kind: 'shadow', pos: SPIRIT_POS.nix },
];

export function isNixVisible(game) {
  if (game.spirits.nix.met) return true;
  if (game.fx.pulseT > 0) return true;
  if (game.bondLevel >= 3) return true; // Spore-sense / Kindred bond
  return game.fuel === 'dreamcap';
}

export function befriended(game, id) {
  const s = game.spirits[id];
  if (id === 'mori') return s.requestDone;
  if (id === 'luma') return s.met;
  if (id === 'nix') return s.met;
  return false;
}

export function befriend(game, id, name) {
  const s = game.spirits[id];
  const first = !s.met;
  s.met = true;
  if (first && !game.journal.spirits.includes(id)) {
    game.journal.spirits.push(id);
    emitProgressionEvent('AXIE_DISCOVERED_SPIRIT', { axieId: game.axieId, spirit: id });
    addBondXp(game, 10, `befriended ${name}`);
    addJournalRecent(game, `Befriended ${name}`);
  }
  return first;
}

export function spiritDialogue(game, id) {
  const s = game.spirits[id];
  if (id === 'mori') {
    if (!s.met) {
      return [
        { who: 'Mori', text: 'Oh! Oh oh! A little keeper, with a lantern! The stream sang your name.' },
        { who: 'Mori', text: 'I am Mori. I grow where the water hums. Would you share something sweet with me?' },
      ];
    }
    if (!s.requestDone) {
      if ((game.inv.produce.glowberry || 0) >= 2) {
        return [{ who: 'Mori', text: 'Glowberries! Two, maybe? The sweet things grow best where the light is kind.' }];
      }
      return [{ who: 'Mori', text: 'Two Glowberries, if you have them. Sweet things make a mushroom brave.' }];
    }
    return [
      { who: 'Mori', text: 'The stream says you are doing well, keeper. It hums a little louder for you now.' },
      { who: 'Mori', text: 'If the gold light works on your plants, the violet light works on shy things. Remember that.' },
    ];
  }
  if (id === 'luma') {
    if (!s.met) {
      return [
        { who: 'Luma', text: 'Blink... blink. You found the circle.' },
        { who: 'Luma', text: 'Three stones sleep here. Gold first. Blue next. Violet wakes last.' },
      ];
    }
    if (!game.puzzles.stonesDone) {
      return [{ who: 'Luma', text: 'Gold first. Blue next. Violet wakes last. Carry the right light to each stone.' }];
    }
    return [{ who: 'Luma', text: 'The way is open now. The deep Twilight will watch you walk it. It is not unkind.' }];
  }
  // nix
  if (!s.met) {
    return [
      { who: 'Nix', text: 'You... can see me? The violet light is soft on my skin.' },
      { who: 'Nix', text: 'I hid here when the Grove forgot. Take this — a moonflower seed. Plant it where you sleep.' },
    ];
  }
  return [
    { who: 'Nix', text: 'The garden hides from the sun, but not from you. You are the first to bring it company in a long time.' },
  ];
}

export function completeSpiritInteraction(game, id) {
  const pos = SPIRIT_POS[id];
  if (id === 'mori' && !game.spirits.mori.requestDone) {
    if (removeProduce(game, 'glowberry', 2)) {
      game.spirits.mori.requestDone = true;
      game.glowdust += 30;
      addBondXp(game, 15, 'spirit request');
      emitProgressionEvent('AXIE_SPIRIT_REQUEST', { axieId: game.axieId, spirit: id, reward: 30 });
      Particles.sparkle(pos.x, pos.y - 14, '#ffd166', 16, 70);
      return { type: 'gift', text: 'Mori presses 30 Glowdust into your palm. “For the light.”' };
    }
  }
  if (id === 'nix' && !game.spirits.nix.met) {
    game.spirits.nix.met = true;
    addSeed(game, 'moonflower', 1);
    addProduceForGift(game);
    game.glowdust += 15;
    addBondXp(game, 10, 'befriended Nix');
    if (!game.journal.spirits.includes('nix')) {
      game.journal.spirits.push('nix');
      emitProgressionEvent('AXIE_DISCOVERED_SPIRIT', { axieId: game.axieId, spirit: 'nix' });
    }
    emitProgressionEvent('AXIE_SPIRIT_GIFT', { axieId: game.axieId, spirit: 'nix', gift: 'moonflower-seed' });
    Particles.sparkle(pos.x, pos.y - 14, '#c79bff', 18, 80);
    return { type: 'gift', text: 'Nix presses a Moonflower Seed and a Dreamleaf into your palm. +15 Glowdust.' };
  }
  return null;
}

function addProduceForGift(game) {
  game.inv.produce.dreamleaf = (game.inv.produce.dreamleaf || 0) + 1;
}
