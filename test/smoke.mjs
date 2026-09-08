// Headless smoke test: stubs a minimal DOM + canvas 2D context, boots the
// real game, and plays the full vertical slice programmatically.
// Run: node test/smoke.mjs

// ------------------------------------------------------------------ stubs
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const winListeners = {};
globalThis.window = globalThis;
globalThis.innerWidth = 1280;
globalThis.innerHeight = 720;
globalThis.devicePixelRatio = 1;
globalThis.addEventListener = (t, fn) => { (winListeners[t] = winListeners[t] || []).push(fn); };
globalThis.removeEventListener = () => {};

// Strict Canvas2D stub: rejects unknown members so renderer typos throw.
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
  const t = {};
  return new Proxy(t, {
    get(target, p) {
      if (p === 'canvas') return canvasEl;
      if (CTX_PROPS.has(p)) return p in target ? target[p] : undefined;
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
    set(target, p, v) {
      if (!CTX_PROPS.has(p)) throw new Error(`canvas ctx: unknown property '${String(p)}' (typo in renderer?)`);
      target[p] = v;
      return true;
    },
  });
}

class FakeEl {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this._q = {};
    this._listeners = {};
    this._html = '';
    this._text = '';
    this.width = 0;
    this.height = 0;
    this.disabled = false;
    this.title = '';
    const set = new Set();
    this.classList = {
      add: (...c) => c.forEach((x) => set.add(x)),
      remove: (...c) => c.forEach((x) => set.delete(x)),
      toggle: (c, f) => {
        const want = f === undefined ? !set.has(c) : f;
        want ? set.add(c) : set.delete(c);
        return want;
      },
      contains: (c) => set.has(c),
    };
    this.style = { setProperty() {} };
  }
  get className() { return ''; }
  set className(v) { this._cls = v; }
  append(...ns) { for (const n of ns) if (n && n.tagName) { n._parent = this; this.children.push(n); } }
  appendChild(n) { n._parent = this; this.children.push(n); return n; }
  prepend(n) { n._parent = this; this.children.unshift(n); }
  addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); }
  removeEventListener() {}
  dispatch(t, ev) { (this._listeners[t] || []).forEach((f) => f(ev || {})); }
  querySelector(sel) {
    if (!this._q[sel]) this._q[sel] = new FakeEl('div');
    return this._q[sel];
  }
  querySelectorAll() { return []; }
  insertAdjacentHTML() { this._html = ''; }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = v; this.children = []; }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); }
  get firstChild() { return this.children[0] || null; }
  get offsetWidth() { return 100; }
  get outerHTML() { return ''; }
  set outerHTML(v) { if (!v) this.children = []; }
  get id() { return this._id || ''; }
  set id(v) { this._id = v; if (v) byId[v] = this; }
  remove() {
    if (this._parent) {
      const i = this._parent.children.indexOf(this);
      if (i >= 0) this._parent.children.splice(i, 1);
      this._parent = null;
    }
  }
  getContext() { if (!this._ctx) this._ctx = makeCtx(this); return this._ctx; }
}

const byId = {};
globalThis.document = {
  createElement: (tag) => new FakeEl(tag),
  getElementById: (id) => (byId[id] = byId[id] || new FakeEl(id === 'game' ? 'canvas' : 'div')),
  addEventListener: () => {},
  activeElement: null,
};

let rafCb = null;
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };

// ------------------------------------------------------------------- boot
let t = 1000;
const FRAME = 16.7;

// Mock WebAudio: the game's audio code (music scheduler, SFX, pick motifs)
// runs for real under test. currentTime is tied to the test clock, and
// exponential ramps to <=0 throw exactly like a browser. (This mock is what
// catches the kind of bug where the music scheduler crashes the frame loop
// ~11s in — a freeze invisible without an AudioContext.)
let mockOscCount = 0;
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
  resume() {}
  createOscillator() {
    mockOscCount++;
    return { type: 'sine', frequency: new MockParam(), connect: (n) => n, start() {}, stop() {} };
  }
  createGain() { return { gain: new MockParam(1), connect: (n) => n }; }
  createBiquadFilter() { return { type: 'lowpass', frequency: new MockParam(440), Q: new MockParam(1), connect: (n) => n }; }
  createBufferSource() { return { buffer: null, loop: false, connect: (n) => n, start() {} }; }
  createBuffer(_ch, len) { return { getChannelData: () => new Float32Array(len) }; }
}
globalThis.AudioContext = MockAudioContext;

function frames(n) {
  for (let i = 0; i < n; i++) {
    const cb = rafCb;
    rafCb = null;
    if (!cb) throw new Error('no animation frame scheduled');
    t += FRAME;
    if (process.env.HB && i % 200 === 0) console.log(`  …frame ${i}/${n}`);
    cb(t);
  }
}

function key(code, down = true) {
  const ev = { code, repeat: false, preventDefault() {} };
  (winListeners[down ? 'keydown' : 'keyup'] || []).forEach((f) => f(ev));
}

let passed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ✓', name); }
  else { console.error('  ✗ FAIL:', name); process.exitCode = 1; }
}

