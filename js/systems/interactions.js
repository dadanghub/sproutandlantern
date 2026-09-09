// The E-key interaction layer: finds the nearest meaningful thing near the
// player and dispatches to the right system. `ui` is a small callback bag
// supplied by main.js (keeps this module free of DOM imports).

import {
  PLOTS, BUILT, SPIRIT_POS, MOONFLOWER_PLOT, DREAM_POD, POUCH,
  REST_STONE, DEEP_ARCH, GROVE_LANTERN,
} from '../world/map.js';
import { PLANTS } from './plants.js';
import { plantCrop, waterCrop, harvestCrop } from './farming.js';
import { isNixVisible, spiritDialogue, completeSpiritInteraction, befriend } from './spirits.js';
import { addBondXp } from '../axie/bond.js';
import { audio } from '../core/audio.js';
import { Particles } from '../core/particles.js';
import { emitProgressionEvent } from '../core/events.js';
import { setSpecial } from './inventory.js';
import { addJournalRecent } from '../game/state.js';
import { dist, pick } from '../core/utils.js';
import { refreshLevel } from './progression.js';

export function currentInteraction(game) {
  const t = game;
  const cands = [];
  const push = (x, y, r, label, act, enabled = true, priority = 0) => {
    const d = dist(t.px, t.py, x, y);
    if (d <= r) cands.push({ x, y, d, label, act, enabled, priority });
  };

  // plots
  for (let i = 0; i < PLOTS.length; i++) {
    const plot = PLOTS[i];
    const p = game.plots[i];
    const cx = plot.x + plot.w / 2, cy = plot.y + plot.h / 2;
    if (!p.crop) {
      const hasSeed = Object.values(game.inv.seeds).some((n) => n > 0);
      push(cx, cy, 72, hasSeed ? 'Plant a seed' : 'Plant (no seeds — visit the shelf)', 'plant:' + i, hasSeed);
    } else if (p.progress >= 1) {
      push(cx, cy, 72, `Harvest ${PLANTS[p.crop].name}`, 'harvest:' + i, true, 1);
    } else {
      push(cx, cy, 72, p.wateredT > 0 ? `Tend ${PLANTS[p.crop].name}` : `Water ${PLANTS[p.crop].name}`, 'water:' + i);
    }
  }

  // grove structures
  push(BUILT.shelf.x + 35, BUILT.shelf.y + 20, 58, 'Buy seeds', 'shop');
  push(BUILT.lanternStation.x + 65, BUILT.lanternStation.y + 46, 70, 'Lantern & crafting', 'craft');
  push(BUILT.workbench.x + 55, BUILT.workbench.y + 40, 62, 'Craft treats', 'workbench');
  push(BUILT.board.x + 42, BUILT.board.y + 30, 56, 'Restoration board', 'board');

  // grove heart
  const tree = BUILT.bigTree;
  if (game.bondLevel >= 4 && game.fx.songT <= 0) {
    push(tree.x, tree.y + 46, 120, 'Sing the Grove Song', 'song');
  } else {
    push(tree.x, tree.y + 46, 120, 'The Grove Heart', 'tree', true, -1);
  }

  // spirits
  for (const id of ['mori', 'luma', 'nix']) {
    if (id === 'nix' && !isNixVisible(game)) continue;
    const pos = SPIRIT_POS[id];
    const names = { mori: 'Mori', luma: 'Luma', nix: 'Nix' };
    push(pos.x, pos.y, 60, `Speak with ${names[id]}`, 'spirit:' + id, true, 2);
  }

  // garden finds
  if (!game.flags.moonflower) {
    push(MOONFLOWER_PLOT.x + 37, MOONFLOWER_PLOT.y + 32, 58, 'Gather the Moonflower seed', 'moonflower', true, 2);
  }
  if (!hasSpecialFlag(game, 'dream-pod')) {
    push(DREAM_POD.x, DREAM_POD.y, 50, 'Open the dream pod', 'pod', true, 2);
  }
  if (!hasSpecialFlag(game, 'starroot-pouch')) {
    push(POUCH.x, POUCH.y, 52, 'Reach into the brambles', 'pouch', true, 2);
  }

  // rest stone
  push(REST_STONE.x, REST_STONE.y + 10, 58, 'Rest a moment', 'rest');

  // deep arch
  push(DEEP_ARCH.x, DEEP_ARCH.y + 20, 70, 'The edge of the Twilight', 'deep');

  // the Grovekeeper's old lantern (only on the opened deep path)
  if (game.puzzles.stonesDone) {
    push(
      GROVE_LANTERN.x, GROVE_LANTERN.y + 16, 64,
      game.flags.groveLanternLit ? 'The lit lantern' : 'Light the old lantern',
      'groveLantern',
    );
  }

  // bonus seed you dug up (Bond 2)
  if (game.fx.bonusSeed) {
    push(game.fx.bonusSeed.x, game.fx.bonusSeed.y, 55, 'Gather the seed you found', 'bonusSeed', true, 3);
  }

  if (!cands.length) return null;
  cands.sort((a, b) => b.priority - a.priority || a.d - b.d);
  const best = cands[0];
  return { label: best.label, act: best.act, enabled: best.enabled };
}

