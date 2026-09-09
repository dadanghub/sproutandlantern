// The renderer: procedural top-down art for the Grove (day) and the
// Twilight forest (night), with the lantern as a real light source.
//
// Order per frame:
//   ground -> paths/stream -> crops & small objects -> actors (y-sorted)
//   -> buildings & trees -> particles -> darkness (twilight) -> bioluminescence
//   -> ambient particles -> discovery flash

import {
  WORLD, PLOTS, BUILT, STREAM, BRIDGE, THICKET, DEEP_PATH, DEEP_ARCH,
  STONE_CIRCLE, STONES, FLOWERS, SPIRIT_POS, GARDEN, MOONFLOWER_PLOT,
  DREAM_POD, POUCH, REST_STONE, TRAIL, POSTS, DECOR, POIS,
} from './map.js';
import { drawAxie } from '../axie/sprites.js';
import { Particles } from '../core/particles.js';
import { camera } from '../core/camera.js';
import { FUELS, lightRadius, isRevealed, isSensed, fuelColor } from '../systems/lantern.js';
import { isNixVisible } from '../systems/spirits.js';
import { isFlowerLit, isStoneLit } from '../systems/puzzles.js';
import { restoredCount } from '../systems/restoration.js';
import { PLANTS } from '../systems/plants.js';
import { clamp, lerp, TAU } from '../core/utils.js';

let dark = document.createElement('canvas');
let dctx = dark.getContext('2d');
function sizeDark(w, h) {
  if (dark.width !== w || dark.height !== h) {
    dark.width = w;
    dark.height = h;
  }
}

// ambient life
const fireflies = [];
for (let i = 0; i < 26; i++) {
  fireflies.push({
    x: 1450 + Math.random() * 1450,
    y: 80 + Math.random() * 1300,
    ph: Math.random() * TAU,
    spd: 6 + Math.random() * 10,
    r: 1.2 + Math.random() * 1.4,
  });
}
const pollen = [];
for (let i = 0; i < 18; i++) {
  pollen.push({
    x: 60 + Math.random() * 1260,
    y: 240 + Math.random() * 1900,
    ph: Math.random() * TAU,
    s: 0.5 + Math.random() * 0.8,
  });
}

