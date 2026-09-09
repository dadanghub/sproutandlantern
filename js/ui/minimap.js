// Twilight Minimap — a lantern-carved map of the corrupted forest.
//
// The map starts shrouded in mist; as your lantern's light reaches each
// 55px cell it is "purified" and becomes visible. Ember Pulse purifies a
// wide area, matching the light wave. Landmarks appear once you've reached
// their area or met their spirit. The grid persists in the save.
//
// All drawing uses only the basic Canvas2D API (see test/smoke.mjs).

import { TAU } from '../core/utils.js';
import { FOREST, STREAM, DEEP_PATH, BRIDGE, STONES, FLOWERS, SPIRIT_POS, REST_STONE, DEEP_ARCH, MOONFLOWER_PLOT, GROVE_LANTERN } from '../world/map.js';
import { lightRadius, FUELS } from '../systems/lantern.js';

export const MM_CELL = 55; // world px per map cell
export const MM_PX = 5; // canvas px per map cell
export const MM_W = Math.ceil(FOREST.w / MM_CELL); // 30
export const MM_H = Math.ceil(FOREST.h / MM_CELL); // 27
export const MM_CW = MM_W * MM_PX; // 150
export const MM_CH = MM_H * MM_PX; // 135

const S = MM_PX / MM_CELL; // world -> canvas scale
const mx = (wx) => (wx - FOREST.x) * S;
const my = (wy) => wy * S;

export function newMinimapState() {
  return { w: MM_W, h: MM_H, cells: new Array(MM_W * MM_H).fill(0) };
}

let terrain = null;
let fog = null;
let fogCtx = null;
let fogDirty = true;
let carveAcc = 0;

/** Pre-render the static terrain + fog layers. */
export function minimapBuild(canvas, game) {
  canvas.width = MM_CW;
  canvas.height = MM_CH;

  terrain = document.createElement('canvas');
  terrain.width = MM_CW;
  terrain.height = MM_CH;
  paintTerrain(terrain.getContext('2d'));

  fog = document.createElement('canvas');
  fog.width = MM_CW;
  fog.height = MM_CH;
  fogCtx = fog.getContext('2d');
  paintFog(game);
  fogDirty = false;
}

function paintTerrain(ctx) {
  // corrupted base
  ctx.fillStyle = '#151930';
  ctx.fillRect(0, 0, MM_CW, MM_CH);
  // mottling (deterministic)
  for (let i = 0; i < 16; i++) {
    const bx = ((i * 137 + 31) % (MM_CW - 14)) + 7;
    const by = ((i * 211 + 57) % (MM_CH - 14)) + 7;
    ctx.fillStyle = i % 2 ? 'rgba(41,48,84,0.4)' : 'rgba(10,12,26,0.4)';
    ctx.beginPath();
    ctx.ellipse(bx, by, 6 + (i % 4) * 2.4, 4 + (i % 3) * 2.2, i * 0.7, 0, TAU);
    ctx.fill();
  }
  // glowing stream (top to bottom, gentle S-curve)
  const streamPts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const wx = 2150 + Math.sin(t * 5.2) * 26;
    const wy = STREAM.y0 + t * (STREAM.y1 - STREAM.y0);
    streamPts.push([mx(wx), my(wy)]);
  }
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(43,74,110,0.85)';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(streamPts[0][0], streamPts[0][1]);
  for (const [x, y] of streamPts) ctx.lineTo(x, y);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(89,227,255,0.3)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(streamPts[0][0], streamPts[0][1]);
  for (const [x, y] of streamPts) ctx.lineTo(x, y);
  ctx.stroke();
  // deep twilight strip (top)
  ctx.fillStyle = 'rgba(150,110,235,0.22)';
  ctx.fillRect(mx(DEEP_PATH.x), my(DEEP_PATH.y), DEEP_PATH.w * S, DEEP_PATH.h * S);
  // the grove rim: the map's left & bottom edges border the safe grove
  ctx.fillStyle = 'rgba(125,160,95,0.45)';
  ctx.fillRect(0, 0, 2.5, MM_CH);
  ctx.fillRect(0, MM_CH - 2.5, MM_CW, 2.5);
  // the forest arch (entrance)
  ctx.fillStyle = '#ffd9a0';
  ctx.beginPath();
  ctx.arc(2.5, my(1250), 2.6, 0, TAU);
  ctx.fill();
}

function paintFog(game) {
  fogCtx.clearRect(0, 0, MM_CW, MM_CH);
  fogCtx.fillStyle = 'rgba(12,10,26,0.93)';
  const cells = game.minimap ? game.minimap.cells : [];
  for (let iy = 0; iy < MM_H; iy++) {
    for (let ix = 0; ix < MM_W; ix++) {
      if (cells[iy * MM_W + ix]) continue;
      fogCtx.fillRect(ix * MM_PX, iy * MM_PX, MM_PX, MM_PX);
    }
  }
}

