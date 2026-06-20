/**
 * Render/view settings — Minecraft-style chunk distance and simulation
 * distance, persisted in localStorage (machine preference, not save data).
 * Live objects read `view` each frame, so slider changes apply instantly.
 */

export const CHUNK_SIZE = 16; // tiles per chunk side

export interface ViewSettings {
  /** chunks of world geometry kept built around the player (radius) */
  chunkDistance: number;
  /** chunks within which NPCs wander/animate and decor ticks (radius) */
  simDistance: number;
}

export const VIEW_LIMITS = {
  chunkDistance: { min: 2, max: 12 },
  simDistance: { min: 1, max: 8 },
} as const;

const KEY = 'monstra:view';

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.round(v)));
}

function load(): ViewSettings {
  const def: ViewSettings = { chunkDistance: 4, simDistance: 3 };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return def;
    const p = JSON.parse(raw) as Partial<ViewSettings>;
    return {
      chunkDistance: clamp(p.chunkDistance ?? def.chunkDistance, VIEW_LIMITS.chunkDistance.min, VIEW_LIMITS.chunkDistance.max),
      simDistance: clamp(p.simDistance ?? def.simDistance, VIEW_LIMITS.simDistance.min, VIEW_LIMITS.simDistance.max),
    };
  } catch {
    return def;
  }
}

export const view: ViewSettings = load();

export function setViewSetting(key: keyof ViewSettings, value: number): void {
  const lim = VIEW_LIMITS[key];
  view[key] = clamp(value, lim.min, lim.max);
  try {
    localStorage.setItem(KEY, JSON.stringify(view));
  } catch {
    /* private mode etc. — setting still applies for the session */
  }
}

/** view radius in tiles, for fog + cull math */
export function viewRadiusTiles(): number {
  return view.chunkDistance * CHUNK_SIZE;
}

export function simRadiusTiles(): number {
  return view.simDistance * CHUNK_SIZE;
}
