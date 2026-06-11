# Monstra — Tales of Veridia

A complete, classic creature-collecting RPG that runs entirely in the browser.
Explore the open region of Veridia, catch and train 40 original creatures
across 8 elemental types, defeat eight gyms, dismantle Team Eclipse, and take
on the Elite Four and Champion — with zero asset files required: every sprite
is drawn procedurally and every note of music is synthesized live via Web Audio.

## Run it

```bash
npm install
npm run dev        # local dev server
npm run build      # static bundle in dist/ — deploy to any static host
npm test           # engine + world integrity test suites (vitest)
```

Open the printed URL. The game saves to `localStorage` (3 manual slots +
autosave at healing centers). **Clearing browser data erases saves.**

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | Arrows / WASD | D-pad |
| Run | hold Shift | hold B |
| Confirm / interact | Z / Space / Enter | A |
| Cancel / back | X / Esc / Backspace | B |
| Pause menu | Enter / Esc (while walking) | MENU |

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
silently ignored — partial art sets are fine. Audio is always procedural; there
are intentionally no sound files.

**Suggested generation prompt template** (front sprites):
> pixel-art creature sprite, 96×96, facing viewer, full body, transparent
> background, GBA-era JRPG style, vivid `<type>` color palette, `<flavor text>`

## Architecture

Pure, engine-independent modules (`src/engine`, `src/data`, all unit-tested,
no Phaser imports): `battle.ts` (turn state machine emitting an event log),
`creature.ts` (stats/EXP/evolution), `capture.ts`, `save.ts` (versioned,
forward-safe), `state.ts`, plus the data tables that hold *all* balance.
Phaser 3 scenes (`src/scenes`) are a thin presentation layer that replays
battle-engine events as animations. All randomness flows through one seedable
RNG (`src/core/rng.ts`), so battles are reproducible. World integrity
(map grids, warps, encounter/trainer/script references) is enforced by
`tests/world.test.ts`.
