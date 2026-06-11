/**
 * GameState — the single mutable state object for a playthrough.
 * Pure data; scenes read and write it, the save-system serializes it.
 */
import type { CreatureInstance } from './creature';
import { fullHeal } from './creature';
import { gameRNG } from '../core/rng';

export type Facing = 'up' | 'down' | 'left' | 'right';

export interface GameState {
  version: number;
  player: {
    name: string;
    mapId: string;
    x: number;
    y: number;
    facing: Facing;
    money: number;
    badges: string[];
    playtimeMs: number;
  };
  party: CreatureInstance[];
  boxes: CreatureInstance[][]; // 8 boxes × 30
  bag: Record<string, number>;
  seen: string[]; // species ids
  caught: string[];
  flags: Record<string, number | boolean | string>;
  settings: { musicVol: number; sfxVol: number; textSpeed: number };
  rngSeed: number;
  repelSteps: number;
  lastHeal: { mapId: string; x: number; y: number };
}

export const SAVE_VERSION = 1;
export const NUM_BOXES = 8;
export const BOX_SIZE = 30;
export const MAX_PARTY = 6;

export function newGameState(playerName: string): GameState {
  return {
    version: SAVE_VERSION,
    player: {
      name: playerName || 'Ari',
      mapId: 'embervale',
      x: 12,
      y: 8,
      facing: 'down',
      money: 3000,
      badges: [],
      playtimeMs: 0,
    },
    party: [],
    boxes: Array.from({ length: NUM_BOXES }, () => []),
    bag: { basicball: 5, potion: 3 },
    seen: [],
    caught: [],
    flags: {},
    settings: { musicVol: 0.5, sfxVol: 0.6, textSpeed: 2 },
    rngSeed: gameRNG.getSeed(),
    repelSteps: 0,
    lastHeal: { mapId: 'embervale', x: 12, y: 8 },
  };
}

/** The live game state. Null until a game is started/loaded. */
let current: GameState | null = null;

export function getState(): GameState {
  if (!current) throw new Error('No game in progress');
  return current;
}

export function hasState(): boolean {
  return current !== null;
}

export function setState(s: GameState | null): void {
  current = s;
}

// ----------------------------------------------------------- conveniences

export function markSeen(speciesId: string): void {
  const s = getState();
  if (!s.seen.includes(speciesId)) s.seen.push(speciesId);
}

export function markCaught(speciesId: string): void {
  const s = getState();
  markSeen(speciesId);
  if (!s.caught.includes(speciesId)) s.caught.push(speciesId);
}

export function addToBag(itemId: string, qty = 1): void {
  const s = getState();
  s.bag[itemId] = (s.bag[itemId] ?? 0) + qty;
}

export function removeFromBag(itemId: string, qty = 1): boolean {
  const s = getState();
  const have = s.bag[itemId] ?? 0;
  if (have < qty) return false;
  if (have - qty <= 0) delete s.bag[itemId];
  else s.bag[itemId] = have - qty;
  return true;
}

export function bagCount(itemId: string): number {
  return getState().bag[itemId] ?? 0;
}

export function getFlag(key: string): number | boolean | string {
  return getState().flags[key] ?? false;
}

export function setFlag(key: string, value: number | boolean | string = true): void {
  getState().flags[key] = value;
}

/** Add a creature to the party, overflowing into the first box with room. */
export function addCreature(c: CreatureInstance): 'party' | 'box' | 'lost' {
  const s = getState();
  markCaught(c.speciesId);
  if (s.party.length < MAX_PARTY) {
    s.party.push(c);
    return 'party';
  }
  for (const box of s.boxes) {
    if (box.length < BOX_SIZE) {
      box.push(c);
      return 'box';
    }
  }
  return 'lost';
}

export function healParty(): void {
  for (const c of getState().party) fullHeal(c);
}

