// ---------------------------------------------------------------------------
// AXIE ECOSYSTEM ARCHITECTURE — identity & traits.
//
// AxieIdentity : a lightweight descriptor for which Axie the player is
//                grovekeeping with (id, name, class, palette, blurb).
// AxieTraits   : maps each Axie class to one lightweight gameplay modifier.
//
// These are intentionally plain data so a future Axie Core provider can map
// a real collection's body parts / class onto the same shape:
//
//   { id, name, cls, colors: {body, accent, glow}, blurb }
// ---------------------------------------------------------------------------

export const TRAITS = {
  plant: {
    key: 'plant', name: 'Plant',
    ability: 'Green Thumb',
    desc: 'Nearby crops grow 50% faster while Fern is tending beside them.',
  },
  aquatic: {
    key: 'aquatic', name: 'Aquatic',
    ability: 'Ripple Step',
    desc: 'Can cross the glowing stream on water where others need a bridge.',
  },
  bird: {
    key: 'bird', name: 'Bird',
    ability: 'Sky Sight',
    desc: 'Sees faint beacons over distant points of interest in the Twilight.',
  },
  beast: {
    key: 'beast', name: 'Beast',
    ability: 'Vinebreaker',
    desc: 'Can push through dense bramble thickets others cannot enter.',
  },
  bug: {
    key: 'bug', name: 'Bug',
    ability: 'Spore Sense',
    desc: 'Senses hidden luminous plants, marking them with a soft spore ring.',
  },
  reptile: {
    key: 'reptile', name: 'Reptile',
    ability: 'Twilight Skin',
    desc: 'The lantern burns 15% brighter in the dark.',
  },
};

export const DEMO_AXIES = [
  {
    id: 'demo-axie-001',
    name: 'Fern',
    cls: 'plant',
    colors: { body: '#8fd6a4', accent: '#3f8f63', glow: '#d7f5df' },
    blurb: 'A gentle Plant Axie with a leafy sprout. Grows fastest where it tends.',
  },
  {
    id: 'demo-axie-002',
    name: 'Ripple',
    cls: 'aquatic',
    colors: { body: '#7fd0e8', accent: '#3f7fa8', glow: '#cdeeff' },
    blurb: 'A calm Aquatic Axie who hums like running water. The stream is its home.',
  },
  {
    id: 'demo-axie-003',
    name: 'Pippin',
    cls: 'bird',
    colors: { body: '#f2c98a', accent: '#b07a3f', glow: '#ffedc9' },
    blurb: 'A curious Bird Axie with a feathered crest. It can see far across the dark.',
  },
];

export function traitOf(cls) {
  return TRAITS[cls] || TRAITS.plant;
}