/** Carve mist with the lantern (throttled to 5x/s). */
export function minimapTick(game, dt) {
  if (!game.minimap) game.minimap = newMinimapState();
  carveAcc += dt;
  if (carveAcc < 0.2) return;
  carveAcc = 0;

  const R = lightRadius(game) + (game.fx.pulseT > 0 ? 520 : 0);
  const x0 = Math.max(0, Math.floor((game.px - R - FOREST.x) / MM_CELL));
  const x1 = Math.min(MM_W - 1, Math.floor((game.px + R - FOREST.x) / MM_CELL));
  const y0 = Math.max(0, Math.floor((game.py - R) / MM_CELL));
  const y1 = Math.min(MM_H - 1, Math.floor((game.py + R) / MM_CELL));
  let changed = false;
  for (let iy = y0; iy <= y1; iy++) {
    for (let ix = x0; ix <= x1; ix++) {
      const cx = FOREST.x + (ix + 0.5) * MM_CELL;
      const cy = (iy + 0.5) * MM_CELL;
      const dx = cx - game.px;
      const dy = cy - game.py;
      if (dx * dx + dy * dy > R * R) continue;
      const idx = iy * MM_W + ix;
      if (!game.minimap.cells[idx]) {
        game.minimap.cells[idx] = 1;
        changed = true;
      }
    }
  }
  if (changed) {
    paintFog(game);
    fogDirty = false;
  }
}

/** Draw the minimap frame: terrain + fog + landmarks + player. */
export function minimapDraw(ctx, game, now) {
  if (!terrain || !fog) return;
  ctx.clearRect(0, 0, MM_CW, MM_CH);
  ctx.drawImage(terrain, 0, 0);
  ctx.drawImage(fog, 0, 0);

  const a = game.areas || {};
  const sp = game.spirits || {};
  const dot = (wx, wy, color, r = 2, alpha = 1) => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mx(wx), my(wy), r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  // old flowers (known at the forest entrance)
  if (a['forest-entrance']) {
    for (const f of FLOWERS) {
      dot(f.x, f.y, game.puzzles.flowersDone ? '#ffffff' : FUELS[f.color].color, 1.8, 0.95);
    }
  }
  // the bridge (known by the stream)
  if (a.stream) {
    dot(BRIDGE.x + BRIDGE.w / 2, BRIDGE.y + BRIDGE.h / 2, game.puzzles.bridgeRevealed ? '#ffe9a0' : '#8a93c8', 2.2, 0.95);
  }
  // stone circle (known in the circle's area)
  if (a['stone-circle']) {
    for (const s of STONES) {
      dot(s.x, s.y, game.puzzles.stonesDone ? FUELS[s.glyph].color : '#9aa0c8', 2, 0.95);
    }
  }
  // spirits
  if (sp.mori && sp.mori.met) dot(SPIRIT_POS.mori.x, SPIRIT_POS.mori.y, '#e8846a', 2.4);
  if (sp.luma && sp.luma.met) dot(SPIRIT_POS.luma.x, SPIRIT_POS.luma.y - 10, '#ffe9a0', 2.2);
  if (sp.nix && sp.nix.met) dot(SPIRIT_POS.nix.x, SPIRIT_POS.nix.y, '#c79bff', 2.4);
  // hidden garden + moonflower
  if (a.garden) {
    if (game.flags.moonflower) dot(MOONFLOWER_PLOT.x + 37, MOONFLOWER_PLOT.y + 32, '#ffffff', 2.6);
    else dot(MOONFLOWER_PLOT.x + 37, MOONFLOWER_PLOT.y + 32, '#b8a6e8', 1.8, 0.7);
  }
  // rest stone (spirit clearing)
  if (a.clearing) dot(REST_STONE.x, REST_STONE.y, '#8a93c8', 2, 0.9);
  // the deep arch (once the circle is solved)
  if (game.flags.deepPath) dot(DEEP_ARCH.x, DEEP_ARCH.y, '#c79bff', 2.4, 0.9 + 0.1 * Math.sin(now * 0.003));
  // the Grovekeeper's old lantern — gold once it is lit
  if (game.flags.deepPath) {
    dot(GROVE_LANTERN.x, GROVE_LANTERN.y, game.flags.groveLanternLit ? '#ffe9a0' : '#9aa0c8', 2.6, game.flags.groveLanternLit ? 1 : 0.8);
  }

  // the player: a lantern dot, fuel-tinted
  const inMap = game.px >= FOREST.x && game.py <= FOREST.y + FOREST.h;
  const px = Math.min(MM_CW - 3, Math.max(3, mx(game.px)));
  const py = Math.min(MM_CH - 3, Math.max(3, my(game.py)));
  const col = FUELS[game.fuel] ? FUELS[game.fuel].color : '#ffcf9e';
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const pulse = 0.55 + 0.25 * Math.sin(now * 0.004);
  const g = ctx.createRadialGradient(px, py, 0.5, px, py, 7);
  g.addColorStop(0, hexA(col, 0.7 * pulse));
  g.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(px, py, 7, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = inMap ? 1 : 0.55;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(px, py, 1.9, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(px, py, 3.4, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
