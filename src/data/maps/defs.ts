/**
 * Map model: ASCII grids + a tile legend, warps, NPCs, triggers, encounters.
 * All maps in the game are defined this way and rendered from procedural tiles.
 */
import type { TrackId } from '../../audio/audio';
import type { Facing } from '../../engine/state';

export interface LegendEntry {
  tile: string; // tile texture name (render/spriteGen TILE_DRAWERS key)
  solid?: boolean;
  encounter?: boolean; // tall grass / cave floor wild checks
  water?: boolean; // needs Wave Charm to enter; water encounters while on it
  ledge?: boolean; // one-way hop when moving down
  cuttable?: boolean; // Cutter Charm clears it (session-local)
  climbable?: boolean; // walkable only with Climbing Gear
}

export const LEGEND: Record<string, LegendEntry> = {
  '.': { tile: 'grass' },
  ',': { tile: 'path' },
  f: { tile: 'flowers' },
  g: { tile: 'tallgrass', encounter: true },
  '#': { tile: 'tree', solid: true },
  b: { tile: 'bush', solid: true, cuttable: true },
  '~': { tile: 'water', water: true },
  '=': { tile: 'bridge' },
  _: { tile: 'ledge', ledge: true, solid: true },
  R: { tile: 'rockwall', solid: true },
  M: { tile: 'climbwall', climbable: true, solid: true },
  c: { tile: 'cavefloor' },
  e: { tile: 'cavefloor', encounter: true },
  C: { tile: 'cavewall', solid: true },
  B: { tile: 'boulder', solid: true },
  S: { tile: 'sand' },
  W: { tile: 'wall', solid: true },
  r: { tile: 'roof', solid: true },
  u: { tile: 'roofblue', solid: true },
  m: { tile: 'roofmart', solid: true },
  y: { tile: 'roofgym', solid: true },
  l: { tile: 'rooflab', solid: true },
  D: { tile: 'door' }, // walkable; usually carries a warp
  w: { tile: 'window', solid: true },
  s: { tile: 'sign', solid: true },
  F: { tile: 'fence', solid: true },
  o: { tile: 'floor' },
  I: { tile: 'interiorwall', solid: true },
  k: { tile: 'carpet' },
  t: { tile: 'counter', solid: true },
  h: { tile: 'shelf', solid: true },
  P: { tile: 'pc', solid: true },
  H: { tile: 'healer', solid: true },
  G: { tile: 'gymfloor' },
  p: { tile: 'gympad' },
  v: { tile: 'warp' },
  a: { tile: 'mat' },
  T: { tile: 'table', solid: true },
  K: { tile: 'bookshelf', solid: true },
  A: { tile: 'statue', solid: true },
  x: { tile: 'void', solid: true },
  d: { tile: 'darkfloor' },
  X: { tile: 'darkwall', solid: true },
  n: { tile: 'snow' },
};

export interface Warp {
  x: number;
  y: number;
  to: string; // map id
  spawn: string; // named spawn point on target map
  /** flag that must be truthy to use this warp */
  requires?: string;
  failText?: string;
}

export interface EdgeWarp {
  side: 'north' | 'south' | 'east' | 'west';
  to: string;
  spawn: string;
}

export interface SpawnPoint {
  x: number;
  y: number;
  facing: Facing;
}

export interface SignDef {
  x: number;
  y: number;
  text: string;
}

export interface NpcDef {
  id: string;
  sprite: string; // char key
  x: number;
  y: number;
  facing: Facing;
  movement?: 'static' | 'wander' | 'spin';
  dialogue?: string[];
  /** script id in story.ts run on interaction (overrides dialogue) */
  script?: string;
  trainer?: {
    trainerId: string;
    sightRange: number;
  };
  /** render as a ground item ball; picking it up grants the item once */
  itemPickup?: { item: string; qty: number };
  /** render using a creature's front sprite instead of a character */
  creatureSprite?: string;
  /** only show when flag has this value (default true) */
  showIf?: { flag: string; value?: boolean | number; not?: boolean };
}

export interface TriggerDef {
  x: number;
  y: number;
  script: string;
  /** only fire when flag check passes */
  showIf?: { flag: string; value?: boolean | number; not?: boolean };
  once?: string; // flag set after firing; trigger skipped if already set
}

export interface EncounterEntry {
  speciesId: string;
  min: number;
  max: number;
  weight: number;
}

export interface MapDef {
  id: string;
  name: string;
  music: TrackId;
  grid: string[];
  spawns: Record<string, SpawnPoint>;
  warps?: Warp[];
  edges?: EdgeWarp[];
  signs?: SignDef[];
  npcs?: NpcDef[];
  triggers?: TriggerDef[];
  encounters?: { grass?: EncounterEntry[]; water?: EncounterEntry[]; rate?: number };
  /** script run every time the map is entered */
  onEnter?: string;
  indoor?: boolean;
}

export function mapWidth(m: MapDef): number {
  return m.grid[0].length;
}

export function mapHeight(m: MapDef): number {
  return m.grid.length;
}

export function tileAt(m: MapDef, x: number, y: number): LegendEntry | null {
  if (y < 0 || y >= m.grid.length || x < 0 || x >= m.grid[y].length) return null;
  return LEGEND[m.grid[y][x]] ?? null;
}

export function charAt(m: MapDef, x: number, y: number): string {
  if (y < 0 || y >= m.grid.length || x < 0 || x >= m.grid[y].length) return 'x';
  return m.grid[y][x];
}
