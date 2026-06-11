/**
 * Debug/automation mode registry — which top-level screens are active.
 * Read by the E2E smoke test through window.__monstra.modes().
 */
const active = new Set<string>();

export type Mode = 'title' | 'overworld' | 'battle' | 'menu' | 'credits';

export function setMode(mode: Mode, on: boolean): void {
  if (on) active.add(mode);
  else active.delete(mode);
}

export function activeModes(): string[] {
  return [...active];
}
