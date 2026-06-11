/**
 * 25 natures, Gen-3 style: each raises one of (atk/def/spa/spd/spe) by 10%
 * and lowers another by 10%; the five where raise === lower are neutral.
 */
export type StatKey = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';

export const STAT_NAMES: Record<StatKey, string> = {
  hp: 'HP',
  atk: 'Attack',
  def: 'Defense',
  spa: 'Sp. Atk',
  spd: 'Sp. Def',
  spe: 'Speed',
};

export interface Nature {
  id: string;
  name: string;
  up: Exclude<StatKey, 'hp'>;
  down: Exclude<StatKey, 'hp'>;
}

const N = (name: string, up: Nature['up'], down: Nature['down']): Nature => ({
  id: name.toLowerCase(),
  name,
  up,
  down,
});

export const NATURES: Nature[] = [
  N('Hardy', 'atk', 'atk'),
  N('Lonely', 'atk', 'def'),
  N('Brave', 'atk', 'spe'),
  N('Adamant', 'atk', 'spa'),
  N('Naughty', 'atk', 'spd'),
  N('Bold', 'def', 'atk'),
  N('Docile', 'def', 'def'),
  N('Relaxed', 'def', 'spe'),
  N('Impish', 'def', 'spa'),
  N('Lax', 'def', 'spd'),
  N('Timid', 'spe', 'atk'),
  N('Hasty', 'spe', 'def'),
  N('Serious', 'spe', 'spe'),
  N('Jolly', 'spe', 'spa'),
  N('Naive', 'spe', 'spd'),
  N('Modest', 'spa', 'atk'),
  N('Mild', 'spa', 'def'),
  N('Quiet', 'spa', 'spe'),
  N('Bashful', 'spa', 'spa'),
  N('Rash', 'spa', 'spd'),
  N('Calm', 'spd', 'atk'),
  N('Gentle', 'spd', 'def'),
  N('Sassy', 'spd', 'spe'),
  N('Careful', 'spd', 'spa'),
  N('Quirky', 'spd', 'spd'),
];

export function natureById(id: string): Nature {
  const n = NATURES.find((n) => n.id === id);
  if (!n) throw new Error(`Unknown nature: ${id}`);
  return n;
}

/** Multiplier this nature applies to the given stat. */
export function natureMod(nature: Nature, stat: StatKey): number {
  if (nature.up === nature.down) return 1;
  if (stat === nature.up) return 1.1;
  if (stat === nature.down) return 0.9;
  return 1;
}
