/**
 * type-chart — the 8 elemental types of the Veridia region and their
 * effectiveness chart. Pure data + lookup function. Normative per PRD.
 */
export type TypeId =
  | 'inferno'
  | 'aqua'
  | 'verdant'
  | 'volt'
  | 'terra'
  | 'gale'
  | 'umbra'
  | 'lumina';

export const ALL_TYPES: TypeId[] = [
  'inferno',
  'aqua',
  'verdant',
  'volt',
  'terra',
  'gale',
  'umbra',
  'lumina',
];

export const TYPE_NAMES: Record<TypeId, string> = {
  inferno: 'Inferno',
  aqua: 'Aqua',
  verdant: 'Verdant',
  volt: 'Volt',
  terra: 'Terra',
  gale: 'Gale',
  umbra: 'Umbra',
  lumina: 'Lumina',
};

export const TYPE_COLORS: Record<TypeId, number> = {
  inferno: 0xe8542f,
  aqua: 0x3a8fe0,
  verdant: 0x57b04a,
  volt: 0xf2c84b,
  terra: 0xb08d4e,
  gale: 0x8fb6d8,
  umbra: 0x6a4e8e,
  lumina: 0xf0e08a,
};

/** attacker -> defender -> multiplier; unlisted pairs are 1×. */
const CHART: Partial<Record<TypeId, Partial<Record<TypeId, number>>>> = {
  inferno: { verdant: 2, gale: 2, aqua: 0.5, terra: 0.5, inferno: 0.5 },
  aqua: { inferno: 2, terra: 2, verdant: 0.5, volt: 0.5, aqua: 0.5 },
  verdant: { aqua: 2, terra: 2, inferno: 0.5, verdant: 0.5, gale: 0.5, volt: 0.5 },
  volt: { aqua: 2, gale: 2, verdant: 0.5, volt: 0.5, terra: 0 },
  terra: { inferno: 2, volt: 2, verdant: 0.5, gale: 0.5 },
  gale: { verdant: 2, volt: 0.5, terra: 0.5, gale: 0.5 },
  umbra: { lumina: 2, umbra: 0.5 },
  lumina: { umbra: 2, lumina: 0.5 },
};

/** Effectiveness multiplier of an attacking type against one defending type. */
export function typeMultiplier(attacker: TypeId, defender: TypeId): number {
  const m = CHART[attacker]?.[defender];
  return m === undefined ? 1 : m;
}

/** Effectiveness against a (possibly dual-typed) defender; multiplies both. */
export function effectiveness(attacker: TypeId, defenders: readonly TypeId[]): number {
  let mult = 1;
  for (const d of defenders) mult *= typeMultiplier(attacker, d);
  return mult;
}
