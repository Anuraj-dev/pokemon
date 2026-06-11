/** creature-model: stat formulas, EXP curves, EV caps, evolution eligibility. */
import { describe, it, expect } from 'vitest';
import { RNG } from '../src/core/rng';
import { calcStat, createCreature, addExp, applyEvGain, levelEvolution, itemEvolution, evolve, calcStats } from '../src/engine/creature';
import { totalExpFor, levelForExp, expToNext } from '../src/data/growth';
import { speciesById } from '../src/data/species';

describe('stat calculation (Gen-3 formulas)', () => {
  it('HP formula exact value', () => {
    // floor((2*100 + 31 + floor(252/4)) * 50 / 100) + 50 + 10 = floor(294*0.5)+60 = 147+60 = 207
    expect(calcStat('hp', 100, 31, 252, 50, 'hardy')).toBe(207);
  });

  it('other stat formula with nature', () => {
    // core = floor((2*100+31+63)*50/100) = 147; (147+5) = 152
    expect(calcStat('atk', 100, 31, 252, 50, 'hardy')).toBe(152); // neutral
    expect(calcStat('atk', 100, 31, 252, 50, 'adamant')).toBe(Math.floor(152 * 1.1)); // +atk
    expect(calcStat('atk', 100, 31, 252, 50, 'bold')).toBe(Math.floor(152 * 0.9)); // -atk
  });

  it('level 5 starter has sane stats', () => {
    const rng = new RNG(42);
    const c = createCreature(rng, 'emberling', 5);
    const stats = calcStats(c);
    expect(stats.hp).toBeGreaterThanOrEqual(17);
    expect(stats.hp).toBeLessThanOrEqual(25);
    expect(c.hp).toBe(stats.hp);
  });
});

describe('EXP growth curves', () => {
  it('mediumFast is n^3', () => {
    expect(totalExpFor('mediumFast', 10)).toBe(1000);
    expect(totalExpFor('mediumFast', 50)).toBe(125000);
  });
  it('fast is 0.8n^3', () => {
    expect(totalExpFor('fast', 10)).toBe(800);
  });
  it('slow is 1.25n^3', () => {
    expect(totalExpFor('slow', 10)).toBe(1250);
  });
  it('mediumSlow crosses known thresholds', () => {
    expect(totalExpFor('mediumSlow', 100)).toBe(1059860);
  });
  it('levelForExp inverts totalExpFor', () => {
    for (const rate of ['fast', 'mediumFast', 'mediumSlow', 'slow'] as const) {
      for (const lvl of [2, 17, 36, 50, 99, 100]) {
        expect(levelForExp(rate, totalExpFor(rate, lvl)), `${rate} L${lvl}`).toBe(lvl);
        expect(expToNext(rate, lvl, totalExpFor(rate, lvl))).toBe(
          lvl === 100 ? 0 : totalExpFor(rate, lvl + 1) - totalExpFor(rate, lvl),
        );
      }
    }
  });
  it('addExp levels up and reports learnable moves', () => {
    const rng = new RNG(7);
    const c = createCreature(rng, 'emberling', 6);
    const sp = speciesById('emberling');
    const target = totalExpFor(sp.growth, 7) - c.exp;
    const res = addExp(c, target);
    expect(c.level).toBe(7);
    expect(res.leveledTo).toEqual([7]);
    expect(res.newMoves.map((m) => m.moveId)).toContain('ember');
  });
});

describe('EV caps', () => {
  it('respects 252 per stat and 510 total', () => {
    const rng = new RNG(3);
    const c = createCreature(rng, 'emberling', 10);
    const speYielder = speciesById('emberling'); // yields 1 spe
    for (let i = 0; i < 600; i++) applyEvGain(c, speYielder);
    expect(c.evs.spe).toBe(252);
    const hpYielder = speciesById('larvit'); // yields 1 hp
    for (let i = 0; i < 600; i++) applyEvGain(c, hpYielder);
    const total = Object.values(c.evs).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(510);
    expect(c.evs.hp).toBe(Math.min(252, 510 - 252)); // per-stat cap binds first
    // a third stat can only absorb what's left under the 510 total
    const defYielder = speciesById('pebblit'); // yields 1 def
    for (let i = 0; i < 50; i++) applyEvGain(c, defYielder);
    expect(Object.values(c.evs).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(510);
    expect(c.evs.def).toBe(510 - 252 - 252);
  });
});

describe('evolution', () => {
  it('level evolution triggers at the right level', () => {
    const rng = new RNG(9);
    const c = createCreature(rng, 'emberling', 15);
    expect(levelEvolution(c)).toBeNull();
    c.level = 16;
    expect(levelEvolution(c)).toBe('flarewolf');
  });
  it('item evolution requires the matching stone', () => {
    const rng = new RNG(9);
    const c = createCreature(rng, 'shadepup', 20);
    expect(itemEvolution(c, 'dawnstone')).toBeNull();
    expect(itemEvolution(c, 'duskstone')).toBe('duskhound');
  });
  it('evolve preserves HP fraction', () => {
    const rng = new RNG(9);
    const c = createCreature(rng, 'shadepup', 20);
    const max = calcStats(c).hp;
    c.hp = Math.floor(max / 2);
    evolve(c, 'duskhound');
    const newMax = calcStats(c).hp;
    expect(c.speciesId).toBe('duskhound');
    expect(c.hp).toBe(Math.max(1, Math.floor(newMax * (Math.floor(max / 2) / max))));
  });
  it('every trade-style evolution is reachable via Link Stone', () => {
    const c = createCreature(new RNG(1), 'golemite', 30);
    expect(itemEvolution(c, 'linkstone')).toBe('gargantuan');
  });
});
