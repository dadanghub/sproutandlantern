// All in-game menus as cozy modal panels:
//   Grove Journal (J) · Inventory (I) · Lantern (craft fuel) · Workbench
//   (treats) · Restoration board · Seed shop · Plant picker · Pause · Connect

import { PLANTS, SHOP_SEEDS, HUT_SEEDS } from '../systems/plants.js';
import { SEED_NAMES } from '../systems/inventory.js';
import { FUELS, FUEL_ORDER } from '../systems/lantern.js';
import { visibleFuelRecipes, craftFuel, visibleTreatRecipes, craftTreat, feedTreat } from '../systems/crafting.js';
import { tryRestore } from '../systems/restoration.js';
import { RESTORE_PROJECTS, ZONES } from '../world/map.js';
import { LEVELS } from '../systems/progression.js';
import { BOND_LEVELS, addBondXp } from '../axie/bond.js';
import { paintPortrait } from '../axie/sprites.js';
import { audio } from '../core/audio.js';

let modal = null;
let closeCb = null;
let currentTitle = '';

export function buildMenus(root) {
  modal = el('div', 'modal');
  modal.id = 'modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-card">
      <div class="modal-head">
        <h2 class="modal-title"></h2>
        <button class="modal-close clickable" aria-label="Close">✕</button>
      </div>
      <div class="modal-body"></div>
    </div>
  `;
  root.append(modal);
  modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);
  modal.querySelector('.modal-close').addEventListener('click', closeModal);
}

export function isModalOpen() {
  return modal && modal.classList.contains('show');
}

export function openModal(title, buildBody) {
  if (!modal) return;
  currentTitle = title;
  modal.querySelector('.modal-title').textContent = title;
  const body = modal.querySelector('.modal-body');
  body.innerHTML = '';
  buildBody(body);
  modal.classList.add('show');
  audio.sfx('click');
}

export function closeModal() {
  if (!modal || !modal.classList.contains('show')) return;
  modal.classList.remove('show');
  audio.sfx('click');
}

export function modalOpen() {
  return isModalOpen();
}

// --------------------------------------------------------------- journal --
export function openJournal(game) {
  const portraitDef = portraitFor(game);
  openModal('Grove Journal', (body) => {
    const port = document.createElement('canvas');
    port.width = 72;
    port.height = 72;
    port.className = 'journal-portrait';
    paintPortrait(port, portraitDef);

    const lv = game.level >= 1 ? LEVELS[game.level - 1] : null;
    const hearts = heartRow(game.bondLevel);

    const hero = el('div', 'journal-hero');
    const heroText = el('div');
    heroText.innerHTML = `
      <div class="journal-name">${game.axieName}</div>
      <div class="journal-class">${className(game.axieCls)} Grovekeeper</div>
      <div class="journal-bond" title="${BOND_LEVELS[game.bondLevel - 1].perk}">Harmony ${hearts}</div>`;
    hero.append(port, heroText);
    body.append(hero);

    const grid = el('div', 'journal-grid');
    grid.innerHTML =
      stat('Grovekeeper Level', lv ? `${game.level} — ${lv.name}` : '—') +
      stat('Plants Discovered', `${game.journal.plants.length} / ${Object.keys(PLANTS).length}`) +
      stat('Seeds Discovered', `${game.journal.seeds.length} / ${Object.keys(SEED_NAMES).length}`) +
      stat('Spirits Befriended', `${game.journal.spirits.length} / 3`) +
      stat('Lantern Fuels', `${game.journal.fuels.length} / 3`) +
      stat('Structures Restored', `${[game.restored.seedkeeper, game.restored.workshop, game.restored.teahouse].filter(Boolean).length} / 3`) +
      stat('Areas Explored', `${countAreas(game)} / ${ZONES.length}`) +
      stat('Deepest Twilight', game.deepest ? `Layer ${game.deepest}` : 'Not yet');
    body.append(grid);

    const recent = el('div', 'journal-recent');
    recent.innerHTML = '<div class="journal-sub">Recent in the Journal</div>';
    if (game.journal.recent.length === 0) {
      recent.append(el('div', 'journal-empty', 'The journal waits for your first discovery.'));
    } else {
      const ul = el('ul', 'journal-list');
      game.journal.recent.slice(0, 6).forEach((r) => ul.append(el('li', null, r.text)));
      recent.append(ul);
    }
    body.append(recent);
  });
}

function countAreas(game) {
  return Object.keys(game.areas).filter((k) => game.areas[k]).length;
}

function heartRow(level) {
  let s = '';
  for (let i = 1; i <= 5; i++) s += i <= level ? '♥ ' : '♡ ';
  return s.trim();
}

function className(c) {
  return { plant: 'Plant', aquatic: 'Aquatic', bird: 'Bird', beast: 'Beast', bug: 'Bug', reptile: 'Reptile' }[c] || c;
}

function stat(label, value) {
  return `<div class="journal-stat"><span class="js-label">${label}</span><span class="js-value">${value}</span></div>`;
}

function portraitFor(game) {
  const colors = {
    plant: { body: '#8fd6a4', accent: '#3f8f63', glow: '#d7f5df' },
    aquatic: { body: '#7fd0e8', accent: '#3f7fa8', glow: '#cdeeff' },
    bird: { body: '#f2c98a', accent: '#b07a3f', glow: '#ffedc9' },
  };
  return { id: game.axieId, name: game.axieName, cls: game.axieCls, colors: colors[game.axieCls] || colors.plant };
}

// ------------------------------------------------------------ inventory --
export function openInventory(game, onSelectSeed) {
  openModal('Inventory', (body) => {
    const sections = [
      { title: 'Seeds (select to plant)', items: seedRows(game, onSelectSeed), selectable: true },
      { title: 'Harvested', items: produceRows(game) },
      { title: 'Lantern Fuel', items: fuelRows(game) },
      { title: 'Treats', items: treatRows(game) },
    ];
    for (const s of sections) {
      if (!s.items.length) continue;
      const wrap = el('div', 'inv-section');
      wrap.innerHTML = `<div class="inv-sub">${s.title}</div>`;
      const grid = el('div', 'inv-grid');
      s.items.forEach((it) => {
        const d = el('div', 'inv-item' + (it.selected ? ' selected' : ''));
        d.innerHTML = `<span class="inv-dot" style="background:${it.color}"></span>
          <span class="inv-name">${it.name}</span>
          <span class="inv-count">×${it.count}</span>`;
        if (s.selectable && it.count > 0) {
          d.classList.add('clickable');
          d.addEventListener('click', () => it.onClick && it.onClick());
        }
        grid.append(d);
      });
      wrap.append(grid);
      body.append(wrap);
    }
  });
}

function seedRows(game, onSelectSeed) {
  const rows = [];
  for (const id of Object.keys(game.inv.seeds)) {
    const n = game.inv.seeds[id];
    if (n <= 0) continue;
    rows.push({
      id,
      name: SEED_NAMES[id] || id,
      color: PLANTS[id] ? PLANTS[id].color : '#ffd98a',
      count: n,
      selected: game.selectedSeed === id,
      onClick: () => {
        game.selectedSeed = id;
        audio.sfx('click');
        openInventory(game, onSelectSeed); // refresh
      },
    });
  }
  return rows;
}

function produceRows(game) {
  const rows = [];
  for (const id of Object.keys(game.inv.produce)) {
    const n = game.inv.produce[id];
    if (n <= 0) continue;
    rows.push({ name: PLANTS[id] ? PLANTS[id].name : id, color: PLANTS[id] ? PLANTS[id].color : '#ccc', count: n });
  }
  return rows;
}

function fuelRows(game) {
  const rows = [];
  for (const id of FUEL_ORDER) {
    const n = game.inv.fuel[id];
    if (n <= 0) continue;
    rows.push({ name: FUELS[id].name, color: FUELS[id].color, count: n });
  }
  return rows;
}

function treatRows(game) {
  const rows = [];
  if (game.inv.treats.bun > 0) rows.push({ name: 'Honey Bun', color: '#ffd166', count: game.inv.treats.bun });
  if (game.inv.treats.tea > 0) rows.push({ name: 'Moonlight Tea', color: '#c79bff', count: game.inv.treats.tea });
  return rows;
}

// -------------------------------------------------------------- lantern --
export function openLantern(game, ui) {
  openModal('Lantern Station', (body) => {
    // current fuel slots
    const slots = el('div', 'fuel-picker');
    FUEL_ORDER.forEach((id, i) => {
      const f = FUELS[id];
      const n = game.inv.fuel[id];
      const s = el('div', 'fuel-big' + (game.fuel === id ? ' active' : '') + (n <= 0 ? ' empty' : ''));
      s.style.setProperty('--fuel', f.color);
      s.innerHTML = `<span class="fb-key">${i + 1}</span>
        <span class="fb-icon" style="background:${f.color}"></span>
        <span class="fb-name">${f.name}</span>
        <span class="fb-count">${n}</span>`;
      s.classList.add('clickable');
      s.addEventListener('click', () => {
        if (game.inv.fuel[id] > 0) {
          game.fuel = id;
          audio.sfx('craft');
          openLantern(game, ui);
        }
      });
      slots.append(s);
    });
    body.append(slots);
    body.append(el('div', 'craft-note', 'Your lantern runs on SLP — bioluminescent spore-luminescence.'));

    const craft = el('div', 'craft-list');
    craft.innerHTML = '<div class="inv-sub">Craft Fuel</div>';
    for (const r of visibleFuelRecipes(game)) {
      const can = hasAll(game, r.needs);
      const row = el('div', 'craft-row' + (can ? '' : ' locked'));
      row.innerHTML = `
        <div class="craft-info">
          <div class="craft-name"><span class="inv-dot" style="background:${FUELS[r.id].color}"></span>${r.name}</div>
          <div class="craft-needs">${r.needs.map(([id, n]) => `${n}× ${PLANTS[id].name}`).join('  +  ')}</div>
        </div>`;
      const btn = el('button', 'btn small clickable' + (can ? '' : ' disabled'), can ? 'Craft' : 'Need more');
      btn.disabled = !can;
      btn.addEventListener('click', () => {
        if (craftFuel(game, r.id)) {
          audio.sfx('craft');
          ui.toast(`Crafted ${FUELS[r.id].name} fuel`);
          ui.markDirty();
          openLantern(game, ui);
        }
      });
      row.append(btn);
      craft.append(row);
    }
    body.append(craft);

    if (!game.restored.workshop) {
      body.append(el('div', 'craft-note', '🔒 The Lantern Workshop would unlock a rarer fuel (Dreamcap).'));
    }
  });
}

function hasAll(game, needs) {
  return needs.every(([id, n]) => (game.inv.produce[id] || 0) >= n);
}

// ------------------------------------------------------------ workbench --
export function openWorkbench(game, ui) {
  openModal('Workbench', (body) => {
    const list = el('div', 'craft-list');
    list.innerHTML = '<div class="inv-sub">Craft Treats</div>';
    for (const r of visibleTreatRecipes(game)) {
      const can = hasAll(game, r.needs);
      const row = el('div', 'craft-row' + (can ? '' : ' locked'));
      row.innerHTML = `
        <div class="craft-info">
          <div class="craft-name">${r.name}</div>
          <div class="craft-needs">${r.needs.map(([id, n]) => `${n}× ${PLANTS[id].name}`).join('  +  ')} · ${r.desc}</div>
        </div>`;
      const btn = el('button', 'btn small clickable' + (can ? '' : ' disabled'), can ? 'Craft' : 'Need more');
      btn.disabled = !can;
      btn.addEventListener('click', () => {
        if (craftTreat(game, r.id)) {
          audio.sfx('craft');
          ui.toast(`Baked a ${r.name}`);
          ui.markDirty();
          openWorkbench(game, ui);
        }
      });
      row.append(btn);
      list.append(row);
    }

    const feed = el('div', 'craft-list');
    feed.innerHTML = '<div class="inv-sub">Savor a treat</div>';
    const treats = [
      { id: 'bun', name: 'Honey Bun' },
      { id: 'tea', name: 'Moonlight Tea' },
    ];
    let any = false;
    for (const t of treats) {
      const n = game.inv.treats[t.id] || 0;
      if (n <= 0) continue;
      any = true;
      const row = el('div', 'craft-row');
      row.innerHTML = `<div class="craft-info"><div class="craft-name">${t.name}</div><div class="craft-needs">×${n} in the satchel</div></div>`;
      const btn = el('button', 'btn small clickable', 'Savor');
      btn.addEventListener('click', () => {
        const res = feedTreat(game, t.id);
        if (res) {
          game.axieHappyT = 2.5;
          addBondXp(game, 8, 'savored treat');
          audio.sfx('pet');
          ui.toast(`You savour the ${t.name} ♥`);
          ui.markDirty();
          openWorkbench(game, ui);
        }
      });
      row.append(btn);
      feed.append(row);
    }
    if (!any) feed.append(el('div', 'craft-note', 'No treats yet. Craft one above.'));
    body.append(list);
    body.append(feed);
  });
}

// ------------------------------------------------------------ restoration
export function openBoard(game, ui) {
  openModal('Restoration Board', (body) => {
    const list = el('div', 'craft-list');
    for (const p of RESTORE_PROJECTS) {
      const done = game.restored[p.id];
      const can = !done && game.glowdust >= p.cost;
      const row = el('div', 'craft-row' + (done ? ' done' : can ? '' : ' locked'));
      row.innerHTML = `
        <div class="craft-info">
          <div class="craft-name">${p.name}</div>
          <div class="craft-needs">${p.desc}</div>
        </div>`;
      const btn = done
        ? el('span', 'craft-status', 'Restored ✓')
        : el('button', 'btn small clickable' + (can ? '' : ' disabled'), `Restore · ${p.cost}✦`);
      if (!done) {
        btn.disabled = !can;
        btn.addEventListener('click', () => {
          if (tryRestore(game, p.id)) {
            audio.sfx('build');
            ui.toast(`The ${p.name} rises from the rubble.`);
            ui.markDirty();
            openBoard(game, ui);
          }
        });
      }
      row.append(btn);
      list.append(row);
    }
    body.append(list);
    body.append(el('div', 'craft-note', `Glowdust: ✦ ${game.glowdust}`));
  });
}

// ----------------------------------------------------------------- shop --
export function openShop(game, ui) {
  openModal('Seed Shelf', (body) => {
    const list = el('div', 'craft-list');
    list.innerHTML = '<div class="inv-sub">Buy Seeds</div>';
    const ids = [...SHOP_SEEDS];
    if (game.restored.seedkeeper) ids.push(...HUT_SEEDS);
    for (const id of ids) {
      const def = PLANTS[id];
      const can = game.glowdust >= def.seedCost;
      const row = el('div', 'craft-row' + (can ? '' : ' locked'));
      row.innerHTML = `
        <div class="craft-info">
          <div class="craft-name"><span class="inv-dot" style="background:${def.color}"></span>${def.name} Seed</div>
          <div class="craft-needs">${def.blurb}</div>
        </div>`;
      const btn = el('button', 'btn small clickable' + (can ? '' : ' disabled'), `Buy · ${def.seedCost}✦`);
      btn.disabled = !can;
      btn.addEventListener('click', () => {
        if (game.glowdust >= def.seedCost) {
          game.glowdust -= def.seedCost;
          game.inv.seeds[id] = (game.inv.seeds[id] || 0) + 1;
          audio.sfx('click');
          ui.toast(`Bought a ${def.name} Seed`);
          ui.markDirty();
          openShop(game, ui);
        }
      });
      row.append(btn);
      list.append(row);
    }
    body.append(list);
    if (!game.restored.seedkeeper) {
      body.append(el('div', 'craft-note', '🔒 The Seedkeeper Hut would unlock rarer seeds.'));
    }
    body.append(el('div', 'craft-note', `Glowdust: ✦ ${game.glowdust}`));
  });
}

// ----------------------------------------------------------- plant picker
export function openPlantPicker(game, plotIdx, onPlanted) {
  const seeds = Object.keys(game.inv.seeds).filter((id) => game.inv.seeds[id] > 0);
  if (seeds.length === 0) return;
  openModal('Plant a Seed', (body) => {
    const list = el('div', 'craft-list');
    for (const id of seeds) {
      const def = PLANTS[id];
      const row = el('div', 'craft-row' + (game.selectedSeed === id ? ' done' : ''));
      row.innerHTML = `
        <div class="craft-info">
          <div class="craft-name"><span class="inv-dot" style="background:${def.color}"></span>${def.name}</div>
          <div class="craft-needs">×${game.inv.seeds[id]} · ${def.blurb}</div>
        </div>`;
      const btn = el('button', 'btn small clickable', game.selectedSeed === id ? 'Selected' : 'Plant');
      btn.addEventListener('click', () => {
        game.selectedSeed = id;
        onPlanted(plotIdx, id);
        audio.sfx('plant');
        closeModal();
      });
      row.append(btn);
      list.append(row);
    }
    body.append(list);
  });
}

// ---------------------------------------------------------------- pause --
export function openPause(game, ui) {
  openModal('Paused', (body) => {
    const list = el('div', 'pause-list');
    const mk = (label, fn) => {
      const b = el('button', 'btn clickable', label);
      b.addEventListener('click', fn);
      list.append(b);
    };
    mk('Resume', () => closeModal());
    mk('Save (auto-saves anyway)', () => {
      ui.markDirty();
      ui.toast('Grove saved.');
      closeModal();
    });
    mk('Return to Title', () => ui.toTitle());
    body.append(list);
    body.append(el('div', 'craft-note', 'WASD move · E interact · 1/2/3 lantern · I inventory · J journal · M sound · Esc pause'));
  });
}

// -------------------------------------------------------------- connect --
export function openConnect() {
  openModal('Connect Axie — Coming Soon', (body) => {
    body.innerHTML = `
      <p class="connect-text">
        This prototype runs on <b>Demo Axies</b> so it is playable with no
        wallet or account.
      </p>
      <p class="connect-text">
        The game is architected for real Axie Core integration: identity,
        traits, bond, journal and progression events are already separated
        behind clean provider seams. When a connection lands, your actual
        collection replaces the Demo Axies here — no gameplay changes.
      </p>
      <p class="connect-note">We never block play behind wallet setup, and we
      never claim an integration that isn’t live.</p>`;
  });
}

// helpers
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
}
