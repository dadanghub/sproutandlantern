# Axie: Sprout & Lantern

*A cozy farming and twilight exploration Vibeathon prototype.*

**You are the Axie.** Explore the twilight mist of Lunacia, grow luminous plants by
day, and carry your bioluminescent **SLP lantern** into an ever-changing twilight
forest by night. No combat, no game-over: darkness is an environmental puzzle, and
the goal is to **purify the corrupted forest** — bring light and life back to it.

**One-line fantasy:** *You're the Axie, lantern in paw — what if growing yourself
meant growing a world back to life?*

---

## Run it

No build step, no dependencies — plain HTML/CSS/ES-modules + a 2D canvas.

```bash
cd axie-sprout-lantern
python3 serve.py                # or: npm start
# open http://localhost:8000
```

`serve.py` is a static server with **caching disabled**, so a reload always
picks up fresh JS (any other static server works too; ES modules require
http://, not file:// — but if you switch away from serve.py, hard-refresh
after editing code).

### Deploying (GitHub + Vercel)

The game is 100% static — no build step, no dependencies, no backend.

```bash
cd axie-sprout-lantern
git init && git add -A && git commit -m "Axie: Sprout & Lantern — vertical slice"
# create the repo on github.com, then:
git remote add origin https://github.com/<you>/axie-sprout-lantern.git
git push -u origin main
```

Then in [vercel.com](https://vercel.com): **Add New → Project → Import** the repo.
Vercel auto-detects it as a static site (`index.html` at the root) — leave the
preset as **Other**, no build command, no output directory — and hit **Deploy**.
Each `git push` redeploys automatically. Saves live in the browser's
`localStorage`, so they're per-visitor and need no backend.

(GitHub Pages also works if you prefer — just push and enable Pages from the
branch; no config file needed.)

### Headless smoke test

```bash
node test/smoke.mjs          # or: npm test
node test/realdom.mjs        # or: npm run test:realdom (needs: npm install)
```

`smoke.mjs` boots the real game under a strict DOM stub and plays the whole
slice: plant → harvest → craft fuel → all three light puzzles → all three
restorations → Moonflower discovery → the Grovekeeper's lantern ritual at the
edge of the Twilight (cold before the grove is whole, lit once it is) →
ending → save/load round-trip — including the minimap's purification grid,
the audio paths (run on a mocked WebAudio graph, so the music scheduler is
actually executed), and the real input path (fuel keys 1/2/3, Ember Pulse,
rest, Grove Song, spirit dialogue, ending buttons — including that the
opening dialogue actually closes on E), photo mode (P), and tab-visibility
audio suspend/resume.
**83 checks.**

`realdom.mjs` additionally boots the game under a real DOM (happy-dom,
dev-only) and plays the human path with real keyboard events — title → intro
→ select (all three demo Axies) → play → journal open/close (J key and HUD
chip) → **Continue run with a mid-game save → journal again**. This is what
caught the save-hydration journal freeze.

---

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | Move |
| E | Interact (plant, water, harvest, talk, sing, rest…) |
| 1 / 2 / 3 | Switch lantern fuel (Moonspore / Sunpetal / Dreamcap) |
| I | Satchel (inventory) |
| J | Grove Journal |
| P | Photo (saves the current view as a PNG) |
| Esc | Pause |
| M | Sound on/off (ambience + music) |
| L | Ember Pulse (Bond 5) |
| Mouse | All menus |

---

## The loop

🌱 GROW → 💧 CARE →  HARVEST → 🏮 CRAFT LANTERN FUEL → 🌙 EXPLORE AT NIGHT
→ 🔦 SOLVE LIGHT PUZZLES → 🌺 DISCOVER RARE SEEDS → 🏡 RESTORE THE GROVE → repeat.

- **Three fuels, three ways to see:** Moonspore (blue) reveals hidden paths,
  Sunpetal (gold) quickens plant growth, Dreamcap (violet) reveals spirits and
  secrets. Which lantern you bring is a real decision. You start with one
  Sunpetal and one Dreamcap from the old lantern cache — Moonspore is your
  first crafting lesson at the Lantern Station.
- **Three light puzzles:** light the old flowers in order (teaches the fuels),
  reveal the invisible bridge with moonlight, wake the stone circle (gold → blue → violet).
- **Three spirits:** Mori (mushroom, by the stream), Luma (firefly, at the stones),
  Nix (shy shadow, hidden garden — only visible in Dreamcap light).
- **Three restorations:** Seedkeeper Hut (new seeds), Lantern Workshop (Dreamcap
  fuel + bigger light), Tea House (treats). Each visibly rebuilds itself — rubble
  becomes a lit, functional building.
- **Grove Journal + Harmony:** your personal adventure history, plus a
  non-punishing bond-with-the-grove system (water crops, savor treats, discover
  together) that unlocks real perks up to the Ember Pulse lantern ability.
- **Glowdust** is a soft in-game currency only — no tokens, no speculation, no wallet.
- **The Twilight minimap** (top-right of the HUD): the corrupted forest starts
  shrouded in mist, and your lantern literally purifies it — cells your light
  reaches open up, landmarks appear as you reach their areas or meet their
  spirits, and your lantern dot glows in the active fuel color. Progress
  persists in the save.
- **Music & sound:** a short generative music loop (4-bar Am–F–C–G, A/B
  variations, ~23s full pattern) darkens through a lowpass as twilight falls,
  layered over the forest ambience. Each Axie class has its own selection
  motif (sprout, droplet, chirp, thud, buzz, hiss).
- **The ending — the Grovekeeper's lantern:** once the grove is whole (all
  three restorations) and the rare Moonflower is found, the old keeper's
  never-lit lantern at the edge of the Twilight (beyond the stone-circle arch)
  is the one thing left cold. Light it (E) and the grove's story closes — the
  lantern glows for the rest of the run and on the minimap, and the ending
  plays. Before the grove is whole it stays cold and tells you why.

