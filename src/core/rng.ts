/**
 * Seedable deterministic RNG (mulberry32). All game randomness routes through
 * a single instance so battles and encounters are reproducible.
 */
export class RNG {
  private state: number;

  constructor(seed: number = Date.now() >>> 0) {
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 0x9e3779b9;
  }

  /** Current internal state, for save serialization. */
  getSeed(): number {
    return this.state;
  }

  setSeed(seed: number): void {
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 0x9e3779b9;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with probability p (0..1). */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Pick a uniformly random element. */
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  /** Weighted pick: weights need not sum to anything in particular. */
  weighted<T>(entries: readonly { item: T; weight: number }[]): T {
    let total = 0;
    for (const e of entries) total += e.weight;
    let roll = this.next() * total;
    for (const e of entries) {
      roll -= e.weight;
      if (roll < 0) return e.item;
    }
    return entries[entries.length - 1].item;
  }
}

/** The global game RNG. Scenes and engine share this; tests construct their own. */
export const gameRNG = new RNG();
