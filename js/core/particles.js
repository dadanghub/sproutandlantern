// Simple pooled particle system with a few cozy particle types.

import { rand, TAU } from './utils.js';

class ParticleSystem {
  constructor() {
    this.list = [];
  }

  add(p) {
    if (this.list.length > 600) this.list.shift();
    this.list.push(p);
  }

  sparkle(x, y, color, n = 10, speed = 60, life = 1) {
    for (let i = 0; i < n; i++) {
      const a = rand(TAU);
      const s = rand(0.3, 1) * speed;
      this.add({
        type: 'spark', x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20,
        life: rand(0.5, life), max: life,
        size: rand(1, 2.6), color, gravity: -14,
      });
    }
  }

  puff(x, y, color, n = 6, speed = 24) {
    for (let i = 0; i < n; i++) {
      const a = rand(TAU);
      const s = rand(0.3, 1) * speed;
      this.add({
        type: 'puff', x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(0.5, 1.1), max: 1.1,
        size: rand(2.5, 5), color, gravity: 0,
      });
    }
  }

  drops(x, y, n = 8) {
    for (let i = 0; i < n; i++) {
      this.add({
        type: 'drop', x: x + rand(-14, 14), y: y + rand(-8, 4),
        vx: rand(-12, 12), vy: rand(-40, -10),
        life: rand(0.35, 0.7), max: 0.7,
        size: rand(1.2, 2.2), color: '#9fd8ff', gravity: 260,
      });
    }
  }

  notes(x, y, n = 5) {
    for (let i = 0; i < n; i++) {
      this.add({
        type: 'note', x: x + rand(-16, 16), y: y - 10,
        vx: rand(-8, 8), vy: rand(-34, -20),
        life: rand(1, 1.7), max: 1.7,
        size: rand(10, 15), color: '#ffe9a0', gravity: -4,
        glyph: i % 2 ? '♫' : '♪',
      });
    }
  }

  ring(x, y, color, size = 60) {
    this.add({ type: 'ring', x, y, vx: 0, vy: 0, life: 0.7, max: 0.7, size, color, gravity: 0 });
  }

  update(dt) {
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) {
        list.splice(i, 1);
        continue;
      }
      p.vy += (p.gravity || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx) {
    for (const p of this.list) {
      const a = Math.max(0, p.life / p.max);
      if (p.type === 'spark') {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
      } else if (p.type === 'puff') {
        ctx.globalAlpha = a * 0.5;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - a * 0.6), 0, TAU);
        ctx.fill();
      } else if (p.type === 'drop') {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
      } else if (p.type === 'note') {
        ctx.globalAlpha = a * 0.9;
        ctx.fillStyle = p.color;
        ctx.font = `${p.size}px serif`;
        ctx.fillText(p.glyph, p.x, p.y);
      } else if (p.type === 'ring') {
        const t = 1 - a;
        ctx.globalAlpha = a * 0.8;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6 + t * p.size, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
}

export const Particles = new ParticleSystem();