### Demo Axies

| Axie | Class | Ability |
| --- | --- | --- |
| Fern | Plant | Green Thumb — nearby crops grow 50% faster |
| Ripple | Aquatic | Ripple Step — crosses the glowing stream on water |
| Pippin | Bird | Sky Sight — sees beacons over distant points of interest |

The other four classes (Beast/Vinebreaker, Bug/Spore Sense, Reptile/Twilight Skin)
are defined in the trait registry and ready for a collection.

---

## Architecture (the Axie-integration seams)

The game was built so **real Axie Core / AXP integration can be added later
without touching gameplay**. Everything Axie-shaped lives behind small interfaces:

```
js/
  core/
    events.js          ← AXIE_* progression event bus (the future AXP hook)
    save.js            ← localStorage save (selected Axie, crops, journal, bond…)
    audio.js           ← synthesized WebAudio (no assets): ambience,
                         generative music loop, per-class Axie pick motifs, SFX
    input.js  camera.js  particles.js  utils.js
  axie/
    axies.js           ← AxieIdentity + AxieTraits (plain data, provider-swappable)
    provider.js        ← AxieProvider seam: LocalDemoProvider today,
                         AxieCoreProvider (wallet + collection) tomorrow
    bond.js            ← AxieBond: 5 levels, perks, XP sources
    sprites.js         ← procedural Axie art, SLP lantern in paw (swap point for real textures)
  world/
    map.js             ← one source of truth: zones, plots, structures, walkability
    render.js          ← procedural day/twilight renderer, real light radius
  systems/
    farming.js  lantern.js  crafting.js  inventory.js
    spirits.js  puzzles.js  restoration.js  progression.js
    interactions.js      ← the E-key layer (kept DOM-free)
  ui/
    hud.js  menus.js  dialogue.js  toasts.js  screens.js  minimap.js
  game/state.js        ← central state + save hydration
  main.js              ← loop, mode state machine, input routing
```

### Progression events (future AXP mapping)

Every meaningful moment emits a named event (`js/core/events.js`), currently
console-traced and used for autosave. These are the exact seams to map to approved
Axie Core/AXP flows later:

`AXIE_DISCOVERED_PLANT · AXIE_DISCOVERED_SEED · AXIE_DISCOVERED_SPIRIT ·
AXIE_DISCOVERED_FUEL · AXIE_DISCOVERED_OBJECT · AXIE_RESTORED_STRUCTURE ·
AXIE_SOLVED_PUZZLE · AXIE_EXPLORED_TWILIGHT · AXIE_CRAFTED_FUEL ·
AXIE_CRAFTED_TREAT · AXIE_HARVESTED_CROP · AXIE_PLANTED_CROP ·
AXIE_BOND_CHANGED · AXIE_LEVEL_UP · AXIE_SPIRIT_REQUEST · AXIE_SPIRIT_GIFT ·
AXIE_GROVE_SONG · AXIE_COMPLETED_GROVE`

### Wallet policy

**No wallet is required and the game never claims an integration that isn't live.**
The title screen has an optional *Connect Axie — Coming Soon* panel that explains
the plan honestly; the Demo Axies stand in until a real provider is wired to
`axie/provider.js`.

### Save system

`localStorage` (key `axie-sprout-lantern.save.v1`): selected Axie, position,
crops, inventory, fuel, restored structures, puzzle/spirit/area state, bond,
level, journal. Auto-saves on progression events + every 10s + on tab close.
A refresh restores the grove exactly; the title screen offers **Continue**.

---

## Known placeholder corners (honest list)

- Axie art is procedural stand-ins (the swap point for real collection art is
  `axie/sprites.js` + `axie/provider.js`).
- Audio is synthesized WebAudio — the music loop is generative (composed in
  code), so it can be swapped for a real track later without touching gameplay.
- One compact handcrafted map (intentionally small, per "vertical slice").
- The demo is designed to be completable in roughly 10–15 minutes.

## Success criteria this build targets

Within 5 minutes you should have: chosen an Axie · planted something ·
harvested something · crafted lantern fuel · entered the forest · solved a light
puzzle · discovered something rare. By the end you should understand *why this
would be better with your own Axie*: its traits change how the Grove is played,
and its journal is its own personal history.