console.log('booting game…');
await import('../js/main.js');
await new Promise((r) => setTimeout(r, 80));

const dbg = globalThis.__sproutDebug;
check('boots to title screen', dbg.mode === 'title');
frames(10);

// ---- title -> intro
const title = globalThis.document.getElementById('screen-title');
title.querySelector('[data-act="demo"]').dispatch('click');
check('play demo -> intro', dbg.mode === 'intro');
frames(3);
for (let i = 0; i < 4; i++) { key('KeyE'); key('KeyE', false); frames(2); }
check('intro -> select', dbg.mode === 'select');
frames(3);

// ---- select Fern (plant)
const sel = globalThis.document.getElementById('screen-select');
const cards = sel.querySelector('.select-cards');
cards.children[0].dispatch('click');
sel.querySelector('.select-begin').dispatch('click');
check('select -> play', dbg.mode === 'play');
let g = dbg.game;
check('axie is Fern (Plant)', g.axieName === 'Fern' && g.axieCls === 'plant');
frames(5);

// per-axie pick motifs + music loop run on the mocked WebAudio graph
{
  const { audio } = await import('../js/core/audio.js');
  audio.axiePick('plant');
  audio.axiePick('aquatic');
  audio.axiePick('reptile');
  check('pick motifs synthesize oscillators', mockOscCount > 0);
  // music started in beginRun; run ~23.4s = two full 32-step passes (A + B).
  // (pre-fix: the scheduler crashed at step 32, ~11.4s in, killing the rAF loop)
  frames(1400);
  check('music loop schedules full A/B pattern', mockOscCount > 70);
}

// HUD carries the portrait + Twilight minimap canvases
{
  const hud = globalThis.document.getElementById('hud');
  let canvases = 0;
  const walk = (n) => {
    if (!n) return;
    if (n.tagName === 'CANVAS') canvases++;
    (n.children || []).forEach(walk);
  };
  walk(hud);
  check('hud has portrait + minimap canvases', canvases === 2);
}

// skip opening dialogue (2 steps: type, advance, type, finish)
for (let i = 0; i < 4; i++) { key('KeyE'); key('KeyE', false); frames(2); }

// ---- walk to first plot (plot 0 at 710,1710) and plant
console.log('farming…');
const { plantCrop, waterCrop, harvestCrop } = await import('../js/systems/farming.js');
const { craftFuel } = await import('../js/systems/crafting.js');
const { tryRestore } = await import('../js/systems/restoration.js');

plantCrop(g, 0, 'glowberry');
plantCrop(g, 1, 'glowberry');
check('planted two glowberries', g.plots[0].crop === 'glowberry' && g.plots[1].crop === 'glowberry');
check('plant flag set', g.flags.planted === true);
waterCrop(g, 0);
waterCrop(g, 1);
frames(1200); // ~20s
check('crops ready', g.plots[0].progress >= 1 && g.plots[1].progress >= 1);
const h1 = harvestCrop(g, 0);
const h2 = harvestCrop(g, 1);
check('harvested produce', g.inv.produce.glowberry >= 4);
check('earned glowdust', g.glowdust > 0);
check('harvest flag set', g.flags.harvested === true);
check('glowberry discovered', g.journal.plants.includes('glowberry'));
frames(5);

// ---- craft first fuel
console.log('crafting…');
// ensure enough berries (glowberry harvests yield 2 each)
while (g.inv.produce.glowberry < 3) {
  plantCrop(g, 0, 'glowberry');
  waterCrop(g, 0);
  frames(1200);
  harvestCrop(g, 0);
}
check('craft moonspore', craftFuel(g, 'moonspore') === true);
check('fuel in inventory', g.inv.fuel.moonspore >= 1);
check('first fuel flag', g.flags.firstFuel === true);
frames(5);

// ---- enter forest + flower puzzle (walk isn't needed; teleport)
console.log('twilight…');
g.fuel = 'moonspore';
g.px = 1798; g.py = 836; // flower 0 (moonspore)
frames(10);
g.fuel = 'sunpetal';
g.inv.fuel.sunpetal = 1;
g.px = 1862; g.py = 872;
frames(10);
g.fuel = 'dreamcap';
g.inv.fuel.dreamcap = 1;
g.px = 1826; g.py = 916;
frames(10);
check('flower puzzle solved', g.puzzles.flowersDone === true);
check('level 3 twilight walker', g.level >= 3);
check('minimap state exists', g.minimap && g.minimap.cells.length === 30 * 27);
check('lantern purifies minimap cells', g.minimap.cells.some((c) => c === 1));

// ---- bridge puzzle
console.log('bridge…');
g.fuel = 'moonspore';
g.px = 2150; g.py = 950;
frames(10);
check('bridge revealed', g.puzzles.bridgeRevealed === true);

