<h1 align="center">Tales of Veridia</h1>

<p align="center">
  A creature-collecting RPG that runs in your browser, rendered in 3D.<br />
  Explore Veridia, catch and train 40 creatures, and take on eight gyms and the League.
</p>

<p align="center">
  <a href="#running-it">Run it</a>
  ·
  <a href="#controls">Controls</a>
  ·
  <a href="#architecture">Architecture</a>
</p>

Tales of Veridia is a full RPG in one browser tab. You pick a starter in Embervale, travel through nine towns and the routes between them, earn eight gym badges, stop Team Eclipse, and climb Victory Road to the League. You walk the world with analog movement and an orbit camera, and the battles run on a turn engine with the depth you expect from the genre.

Nothing runs on a server. The game is a static bundle built with Vite, rendered with Three.js, and scored with Web Audio. Your save lives in `localStorage` on the machine you played on. You need Node.js and npm to build it. No accounts or API keys are involved.

## What you get

- **Walk the region in 3D.** Movement is analog, with circle-against-tile collision and axis sliding, so you slide along walls and vault ledges. Warps, triggers, and repel checks run each time you step onto a new tile.
- **Battles with real depth.** Physical and special moves, STAB, natures, and IVs and EVs capped at 252 per stat and 510 in total. Critical hits land at 1 in 24, or 1 in 8 for high-crit moves. Stat stages, priority, status and volatile conditions, abilities, held items, multi-hit moves, and two-turn moves all resolve in the engine.
- **Eight types, one chart.** Inferno, Aqua, Verdant, Volt, Terra, Gale, Umbra, and Lumina. Dual-typed creatures multiply both matchups. Umbra and Lumina deal double damage to each other, and some pairs deal none at all.
- **Forty creatures in 18 evolution lines.** Each species has base stats, an ability, a learnset, and a Compendium entry. Creatures evolve by level or with one of three stones, so you never need a trade. Each new creature has a 1 in 512 chance to be shiny.
- **Catch math with four balls.** Basic, Great, and Ultra Balls multiply the catch value by 1, 1.5, and 2. Sleep and freeze double it, and poison, burn, and paralysis multiply it by 1.5. The Master Ball always catches. Each throw runs four shake checks, and all four must pass.
- **Three save slots and an autosave.** Pick Save from the menu to write one of three slots. Healing centers heal your party and autosave. Clearing browser data erases every save.
- **Art and music from code.** Each map tile is extruded into 3D geometry at runtime, creature and character sprites are painted on canvases, and each track is synthesized from a seeded chord progression. Optional files in `public/assets` replace the generated sprites and cries.

## Running it

Install the dependencies once, then start the dev server.

### Development server

```sh
npm install
npm run dev
```

Open the local URL that Vite prints. Choosing New Game or Continue enters fullscreen. Add `?windowed=1` to the URL to stay windowed.

### Production build

```sh
npm run build
npm run preview
```

`npm run build` type-checks with `tsc --noEmit`, then writes a static bundle to `dist/`. The Vite `base` is relative, so you can host `dist/` on any static file host. `npm run preview` serves that bundle locally.

### Tests

```sh
npm test
```

Vitest runs every suite under `tests/`, covering battles, capture, creatures, saves, the type chart, and layout. `tests/world.test.ts` checks every map for ragged grids, warps to nowhere, NPCs on solid tiles, and references to unknown species, trainers, items, or scripts.

### Browser smoke test

```sh
npm run dev -- --port 5180
npm run smoke
```

Run these in two terminals. The smoke test drives the game in headless Google Chrome, since the script uses Playwright's `chrome` channel. It starts a new game, takes a starter from Professor Alder, fights the rival on Route 1, opens the pause menu, and catches a wild creature. Set `GAME_URL` if the dev server runs on another port.

## Controls

| Action | Input |
|---|---|
| Move | `WASD` or arrow keys |
| Run | Hold `Shift` |
| Orbit camera | Drag with the mouse, or click the world to lock the mouse and move it |
| Zoom | Mouse wheel |
| Confirm or interact | `Z`, `E`, `Space`, or left click while the mouse is locked |
| Cancel or back | `X`, `Esc`, or `Backspace` |
| Pause menu | `Enter` or `Esc` while walking |
| Fullscreen | `F` |

## Art and asset overrides

The game runs with no image or audio files. Sprites and tiles are drawn in `src/render/spriteGen.ts`, and music and sound effects are synthesized in `src/audio/audio.ts`. When a PNG exists at one of the keys below, the loader swaps it in after startup. Missing files are skipped, so a partial set works.

```
public/assets/sprites/
  creature/<speciesId>/front.png          # 96×96 battle sprite, transparent background
  creature/<speciesId>/back.png
  creature/<speciesId>/front/shiny.png
  creature/<speciesId>/back/shiny.png
  tile/<tileName>.png                     # 32×32, names from TILE_DRAWERS in src/render/spriteGen.ts
  char/<charKey>/<dir>/<frame>.png        # 32×32, dir is down, up, left, or right; frame is 0, 1, or 2
```

Species ids live in `src/data/species.ts`, for example `emberling` and `umbralis`. Character keys live in `CHAR_KEYS` in `src/render/spriteGen.ts`. Tile art also retextures the 3D ground and walls.

Creature cries load from `public/assets/cries/<speciesId>.ogg`. A missing cry file stays silent.

The repo already tracks the sprites and cries that `scripts/fetch-assets.mjs` downloads from PokeAPI. The script skips files that already exist, so running it only fills gaps.

## Architecture

Game rules live in `src/engine` and `src/data`. Nothing in `src/engine` imports the renderer.

- `battle.ts` is a turn state machine that emits an event log.
- `creature.ts` covers stats, experience, and evolution. `capture.ts` holds the catch math.
- `save.ts` defines the versioned save format. Its loader merges a save onto a fresh state, so unknown fields do not break it.
- `src/data` holds every balance table: species, moves, items, trainers, and maps.

The presentation layer is `src/render3d` and `src/game`. `src/main.ts` owns one WebGL renderer and one animation loop, and it switches between the overworld, battles, and DOM-only screens. `src/game/battle.ts` replays the engine's events as camera cuts, move effects, and screen shake. `src/ui/dom.ts` draws menus as HTML over a 480×320 layout that scales to the window.

Battle logic draws its random numbers from an RNG passed in from `src/core/rng.ts`, so a seed replays the same battle. Cosmetic effects in `src/game/moveFx.ts` call `Math.random`.

## License

MIT. See [LICENSE](LICENSE).
