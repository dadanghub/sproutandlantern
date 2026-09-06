// Bottom dialogue box with a tiny typewriter effect. Used for spirits
// and short narration beats. E / click advances.

const CHAR_MS = 16;

export function buildDialogue(root) {
  const box = el('div', 'dialogue');
  box.id = 'dialogue';
  box.innerHTML = `
    <canvas class="dlg-portrait" width="56" height="56"></canvas>
    <div class="dlg-body">
      <div class="dlg-name"></div>
      <div class="dlg-text"></div>
    </div>
    <div class="dlg-next">▼</div>
  `;
  root.append(box);
  box.addEventListener('click', () => advance());
  state.box = box;
}

const state = {
  steps: null,
  idx: 0,
  char: 0,
  done: false,
  onDone: null,
  box: null,
};

export function dialogueActive() {
  return !!state.steps && !state.done;
}

export function showDialogue(steps, onDone) {
  state.steps = steps;
  state.idx = 0;
  state.onDone = onDone;
  state.done = false;
  showStep();
}

function showStep() {
  const step = state.steps[state.idx];
  if (!step) {
    finish();
    return;
  }
  const box = state.box;
  box.classList.add('show');
  box.querySelector('.dlg-name').textContent = step.who || '';
  const text = box.querySelector('.dlg-text');
  text.textContent = '';
  state.char = 0;
  state.full = step.text;
  paintSpiritPortrait(box.querySelector('.dlg-portrait'), step);
  state.nextVisible = false;
  box.querySelector('.dlg-next').classList.remove('show');
}

export function advance() {
  if (!dialogueActive()) return;
  if (state.char < state.full.length) {
    state.char = state.full.length; // finish typing
    state.box.querySelector('.dlg-text').textContent = state.full;
    state.box.querySelector('.dlg-next').classList.add('show');
    return;
  }
  state.idx++;
  if (state.idx >= state.steps.length) finish();
  else showStep();
}

function finish() {
  state.done = true;
  state.box.classList.remove('show');
  const cb = state.onDone;
  state.steps = null;
  if (cb) cb();
}

/** Typewriter tick — called every frame from the main loop. */
export function tickDialogue() {
  if (!dialogueActive()) return;
  if (state.char < state.full.length) {
    state.char++;
    state.box.querySelector('.dlg-text').textContent = state.full.slice(0, state.char);
    if (state.char >= state.full.length) state.box.querySelector('.dlg-next').classList.add('show');
  }
}

function paintSpiritPortrait(canvas, step) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 56, 56);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.arc(28, 28, 26, 0, Math.PI * 2);
  ctx.fill();
  const who = (step.who || '').toLowerCase();
  if (who === 'mori') {
    ctx.fillStyle = '#f2e3d0';
    ctx.beginPath();
    ctx.ellipse(28, 38, 12, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8846a';
    ctx.beginPath();
    ctx.arc(28, 30, 18, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(22, 24, 3, 0, Math.PI * 2);
    ctx.arc(34, 21, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (who === 'luma') {
    const g = ctx.createRadialGradient(28, 28, 2, 28, 28, 22);
    g.addColorStop(0, 'rgba(255,233,160,0.9)');
    g.addColorStop(1, 'rgba(255,233,160,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(28, 28, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff8e0';
    ctx.beginPath();
    ctx.arc(28, 28, 7, 0, Math.PI * 2);
    ctx.fill();
  } else if (who === 'nix') {
    ctx.fillStyle = '#2a2140';
    ctx.beginPath();
    ctx.arc(28, 32, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(22, 30, 4.5, 0, Math.PI * 2);
    ctx.arc(35, 30, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2140';
    ctx.beginPath();
    ctx.arc(22, 30, 2.2, 0, Math.PI * 2);
    ctx.arc(35, 30, 2.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#ffd98a';
    ctx.font = '22px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(step.who ? step.who[0] : '?', 28, 36);
    ctx.textAlign = 'left';
  }
  // eyes for generic
  if (who === 'mori') {
    ctx.fillStyle = '#2a2438';
    ctx.beginPath();
    ctx.arc(24, 38, 2, 0, Math.PI * 2);
    ctx.arc(32, 38, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function el(tag, cls) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
}