function mix(a, b, t) {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const c = pa.map((v, i) => Math.round(lerp(v, pb[i], t)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function renderGame(ctx, W, H, game, dt, now, opts = {}) {
  sizeDark(W, H);
  const nightOverride = opts.nightT; // 0..1 forced (ending)
  const cam = camera;
  const zoom = cam.zoom;

  // culling box in world coords
  const halfW = W / (2 * zoom) + 220;
  const halfH = H / (2 * zoom) + 220;
  const vis = (x, y, r = 0) =>
    x > cam.x - halfW - r && x < cam.x + halfW + r && y > cam.y - halfH - r && y < cam.y + halfH + r;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-cam.x, -cam.y);

  const night = nightOverride !== undefined ? nightOverride : game.phaseT;

  drawGround(ctx, game, night, vis);
  drawGroveDetails(ctx, game, night, vis, now);
  drawForestDetails(ctx, game, vis, now);
  drawCorruptionMist(ctx, game, vis, now);
  drawCrops(ctx, game, vis, now);

  // actors, y-sorted
  // The player IS the Axie — a single actor, SLP lantern in paw.
  const actors = [
    { y: game.py, draw: () => drawAxieSprite(ctx, game, now) },
  ];
  // spirits (only visible ones)
  if (vis(SPIRIT_POS.mori.x, SPIRIT_POS.mori.y)) actors.push({ y: SPIRIT_POS.mori.y, draw: () => drawMori(ctx, now) });
  if (vis(SPIRIT_POS.luma.x, SPIRIT_POS.luma.y)) actors.push({ y: SPIRIT_POS.luma.y, draw: () => drawLuma(ctx, now) });
  if (isNixVisible(game) && vis(SPIRIT_POS.nix.x, SPIRIT_POS.nix.y)) actors.push({ y: SPIRIT_POS.nix.y, draw: () => drawNix(ctx, now, game) });

  actors.sort((a, b) => a.y - b.y).forEach((a) => a.draw());

  drawBuildings(ctx, game, night, vis, now);
  Particles.draw(ctx);

  ctx.restore();

  // ---------------- darkness (twilight) ----------------
  const darkAlpha = clamp(night, 0, 1) * 0.94;
  if (darkAlpha > 0.01) {
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.clearRect(0, 0, W, H);
    dctx.fillStyle = `rgba(9,8,26,${darkAlpha})`;
    dctx.fillRect(0, 0, W, H);

    // lantern hole (with a subtle spore-flame flicker)
    const sx = (game.px - cam.x) * zoom + W / 2;
    const sy = (game.py - cam.y) * zoom + H / 2;
    const flick = 1 + 0.014 * Math.sin(now * 0.011) + 0.009 * Math.sin(now * 0.027 + 1.3);
    const R = (lightRadius(game) * flick + (game.fx.pulseT > 0 ? 520 : 0)) * zoom;
    const g = dctx.createRadialGradient(sx, sy, R * 0.22, sx, sy, R);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.7, 'rgba(0,0,0,0.85)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    dctx.globalCompositeOperation = 'destination-out';
    dctx.fillStyle = g;
    dctx.beginPath();
    dctx.arc(sx, sy, R, 0, TAU);
    dctx.fill();
    dctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(dark, 0, 0, W, H);
  }

  // ---------------- bioluminescence (over the dark) ----------------
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glowAt = (wx, wy, r, color, a) => {
    const s = cam.screen(wx, wy, W, H);
    if (s.x < -r * 2 || s.x > W + r * 2 || s.y < -r * 2 || s.y > H + r * 2) return;
    const rr = r * zoom;
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, rr);
    g.addColorStop(0, color.replace('$A', a));
    g.addColorStop(1, color.replace('$A', 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s.x, s.y, rr, 0, TAU);
    ctx.fill();
  };
  // stream
  if (night > 0.15) {
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      const sx = 2150 + Math.sin(t * 5.2) * 26;
      const sy = lerp(160, 1420, t);
      glowAt(sx, sy, 46, 'rgba(89,227,255,$A)', 0.16 * night);
    }
  }
  // grove heart
  glowAt(BUILT.bigTree.x, BUILT.bigTree.y - 40, 190, 'rgba(255,233,180,$A)', (0.05 + 0.05 * restoredCount(game) + (game.flags.moonflower ? 0.08 : 0)) * (night > 0.4 ? 1 : 0.5));
  // restored buildings glow
  if (game.restored.seedkeeper) glowAt(BUILT.seedkeeperHut.x + 75, BUILT.seedkeeperHut.y + 50, 90, 'rgba(255,217,138,$A)', 0.2 * night + 0.05);
  if (game.restored.workshop) glowAt(BUILT.workshop.x + 75, BUILT.workshop.y + 45, 110, 'rgba(156,200,255,$A)', 0.24 * night + 0.06);
  if (game.restored.teahouse) glowAt(BUILT.teahouse.x + 80, BUILT.teahouse.y + 55, 100, 'rgba(255,190,140,$A)', 0.18 * night + 0.05);
  // lantern station
  glowAt(BUILT.lanternStation.x + 112, BUILT.lanternStation.y + 6, 60, fuelColor(game) ? rgba(FUELS[game.fuel].color, 0.3) : 'rgba(255,207,158,0.22)', 0.5);
  // posts
  for (const p of POSTS) {
    const lit = (p.key === 'flowers' && game.puzzles.flowersDone) || (p.key === 'bridge' && game.puzzles.bridgeRevealed) || (p.key === 'stones' && game.puzzles.stonesDone) || (p.key === 'moonflower' && game.flags.moonflower);
    if (lit) glowAt(p.x, p.y - 26, 70, 'rgba(255,217,138,$A)', 0.3 * Math.max(night, 0.4) + 0.08);
  }
  // deep arch
  if (game.puzzles.stonesDone) {
    glowAt(DEEP_ARCH.x, DEEP_ARCH.y - 10, 130, 'rgba(199,155,255,$A)', 0.28 * (0.8 + 0.2 * Math.sin(now * 0.002)));
  }
  // lit stones & flowers
  for (const s of STONES) if (isStoneLit(game, s)) glowAt(s.x, s.y - 24, 60, rgba(FUELS[s.glyph].color, 0.3), 0.5);
  for (const f of FLOWERS) if (isFlowerLit(game, f)) glowAt(f.x, f.y - 12, 40, rgba(FUELS[f.color].color, 0.3), 0.5);
  // moonflower
  if (game.flags.moonflower || isRevealed(game, 'secret', MOONFLOWER_PLOT.x + 37, MOONFLOWER_PLOT.y + 32)) {
    glowAt(MOONFLOWER_PLOT.x + 37, MOONFLOWER_PLOT.y + 24, 50, 'rgba(255,255,255,$A)', 0.25);
  }
  // lantern glow (colored by fuel)
  // ambient halo around the Axie's lantern (the lantern itself is on the sprite)
  const lc = fuelColor(game) ? FUELS[game.fuel].color : '#ffcf9e';
  glowAt(game.px + game.facing * 20, game.py - 2, lightRadius(game) * 0.55, rgba(lc, 0.16), 1);
  // wide light spill on the ground
  if (night > 0.2) glowAt(game.px, game.py + 8, lightRadius(game) * 0.95, rgba(lc, 0.07 * night), 1);
  // the lantern's reflection on the glowing stream
  if (night > 0.15 && game.fuel) {
    const stx = 2150 + Math.sin(((game.py - 140) / 1300) * 5.2) * 26;
    if (Math.abs(game.px - stx) < 170 && game.py > 170 && game.py < 1410) {
      for (let k = 0; k < 5; k++) {
        const jx = Math.sin(now * 0.002 + k * 1.7) * 4;
        glowAt(stx + jx, game.py + 8 + k * 9, 8, rgba(FUELS[game.fuel].color, (0.15 - k * 0.024) * night), 1);
      }
    }
  }

  // fireflies (twilight) & pollen (day)
  if (night > 0.2) {
    for (const f of fireflies) {
      f.ph += dt * f.spd * 0.2;
      const fx = f.x + Math.sin(f.ph) * 40;
      const fy = f.y + Math.cos(f.ph * 0.7) * 30;
      const a = (0.35 + 0.3 * Math.sin(f.ph * 2.3)) * night;
      glowAt(fx, fy, 9, 'rgba(216,255,158,$A)', a);
    }
  }
  if (night < 0.8) {
    for (const p of pollen) {
      p.ph += dt * 0.4;
      const px = p.x + Math.sin(p.ph) * 26;
      const py = p.y + Math.cos(p.ph * 0.8) * 18 - (now * 0.004 * p.s) % 2200;
      const a = 0.22 * (1 - night);
      glowAt(((px % 1300) + 1300) % 1300 + 60, ((py % 1950) + 1950) % 1950 + 200, 4, 'rgba(255,244,200,$A)', a);
    }
  }
  ctx.restore();

  // golden-hour grade: a warm wash peaking at mid-dusk
  const duskA = Math.sin(Math.PI * clamp(night, 0, 1)) * 0.055;
  if (duskA > 0.004) {
    ctx.fillStyle = `rgba(255,150,70,${duskA})`;
    ctx.fillRect(0, 0, W, H);
  }

  // soft vignette (cached per screen size)
  drawVignette(ctx, W, H);

  // ---------------- discovery flash ----------------
  if (game.fx.flash > 0) {
    ctx.fillStyle = `rgba(255,250,235,${game.fx.flash * 0.22})`;
    ctx.fillRect(0, 0, W, H);
  }

  // bonus seed marker
  if (game.fx.bonusSeed) {
    const s = cam.screen(game.fx.bonusSeed.x, game.fx.bonusSeed.y, W, H);
    const a = 0.6 + 0.4 * Math.sin(now * 0.006);
    glowAt(game.fx.bonusSeed.x, game.fx.bonusSeed.y - 8, 26, 'rgba(255,158,196,$A)', a);
  }
}

function rgba(hex, a) {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}

function drawAxieSprite(ctx, game, now) {
  const def = {
    id: game.axieId,
    name: game.axieName,
    cls: game.axieCls,
    colors: AXIE_COLORS[game.axieCls] || AXIE_COLORS.plant,
  };
  // Player avatar: slightly larger, carrying the SLP lantern.
  // (now/1000 — not walkT — so breathing/blinking continue while standing still)
  drawAxie(ctx, def, game.px, game.py, now / 1000, {
    moving: game.moving,
    facing: game.facing,
    happy: game.axieHappyT > 0,
    lantern: fuelColor(game) || '#ffcf9e',
    scale: 1.15,
  });
  // Green Thumb aura (Plant class) — radiates from the player
  if (game.axieCls === 'plant') {
    ctx.save();
    ctx.globalAlpha = 0.08 + 0.03 * Math.sin(now * 0.003);
    ctx.strokeStyle = '#9fe8b0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(game.px, game.py, 150, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

// --------------------------------------------------- corruption mist ------
// Visible haze over the parts of the forest that are not yet purified.
// Driven by the minimap's purified grid: where your lantern has been,
// the mist is gone — the "purify the corrupted forest" loop, in-world.
let mistTex = null;
function mistTexture() {
  if (mistTex) return mistTex;
  mistTex = document.createElement('canvas');
  mistTex.width = 64;
  mistTex.height = 64;
  const c = mistTex.getContext('2d');
  const g = c.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(132,120,182,0.55)');
  g.addColorStop(0.7, 'rgba(118,108,168,0.28)');
  g.addColorStop(1, 'rgba(118,108,168,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  return mistTex;
}

const MIST_W = 30, MIST_H = 27; // matches the minimap grid (55px cells)
function drawCorruptionMist(ctx, game, vis, now) {
  const cells = game.minimap && game.minimap.cells;
  if (!cells) return;
  const tex = mistTexture();
  for (let iy = 0; iy < MIST_H; iy++) {
    for (let ix = 0; ix < MIST_W; ix++) {
      if (cells[iy * MIST_W + ix]) continue; // purified — clear
      const cx = 1350 + (ix + 0.5) * 55;
      const cy = (iy + 0.5) * 55;
      if (!vis(cx, cy, 40)) continue;
      const v = (ix * 7 + iy * 13) % 10;
      const drift = Math.sin(now * 0.0004 + ix * 0.7 + iy * 1.3) * 3;
      ctx.globalAlpha = 0.34 + (v % 5) * 0.07;
      ctx.drawImage(tex, cx - 32 + drift, cy - 32, 64, 64);
    }
  }
  ctx.globalAlpha = 1;
}

let vignette = null;
let vignW = 0, vignH = 0;
function drawVignette(ctx, W, H) {
  if (!vignette || vignW !== W || vignH !== H) {
    vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.72);
    vignette.addColorStop(0, 'rgba(6,6,18,0)');
    vignette.addColorStop(1, 'rgba(6,6,18,0.20)');
    vignW = W;
    vignH = H;
  }
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}

// class palettes mirrored from axie/axies.js (kept local to avoid a cycle)
const AXIE_COLORS = {
  plant: { body: '#8fd6a4', accent: '#3f8f63', glow: '#d7f5df' },
  aquatic: { body: '#7fd0e8', accent: '#3f7fa8', glow: '#cdeeff' },
  bird: { body: '#f2c98a', accent: '#b07a3f', glow: '#ffedc9' },
  beast: { body: '#d8a37a', accent: '#8a5a3a', glow: '#f5d9c0' },
  bug: { body: '#b8d87f', accent: '#6f9440', glow: '#e4f5c8' },
  reptile: { body: '#9fd8a0', accent: '#4f8f5a', glow: '#d0f0d4' },
};

// ---------------------------------------------------------------- ground --
function drawGround(ctx, game, night, vis) {
  // day base (whole world)
  const gg = ctx.createLinearGradient(0, 0, 0, WORLD.h);
  gg.addColorStop(0, '#97c477');
  gg.addColorStop(1, '#7cab60');
  ctx.fillStyle = gg;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  // mottling
  for (const m of DECOR.mottles) {
    if (!vis(m.x, m.y, m.r)) continue;
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = m.dark ? '#3f6b3a' : '#b8dc9a';
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // twilight ground (forest) with soft blends on the border
  const fc = '#1a1e3a';
  ctx.fillStyle = fc;
  ctx.fillRect(1350, 0, 1650, 1450);
  // left blend band
  let g = ctx.createLinearGradient(1180, 0, 1350, 0);
  g.addColorStop(0, 'rgba(26,30,58,0)');
  g.addColorStop(1, 'rgba(26,30,58,1)');
  ctx.fillStyle = g;
  ctx.fillRect(1180, 0, 170, 1450);
  // bottom blend band
  g = ctx.createLinearGradient(0, 1450, 0, 1620);
  g.addColorStop(0, 'rgba(26,30,58,1)');
  g.addColorStop(1, 'rgba(26,30,58,0)');
  ctx.fillStyle = g;
  ctx.fillRect(1350, 1450, 1650, 170);
}

// ------------------------------------------------------------- grove -----
function drawGroveDetails(ctx, game, night, vis, now) {
  // path
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const path = (pts, color, w) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    ctx.stroke();
  };
  if (vis(800, 1700, 700)) {
    path([[455, 1915], [560, 1800], [700, 1745], [860, 1660]], 'rgba(201,160,108,0.85)', 46);
    path([[860, 1660], [1000, 1590], [1120, 1540], [1250, 1400], [1350, 1260]], 'rgba(201,160,108,0.85)', 40);
    path([[455, 1915], [400, 1990], [300, 2010]], 'rgba(201,160,108,0.7)', 34);
  }
  if (vis(1700, 1000, 700)) {
    // forest path
    path([[1350, 1255], [1500, 1170], [1650, 1120], [1760, 1000], [1830, 905]], 'rgba(96,86,140,0.9)', 38);
    path([[1830, 905], [1930, 1010], [1990, 1130], [2010, 1245]], 'rgba(96,86,140,0.8)', 30);
    path([[1830, 905], [1950, 950], [2060, 955]], 'rgba(96,86,140,0.8)', 30);
    path([[2240, 950], [2330, 890], [2400, 760], [2450, 680]], 'rgba(96,86,140,0.8)', 30);
  }

  // grove flowers
  for (const f of DECOR.groveFlowers) {
    if (!vis(f.x, f.y)) continue;
    const colors = ['#ffd98a', '#ff9ec4', '#cfd8ff', '#ffe9a8'];
    ctx.fillStyle = colors[f.c];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + f.x;
      ctx.beginPath();
      ctx.arc(f.x + Math.cos(a) * 3.4 * f.s, f.y + Math.sin(a) * 3.4 * f.s, 2 * f.s, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(f.x, f.y, 1.4 * f.s, 0, TAU);
    ctx.fill();
  }

  // plots
  for (let i = 0; i < PLOTS.length; i++) {
    const p = PLOTS[i];
    if (!vis(p.x, p.y, 80)) continue;
    ctx.fillStyle = '#7a5230';
    rr(ctx, p.x, p.y, p.w, p.h, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 2;
    rr(ctx, p.x, p.y, p.w, p.h, 10);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(58,36,18,0.5)';
    ctx.lineWidth = 2;
    for (let r = 1; r < 4; r++) {
      ctx.beginPath();
      ctx.moveTo(p.x + 10, p.y + (p.h / 4) * r);
      ctx.lineTo(p.x + p.w - 10, p.y + (p.h / 4) * r);
      ctx.stroke();
    }
    // watered tint
    if (game.plots[i].wateredT > 0) {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#2f6f9f';
      rr(ctx, p.x, p.y, p.w, p.h, 10);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // forest entrance arch
  if (vis(BUILT.arch.x, BUILT.arch.y, 200)) {
    ctx.fillStyle = '#5d4534';
    ctx.fillRect(BUILT.arch.x - 52, BUILT.arch.y - 90, 20, 150);
    ctx.fillRect(BUILT.arch.x + 32, BUILT.arch.y - 90, 20, 150);
    ctx.strokeStyle = '#5d4534';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(BUILT.arch.x, BUILT.arch.y - 96, 48, Math.PI, TAU);
    ctx.stroke();
    ctx.strokeStyle = '#4e7d43';
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const vx = BUILT.arch.x - 36 + i * 24;
      ctx.beginPath();
      ctx.moveTo(vx, BUILT.arch.y - 74);
      ctx.quadraticCurveTo(vx + 4, BUILT.arch.y - 40, vx - 3, BUILT.arch.y - 12);
      ctx.stroke();
    }
  }

  // sign near arch
  if (vis(1290, 1330)) drawSign(ctx, 1290, 1330, 'Light kindly.');
}

function drawSign(ctx, x, y, lines) {
  ctx.fillStyle = '#6b4a35';
  ctx.fillRect(x - 3, y - 6, 6, 26);
  ctx.fillStyle = '#8a6a44';
  rr(ctx, x - 34, y - 34, 68, 32, 5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1.5;
  rr(ctx, x - 34, y - 34, 68, 32, 5);
  ctx.stroke();
  ctx.fillStyle = '#f4ead8';
  ctx.font = '11px Georgia, serif';
  ctx.textAlign = 'center';
  const ls = String(lines).split('\n');
  ls.forEach((l, i) => ctx.fillText(l, x, y - 18 + i * 13));
  ctx.textAlign = 'left';
}

// --------------------------------------------------------------- forest --
function drawForestDetails(ctx, game, vis, now) {
  // stream
  if (vis(2150, 780, 1600)) {
    const streamPts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      streamPts.push([2150 + Math.sin(t * 5.2) * 26, lerp(140, 1440, t)]);
    }
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0e2c4a';
    ctx.lineWidth = 118;
    strokePath(ctx, streamPts);
    ctx.strokeStyle = '#123a5e';
    ctx.lineWidth = 88;
    strokePath(ctx, streamPts);
    // animated shimmer
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(89,227,255,0.4)';
    ctx.lineWidth = 10;
    ctx.setLineDash([14, 26]);
    ctx.lineDashOffset = -now * 0.03;
    strokePath(ctx, streamPts);
    ctx.restore();
    ctx.setLineDash([]);
  }

  // hidden trail (moonspore)
  for (let i = 0; i < TRAIL.length - 1; i++) {
    const [ax, ay] = TRAIL[i];
    const [bx, by] = TRAIL[i + 1];
    const d = dist2(game, ax, ay);
    const inLight = d < lightRadius(game) + 40;
    let a = 0;
    if (inLight && game.fuel === 'moonspore') a = 0.5;
    else if (isSensed(game, (ax + bx) / 2, (ay + by) / 2)) a = Math.max(a, 0.2);
    if (game.fx.pulseT > 0) a = 0.6;
    if (a > 0 && vis((ax + bx) / 2, (ay + by) / 2)) {
      ctx.globalAlpha = a;
      ctx.fillStyle = '#9cc8ff';
      const steps = 5;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        ctx.beginPath();
        ctx.arc(lerp(ax, bx, t), lerp(ay, by, t), 2.4, 0, TAU);
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;

  // bridge
  const bRevealed = game.puzzles.bridgeRevealed;
  const bcx = BRIDGE.x + BRIDGE.w / 2, bcy = BRIDGE.y + BRIDGE.h / 2;
  let bA = bRevealed ? 1 : 0;
  if (!bRevealed && isRevealed(game, 'path', bcx, bcy)) bA = 0.3 + 0.1 * Math.sin(now * 0.004);
  if (bA > 0 && vis(bcx, bcy, 140)) {
    ctx.globalAlpha = bA;
    ctx.fillStyle = '#6b5335';
    rr(ctx, BRIDGE.x, BRIDGE.y, BRIDGE.w, BRIDGE.h, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(BRIDGE.x + 8, BRIDGE.y + (BRIDGE.h / 6) * i);
      ctx.lineTo(BRIDGE.x + BRIDGE.w - 8, BRIDGE.y + (BRIDGE.h / 6) * i);
      ctx.stroke();
    }
    ctx.strokeStyle = '#8a6a44';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(BRIDGE.x + 4, BRIDGE.y - 4);
    ctx.lineTo(BRIDGE.x + BRIDGE.w - 4, BRIDGE.y - 4);
    ctx.moveTo(BRIDGE.x + 4, BRIDGE.y + BRIDGE.h + 4);
    ctx.lineTo(BRIDGE.x + BRIDGE.w - 4, BRIDGE.y + BRIDGE.h + 4);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // forest glow plants
  for (const f of DECOR.forestGlow) {
    if (!vis(f.x, f.y)) continue;
    const colors = ['#9cc8ff', '#c79bff', '#9fe8b0'];
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = colors[f.c];
    ctx.beginPath();
    ctx.arc(f.x, f.y, 2.6 * f.s, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(f.x, f.y, 6 * f.s, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // puzzle 1 flowers
  for (const f of FLOWERS) {
    if (!vis(f.x, f.y)) continue;
    const lit = isFlowerLit(game, f);
    const c = FUELS[f.color].color;
    ctx.strokeStyle = '#3f5a4a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(f.x, f.y);
    ctx.lineTo(f.x, f.y - 14);
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + (lit ? now * 0.001 : 0);
      ctx.fillStyle = lit ? '#ffffff' : c;
      ctx.globalAlpha = lit ? 1 : 0.8;
      ctx.beginPath();
      ctx.arc(f.x + Math.cos(a) * 6, f.y - 16 + Math.sin(a) * 6, 3.4, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = lit ? '#ffffff' : 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(f.x, f.y - 16, 2.4, 0, TAU);
    ctx.fill();
    // order ring
    ctx.strokeStyle = lit ? c : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = lit ? 2 : 1;
    ctx.beginPath();
    ctx.arc(f.x, f.y + 4, 9, 0, TAU);
    ctx.stroke();
  }
  if (vis(1925, 800)) drawSign(ctx, 1925, 800, 'Blue first, then\ngold, violet last.');

  // stone circle
  for (const s of STONES) {
    if (!vis(s.x, s.y, 60)) continue;
    const lit = isStoneLit(game, s);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 16, 24, 7, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = lit ? '#5f648c' : '#454a6a';
    rr(ctx, s.x - 16, s.y - 40, 32, 56, 9);
    ctx.fill();
    ctx.fillStyle = lit ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.08)';
    rr(ctx, s.x - 16, s.y - 40, 12, 56, 9);
    ctx.fill();
    // glyph
    const c = FUELS[s.glyph].color;
    ctx.globalAlpha = lit ? 1 : 0.55;
    drawGlyph(ctx, s.x, s.y - 14, s.glyph, c);
    ctx.globalAlpha = 1;
  }
  // pedestal
  if (vis(STONE_CIRCLE.x, STONE_CIRCLE.y, 60)) {
    ctx.fillStyle = '#3c4160';
    rr(ctx, STONE_CIRCLE.x - 24, STONE_CIRCLE.y - 10, 48, 32, 8);
    ctx.fill();
    ctx.fillStyle = '#4a4f6e';
    rr(ctx, STONE_CIRCLE.x - 18, STONE_CIRCLE.y - 18, 36, 16, 6);
    ctx.fill();
  }
  if (vis(2330, 720)) drawSign(ctx, 2330, 720, 'Gold first. Blue next.\nViolet wakes last.');

  // lantern posts
  for (const p of POSTS) {
    if (!vis(p.x, p.y, 60)) continue;
    ctx.fillStyle = '#3c4160';
    ctx.fillRect(p.x - 3, p.y - 44, 6, 48);
    ctx.fillStyle = '#2c3050';
    rr(ctx, p.x - 9, p.y - 58, 18, 18, 4);
    ctx.fill();
    const lit = (p.key === 'flowers' && game.puzzles.flowersDone) || (p.key === 'bridge' && game.puzzles.bridgeRevealed) || (p.key === 'stones' && game.puzzles.stonesDone) || (p.key === 'moonflower' && game.flags.moonflower);
    ctx.fillStyle = lit ? '#ffd98a' : 'rgba(120,130,180,0.4)';
    rr(ctx, p.x - 5.5, p.y - 54.5, 11, 11, 3);
    ctx.fill();
  }

  // hidden garden
  if (vis(GARDEN.x + 170, GARDEN.y + 130, 320)) {
    ctx.strokeStyle = 'rgba(120,126,170,0.5)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(GARDEN.x + 170, GARDEN.y + 150, 150, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(150,156,200,0.3)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(GARDEN.x + 170, GARDEN.y + 150, 158, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
  }
  // moonflower plot
  {
    const m = MOONFLOWER_PLOT;
    const revealed = game.flags.moonflower || isRevealed(game, 'secret', m.x + 37, m.y + 32);
    const sensed = isSensed(game, m.x + 37, m.y + 32);
    ctx.globalAlpha = revealed ? 1 : sensed ? 0.35 : 0.12;
    ctx.fillStyle = '#2a2547';
    rr(ctx, m.x, m.y, m.w, m.h, 10);
    ctx.fill();
    ctx.strokeStyle = '#3f3a63';
    ctx.lineWidth = 2;
    rr(ctx, m.x, m.y, m.w, m.h, 10);
    ctx.stroke();
    if (revealed) {
      const fx = m.x + m.w / 2, fy = m.y + m.h / 2 - 4;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + now * 0.0006;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(fx + Math.cos(a) * 8, fy + Math.sin(a) * 8, 5, 3, a, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#ffe9a0';
      ctx.beginPath();
      ctx.arc(fx, fy, 4, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // dream pod
  if (vis(DREAM_POD.x, DREAM_POD.y)) {
    const revealed = isRevealed(game, 'secret', DREAM_POD.x, DREAM_POD.y);
    ctx.globalAlpha = revealed ? 1 : 0.15;
    ctx.fillStyle = '#7a4fb0';
    ctx.beginPath();
    ctx.ellipse(DREAM_POD.x, DREAM_POD.y, 12, 9, 0.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(DREAM_POD.x - 4, DREAM_POD.y - 3, 2.4, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // thicket + pouch
  if (vis(THICKET.x + 95, THICKET.y + 85, 200)) {
    for (let i = 0; i < 12; i++) {
      const tx = THICKET.x + 14 + (i % 4) * 48 + ((i * 37) % 18);
      const ty = THICKET.y + 16 + Math.floor(i / 4) * 52 + ((i * 23) % 14);
      ctx.fillStyle = i % 2 ? '#20363f' : '#1b2f38';
      ctx.beginPath();
      ctx.arc(tx, ty, 20, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,200,170,0.25)';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * TAU + i;
        ctx.beginPath();
        ctx.moveTo(tx + Math.cos(a) * 14, ty + Math.sin(a) * 14);
        ctx.lineTo(tx + Math.cos(a) * 24, ty + Math.sin(a) * 24);
        ctx.stroke();
      }
    }
    if (!game.inv.special['starroot-pouch']) {
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#c9a06c';
      ctx.beginPath();
      ctx.ellipse(POUCH.x, POUCH.y, 10, 7, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#8a6a44';
      ctx.fillRect(POUCH.x - 5, POUCH.y - 9, 10, 5);
      ctx.globalAlpha = 1;
    }
  }

  // spirit clearing: mushroom ring
  if (vis(2706, 1150, 260)) {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      const mx = 2706 + Math.cos(a) * 150;
      const my = 1150 + Math.sin(a) * 110;
      ctx.fillStyle = '#2c4a5e';
      ctx.fillRect(mx - 2.5, my - 6, 5, 9);
      ctx.fillStyle = '#59b8d8';
      ctx.beginPath();
      ctx.arc(mx, my - 6, 7, Math.PI, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(mx - 2, my - 9, 1.6, 0, TAU);
      ctx.fill();
    }
    // rest stone
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(REST_STONE.x, REST_STONE.y + 18, 44, 10, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#565c80';
    ctx.beginPath();
    ctx.ellipse(REST_STONE.x, REST_STONE.y + 4, 40, 22, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#6d7398';
    ctx.beginPath();
    ctx.ellipse(REST_STONE.x, REST_STONE.y - 4, 34, 15, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e8d5b5';
    rr(ctx, REST_STONE.x - 16, REST_STONE.y + 10, 32, 10, 5);
    ctx.fill();
  }
  if (vis(2590, 1230)) drawSign(ctx, 2590, 1230, 'Sit. The forest\nwill wait.');

  // deep path
  if (vis(DEEP_ARCH.x, 400, 300)) {
    const open = game.puzzles.stonesDone;
    const pulse = 0.75 + 0.25 * Math.sin(now * 0.002);
    ctx.globalAlpha = open ? 0.85 : 0.3;
    const pg = ctx.createLinearGradient(0, 480, 0, 250);
    pg.addColorStop(0, 'rgba(120,90,200,0)');
    pg.addColorStop(1, `rgba(150,110,235,${0.5 * pulse})`);
    ctx.fillStyle = pg;
    ctx.fillRect(2410, 250, 80, 240);
    ctx.globalAlpha = 1;
    // arch
    ctx.fillStyle = '#5a5f8a';
    rr(ctx, 2408, 230, 26, 90, 8);
    ctx.fill();
    rr(ctx, 2466, 230, 26, 90, 8);
    ctx.fill();
    rr(ctx, 2398, 214, 104, 26, 10);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    rr(ctx, 2410, 218, 80, 8, 4);
    ctx.fill();
    // mist wall when locked
    if (!open) {
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.12 * Math.sin(now * 0.0016);
      const mg = ctx.createLinearGradient(0, 300, 0, 420);
      mg.addColorStop(0, 'rgba(200,220,255,0)');
      mg.addColorStop(0.5, 'rgba(200,220,255,0.8)');
      mg.addColorStop(1, 'rgba(200,220,255,0)');
      ctx.fillStyle = mg;
      ctx.fillRect(2380, 300, 140, 130);
      ctx.restore();
    }
  }
  if (vis(2560, 300)) drawSign(ctx, 2560, 300, 'The edge of the\nTwilight.');

  // sky sight beacons (Bird)
  if (game.axieCls === 'bird') {
    for (const poi of POIS) {
      if (!vis(poi.x, poi.y)) continue;
      const a = 0.25 + 0.2 * Math.sin(now * 0.003 + poi.x);
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = '#ffe9a0';
      const yy = poi.y - 60 + Math.sin(now * 0.002 + poi.y) * 5;
      ctx.beginPath();
      ctx.moveTo(poi.x, yy - 7);
      ctx.lineTo(poi.x + 4.5, yy);
      ctx.lineTo(poi.x, yy + 7);
      ctx.lineTo(poi.x - 4.5, yy);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function dist2(game, x, y) {
  return Math.hypot(game.px - x, game.py - y);
}

function drawGlyph(ctx, x, y, glyph, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  if (glyph === 'moonspore') {
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(Math.cos(i * 2.1) * 3, Math.sin(i * 2.1) * 3, 1.4, 0, TAU);
      ctx.fill();
    }
  } else if (glyph === 'sunpetal') {
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
      ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9);
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    for (let a = 0; a < TAU * 1.6; a += 0.2) {
      const r = 1.5 + a * 1.6;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// -------------------------------------------------------------- crops ----
function drawCrops(ctx, game, vis, now) {
  for (let i = 0; i < PLOTS.length; i++) {
    const plot = PLOTS[i];
    const st = game.plots[i];
    if (!st.crop) continue;
    if (!vis(plot.x, plot.y, 60)) continue;
    const def = PLANTS[st.crop];
    const cx = plot.x + plot.w / 2;
    const baseY = plot.y + plot.h / 2 + 16;

    let alpha = 1;
    if (def.needLight === 'dreamcap') {
      const revealed = isRevealed(game, 'plant', cx, baseY) || game.fx.pulseT > 0;
      const sensed = isSensed(game, cx, baseY);
      alpha = revealed ? 1 : sensed ? 0.4 : 0.14;
    }
    ctx.globalAlpha = alpha;
    drawCropPlant(ctx, def, cx, baseY, st.progress, now);
    ctx.globalAlpha = 1;
  }
}

function drawCropPlant(ctx, def, x, y, progress, now) {
  const stage = progress < 0.33 ? 0 : progress < 0.66 ? 1 : progress < 1 ? 2 : 3;
  const sway = Math.sin(now * 0.002 + x) * 1.5;

  if (stage === 0) {
    ctx.fillStyle = '#5d4025';
    ctx.beginPath();
    ctx.ellipse(x, y, 7, 4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(x, y - 2, 2.4, 0, TAU);
    ctx.fill();
    return;
  }

  const h = stage === 1 ? 10 : stage === 2 ? 18 : 24;
  ctx.strokeStyle = '#4e7d43';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + sway, y - h * 0.6, x + sway, y - h);
  ctx.stroke();

  // leaves
  ctx.fillStyle = '#5d9350';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + side * 5 + sway * 0.5, y - h * 0.5, 5.5, 2.6, side * 0.5, 0, TAU);
    ctx.fill();
  }
  if (stage >= 2) {
    ctx.beginPath();
    ctx.ellipse(x - 4 + sway, y - h * 0.85, 4.5, 2.2, -0.4, 0, TAU);
    ctx.fill();
  }

  const topY = y - h;
  if (stage === 2) {
    ctx.fillStyle = def.color;
    ctx.globalAlpha = Math.min(ctx.globalAlpha, 0.7);
    ctx.beginPath();
    ctx.arc(x + sway, topY, 4.5, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = Math.min(1, ctx.globalAlpha / 0.7);
    return;
  }

  // stage 3: the full bloom
  if (def.id === 'mooncap') {
    ctx.fillStyle = '#e8e2d8';
    ctx.fillRect(x - 3 + sway, topY + 2, 6, 9);
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(x + sway, topY + 3, 10, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(x - 3 + sway, topY - 1, 2, 0, TAU);
    ctx.arc(x + 4 + sway, topY + 1, 1.6, 0, TAU);
    ctx.fill();
  } else if (def.id === 'glowberry') {
    ctx.fillStyle = def.color;
    for (const [ox, oy] of [[-5, -3], [5, -1], [0, 4]]) {
      ctx.beginPath();
      ctx.arc(x + ox + sway, topY + oy, 4.2, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(x - 6 + sway, topY - 4, 1.3, 0, TAU);
    ctx.fill();
  } else {
    const petal = def.id === 'moonflower' ? 8 : 6;
    for (let i = 0; i < petal; i++) {
      const a = (i / petal) * TAU + now * 0.0005;
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * 7 + sway, topY + Math.sin(a) * 7, 5.5, 3, a, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = def.id === 'moonflower' ? '#ffe9a0' : '#fff3c4';
    ctx.beginPath();
    ctx.arc(x + sway, topY, 4, 0, TAU);
    ctx.fill();
  }

  // ready glow
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x + sway, topY, 1, x + sway, topY, 16);
  g.addColorStop(0, def.id === 'moonflower' ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x + sway, topY, 16, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------- buildings -----
function drawBuildings(ctx, game, night, vis, now) {
  // cottage
  if (vis(BUILT.cottage.x + 120, BUILT.cottage.y + 90, 220)) {
    const c = BUILT.cottage;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(c.x + c.w / 2, c.y + c.h, c.w * 0.55, 16, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#b98a63';
    rr(ctx, c.x, c.y + 50, c.w, c.h - 50, 8);
    ctx.fill();
    ctx.fillStyle = '#a37752';
    rr(ctx, c.x, c.y + 50, c.w, 12, 6);
    ctx.fill();
    // roof
    ctx.fillStyle = '#7d5a49';
    ctx.beginPath();
    ctx.moveTo(c.x - 14, c.y + 62);
    ctx.lineTo(c.x + c.w / 2, c.y - 26);
    ctx.lineTo(c.x + c.w + 14, c.y + 62);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.moveTo(c.x + c.w / 2, c.y - 26);
    ctx.lineTo(c.x + c.w * 0.62, c.y + 40);
    ctx.lineTo(c.x + c.w * 0.5, c.y + 46);
    ctx.closePath();
    ctx.fill();
    // chimney + smoke
    ctx.fillStyle = '#8a6a55';
    ctx.fillRect(c.x + c.w * 0.68, c.y + 6, 16, 34);
    // door
    ctx.fillStyle = '#6b4a35';
    rr(ctx, c.x + c.w / 2 - 20, c.y + c.h - 58, 40, 58, 12);
    ctx.fill();
    // window (glows when the grove has life in it)
    const glow = restoredCount(game) > 0 || game.journal.plants.length > 0;
    ctx.fillStyle = glow ? '#ffe9a0' : '#5a4636';
    rr(ctx, c.x + 26, c.y + 96, 26, 26, 5);
    ctx.fill();
    ctx.strokeStyle = '#6b4a35';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(c.x + 39, c.y + 96);
    ctx.lineTo(c.x + 39, c.y + 122);
    ctx.moveTo(c.x + 26, c.y + 109);
    ctx.lineTo(c.x + 52, c.y + 109);
    ctx.stroke();
  }

  // seed shelf
  if (vis(BUILT.shelf.x, BUILT.shelf.y, 80)) {
    const s = BUILT.shelf;
    ctx.fillStyle = '#8a6a44';
    rr(ctx, s.x, s.y, s.w, s.h, 6);
    ctx.fill();
    ctx.fillStyle = '#6b4a35';
    rr(ctx, s.x, s.y + s.h * 0.45, s.w, 5, 2);
    ctx.fill();
    const seedColors = ['#9fe8ff', '#cfd8ff', '#ffe9a8', '#9fe8b0', '#ffd166'];
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = seedColors[i];
      ctx.beginPath();
      ctx.arc(s.x + 12 + i * 11, s.y + 12, 3.4, 0, TAU);
      ctx.fill();
    }
  }

  // workbench
  if (vis(BUILT.workbench.x, BUILT.workbench.y, 100)) {
    const w = BUILT.workbench;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(w.x + w.w / 2, w.y + w.h, 60, 10, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#9a7448';
    rr(ctx, w.x, w.y + 20, w.w, 44, 8);
    ctx.fill();
    ctx.fillStyle = '#8a6a44';
    rr(ctx, w.x, w.y + 8, w.w, 18, 8);
    ctx.fill();
    ctx.fillStyle = '#c9a06c';
    ctx.beginPath();
    ctx.arc(w.x + 28, w.y + 4, 9, Math.PI, TAU);
    ctx.fill();
    if (game.restored.teahouse) {
      ctx.fillStyle = '#7fa888';
      rr(ctx, w.x + 66, w.y - 6, 20, 16, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(w.x + 74, w.y - 10);
      ctx.quadraticCurveTo(w.x + 78, w.y - 18, w.x + 73, w.y - 24);
      ctx.stroke();
    }
  }

  // lantern station
  if (vis(BUILT.lanternStation.x, BUILT.lanternStation.y, 120)) {
    const s = BUILT.lanternStation;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(s.x + s.w / 2, s.y + s.h, 70, 12, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#9a7448';
    rr(ctx, s.x, s.y + 30, s.w - 34, 50, 8);
    ctx.fill();
    ctx.fillStyle = '#8a6a44';
    rr(ctx, s.x, s.y + 16, s.w - 34, 18, 8);
    ctx.fill();
    // pole + hanging lantern
    const px = s.x + s.w - 16;
    ctx.fillStyle = '#6b5335';
    ctx.fillRect(px - 4, s.y - 44, 8, s.h + 40);
    ctx.strokeStyle = '#6b5335';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(px, s.y - 40);
    ctx.lineTo(px - 26, s.y - 34);
    ctx.stroke();
    const lx = px - 28, ly = s.y - 24;
    const fc = fuelColor(game);
    const swing = Math.sin(now * 0.0012) * 2;
    ctx.save();
    ctx.translate(swing, 0);
    ctx.fillStyle = '#4a3a26';
    rr(ctx, lx - 8, ly - 10, 16, 22, 4);
    ctx.fill();
    ctx.fillStyle = fc || '#ffcf9e';
    ctx.globalAlpha = 0.95;
    rr(ctx, lx - 5, ly - 6, 10, 14, 3);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#4a3a26';
    ctx.fillRect(lx - 9, ly - 13, 18, 4);
    ctx.restore();
  }

  // restoration board
  if (vis(BUILT.board.x, BUILT.board.y, 90)) {
    const b = BUILT.board;
    ctx.fillStyle = '#6b4a35';
    ctx.fillRect(b.x + 8, b.y + 20, 8, 40);
    ctx.fillRect(b.x + b.w - 16, b.y + 20, 8, 40);
    ctx.fillStyle = '#8a6a44';
    rr(ctx, b.x, b.y, b.w, b.h - 8, 6);
    ctx.fill();
    const keys = ['seedkeeper', 'workshop', 'teahouse'];
    const names = ['Seed Hut', 'Lantern', 'Tea House'];
    for (let i = 0; i < 3; i++) {
      const done = game.restored[keys[i]];
      ctx.fillStyle = done ? '#ffe9a0' : 'rgba(244,234,216,0.5)';
      rr(ctx, b.x + 8 + i * 24, b.y + 8, 18, 26, 3);
      ctx.fill();
      ctx.fillStyle = done ? '#6b4a35' : '#3a2a1a';
      ctx.font = '8px Georgia, serif';
      ctx.fillText(names[i], b.x + 9 + i * 24, b.y + b.h - 4);
    }
  }

  // restored structures (with rubble fallback)
  drawHut(ctx, game, 'seedkeeper', now, vis);
  drawHut(ctx, game, 'workshop', now, vis);
  drawHut(ctx, game, 'teahouse', now, vis);

  // big tree
  if (vis(BUILT.bigTree.x, BUILT.bigTree.y, 260)) {
    const t = BUILT.bigTree;
    const rc = restoredCount(game);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(t.x, t.y + 44, 90, 20, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#6b4a35';
    rr(ctx, t.x - 26, t.y - 30, 52, 76, 14);
    ctx.fill();
    ctx.strokeStyle = '#5d4030';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(t.x - 24, t.y + 40);
    ctx.quadraticCurveTo(t.x - 56, t.y + 46, t.x - 74, t.y + 58);
    ctx.moveTo(t.x + 24, t.y + 40);
    ctx.quadraticCurveTo(t.x + 58, t.y + 48, t.x + 76, t.y + 58);
    ctx.stroke();
    // canopy
    const canopy = night > 0.5 ? '#2a3a5e' : '#4e7d43';
    const canopy2 = night > 0.5 ? '#22304e' : '#5d9350';
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.0015);
    ctx.fillStyle = canopy;
    ctx.beginPath();
    ctx.arc(t.x - 46, t.y - 52, 62, 0, TAU);
    ctx.arc(t.x + 46, t.y - 52, 62, 0, TAU);
    ctx.arc(t.x, t.y - 92, 74, 0, TAU);
    ctx.fill();
    ctx.fillStyle = canopy2;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(t.x - 20, t.y - 70, 46, 0, TAU);
    ctx.arc(t.x + 30, t.y - 76, 40, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    // grove-heart light
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const a = 0.10 + 0.10 * rc + (game.flags.moonflower ? 0.10 : 0) + (game.fx.songT > 0 ? 0.12 * pulse : 0);
    const g = ctx.createRadialGradient(t.x, t.y - 60, 10, t.x, t.y - 60, 170);
    g.addColorStop(0, `rgba(255,233,180,${a})`);
    g.addColorStop(1, 'rgba(255,233,180,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(t.x, t.y - 60, 170, 0, TAU);
    ctx.fill();
    ctx.restore();
    // fruit lights on the canopy
    for (let i = 0; i < rc * 3; i++) {
      const a2 = (i / (rc * 3)) * TAU + 0.6;
      const fx = t.x + Math.cos(a2) * 60;
      const fy = t.y - 70 + Math.sin(a2) * 44;
      ctx.fillStyle = '#ffe9a0';
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(now * 0.003 + i * 2);
      ctx.beginPath();
      ctx.arc(fx, fy, 3, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // grove trees (canopy over actors) — canopies sway gently in the breeze
  for (const t of DECOR.groveTrees) {
    if (!vis(t.x, t.y, 90)) continue;
    const sway = Math.sin(now * 0.0008 + t.x * 0.02) * 1.6;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(t.x, t.y + 26 * t.s, 26 * t.s, 7 * t.s, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#6b4a35';
    ctx.fillRect(t.x - 5 * t.s, t.y - 10 * t.s, 10 * t.s, 36 * t.s);
    const col = night > 0.5 ? '#2c4258' : t.t > 0.5 ? '#4e7d43' : '#5d9350';
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(t.x - 10 * t.s + sway, t.y - 26 * t.s, 24 * t.s, 0, TAU);
    ctx.arc(t.x + 12 * t.s + sway * 0.8, t.y - 24 * t.s, 22 * t.s, 0, TAU);
    ctx.arc(t.x + sway * 0.6, t.y - 42 * t.s, 26 * t.s, 0, TAU);
    ctx.fill();
  }

  // forest trees (silhouettes) — a slower, heavier sway
  for (const t of DECOR.forestTrees) {
    if (!vis(t.x, t.y, 100)) continue;
    const sway = Math.sin(now * 0.0006 + t.x * 0.017) * 2.2;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(t.x, t.y + 30 * t.s, 30 * t.s, 8 * t.s, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#141729';
    ctx.fillRect(t.x - 5 * t.s, t.y - 12 * t.s, 10 * t.s, 40 * t.s);
    ctx.fillStyle = t.t > 0.5 ? '#1d2240' : '#191e38';
    ctx.beginPath();
    ctx.arc(t.x - 12 * t.s + sway, t.y - 30 * t.s, 26 * t.s, 0, TAU);
    ctx.arc(t.x + 14 * t.s + sway * 0.8, t.y - 28 * t.s, 24 * t.s, 0, TAU);
    ctx.arc(t.x + sway * 0.6, t.y - 48 * t.s, 28 * t.s, 0, TAU);
    ctx.fill();
    // rim light
    ctx.strokeStyle = 'rgba(120,140,255,0.14)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.x + sway * 0.6, t.y - 40 * t.s, 30 * t.s, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
}

function drawHut(ctx, game, id, now, vis) {
  const spots = {
    seedkeeper: BUILT.seedkeeperHut,
    workshop: BUILT.workshop,
    teahouse: BUILT.teahouse,
  };
  const s = spots[id];
  if (!vis(s.x + s.w / 2, s.y + s.h / 2, 160)) return;
  const cx = s.x + s.w / 2, cy = s.y + s.h;

  if (!game.restored[id]) {
    // rubble
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < 6; i++) {
      const ox = s.x + 12 + (i % 3) * (s.w / 3);
      const oy = cy - 8 - Math.floor(i / 3) * 10;
      ctx.fillStyle = i % 2 ? '#6a6d84' : '#585b72';
      ctx.beginPath();
      ctx.ellipse(ox, oy, 12, 8, i, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    return;
  }

  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, s.w * 0.55, 12, 0, 0, TAU);
  ctx.fill();

  if (id === 'seedkeeper') {
    ctx.fillStyle = '#b08968';
    rr(ctx, s.x, s.y + 26, s.w, s.h - 26, 8);
    ctx.fill();
    ctx.fillStyle = '#7d5a49';
    ctx.beginPath();
    ctx.moveTo(s.x - 10, s.y + 34);
    ctx.lineTo(cx, s.y - 14);
    ctx.lineTo(s.x + s.w + 10, s.y + 34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe9a0';
    rr(ctx, s.x + 18, s.y + 52, 20, 20, 4);
    ctx.fill();
    ctx.fillStyle = '#9a7448';
    rr(ctx, s.x + s.w - 44, s.y + s.h - 20, 34, 18, 4);
    ctx.fill();
    ctx.fillStyle = ['#9fe8ff', '#c79bff', '#ffd166'];
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(s.x + s.w - 35 + i * 10, s.y + s.h - 11, 2.6, 0, TAU);
      ctx.fill();
    }
  } else if (id === 'workshop') {
    ctx.fillStyle = '#8d99ae';
    rr(ctx, s.x, s.y + 24, s.w, s.h - 24, 8);
    ctx.fill();
    ctx.fillStyle = '#5c677d';
    ctx.beginPath();
    ctx.moveTo(s.x - 10, s.y + 32);
    ctx.lineTo(cx, s.y - 16);
    ctx.lineTo(s.x + s.w + 10, s.y + 32);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe9a0';
    rr(ctx, s.x + 16, s.y + 48, 22, 24, 4);
    ctx.fill();
    // row of glowing lanterns
    for (let i = 0; i < 3; i++) {
      const lx = s.x + 56 + i * 30;
      ctx.fillStyle = '#4a3a26';
      rr(ctx, lx - 6, s.y + 40, 12, 16, 3);
      ctx.fill();
      ctx.fillStyle = ['#9cc8ff', '#ffd166', '#c79bff'][i];
      rr(ctx, lx - 3.5, s.y + 43, 7, 10, 2);
      ctx.fill();
    }
    // chimney
    ctx.fillStyle = '#6c7589';
    ctx.fillRect(s.x + s.w - 34, s.y - 8, 14, 34);
  } else {
    ctx.fillStyle = '#c9a37c';
    rr(ctx, s.x, s.y + 26, s.w, s.h - 26, 8);
    ctx.fill();
    ctx.fillStyle = '#8a5f45';
    ctx.beginPath();
    ctx.moveTo(s.x - 10, s.y + 34);
    ctx.lineTo(cx, s.y - 14);
    ctx.lineTo(s.x + s.w + 10, s.y + 34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffcf9e';
    rr(ctx, s.x + 22, s.y + 52, 22, 22, 4);
    ctx.fill();
    // hanging lantern
    ctx.fillStyle = '#4a3a26';
    rr(ctx, s.x + s.w - 40, s.y + 40, 14, 18, 3);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    rr(ctx, s.x + s.w - 37, s.y + 43, 8, 12, 2);
    ctx.fill();
    // steam
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const st = (now * 0.002) % 1;
    ctx.moveTo(s.x + 32, s.y + 44 - st * 14);
    ctx.quadraticCurveTo(s.x + 37, s.y + 38 - st * 18, s.x + 32, s.y + 30 - st * 22);
    ctx.stroke();
  }
}

// ------------------------------------------------------------- spirits ---
function drawMori(ctx, now) {
  const p = SPIRIT_POS.mori;
  const bob = Math.sin(now * 0.0024) * 2;
  ctx.save();
  ctx.translate(p.x, p.y + bob);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 16 - bob, 14, 5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f2e3d0';
  ctx.beginPath();
  ctx.ellipse(0, 6, 9, 10, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#e8846a';
  ctx.beginPath();
  ctx.ellipse(0, -4, 16, 10, 0, Math.PI, TAU);
  ctx.quadraticCurveTo(0, 2, -16, -4);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -4, 16, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const [ox, oy, r] of [[-7, -9, 2.4], [4, -11, 2], [9, -6, 1.8]]) {
    ctx.beginPath();
    ctx.arc(ox, oy, r, 0, TAU);
    ctx.fill();
  }
  if ((now * 0.001) % 4.3 < 0.12) {
    // blink
    ctx.strokeStyle = '#2a2438';
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-5.2, 5);
    ctx.lineTo(-1.8, 5);
    ctx.moveTo(1.8, 5);
    ctx.lineTo(5.2, 5);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#2a2438';
    ctx.beginPath();
    ctx.arc(-3.5, 5, 1.8, 0, TAU);
    ctx.arc(3.5, 5, 1.8, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = '#2a2438';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(0, 8.5, 1.6, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

function drawLuma(ctx, now) {
  const p = SPIRIT_POS.luma;
  const bob = Math.sin(now * 0.003) * 4;
  const tw = 0.7 + 0.3 * Math.sin(now * 0.008);
  ctx.save();
  ctx.translate(p.x, p.y - 26 + bob);
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 22);
  g.addColorStop(0, `rgba(255,233,160,${0.7 * tw})`);
  g.addColorStop(1, 'rgba(255,233,160,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffe9a0';
  ctx.beginPath();
  ctx.arc(p.x, p.y - 26 + bob, 5.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff8e0';
  ctx.beginPath();
  ctx.arc(p.x, p.y - 26 + bob, 3, 0, TAU);
  ctx.fill();
  // wings
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.4;
  const w = Math.sin(now * 0.02) * 3;
  ctx.beginPath();
  ctx.moveTo(p.x - 4, p.y - 28 + bob);
  ctx.quadraticCurveTo(p.x - 12, p.y - 34 + bob + w, p.x - 14, p.y - 26 + bob);
  ctx.moveTo(p.x + 4, p.y - 28 + bob);
  ctx.quadraticCurveTo(p.x + 12, p.y - 34 + bob - w, p.x + 14, p.y - 26 + bob);
  ctx.stroke();
}

function drawNix(ctx, now, game) {
  const p = SPIRIT_POS.nix;
  const bob = Math.sin(now * 0.002) * 3;
  ctx.save();
  ctx.translate(p.x, p.y + bob);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 18 - bob, 13, 4.5, 0, 0, TAU);
  ctx.fill();
  // wisp tail
  ctx.strokeStyle = 'rgba(42,33,64,0.8)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.quadraticCurveTo(10 + Math.sin(now * 0.003) * 5, 14, 6, 20);
  ctx.stroke();
  // body
  ctx.fillStyle = '#2a2140';
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(199,155,255,0.18)';
  ctx.beginPath();
  ctx.arc(-4, -4, 7, 0, TAU);
  ctx.fill();
  // big shy eyes
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-4, -1, 3.4, 0, TAU);
  ctx.arc(4.5, -1, 3.4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2a2140';
  const blink = Math.sin(now * 0.004) > 0.96 ? 0.3 : 1;
  ctx.beginPath();
  ctx.ellipse(-4, -1, 1.8, 2.4 * blink, 0, 0, TAU);
  ctx.ellipse(4.5, -1, 1.8, 2.4 * blink, 0, 0, TAU);
  ctx.fill();
  // sparkles
  ctx.fillStyle = 'rgba(199,155,255,0.8)';
  for (let i = 0; i < 3; i++) {
    const a = now * 0.002 + i * 2.1;
    ctx.globalAlpha = 0.4 + 0.4 * Math.sin(a * 3);
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 18, Math.sin(a * 1.3) * 14 - 6, 1.4, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function strokePath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  ctx.stroke();
}
