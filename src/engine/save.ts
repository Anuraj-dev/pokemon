/**
 * save-system — versioned serialization of GameState to localStorage,
 * 3 manual slots + 1 autosave slot. Forward-safe loader: unknown fields
 * are preserved-by-merge onto a fresh state skeleton.
 */
import { type GameState, SAVE_VERSION, newGameState } from './state';
import { speciesById } from '../data/species';
import { displayName } from './creature';

const KEY_PREFIX = 'monstra.save.';
export const SLOTS = ['slot1', 'slot2', 'slot3', 'auto'] as const;
export type SlotId = (typeof SLOTS)[number];

export interface SlotSummary {
  slot: SlotId;
  playerName: string;
  badges: number;
  playtimeMs: number;
  partyLead: string | null;
  partyLevels: number[];
  savedAt: number;
}

function storageAvailable(): boolean {
  try {
    const k = '__monstra_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function serialize(state: GameState): string {
  return JSON.stringify({ ...state, savedAt: Date.now() });
}

/**
 * Deserialize a save payload of version <= SAVE_VERSION by merging onto a
 * fresh skeleton, so missing fields get sane defaults.
 */
export function deserialize(json: string): GameState {
  const raw = JSON.parse(json) as Partial<GameState> & { savedAt?: number };
  if (typeof raw !== 'object' || raw === null) throw new Error('Corrupt save');
  const base = newGameState(raw.player?.name ?? 'Ari');
  const merged: GameState = {
    ...base,
    ...raw,
    version: SAVE_VERSION,
    player: { ...base.player, ...(raw.player ?? {}) },
    settings: { ...base.settings, ...(raw.settings ?? {}) },
    lastHeal: { ...base.lastHeal, ...(raw.lastHeal ?? {}) },
    party: raw.party ?? [],
    boxes: raw.boxes ?? base.boxes,
    bag: raw.bag ?? base.bag,
    seen: raw.seen ?? [],
    caught: raw.caught ?? [],
    flags: raw.flags ?? {},
  };
  delete (merged as unknown as Record<string, unknown>).savedAt;
  return merged;
}

export function saveToSlot(slot: SlotId, state: GameState): boolean {
  if (!storageAvailable()) return false;
  try {
    localStorage.setItem(KEY_PREFIX + slot, serialize(state));
    return true;
  } catch {
    return false;
  }
}

export function loadFromSlot(slot: SlotId): GameState | null {
  if (!storageAvailable()) return null;
  const json = localStorage.getItem(KEY_PREFIX + slot);
  if (!json) return null;
  try {
    return deserialize(json);
  } catch {
    return null;
  }
}

export function deleteSlot(slot: SlotId): void {
  if (storageAvailable()) localStorage.removeItem(KEY_PREFIX + slot);
}

export function slotSummary(slot: SlotId): SlotSummary | null {
  if (!storageAvailable()) return null;
  const json = localStorage.getItem(KEY_PREFIX + slot);
  if (!json) return null;
  try {
    const raw = JSON.parse(json);
    const party = (raw.party ?? []) as GameState['party'];
    return {
      slot,
      playerName: raw.player?.name ?? '???',
      badges: raw.player?.badges?.length ?? 0,
      playtimeMs: raw.player?.playtimeMs ?? 0,
      partyLead: party[0] ? displayName(party[0]) : null,
      partyLevels: party.map((c) => c.level),
      savedAt: raw.savedAt ?? 0,
    };
  } catch {
    return null;
  }
}

export function anySaveExists(): boolean {
  return SLOTS.some((s) => slotSummary(s) !== null);
}

export function formatPlaytime(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

/** Sanity check that all referenced species in a save still exist. */
export function validateSave(state: GameState): boolean {
  try {
    for (const c of state.party) speciesById(c.speciesId);
    for (const box of state.boxes) for (const c of box) speciesById(c.speciesId);
    return true;
  } catch {
    return false;
  }
}
