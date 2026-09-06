// Smooth soft-follow camera with zoom (used for the ending dolly-out).

import { clamp, lerp } from './utils.js';

export const camera = {
  x: 0,
  y: 0,
  zoom: 1,
  targetZoom: 1,

  snap(x, y) {
    this.x = x;
    this.y = y;
  },

  update(px, py, dt, world) {
    // slight look-ahead in the direction of motion is handled by caller via px/py nudge
    const k = 1 - Math.pow(0.0015, dt); // frame-rate independent smoothing
    this.x = lerp(this.x, px, k);
    this.y = lerp(this.y, py, k);
    this.zoom = lerp(this.zoom, this.targetZoom, 1 - Math.pow(0.2, dt));
    const vw = 1600 / this.zoom;
    const vh = 900 / this.zoom;
    this.x = clamp(this.x, vw / 2 - 400, world.w - vw / 2 + 400);
    this.y = clamp(this.y, vh / 2 - 300, world.h - vh / 2 + 300);
  },

  screen(wx, wy, viewW, viewH) {
    return {
      x: (wx - this.x) * this.zoom + viewW / 2,
      y: (wy - this.y) * this.zoom + viewH / 2,
    };
  },
};
