// ---------------------------------------------------------------------------
// AXIE ECOSYSTEM ARCHITECTURE — progression event system.
//
// Every meaningful moment in the Grove emits a named progression event here.
// Today the only listener is a console trace (useful while judging the
// architecture), but these events are the exact seams where real Axie Core /
// AXP integration would later subscribe:
//
//   const unsubscribe = onProgressionEvent((evt) => {
//     // map evt.type -> approved Axie Core / AXP flow
//   });
//
// Event types:
//   AXIE_HARVESTED_CROP      AXIE_CRAFTED_FUEL        AXIE_CRAFTED_TREAT
//   AXIE_DISCOVERED_PLANT    AXIE_DISCOVERED_SEED     AXIE_DISCOVERED_SPIRIT
//   AXIE_DISCOVERED_OBJECT   AXIE_RESTORED_STRUCTURE  AXIE_SOLVED_PUZZLE
//   AXIE_EXPLORED_TWILIGHT   AXIE_BOND_CHANGED        AXIE_LEVEL_UP
//   AXIE_COMPLETED_GROVE
// ---------------------------------------------------------------------------

const listeners = new Set();

export function onProgressionEvent(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitProgressionEvent(type, payload = {}) {
  const evt = { type, payload, at: Date.now() };
  try {
    console.debug(`[Axie Progression] ${type}`, payload);
  } catch {
    /* ignore */
  }
  for (const fn of listeners) {
    try {
      fn(evt);
    } catch (err) {
      console.warn('progression listener error', err);
    }
  }
  return evt;
}
