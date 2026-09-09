// Real-DOM verification (happy-dom): boots the actual game under a real DOM
// and plays the human path — title → intro → select → play — then opens the
// Grove Journal with a real KeyJ keystroke, keeps playing, closes it, etc.
// Catches any behavior that the hand-rolled smoke stub masks.
// Run: node test/realdom.mjs

import { Window } from 'happy-dom';
import { readFileSync } from 'fs';

const win = new Window({ width: 1280, height: 720, url: 'http://localhost:8000/' });

// ------------------------------------------------- strict canvas 2D stub --
const CTX_METHODS = new Set([
  'save', 'restore', 'scale', 'rotate', 'translate', 'transform', 'setTransform', 'resetTransform',
  'beginPath', 'closePath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo',
  'arc', 'arcTo', 'ellipse', 'rect', 'fill', 'stroke', 'clip',
  'fillRect', 'strokeRect', 'clearRect', 'fillText', 'strokeText', 'measureText',
  'createLinearGradient', 'createRadialGradient', 'createPattern', 'createImageData',
  'getImageData', 'putImageData', 'setLineDash', 'getLineDash', 'drawImage',
  'isPointInPath', 'isPointInStroke',
]);
const CTX_PROPS = new Set([
  'fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'lineJoin', 'miterLimit',
  'lineDashOffset', 'globalAlpha', 'globalCompositeOperation', 'font', 'textAlign',
  'textBaseline', 'shadowBlur', 'shadowColor', 'shadowOffsetX', 'shadowOffsetY',
  'imageSmoothingEnabled', 'filter', 'canvas',
]);
function makeCtx(canvasEl) {
  const target = {};
  return new Proxy(target, {
    get(t, p) {
      if (p === 'canvas') return canvasEl;
      if (CTX_PROPS.has(p)) return p in t ? t[p] : undefined;
      if (CTX_METHODS.has(p)) {
        return (...args) => {
          const s = String(p);
          if (s.startsWith('create') && s !== 'createImageData') return { addColorStop() {} };
          if (s === 'measureText') return { width: 10 };
          if (s === 'getLineDash') return [];
          return undefined;
        };
      }
      throw new Error(`canvas ctx: unknown member '${String(p)}' (typo in renderer?)`);
    },
    set(t, p, v) {
      if (!CTX_PROPS.has(p)) throw new Error(`canvas ctx: unknown property '${String(p)}' (typo in renderer?)`);
      t[p] = v;
      return true;
    },
  });
}
win.HTMLCanvasElement.prototype.getContext = function () {
  if (!this._ctx) this._ctx = makeCtx(this);
  return this._ctx;
};

// ------------------------------------------------- mock WebAudio ---------
let t = 1000;
class MockParam {
  constructor(v = 0) { this.value = v; }
  setValueAtTime(v) { this.value = v; }
  linearRampToValueAtTime(v) { this.value = v; }
  exponentialRampToValueAtTime(v) {
    if (v <= 0) throw new RangeError('exponentialRampToValueAtTime: target must be > 0');
    this.value = v;
  }
  setTargetAtTime(v) { this.value = v; }
  connect(n) { return n; }
}
class MockAudioContext {
  constructor() {
    this.sampleRate = 44100;
    this.state = 'running';
    this.destination = { connect: (n) => n };
  }
  get currentTime() { return t / 1000; }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  resume() { this.state = 'running'; return Promise.resolve(); }
  createOscillator() {
    return { type: 'sine', frequency: new MockParam(), connect: (n) => n, start() {}, stop() {} };
  }
  createGain() { return { gain: new MockParam(1), connect: (n) => n }; }
  createBiquadFilter() { return { type: 'lowpass', frequency: new MockParam(440), Q: new MockParam(1), connect: (n) => n }; }
  createBufferSource() { return { buffer: null, loop: false, connect: (n) => n, start() {} }; }
  createBuffer(_ch, len) { return { getChannelData: () => new Float32Array(len) }; }
}
win.AudioContext = MockAudioContext;

// ------------------------------------------------- globals ---------------
globalThis.window = win;
globalThis.document = win.document;
globalThis.localStorage = win.localStorage;
globalThis.innerWidth = 1280;
globalThis.innerHeight = 720;
globalThis.devicePixelRatio = 1;
globalThis.addEventListener = (h, fn, o) => win.addEventListener(h, fn, o);
globalThis.removeEventListener = (h, fn) => win.removeEventListener(h, fn);
let rafCb = null;
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };

let failures = 0;
function check(name, cond) {
  if (cond) console.log('  ✓', name);
  else { console.error('  ✗ FAIL:', name); failures++; process.exitCode = 1; }
}

// ------------------------------------------------- page markup -----------
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const bodyMatch = html.match(/<body>([\s\S]*)<\/body>/);
win.document.body.innerHTML = bodyMatch[1].replace(/<script[\s\S]*?<\/script>/, '');

win.addEventListener('error', (e) => {
  console.error('  ✗ WINDOW ERROR EVENT:', e.message);
  failures++; process.exitCode = 1;
});

let frameCount = 0;
function frames(n) {
  for (let i = 0; i < n; i++) {
    const cb = rafCb;
    rafCb = null;
    if (!cb) throw new Error('no animation frame scheduled — the loop DIED');
    t += 16.7;
    frameCount++;
    cb(t);
  }
}
function key(code) {
  win.dispatchEvent(new win.KeyboardEvent('keydown', { code, repeat: false, cancelable: true }));
  win.dispatchEvent(new win.KeyboardEvent('keyup', { code, repeat: false, cancelable: true }));
}

