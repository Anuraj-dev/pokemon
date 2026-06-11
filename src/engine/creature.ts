/**
 * creature-model — pure functions for stat calculation, instance creation,
 * leveling/EXP, EV accrual, and evolution eligibility. No Phaser imports.
 */
import type { RNG } from '../core/rng';
import { speciesById, movesAtLevel, type SpeciesData } from '../data/species';
import { NATURES, natureById, natureMod, type StatKey } from '../data/natures';
import { totalExpFor, levelForExp, type GrowthRate, MAX_LEVEL } from '../data/growth';
import { moveById, type NonVolatileStatus } from '../data/moves';

export interface MoveSlot {
  id: string;
  pp: number;
}

export interface Stats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface CreatureInstance {
  uid: string;
  speciesId: string;
  nickname?: string;
  level: number;
  exp: number;
  ivs: Stats;
  evs: Stats;
  natureId: string;
  moves: MoveSlot[];
  hp: number; // current HP
  status: NonVolatileStatus | null;
  heldItem: string | null;
  shiny: boolean;
  /** original trainer marker: 'player' or trainer id (cosmetic) */
  ot: string;
}

const STAT_KEYS: StatKey[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

let uidCounter = 0;
export function freshUid(): string {
  uidCounter = (uidCounter + 1) % 1_000_000;
  return `${Date.now().toString(36)}-${uidCounter.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Gen-3 style stat formulas (normative per PRD). */
export function calcStat(
  stat: StatKey,
  base: number,
  iv: number,
  ev: number,
  level: number,
  natureId: string,
): number {
  const core = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100);
  if (stat === 'hp') return core + level + 10;
  return Math.floor((core + 5) * natureMod(natureById(natureId), stat));
}

export function calcStats(c: Pick<CreatureInstance, 'speciesId' | 'level' | 'ivs' | 'evs' | 'natureId'>): Stats {
  const s = speciesById(c.speciesId);
  const out = {} as Stats;
  for (const k of STAT_KEYS) {
    out[k] = calcStat(k, s.baseStats[k], c.ivs[k], c.evs[k], c.level, c.natureId);
  }
  return out;
}

export function maxHp(c: CreatureInstance): number {
  return calcStats(c).hp;
}

export function displayName(c: CreatureInstance): string {
  return c.nickname || speciesById(c.speciesId).name;
}

export function makePpSlots(moveIds: string[]): MoveSlot[] {
  return moveIds.map((id) => ({ id, pp: moveById(id).pp }));
}

/** Create a wild/trainer creature instance at a level. Deterministic given the RNG. */
export function createCreature(
  rng: RNG,
  speciesId: string,
  level: number,
  opts: { ot?: string; heldItem?: string | null; perfectIvs?: boolean; moveIds?: string[] } = {},
): CreatureInstance {
  const sp = speciesById(speciesId);
  const ivs: Stats = {
    hp: opts.perfectIvs ? 31 : rng.int(0, 31),
    atk: opts.perfectIvs ? 31 : rng.int(0, 31),
    def: opts.perfectIvs ? 31 : rng.int(0, 31),
    spa: opts.perfectIvs ? 31 : rng.int(0, 31),
    spd: opts.perfectIvs ? 31 : rng.int(0, 31),
    spe: opts.perfectIvs ? 31 : rng.int(0, 31),
  };
  const evs: Stats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  const natureId = rng.pick(NATURES).id;
  const inst: CreatureInstance = {
    uid: freshUid(),
    speciesId,
    level,
    exp: totalExpFor(sp.growth, level),
    ivs,
    evs,
    natureId,
    moves: makePpSlots(opts.moveIds ?? movesAtLevel(speciesId, level)),
    hp: 0,
    status: null,
    heldItem: opts.heldItem ?? null,
    shiny: rng.chance(1 / 512),
    ot: opts.ot ?? 'wild',
  };
  inst.hp = calcStats(inst).hp;
  return inst;
}

/** EXP awarded for defeating `defeated`, split across `participants` count. */
export function expGain(defeatedSpecies: SpeciesData, defeatedLevel: number, participants: number, opts: { trainer?: boolean; luckyCharm?: boolean } = {}): number {
  const base = (defeatedSpecies.expYield * defeatedLevel) / 7;
  let exp = Math.floor(base / Math.max(1, participants));
  if (opts.trainer) exp = Math.floor(exp * 1.5);
  if (opts.luckyCharm) exp = Math.floor(exp * 1.5);
  return Math.max(1, exp);
}

export interface LevelUpResult {
  leveledTo: number[];
  /** moves newly learnable at the levels gained */
  newMoves: { level: number; moveId: string }[];
}

/**
 * Add EXP, returning levels gained and learnable moves. Caller handles
 * the 4-move limit interaction and evolution checks.
 */
export function addExp(c: CreatureInstance, amount: number): LevelUpResult {
  const sp = speciesById(c.speciesId);
  const before = c.level;
  c.exp = Math.min(c.exp + amount, totalExpFor(sp.growth, MAX_LEVEL));
  const after = levelForExp(sp.growth, c.exp);
  const result: LevelUpResult = { leveledTo: [], newMoves: [] };
  if (after > before) {
    const oldMax = calcStats(c).hp;
    for (let lvl = before + 1; lvl <= after; lvl++) {
      result.leveledTo.push(lvl);
      for (const [moveLvl, moveId] of sp.learnset) {
        if (moveLvl === lvl && !c.moves.some((m) => m.id === moveId)) {
          result.newMoves.push({ level: lvl, moveId });
        }
      }
    }
    c.level = after;
    // current HP grows by the same amount max HP grew
    const newMax = calcStats(c).hp;
    if (c.hp > 0) c.hp = Math.min(newMax, c.hp + (newMax - oldMax));
  }
  return result;
}

/** Apply EV gains from defeating a species, respecting the 252/510 caps. */
export function applyEvGain(c: CreatureInstance, defeated: SpeciesData): void {
  const total = () => STAT_KEYS.reduce((sum, k) => sum + c.evs[k], 0);
  for (const k of STAT_KEYS) {
    const gain = defeated.evYield[k] ?? 0;
    if (gain <= 0) continue;
    const room = Math.min(252 - c.evs[k], 510 - total());
    c.evs[k] += Math.max(0, Math.min(gain, room));
  }
}

/** Species this creature evolves into right now via level, if any. */
export function levelEvolution(c: CreatureInstance): string | null {
  const sp = speciesById(c.speciesId);
  if (sp.evolution?.method === 'level' && c.level >= sp.evolution.level) return sp.evolution.into;
  return null;
}

/** Species this creature evolves into with the given item, if any. */
export function itemEvolution(c: CreatureInstance, itemId: string): string | null {
  const sp = speciesById(c.speciesId);
  if (sp.evolution?.method === 'item' && sp.evolution.item === itemId) return sp.evolution.into;
  return null;
}

/** Perform an evolution in place; preserves HP fraction, learns nothing automatically. */
export function evolve(c: CreatureInstance, intoSpeciesId: string): void {
  const fracHp = c.hp / Math.max(1, calcStats(c).hp);
  c.speciesId = intoSpeciesId;
  c.hp = Math.max(1, Math.floor(calcStats(c).hp * fracHp));
}

/** Moves the evolved (or any) species could learn at exactly this level. */
export function movesLearnedAt(speciesId: string, level: number): string[] {
  return speciesById(speciesId)
    .learnset.filter(([lvl]) => lvl === level)
    .map(([, id]) => id);
}

export function fullHeal(c: CreatureInstance): void {
  c.hp = calcStats(c).hp;
  c.status = null;
  for (const m of c.moves) m.pp = moveById(m.id).pp;
}
