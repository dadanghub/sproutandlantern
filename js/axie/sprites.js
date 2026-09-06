// Procedural Axie sprites. No image assets — everything is drawn so a real
// Axie texture can later be swapped in at the same anchor points.
// The Axie carries its SLP lantern (opts.lantern = glass color).

import { TAU, roundRect } from '../core/utils.js';

/** Draw the Axie sprite centered at (x, y). t = walk/anim time, facing = -1|1. */
export function drawAxie(ctx, def, x, y, t, opts = {}) {
  const { body, accent, glow } = def.colors;
  const walk = opts.moving ? Math.sin(t * 9) : Math.sin(t * 2.4) * 0.4;
  const bob = walk * 1.6;
  const sc = opts.scale || 1;

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(sc, sc);
  if (opts.facing < 0) ctx.scale(-1, 1);

  // shadow
  ctx.fillStyle = 'rgba(10,10,20,0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 15 - bob, 12, 4.5, 0, 0, TAU);
  ctx.fill();

  // tail per class
  if (def.cls === 'aquatic') {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(-10, 4);
    ctx.quadraticCurveTo(-19, 0 + walk * 2, -15, -6);
    ctx.quadraticCurveTo(-12, -2, -9, -1);
    ctx.fill();
  } else if (def.cls === 'bird') {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.ellipse(-11, 2, 4.5, 8, 0.5, 0, TAU);
    ctx.fill();
  } else if (def.cls === 'plant') {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, 6);
    ctx.quadraticCurveTo(-15, 4 + walk * 2, -16, -1);
    ctx.stroke();
  } else {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.ellipse(-12, 3, 4, 6, 0.3, 0, TAU);
    ctx.fill();
  }

  // body
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 12.5, 11.5 + walk * 0.5, 0, 0, TAU);
  ctx.fill();

  // belly
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(1, 4, 7.5, 6, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;

  // class crest
  if (def.cls === 'plant') {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.ellipse(-3, -13, 3, 6, -0.5, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(3, -13.5, 3, 6, 0.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(0, -11.5);
    ctx.stroke();
  } else if (def.cls === 'aquatic') {
    ctx.fillStyle = accent;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 5 - 2.6, -10);
      ctx.lineTo(i * 5, -17 - (i === 0 ? 2 : 0));
      ctx.lineTo(i * 5 + 2.6, -10);
      ctx.closePath();
      ctx.fill();
    }
  } else if (def.cls === 'bird') {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.ellipse(7, 1, 6.5, 9.5, 0.35, 0, TAU);
    ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(-2, -12.5, 2.6, 0, TAU);
    ctx.arc(1.5, -13.5, 2.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e8a05e';
    ctx.beginPath();
    ctx.moveTo(11, -2);
    ctx.lineTo(15.5, -0.5);
    ctx.lineTo(11, 1.5);
    ctx.closePath();
    ctx.fill();
  } else {
    // beast/bug/reptile: rounded ears
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(-7, -10, 4, 0, TAU);
    ctx.arc(7, -10, 4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(-7, -10, 2, 0, TAU);
    ctx.arc(7, -10, 2, 0, TAU);
    ctx.fill();
  }

  // face
  if (opts.happy) {
    ctx.strokeStyle = '#2a2438';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    for (const ex of [2.5, 8]) {
      ctx.beginPath();
      ctx.arc(ex, -2.5, 2.4, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#2a2438';
    ctx.beginPath();
    ctx.arc(3, -2.5, 1.7, 0, TAU);
    ctx.arc(8.5, -2.5, 1.7, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(3.5, -3, 0.6, 0, TAU);
    ctx.arc(9, -3, 0.6, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = '#2a2438';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(5.8, 1.2, 1.8, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  // blush
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#ff9e9e';
  ctx.beginPath();
  ctx.arc(0.5, 0.5, 1.8, 0, TAU);
  ctx.arc(10.5, 0.5, 1.8, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;

  // ---- the SLP lantern the Axie carries (drawn on the front side) ----
  if (opts.lantern) {
    const sw = Math.sin(t * 2.2) * 0.8;
    const lx = 17.5, ly = -2 + sw * 0.5;
    // stick
    ctx.strokeStyle = '#8a6a44';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(10, 4);
    ctx.lineTo(lx - 1, ly - 7);
    ctx.stroke();
    // handle
    ctx.strokeStyle = '#4a3a26';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(lx, ly - 8.4, 2.6, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    // frame
    ctx.fillStyle = '#4a3a26';
    roundRect(ctx, lx - 3.8, ly - 7.6, 7.6, 9.6, 2.4);
    ctx.fill();
    // glass — bioluminescent SLP
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = opts.lantern;
    roundRect(ctx, lx - 2.4, ly - 6.2, 4.8, 6.8, 1.6);
    ctx.fill();
    ctx.globalAlpha = 1;
    // core sparkle
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(lx - 0.6, ly - 4.6, 1.1, 0, TAU);
    ctx.fill();
    // cap + base
    ctx.fillStyle = '#4a3a26';
    ctx.fillRect(lx - 4.2, ly - 8.8, 8.4, 1.8);
    ctx.fillRect(lx - 4.2, ly + 2.2, 8.4, 1.6);
    // small local glow so the lantern reads even in daylight
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(lx, ly - 3, 1, lx, ly - 3, 16);
    g.addColorStop(0, hexA(opts.lantern, 0.5));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(lx, ly - 3, 16, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** Render an Axie portrait onto a small canvas (used in HUD, journal, cards). */
export function paintPortrait(canvas, def) {
  const ctx = canvas.getContext('2d');
  const s = canvas.width;
  ctx.clearRect(0, 0, s, s);
  // background circle
  const g = ctx.createRadialGradient(s / 2, s * 0.42, s * 0.1, s / 2, s / 2, s * 0.62);
  g.addColorStop(0, shade(def.colors.body, 0.55));
  g.addColorStop(1, shade(def.colors.body, -0.45));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.55, 0, TAU);
  ctx.fill();
  // soft ring
  ctx.strokeStyle = 'rgba(255,217,138,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.55, 0, TAU);
  ctx.stroke();
  // the Axie, big and centered, lantern in paw
  ctx.save();
  ctx.translate(s / 2, s * 0.56);
  ctx.scale(s / 46, s / 46);
  drawAxie(ctx, def, 0, 0, 1.2, { moving: false, facing: 1, happy: true, lantern: '#ffd9a8' });
  ctx.restore();
}

function shade(hex, amt) {
  const h = hex.replace('#', '');
  let r = parseInt(h.slice(0, 2), 16);
  let g = parseInt(h.slice(2, 4), 16);
  let b = parseInt(h.slice(4, 6), 16);
  const t = amt > 0 ? 255 : 0;
  const p = Math.abs(amt);
  r = Math.round(r + (t - r) * p);
  g = Math.round(g + (t - g) * p);
  b = Math.round(b + (t - b) * p);
  return `rgb(${r},${g},${b})`;
}
