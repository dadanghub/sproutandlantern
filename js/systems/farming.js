// Farming: plant -> water -> harvest. Crops connect to the lantern system
// (Sunpetal quickens growth; Moonflower only blooms under Moonspore light).

import { PLANTS } from './plants.js';
import { PLOTS } from '../world/map.js';
import { dist, randInt } from '../core/utils.js';
import { emitProgressionEvent } from '../core/events.js';
import { Particles } from '../core/particles.js';
import { lightRadius, sunpetalBoost } from './lantern.js';
import { addJournalRecent } from '../game/state.js';
import { discoverSeed, addSeed, addProduce } from './inventory.js';
import { addBondXp } from '../axie/bond.js';

/** Green Thumb (Plant trait): crops near the Axie grow 50% faster. */
export function greenThumbBoost(game, x, y) {
  if (game.axieCls === 'plant' && dist(game.px, game.py, x, y) < 150) return 1.5;
  return 1;
}

/** Is the crop currently bathed in the light it needs? */
function lightPresent(game, fuelId, x, y) {
  if (game.fx.pulseT > 0) return true;
  if (dist(game.px, game.py, x, y) > lightRadius(game) + 30) return false;
  return game.fuel === fuelId;
}

export function updateFarming(game, dt) {
  for (let i = 0; i < game.plots.length; i++) {
    const p = game.plots[i];
    if (!p.crop) continue;
    const def = PLANTS[p.crop];
    const plot = PLOTS[i];
    const cx = plot.x + plot.w / 2;
    const cy = plot.y + plot.h / 2;

    let rate = (1 / def.time) * greenThumbBoost(game, cx, cy) * sunpetalBoost(game, cx, cy);
    if (p.wateredT > 0) rate *= 1.8;
    if (game.fx.songT > 0) rate *= 1.15;

    // light-needy crops hold back until bathed in their light
    if (def.needLight && p.progress >= 0.85 && !lightPresent(game, def.needLight, cx, cy)) {
      p.progress = Math.min(p.progress, 0.97);
    }

    p.progress += rate * dt;
    if (p.wateredT > 0) p.wateredT -= dt;
    if (p.progress >= 1) p.progress = 1;
  }
}

export function plantCrop(game, plotIdx, seedId) {
  const p = game.plots[plotIdx];
  if (p.crop) return false;
  if ((game.inv.seeds[seedId] || 0) <= 0) return false;
  game.inv.seeds[seedId]--;
  p.crop = seedId;
  p.progress = 0;
  p.wateredT = 0;
  game.flags.planted = true;
  const plot = PLOTS[plotIdx];
  Particles.puff(plot.x + plot.w / 2, plot.y + plot.h / 2, '#8a6a44', 6, 20);
  addJournalRecent(game, `Planted ${PLANTS[seedId].name}`);
  emitProgressionEvent('AXIE_PLANTED_CROP', { axieId: game.axieId, plant: seedId });
  return true;
}

export function waterCrop(game, plotIdx) {
  const p = game.plots[plotIdx];
  if (!p.crop) return false;
  const plot = PLOTS[plotIdx];
  p.wateredT = 30;
  Particles.drops(plot.x + plot.w / 2, plot.y + plot.h / 2, 9);
  addBondXp(game, 2, 'watered the grove');
  return true;
}

export function harvestCrop(game, plotIdx) {
  const p = game.plots[plotIdx];
  if (!p.crop || p.progress < 1) return null;
  const def = PLANTS[p.crop];
  const plot = PLOTS[plotIdx];
  const cx = plot.x + plot.w / 2;
  const cy = plot.y + plot.h / 2;

  const yieldN = def.id === 'glowberry' ? 2 : 1;
  addProduce(game, def.id, yieldN);
  const dust = randInt(def.dust[0], def.dust[1]);
  game.glowdust += dust;

  if (Math.random() < 0.35) {
    addSeed(game, def.id, 1);
  }

  if (!game.journal.plants.includes(def.id)) {
    game.journal.plants.push(def.id);
    discoverSeed(game, def.id);
    addBondXp(game, 5, 'discovered plant');
    emitProgressionEvent('AXIE_DISCOVERED_PLANT', { axieId: game.axieId, plant: def.id });
    addJournalRecent(game, `Discovered ${def.name}`);
  }

  game.flags.harvested = true;
  addBondXp(game, 3, 'harvested');
  Particles.sparkle(cx, cy - 10, def.color, 14, 70);
  Particles.ring(cx, cy, def.color, 46);
  emitProgressionEvent('AXIE_HARVESTED_CROP', { axieId: game.axieId, plant: def.id, yield: yieldN, glowdust: dust });

  p.crop = null;
  p.progress = 0;
  p.wateredT = 0;
  return { def, yieldN, dust };
}
