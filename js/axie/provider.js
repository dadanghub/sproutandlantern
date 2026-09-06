// ---------------------------------------------------------------------------
// AXIE ECOSYSTEM ARCHITECTURE — provider seam.
//
// The game only ever asks the provider for Axie identity data. Today it is a
// local demo provider backed by mock data. A future `AxieCoreProvider`
// (wallet + Axie Core) can implement the same interface and drop in without
// touching gameplay code:
//
//   export class AxieCoreProvider extends AxieProvider {
//     async listAxies() { ... fetch the player's collection ... }
//     getAxie(id) { ... map real parts/class onto AxieIdentity shape ... }
//   }
//
// NOTE: no real blockchain data is used anywhere in this prototype, and the
// UI never claims otherwise.
// ---------------------------------------------------------------------------

import { DEMO_AXIES } from './axies.js';

export class AxieProvider {
  async listAxies() {
    throw new Error('not implemented');
  }
  getAxie(id) {
    throw new Error('not implemented');
  }
}

export class LocalDemoProvider extends AxieProvider {
  async listAxies() {
    return DEMO_AXIES;
  }
  getAxie(id) {
    return DEMO_AXIES.find((a) => a.id === id) || null;
  }
}

export const axieProvider = new LocalDemoProvider();