function hasSpecialFlag(game, id) {
  return !!game.inv.special[id];
}

export function performInteraction(game, ui, target) {
  if (!target) return;
  if (!target.enabled) {
    audio.sfx('error');
    return;
  }
  const act = target.act;
  const [verb, arg] = act.split(':');

  if (verb === 'plant') {
    ui.openPlant(parseInt(arg, 10));
    return;
  }
  if (verb === 'harvest') {
    const res = harvestCrop(game, parseInt(arg, 10));
    if (res) {
      audio.sfx('harvest');
      ui.toast(`+${res.yieldN} ${res.def.name}   +${res.dust} Glowdust`);
      refreshLevel(game);
      ui.markDirty();
    }
    return;
  }
  if (verb === 'water') {
    if (waterCrop(game, parseInt(arg, 10))) audio.sfx('water');
    return;
  }

  switch (act) {
    case 'shop':
    case 'craft':
    case 'workbench':
    case 'board':
      ui.openMenu(act);
      return;

    case 'rest': {
      if (game.flags.restCooldown <= 0) {
        game.flags.restCooldown = 120;
        addBondXp(game, 5, 'rest');
        Particles.notes(REST_STONE.x, REST_STONE.y - 20, 4);
        audio.sfx('rest');
        ui.toast('You rest a moment. The forest waits with you.');
      } else {
        ui.toast('The stone is still warm from the last rest.');
      }
      break;
    }

    case 'song': {
      game.fx.songT = 60;
      Particles.notes(game.px, game.py - 30, 8);
      Particles.ring(game.px, game.py, '#ffe9a0', 120);
      audio.sfx('level');
      ui.toast('The Grove Song hums through the garden — crops grow swifter.');
      emitProgressionEvent('AXIE_GROVE_SONG', { axieId: game.axieId });
      break;
    }

    case 'tree':
      ui.toast('The Grove Heart. It beats a little brighter with each restoration.');
      break;

    case 'deep':
      if (game.puzzles.stonesDone) {
        ui.toast(game.flags.groveLanternLit
          ? 'The edge of the Twilight. Your lantern answers the old one across the dark.'
          : 'The edge of the Twilight. Something old waits on the far side of the arch.');
        Particles.sparkle(DEEP_ARCH.x, DEEP_ARCH.y, '#c79bff', 10, 50);
      }
      break;

    case 'groveLantern': {
      if (game.flags.groveLanternLit) {
        ui.toast('It glows quietly. The grove remembers its keeper.');
        break;
      }
      const missing = ['seedkeeper', 'workshop', 'teahouse'].filter((k) => !game.restored[k]);
      if (missing.length || !game.flags.moonflower) {
        audio.sfx('error');
        ui.toast('The old lantern is cold. The grove must be whole first — and the Moonflower found.');
        break;
      }
      // the ritual: give the never-lit lantern the light the grove has made
      game.flags.groveLanternLit = true;
      Particles.ring(GROVE_LANTERN.x, GROVE_LANTERN.y - 8, '#ffe9a0', 760);
      Particles.ring(GROVE_LANTERN.x, GROVE_LANTERN.y - 8, '#c79bff', 520);
      Particles.sparkle(GROVE_LANTERN.x, GROVE_LANTERN.y - 20, '#ffe9a0', 26, 90);
      audio.sfx('big');
      addJournalRecent(game, 'You lit the Grovekeeper’s lantern at the edge of the Twilight.');
      addBondXp(game, 30, 'lit the Grovekeeper’s lantern');
      emitProgressionEvent('AXIE_LIT_GROVE_LANTERN', {
        axieId: game.axieId,
        level: game.level,
        bond: game.bondLevel,
      });
      ui.showDialogue(
        [
          { who: 'The Grove', text: 'You found it, little one. The lantern the old keeper set by the arch — the one that never held a flame.' },
          { who: 'The Grove', text: 'It does not need your fuel. It needs what you carried home: a whole grove, a lit heart, a light that was shared.' },
          { who: 'The Grove', text: 'Give it that. And the Twilight will remember what it was to be kept.' },
        ],
        () => {
          ui.banner('The Old Lantern', 'It takes the grove’s light and gives it back a hundredfold.', '#ffe9a0');
          ui.markDirty();
        },
      );
      break;
    }

    case 'pod': {
      setSpecial(game, 'dream-pod');
      game.glowdust += 25;
      Particles.sparkle(DREAM_POD.x, DREAM_POD.y - 8, '#c79bff', 14, 60);
      audio.sfx('chime');
      ui.banner('Dream Pod', 'It hums, then dissolves into 25 Glowdust.', '#c79bff');
      break;
    }

    case 'pouch': {
      setSpecial(game, 'starroot-pouch');
      game.glowdust += 20;
      for (let i = 0; i < 2; i++) game.inv.seeds.starroot = (game.inv.seeds.starroot || 0) + 1;
      Particles.sparkle(POUCH.x, POUCH.y - 8, '#ffe9a8', 12, 60);
      audio.sfx('chime');
      ui.banner('Starroot Pouch', '2 Starroot Seeds and 20 Glowdust, wrapped in leaf-cloth.', '#ffe9a8');
      break;
    }

    case 'bonusSeed': {
      const known = Object.keys(game.inv.seeds).filter((s) => game.journal.seeds.includes(s));
      const seed = pick(known.length ? known : ['glowberry']);
      game.inv.seeds[seed] = (game.inv.seeds[seed] || 0) + 1;
      game.fx.bonusSeed = null;
      audio.sfx('chime');
      ui.toast(`You found a ${PLANTS[seed] ? PLANTS[seed].name : seed} seed!`);
      break;
    }

    case 'moonflower': {
      game.flags.moonflower = true;
      game.inv.seeds.moonflower = (game.inv.seeds.moonflower || 0) + 1;
      if (!game.journal.seeds.includes('moonflower')) game.journal.seeds.push('moonflower');
      setSpecial(game, 'moonflower-sprout');
      addBondXp(game, 5, 'moonflower');
      game.fx.flash = 1;
      Particles.sparkle(MOONFLOWER_PLOT.x + 37, MOONFLOWER_PLOT.y + 20, '#ffffff', 26, 110);
      Particles.ring(MOONFLOWER_PLOT.x + 37, MOONFLOWER_PLOT.y + 20, '#ffffff', 130);
      audio.sfx('big');
      emitProgressionEvent('AXIE_DISCOVERED_SEED', { axieId: game.axieId, seed: 'moonflower', rare: true });
      addJournalRecent(game, 'Discovered the Moonflower');
      ui.banner('NEW DISCOVERY — Moonflower Seed', 'Only blooms beneath a moonlit lantern.', '#ffffff');
      ui.markDirty();
      break;
    }

    case 'spirit:mori':
    case 'spirit:luma':
    case 'spirit:nix': {
      const id = act.split(':')[1];
      const first = !game.spirits[id].met;
      // Nix's "met" + journal entry happen inside completeSpiritInteraction
      // (after the dialogue), because meeting Nix *is* its gift moment.
      if (first && id !== 'nix') {
        befriend(game, id, { mori: 'Mori', luma: 'Luma', nix: 'Nix' }[id]);
        audio.sfx('spirit');
      }
      const steps = spiritDialogue(game, id);
      ui.showDialogue(steps, () => {
        const result = completeSpiritInteraction(game, id);
        if (result) {
          ui.toast(result.text);
          audio.sfx('chime');
        }
        ui.markDirty();
      });
      break;
    }
  }
}
