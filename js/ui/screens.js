// Full-screen states: Title, Intro, Axie Selection, Ending.
// The live game canvas renders behind them (idle grove on the title).

import { paintPortrait } from '../axie/sprites.js';
import { TRAITS } from '../axie/axies.js';

let screens = {};
let introStep = 0;
let selected = null;

const INTRO_STEPS = [
  'Long after the last lantern went dark…',
  'The Grove was forgotten — and the twilight crept in, corroding the forest.',
  'Until one little Axie arrived, lantern in paw, SLP spores glowing in the glass.',
];

export function buildScreens(root, handlers) {
  // ------------------------------------------------------------- title
  const title = el('div', 'screen title-screen');
  title.id = 'screen-title';
  title.innerHTML = `
    <div class="title-wrap">
      <div class="title-kicker">An Axie Infinity Vibeathon prototype</div>
      <h1 class="title-logo">AXIE</h1>
      <h2 class="title-name">Sprout &amp; Lantern</h2>
      <p class="title-tag">Be the Grovekeeper.<br/>
      Grow luminous plants by day, carry your bioluminescent SLP lantern into the twilight,<br/>
      and purify the corrupted forest.</p>
      <div class="title-buttons">
        <button class="btn primary big clickable" data-act="demo">▶ &nbsp;Play Demo</button>
        <button class="btn big clickable hidden" data-act="continue">Continue</button>
        <button class="btn ghost clickable" data-act="connect">Connect Axie — Coming Soon</button>
      </div>
      <div class="title-keys">
        <span><b>WASD</b> move</span><span><b>E</b> interact</span><span><b>1·2·3</b> lantern</span>
        <span><b>I</b> satchel</span><span><b>J</b> journal</span><span><b>Esc</b> pause</span>
      </div>
      <div class="title-foot">Demo Axies included · no wallet required · progress saves in this browser</div>
    </div>`;
  title.querySelector('[data-act="demo"]').addEventListener('click', () => {
    handlers.onPlayDemo();
  });
  title.querySelector('[data-act="continue"]').addEventListener('click', () => {
    handlers.onContinue();
  });
  title.querySelector('[data-act="connect"]').addEventListener('click', () => {
    handlers.onConnect();
  });
  root.append(title);
  screens.title = title;

  // ------------------------------------------------------------- intro
  const intro = el('div', 'screen intro-screen');
  intro.id = 'screen-intro';
  intro.innerHTML = `<div class="intro-card clickable"><div class="intro-text"></div><div class="intro-hint">click or press E</div></div>`;
  intro.addEventListener('click', () => handlers.onIntroAdvance());
  root.append(intro);
  screens.intro = intro;

  // ------------------------------------------------------------ select
  const sel = el('div', 'screen select-screen');
  sel.id = 'screen-select';
  sel.innerHTML = `
    <div class="select-wrap">
      <h2 class="select-title">Choose your Axie</h2>
      <p class="select-sub">You ARE the Grovekeeper. Each Axie shapes the Grove a little differently.</p>
      <div class="select-cards"></div>
      <button class="btn primary big clickable select-begin" disabled>Begin the Adventure</button>
    </div>`;
  const cards = sel.querySelector('.select-cards');
  (handlers.axies || []).forEach((def, i) => {
    const card = el('div', 'axie-card clickable');
    const port = document.createElement('canvas');
    port.width = 120;
    port.height = 120;
    paintPortrait(port, def);
    const trait = TRAITS[def.cls];
    const body = el('div', 'axie-card-body');
    body.innerHTML = `
      <div class="axie-card-name">${def.name}</div>
      <div class="axie-class chip" style="--chip:${def.colors.body}">${trait.name}</div>
      <div class="axie-ability"><b>${trait.ability}</b> — ${trait.desc}</div>
      <div class="axie-blurb">${def.blurb}</div>`;
    card.append(port, body);
    card.addEventListener('click', () => {
      selected = def;
      [...cards.children].forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      sel.querySelector('.select-begin').disabled = false;
    });
    cards.append(card);
  });
  sel.querySelector('.select-begin').addEventListener('click', () => {
    if (selected) handlers.onSelectAxie(selected);
  });
  root.append(sel);
  screens.select = sel;

  // ------------------------------------------------------------ ending
  const end = el('div', 'screen ending-screen');
  end.id = 'screen-ending';
  end.innerHTML = `
    <div class="ending-card">
      <div class="ending-kicker">The Grove Remembers</div>
      <p class="ending-line">“You’ve only uncovered the edge of the Twilight.”</p>
      <p class="ending-line">“More paths are waiting.”</p>
      <div class="ending-rule"></div>
      <h2 class="ending-logo">AXIE: SPROUT &amp; LANTERN</h2>
      <p class="ending-sub">A peaceful adventure, lantern by lantern.</p>
      <div class="ending-buttons">
        <button class="btn primary clickable" data-act="again">Play Again</button>
        <button class="btn clickable" data-act="explore">Keep Exploring</button>
        <button class="btn ghost clickable" data-act="connect">Connect Axie — Coming Soon</button>
      </div>
    </div>`;
  end.querySelector('[data-act="again"]').addEventListener('click', () => handlers.onPlayAgain());
  end.querySelector('[data-act="explore"]').addEventListener('click', () => handlers.onKeepExploring());
  end.querySelector('[data-act="connect"]').addEventListener('click', () => handlers.onConnect());
  root.append(end);
  screens.ending = end;
}

export function showScreen(name) {
  for (const k in screens) screens[k].classList.remove('show');
  if (name && screens[name]) screens[name].classList.add('show');
}

export function setIntroStep(step) {
  introStep = step;
  const txt = screens.intro.querySelector('.intro-text');
  if (step < INTRO_STEPS.length) {
    txt.textContent = INTRO_STEPS[step];
    txt.classList.remove('cta');
    screens.intro.querySelector('.intro-hint').textContent = 'click or press E';
  } else {
    txt.textContent = 'BECOME THE GROVEKEEPER';
    txt.classList.add('cta');
    screens.intro.querySelector('.intro-hint').textContent = 'click or press E';
  }
}

export function introHasCta() {
  return introStep >= INTRO_STEPS.length;
}

export function hasContinueSave() {
  const btn = screens.title && screens.title.querySelector('[data-act="continue"]');
  if (!btn) return;
  btn.classList.toggle('hidden', !localStorage.getItem('axie-sprout-lantern.save.v1'));
}

function el(tag, cls) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
}