// ------------------------------------------------- boot + human play -----
console.log('booting under real DOM…');
await import('../js/main.js');
await new Promise((r) => setTimeout(r, 50));
const dbg = win.__sproutDebug;
check('boots to title', dbg.mode === 'title');
frames(10);

win.document.getElementById('screen-title').querySelector('[data-act="demo"]').click();
check('play demo → intro', dbg.mode === 'intro');
frames(3);
for (let i = 0; i < 4; i++) { key('KeyE'); frames(2); }
check('intro → select', dbg.mode === 'select');
frames(3);

const sel = win.document.getElementById('screen-select');
const modalEl = win.document.getElementById('modal');

async function runSession(axieIndex) {
  sel.querySelector('.select-cards').children[axieIndex].click();
  sel.querySelector('.select-begin').click();
  check(`select Axie ${axieIndex} → play`, dbg.mode === 'play');
  frames(5);
  for (let i = 0; i < 4; i++) { key('KeyE'); frames(2); }
  frames(5);
  check(`session ${axieIndex}: playing`, dbg.mode === 'play' && !!dbg.game);
  key('KeyJ'); frames(5);
  check(`session ${axieIndex}: journal opens`, modalEl.classList.contains('show'));
  frames(40);
  key('Escape'); frames(5);
  check(`session ${axieIndex}: journal closes`, !modalEl.classList.contains('show'));
  frames(20);
  return dbg.game;
}

const g0 = await runSession(0); // Fern (Plant)
const g1 = await runSession(1); // Ripple (Aquatic)
const g2 = await runSession(2); // Pippin (Bird)

// Continue run: load a saved state, then open the journal
const saveKey = 'axie-sprout-lantern.save.v1';
win.localStorage.setItem(saveKey, JSON.stringify({ v: 1, at: Date.now(), state: {
  axieId: g2.axieId, axieName: g2.axieName, axieCls: g2.axieCls,
  px: 1700, py: 1100, phaseT: 1, glowdust: 55,
  plots: g2.plots, inv: { seeds: { glowberry: 2, mooncap: 1 }, produce: { glowberry: 4 }, fuel: { moonspore: 1, sunpetal: 1, dreamcap: 1 }, treats: { bun: 1, tea: 1 }, special: {} },
  fuel: 'moonspore', selectedSeed: 'glowberry',
  restored: { seedkeeper: true, workshop: false, teahouse: false },
  puzzles: { flowerSeq: 0, flowersDone: false, bridgeRevealed: false, stoneSeq: 0, stonesDone: false },
  spirits: { mori: { met: true, requestDone: true, lastPet: 0 }, luma: { met: false, lastGift: 0 }, nix: { met: false, lastGift: 0 } },
  areas: { grove: true, 'forest-entrance': true, stream: false, 'stone-circle': false, garden: false, clearing: false, deep: false },
  deepest: 1,
  bondXp: 62, bondLevel: 2, level: 3,
  journal: { plants: ['glowberry', 'mooncap'], seeds: ['glowberry', 'mooncap'], spirits: ['mori'], fuels: ['moonspore'], objects: [], recent: [{ text: 'Befriended Mori', at: 10 }, { text: 'Discovered Mooncap', at: 20 }] },
  flags: { planted: true, harvested: true, firstFuel: true, enteredForest: true, moonflower: false, deepPath: false, endingSeen: false, restCooldown: 0 },
  times: { save: 0 },
}}));
win.document.getElementById('screen-title').querySelector('[data-act="continue"]').click();
frames(5);
check('continue restores the run', dbg.mode === 'play' && dbg.game.bondLevel === 2);
frames(3);
key('KeyJ'); frames(5);
check('journal opens on continued (mid-game) run', modalEl.classList.contains('show'));
frames(40);
key('Escape'); frames(5);
check('journal closes on continued run', !modalEl.classList.contains('show'));
frames(30);

// ---------------------------------------------------------------------
// THE REPORTED BUG: opening the Grove Journal (J key / HUD chip)
// ---------------------------------------------------------------------
key('KeyJ');
frames(5);
check('journal modal is visible', modalEl.classList.contains('show'));
check('journal title is set', modalEl.querySelector('.modal-title').textContent === 'Grove Journal');
frames(60);
check('journal hero shows the Axie name', modalEl.querySelector('.journal-name').textContent === dbg.game.axieName);
check('journal has 8 stats', modalEl.querySelectorAll('.journal-stat').length === 8);
check('game loop still alive with journal open', true);
check('world time advanced', dbg.game.time > 0.5);

key('Escape');
frames(5);
check('journal closes on Escape', !modalEl.classList.contains('show'));
frames(30);

win.document.querySelector('.hud-journal').click();
frames(5);
check('journal reopens via HUD chip', modalEl.classList.contains('show'));
frames(30);
key('Escape');
frames(5);

key('KeyI'); frames(5);
check('inventory opens (I)', modalEl.classList.contains('show'));
key('Escape'); frames(5);

frames(120);
console.log(failures ? `\n${failures} FAILURE(S) — real DOM run` : `\nreal-DOM run clean — ${frameCount} frames, journal opens/closes fine`);
