// Local save state. Everything persists in localStorage so a refresh
// restores the player's grove exactly where they left it.

const KEY = 'axie-sprout-lantern.save.v1';

// Only these top-level fields are persisted (keeps saves stable & small).
const FIELDS = [
  'axieId', 'axieName', 'axieCls',
  'px', 'py',
  'phaseT', 'glowdust',
  'plots', 'inv', 'fuel', 'selectedSeed',
  'restored', 'puzzles', 'spirits', 'areas', 'deepest',
  'bondXp', 'bondLevel', 'level',
  'journal', 'flags', 'times',
];

export const Save = {
  has() {
    try {
      return !!localStorage.getItem(KEY);
    } catch {
      return false;
    }
  },

  save(state) {
    try {
      const out = {};
      for (const f of FIELDS) if (f in state) out[f] = state[f];
      localStorage.setItem(KEY, JSON.stringify({ v: 1, at: Date.now(), state: out }));
      return true;
    } catch {
      return false;
    }
  },

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && data.state ? data.state : null;
    } catch {
      return null;
    }
  },

  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};
