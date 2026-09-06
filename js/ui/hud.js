// Minimal cozy HUD: Axie identity (top-left), Glowdust (top-right),
// lantern fuel slots (bottom-right), interaction prompt, quest hint, phase.

import { paintPortrait } from '../axie/sprites.js';
import { FUELS, FUEL_ORDER } from '../systems/lantern.js';
import { BOND_LEVELS } from '../axie/bond.js';
import { LEVELS, questHint } from '../systems/progression.js';

const cache = {};

export function buildHud(root, game) {
  const hud = el('div', 'hud');
  hud.id = 'hud';

  // top-left: Axie identity
  const tl = el('div', 'hud-topleft');
  const portrait = document.createElement('canvas');
  portrait.width = 52;
  portrait.height = 52;
  portrait.className = 'hud-portrait';
  const name = el('div', 'hud-name', game.axieName);
  const cls = el('div', 'hud-class', traitLabel(game.axieCls));
  const bond = el('div', 'hud-bond');
  tl.append(portrait, el('div', 'hud-tl-text', [name, cls, bond]));
  hud.append(tl);

  // top-right: glowdust + level + journal chip
  const tr = el('div', 'hud-topright');
  const dust = el('div', 'hud-dust');
  const level = el('div', 'hud-level');
  const journal = el('button', 'hud-journal clickable');
  journal.innerHTML = '📖 Grove Journal <span class="key">J</span>';
  journal.addEventListener('click', () => journalOnClick && journalOnClick());
  tr.append(dust, level, journal);
  hud.append(tr);

  // top-center: phase
  const phase = el('div', 'hud-phase');
  hud.append(phase);

  // bottom-right: fuel slots
  const fuelWrap = el('div', 'hud-fuel');
  FUEL_ORDER.forEach((id, i) => {
    const f = FUELS[id];
    const slot = el('div', 'fuel-slot');
    slot.style.setProperty('--fuel', f.color);
    slot.innerHTML = `
      <span class="fuel-glow"></span>
      <span class="fuel-icon" style="background:${f.color}"></span>
      <span class="fuel-count">0</span>
      <span class="fuel-key">${i + 1}</span>
    `;
    slot.addEventListener('click', () => onFuelSlot && onFuelSlot(id));
    fuelWrap.append(slot);
  });
  hud.append(fuelWrap);

  // bottom-center: prompt
  const prompt = el('div', 'hud-prompt');
  hud.append(prompt);

  // bottom-left: quest hint
  const hint = el('div', 'hud-hint');
  hud.append(hint);

  root.append(hud);

  cache.hud = hud;
  cache.portrait = portrait;
  cache.name = name;
  cache.cls = cls;
  cache.bond = bond;
  cache.dust = dust;
  cache.level = level;
  cache.phase = phase;
  cache.prompt = prompt;
  cache.hint = hint;
  cache.fuelSlots = [...fuelWrap.children];

  paintPortrait(portrait, axieDef(game));
  return hud;
}

let journalOnClick = null;
let onFuelSlot = null;
export function setHudHandlers(handlers) {
  journalOnClick = handlers.journal;
  onFuelSlot = handlers.fuelSlot;
}

function traitLabel(cls) {
  const names = { plant: 'Plant', aquatic: 'Aquatic', bird: 'Bird', beast: 'Beast', bug: 'Bug', reptile: 'Reptile' };
  return names[cls] || cls;
}

function axieDef(game) {
  return { id: game.axieId, name: game.axieName, cls: game.axieCls, colors: {
    plant: { body: '#8fd6a4', accent: '#3f8f63', glow: '#d7f5df' },
    aquatic: { body: '#7fd0e8', accent: '#3f7fa8', glow: '#cdeeff' },
    bird: { body: '#f2c98a', accent: '#b07a3f', glow: '#ffedc9' },
  }[game.axieCls] || { body: '#8fd6a4', accent: '#3f8f63', glow: '#d7f5df' } };
}

export function refreshPortrait(game) {
  if (cache.portrait) paintPortrait(cache.portrait, axieDef(game));
}

export function setPrompt(label, enabled = true) {
  if (!cache.prompt) return;
  if (!label) {
    cache.prompt.classList.remove('show');
    return;
  }
  cache.prompt.innerHTML = `<span class="key">E</span> ${label}`;
  cache.prompt.classList.toggle('disabled', !enabled);
  cache.prompt.classList.add('show');
}

export function updateHud(game) {
  if (!cache.dust) return;
  cache.dust.innerHTML = `<span class="dust-icon">✦</span> ${game.glowdust}`;

  const lv = game.level >= 1 ? LEVELS[game.level - 1] : null;
  cache.level.innerHTML = lv ? `Grovekeeper ${game.level} · ${lv.name}` : 'Grovekeeper';
  cache.level.title = lv ? lv.desc : '';

  // bond hearts
  const hearts = [];
  for (let i = 1; i <= 5; i++) hearts.push(i <= game.bondLevel ? '♥' : '♡');
  cache.bond.textContent = hearts.join(' ');
  cache.bond.title = `${BOND_LEVELS[game.bondLevel - 1].name} — ${BOND_LEVELS[game.bondLevel - 1].perk}`;

  // phase chip
  if (game.phaseT > 0.45) {
    cache.phase.textContent = `🌙 Twilight · Layer ${Math.max(1, game.deepest)}`;
    cache.phase.className = 'hud-phase night';
  } else if (game.phaseT > 0.1) {
    cache.phase.textContent = '🌗 The border of the Twilight';
    cache.phase.className = 'hud-phase dusk';
  } else {
    cache.phase.textContent = '☀ The Grove';
    cache.phase.className = 'hud-phase day';
  }

  // fuel slots
  FUEL_ORDER.forEach((id, i) => {
    const slot = cache.fuelSlots[i];
    const count = game.inv.fuel[id];
    slot.querySelector('.fuel-count').textContent = count;
    slot.classList.toggle('active', game.fuel === id);
    slot.classList.toggle('empty', count <= 0);
  });

  cache.hint.textContent = questHint(game);
  cache.hint.classList.toggle('show', !!questHint(game));
}

function el(tag, cls, children) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (children) {
    if (typeof children === 'string') n.textContent = children;
    else children.forEach((c) => n.append(c));
  }
  return n;
}
