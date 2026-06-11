# Pokemon — Tales of Veridia (3D)

A complete, classic creature-collecting RPG that runs entirely in the browser —
now rendered as a full 3D world. Explore the open region of Veridia with free
analog movement and an orbiting chase camera, catch and train 40 creatures
across 8 elemental types, defeat eight gyms, dismantle Team Eclipse, and take
on the Elite Four and Champion — with zero asset files required: every sprite
is drawn procedurally, every tile is extruded into 3D geometry in code, and
every note of music is synthesized live via Web Audio.

## Run it

```bash
npm install
npm run dev        # local dev server
npm run build      # static bundle in dist/ — deploy to any static host
npm test           # engine + world integrity test suites (vitest)
npm run smoke      # real-browser E2E (needs the dev server on :5180)
```

Open the printed URL. Press Start enters fullscreen (add `?windowed=1` to
skip). The game saves to `localStorage` (3 manual slots + autosave at healing
centers). **Clearing browser data erases saves.**

## Controls

| Action | Input |
|---|---|
| Move (360°) | WASD / Arrows |
| Run | hold Shift |
| Orbit camera / zoom | mouse drag / wheel |
| Confirm / interact | Z / Space / Enter |
| Cancel / back | X / Esc / Backspace |
| Pause menu | Enter / Esc (while walking) |
| Fullscreen toggle | F |

## The game

- **8 types** — Inferno, Aqua, Verdant, Volt, Terra, Gale, Umbra, Lumina — with
  a full effectiveness chart (Umbra ⇄ Lumina are mutual 2× opposites).
- **40 creatures** in 18 evolution lines (level, stone, and Link Stone
  evolutions — no trading needed), each with stats, ability, learnset, and
  compendium entry. 1/512 shiny chance.
- **Modern battle engine**: physical/special split, STAB, crits (1/24),
  natures, IVs/EVs (252/510 caps), stat stages, accuracy/evasion, priority,
  status + volatile conditions, abilities, held items, multi-hit, two-turn and
  drain/recoil moves, Struggle, and Gen-3 capture math with tiered balls.
- **Open region**: 9 settlements, 12 routes, forest, two cave systems, sea
  routes, Team Eclipse hideout, the Twinlight Spire, and Victory Road. Soft
  level gating plus traversal unlocks: Cutter Charm (badge 1), Wave Charm
  (badge 4), Climbing Gear (badge 6).
- **Full arc**: recurring rival (who picks the counter starter and ends up
  somewhere surprising), a villain team with five set-pieces, a catchable
  legendary, Elite Four, Champion, and Hall of Fame.

## The 3D layer

- **ASCII → 3D compiler** (`src/render3d/world.ts`): every map is still an
  ASCII tile grid; a build pass bakes the floor tiles into one ground texture
  and extrudes walls/trees/roofs/furniture into instanced boxes. Editing a map
  is still editing ASCII art, and the world-integrity tests still bite.
- **Continuous movement over grid logic** (`src/game/overworld.ts`): the
  player moves freely (circle-vs-tile collision, axis sliding, ledge vaults),
  while warps, triggers, encounters, repel and trainer line-of-sight fire on
  tile crossings — identical rates and semantics to the 2D game.
- **Billboard sprites**: NPCs and creatures are upright camera-facing planes
  using the same procedural (or hot-swapped PNG) sprites, with DOOM-style
  4-direction frame selection. The player is a procedurally rigged low-poly
  humanoid with a code-driven walk cycle.
- **Cinematic battles** (`src/game/battle.ts`): a floating biome-themed arena
  (grass/cave/water/gym/dark/indoor), camera cuts behind the attacker on every
  move, particle bursts, screen shake — replaying the same battle-engine
  events the 2D game did.
- **DOM UI** (`src/ui/dom.ts`): dialogs and menus are an HTML overlay in the
  classic 480×320 layout, scaled to the viewport — crisp at any resolution.

## Asset hot-swap contract

The game is fully playable with **no** image files. If you want real art, drop
PNGs into `public/assets/sprites/` using these logical keys — they are loaded
in the background and swapped in automatically, no code changes:

```
public/assets/sprites/
  creature/<speciesId>/front.png   # 96×96, transparent bg
  creature/<speciesId>/back.png    # 96×96, transparent bg
  tile/<tileName>.png              # 32×32 (see TILE_DRAWERS in src/render/spriteGen.ts)
  char/<charKey>/<dir>/<frame>.png # 32×32; dir ∈ down|up|left|right, frame ∈ 0|1|2
```

Species ids are in `src/data/species.ts` (e.g. `emberling`, `umbralis`);
character keys in `src/render/spriteGen.ts` (`CHAR_KEYS`). Missing files are
silently ignored — partial art sets are fine (tiles also retexture the 3D
ground and walls). Audio is always procedural; there are intentionally no
sound files. `node scripts/fetch-assets.mjs` downloads the PokeAPI sprite set.

## Architecture

Pure, engine-independent modules (`src/engine`, `src/data`, all unit-tested,
no renderer imports): `battle.ts` (turn state machine emitting an event log),
`creature.ts` (stats/EXP/evolution), `capture.ts`, `save.ts` (versioned,
forward-safe), `state.ts`, plus the data tables that hold *all* balance.
The Three.js layer (`src/render3d`, `src/game`) is a thin presentation layer
that replays battle-engine events as animations. All randomness flows through
one seedable RNG (`src/core/rng.ts`), so battles are reproducible. World
integrity (map grids, warps, encounter/trainer/script references) is enforced
by `tests/world.test.ts`.
