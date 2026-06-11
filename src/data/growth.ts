/**
 * EXP growth-rate groups with standard cubic-style curves.
 * totalExpFor(level) = total EXP required to BE at that level.
 */
export type GrowthRate = 'fast' | 'mediumFast' | 'mediumSlow' | 'slow';

export const MAX_LEVEL = 100;

export function totalExpFor(rate: GrowthRate, level: number): number {
  const n = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  if (n === 1) return 0;
  switch (rate) {
    case 'fast':
      return Math.floor((4 * n * n * n) / 5);
    case 'mediumFast':
      return n * n * n;
    case 'mediumSlow':
      return Math.floor((6 / 5) * n * n * n - 15 * n * n + 100 * n - 140);
    case 'slow':
      return Math.floor((5 * n * n * n) / 4);
  }
}

/** Level implied by a total EXP amount (inverse of totalExpFor). */
export function levelForExp(rate: GrowthRate, exp: number): number {
  let lvl = 1;
  while (lvl < MAX_LEVEL && totalExpFor(rate, lvl + 1) <= exp) lvl++;
  return lvl;
}

/** EXP still needed to go from `exp` to the next level; 0 at max level. */
export function expToNext(rate: GrowthRate, level: number, exp: number): number {
  if (level >= MAX_LEVEL) return 0;
  return totalExpFor(rate, level + 1) - exp;
}