// ---- stone circle
console.log('stones…');
// order: sunpetal (gold) -> moonspore (blue) -> dreamcap (violet)
const STONE_POS = [ { x: 2358, y: 656, fuel: 'sunpetal' }, { x: 2450, y: 492, fuel: 'moonspore' }, { x: 2542, y: 656, fuel: 'dreamcap' } ];
for (const s of STONE_POS) {
  g.fuel = s.fuel;
  g.px = s.x; g.py = s.y;
  frames(8);
}
check('stone circle solved', g.puzzles.stonesDone === true);
check('deep twilight flagged', g.flags.deepPath === true);
check('level 5 grovekeeper', g.level >= 5);

// ---- restore workshop + seedkeeper + teahouse
console.log('restoration…');
g.glowdust = 300;
check('restore seedkeeper', tryRestore(g, 'seedkeeper') === true);
check('restore workshop', tryRestore(g, 'workshop') === true);
check('restore teahouse', tryRestore(g, 'teahouse') === true);
frames(5);

// ---- moonflower via interaction layer
console.log('moonflower…');
const { currentInteraction, performInteraction } = await import('../js/systems/interactions.js');
const fakeUi = { toast() {}, banner() {}, markDirty() {}, openMenu() {}, openPlant() {}, showDialogue() {} };
g.px = 2803; g.py = 404; // moonflower plot center
frames(5);
const target = currentInteraction(g);
check('moonflower interaction found', target && target.act === 'moonflower');
performInteraction(g, fakeUi, target);
check('moonflower discovered', g.flags.moonflower === true);
check('moonflower seed gained', (g.inv.seeds.moonflower || 0) >= 1);
frames(5);

// ---- ending should trigger after a short delay
console.log('ending…');
frames(400); // ~6.6s
check('ending triggered', dbg.mode === 'ending');
check('save exists', !!globalThis.localStorage.getItem('axie-sprout-lantern.save.v1'));
frames(400);

// ---- save/restore roundtrip
console.log('save/restore…');
const { Save } = await import('../js/core/save.js');
const loaded = Save.load();
check('save has state', loaded && loaded.axieId === 'demo-axie-001');
const { hydrateGame } = await import('../js/game/state.js');
const g2 = hydrateGame(loaded, { id: 'demo-axie-001', name: 'Fern', cls: 'plant', colors: {} });
check('hydrate restores flags', g2.flags.moonflower === true && g2.puzzles.stonesDone === true);
check('hydrate restores inventory', g2.inv.fuel.moonspore >= 1);
check('minimap persisted in save', loaded.minimap && loaded.minimap.cells.length === 30 * 27 && loaded.minimap.cells.some((c) => c === 1));

// ---- menus: exercise the DOM modal code paths
console.log('menus…');
const menus = await import('../js/ui/menus.js');
const modalBody = () => globalThis.document.getElementById('modal').querySelector('.modal-body');

menus.openJournal(g);
check('journal modal opens', menus.isModalOpen());
menus.closeModal();

menus.openShop(g, fakeUi);
check('shop modal opens', menus.isModalOpen());
{
  // NOTE: the stub does not materialize innerHTML child nodes, so each
  // row's only real child is its appended <button>.
  const rows = modalBody().children[0].children; // craft-list rows
  const before = g.glowdust;
  const capBefore = g.inv.seeds.mooncap || 0;
  rows[1].children[0].dispatch('click'); // buy mooncap (10)
  check('shop buy works', (g.inv.seeds.mooncap || 0) === capBefore + 1 && g.glowdust === before - 10);
  menus.closeModal();
}

let planted = null;
menus.openPlantPicker(g, 2, (i, seed) => { planted = { i, seed }; });
{
  const rows = modalBody().children[0].children;
  rows[0].children[0].dispatch('click'); // plant first owned seed
  check('plant picker works', planted && planted.i === 2);
  menus.closeModal();
}

g.inv.treats.bun = 1;
menus.openWorkbench(g, fakeUi);
{
  const lists = modalBody().children;
  const feedList = lists[lists.length - 1]; // last section = feed
  feedList.children[0].children[0].dispatch('click'); // feed bun
  check('feed treat works', g.inv.treats.bun === 0 && g.axieHappyT > 0);
  menus.closeModal();
}

menus.openBoard(g, fakeUi);
check('board modal lists 3 projects', modalBody().children[0].children.length === 3);
menus.closeModal();

menus.openLantern(g, fakeUi);
check('lantern modal has picker + recipes', modalBody().children.length >= 2);
menus.closeModal();

menus.openInventory(g, null);
check('inventory modal opens', menus.isModalOpen());
menus.closeModal();

menus.openPause(g, fakeUi);
check('pause modal opens', menus.isModalOpen());
menus.closeModal();
frames(5);

// ---- continue flow (title -> Continue with an existing save)
console.log('continue…');
globalThis.document.getElementById('screen-title').querySelector('[data-act="continue"]').dispatch('click');
frames(5);
check('continue restores the run', dbg.mode === 'play' && dbg.game.flags.moonflower === true && dbg.game.puzzles.stonesDone === true);
frames(5);

// ---- long idle: make sure nothing explodes over a "session"
frames(2000);
check('survives 2000 idle frames', true);

console.log(`\n${passed} checks passed${process.exitCode ? ' (with failures)' : ' — all good'}`);
