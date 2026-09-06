// Plant registry: 8 luminous crops. Each has growth time, a water boost,
// a harvest yield and — for a few — a lantern-light connection.

export const PLANTS = {
  glowberry: {
    id: 'glowberry', name: 'Glowberry', time: 14,
    dust: [4, 7], color: '#9fe8ff', seedCost: 0,
    blurb: 'A quick, kind little light.',
  },
  mooncap: {
    id: 'mooncap', name: 'Mooncap', time: 20,
    dust: [5, 8], color: '#cfd8ff', seedCost: 10,
    blurb: 'A cap that remembers rain.',
  },
  starroot: {
    id: 'starroot', name: 'Starroot', time: 24,
    dust: [7, 10], color: '#ffe9a8', seedCost: 12,
    blurb: 'Grows quietly toward the night sky.',
  },
  whisperfern: {
    id: 'whisperfern', name: 'Whisper Fern', time: 22,
    dust: [6, 9], color: '#9fe8b0', seedCost: 14,
    blurb: 'It murmurs softly when you water it.',
  },
  sunbud: {
    id: 'sunbud', name: 'Sunbud', time: 18,
    dust: [6, 9], color: '#ffd166', seedCost: 15,
    blurb: 'Quickens when golden light falls on it.',
  },
  lunapear: {
    id: 'lunapear', name: 'Lunapear', time: 34,
    dust: [10, 14], color: '#d9c2ff', seedCost: 18,
    blurb: 'A slow, sweet, heavy fruit.',
  },
  dreamleaf: {
    id: 'dreamleaf', name: 'Dreamleaf', time: 26,
    dust: [8, 12], color: '#c79bff', seedCost: 20,
    needLight: 'dreamcap',
    blurb: 'Its true face only shows in violet light.',
  },
  moonflower: {
    id: 'moonflower', name: 'Moonflower', time: 40,
    dust: [15, 20], color: '#ffffff', seedCost: null, rare: true,
    needLight: 'moonspore',
    blurb: 'Only blooms beneath a moonlit lantern.',
  },
};

export const SHOP_SEEDS = ['glowberry', 'mooncap', 'starroot', 'whisperfern', 'sunbud', 'lunapear'];
export const HUT_SEEDS = ['dreamleaf'];
