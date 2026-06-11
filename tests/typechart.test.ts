/** type-chart: every normative multiplier from the PRD, exactly. */
import { describe, it, expect } from 'vitest';
import { typeMultiplier, effectiveness, ALL_TYPES, type TypeId } from '../src/data/types';

const EXPECTED: [TypeId, TypeId, number][] = [
  // Inferno
  ['inferno', 'verdant', 2], ['inferno', 'gale', 2],
  ['inferno', 'aqua', 0.5], ['inferno', 'terra', 0.5], ['inferno', 'inferno', 0.5],
  // Aqua
  ['aqua', 'inferno', 2], ['aqua', 'terra', 2],
  ['aqua', 'verdant', 0.5], ['aqua', 'volt', 0.5], ['aqua', 'aqua', 0.5],
  // Verdant
  ['verdant', 'aqua', 2], ['verdant', 'terra', 2],
  ['verdant', 'inferno', 0.5], ['verdant', 'verdant', 0.5], ['verdant', 'gale', 0.5], ['verdant', 'volt', 0.5],
  // Volt
  ['volt', 'aqua', 2], ['volt', 'gale', 2],
  ['volt', 'verdant', 0.5], ['volt', 'volt', 0.5], ['volt', 'terra', 0],
  // Terra
  ['terra', 'inferno', 2], ['terra', 'volt', 2],
  ['terra', 'verdant', 0.5], ['terra', 'gale', 0.5],
  // Gale
  ['gale', 'verdant', 2],
  ['gale', 'volt', 0.5], ['gale', 'terra', 0.5], ['gale', 'gale', 0.5],
  // Umbra/Lumina — normative resolution: mutual 2×, self 0.5×, no 0×
  ['umbra', 'lumina', 2], ['umbra', 'umbra', 0.5],
  ['lumina', 'umbra', 2], ['lumina', 'lumina', 0.5],
];

describe('type chart', () => {
  it('matches every normative entry', () => {
    for (const [atk, def, mult] of EXPECTED) {
      expect(typeMultiplier(atk, def), `${atk} → ${def}`).toBe(mult);
    }
  });

  it('unlisted pairs are exactly 1×', () => {
    const listed = new Set(EXPECTED.map(([a, d]) => `${a}:${d}`));
    for (const a of ALL_TYPES) {
      for (const d of ALL_TYPES) {
        if (!listed.has(`${a}:${d}`)) {
          expect(typeMultiplier(a, d), `${a} → ${d}`).toBe(1);
        }
      }
    }
  });

  it('dual-type defenders multiply both', () => {
    expect(effectiveness('volt', ['aqua', 'gale'])).toBe(4);
    expect(effectiveness('volt', ['terra', 'volt'])).toBe(0); // immunity dominates
    expect(effectiveness('inferno', ['verdant', 'terra'])).toBe(1); // 2 × 0.5
    expect(effectiveness('umbra', ['umbra', 'lumina'])).toBe(1); // 0.5 × 2
  });
});
