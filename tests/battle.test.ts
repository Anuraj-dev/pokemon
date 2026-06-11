/**
 * battle-engine: damage formula exactness, STAB/effectiveness, turn order,
 * status ticks, PP, fainting/forced switches, capture, run, protect, EXP.
 * Driven through a fixed-value RNG for full determinism.
 */
import { describe, it, expect } from 'vitest';
import { RNG } from '../src/core/rng';
import { BattleEngine, type BattleEvent } from '../src/engine/battle';
import { createCreature, calcStats, type CreatureInstance } from '../src/engine/creature';

/** RNG whose next() always returns a fixed value — fully deterministic battles. */
class FixedRNG extends RNG {
  constructor(private v: number) {
    super(1);
  }
  next(): number {
    return this.v;
  }
}

function mk(speciesId: string, level: number, moveIds: string[]): CreatureInstance {
  const c = createCreature(new RNG(123), speciesId, level, { perfectIvs: true, moveIds });
  c.natureId = 'hardy';
  c.ivs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
  c.hp = calcStats(c).hp;
  return c;
}

function texts(events: BattleEvent[]): string[] {
  return events.filter((e): e is Extract<BattleEvent, { t: 'text' }> => e.t === 'text').map((e) => e.msg);
}

function engine(player: CreatureInstance[], foe: CreatureInstance[], rng: RNG, kind: 'wild' | 'trainer' = 'wild') {
  const e = new BattleEngine({ kind, playerParty: player, foeParty: foe, foeName: 'Test', canCatch: kind === 'wild', canRun: kind === 'wild' }, rng);
  e.start();
  return e;
}

describe('damage formula', () => {
  it('matches the normative formula exactly (no crit, fixed roll)', () => {
    const rng = new FixedRNG(0.5);
    const attacker = mk('emberling', 10, ['ember']);
    const defender = mk('pebblit', 10, ['tackle']);
    const e = engine([attacker], [defender], rng);
    const foeMaxHp = calcStats(defender).hp;
    const events = e.executeTurn({ type: 'move', moveIndex: 0 });

    // expected per PRD formula
    const spa = calcStats(attacker).spa;
    const spd = calcStats(defender).spd;
    const base = (((2 * 10) / 5 + 2) * 40 * (spa / spd)) / 50 + 2;
    const rand = 0.85 + 0.5 * 0.15;
    const expected = Math.floor(base * 1.5 /* STAB */ * 0.5 /* inferno→terra */ * rand);

    const hpEvent = events.find((ev) => ev.t === 'hp' && ev.side === 'foe') as Extract<BattleEvent, { t: 'hp' }>;
    expect(hpEvent).toBeDefined();
    expect(foeMaxHp - hpEvent.hp).toBe(Math.max(1, expected));
    expect(texts(events)).toContain("It's not very effective...");
  });

  it('applies super effectiveness and announces it', () => {
    const rng = new FixedRNG(0.5);
    const attacker = mk('dribblet', 10, ['splashjet']);
    const defender = mk('magmite', 10, ['tackle']); // inferno/terra: aqua hits 2×2=4×
    const e = engine([attacker], [defender], rng);
    const events = e.executeTurn({ type: 'move', moveIndex: 0 });
    expect(texts(events)).toContain("It's super effective!");
    const eff = events.find((ev) => ev.t === 'effectiveness') as Extract<BattleEvent, { t: 'effectiveness' }>;
    expect(eff.mult).toBe(4);
  });

  it('volt cannot touch terra (immunity)', () => {
    const rng = new FixedRNG(0.5);
    const attacker = mk('sparkit', 10, ['sparkshot']);
    const defender = mk('pebblit', 10, ['tackle']);
    const e = engine([attacker], [defender], rng);
    const events = e.executeTurn({ type: 'move', moveIndex: 0 });
    expect(texts(events).some((t) => t.includes("doesn't affect"))).toBe(true);
    expect(events.some((ev) => ev.t === 'hp' && ev.side === 'foe')).toBe(false);
  });
});

describe('turn order', () => {
  it('faster creature acts first', () => {
    const rng = new FixedRNG(0.5);
    const fast = mk('voltail', 20, ['sparkshot']); // base spe 110
    const slow = mk('golemite', 20, ['rocktoss']); // base spe 30
    const e = engine([fast], [slow], rng);
    const msgs = texts(e.executeTurn({ type: 'move', moveIndex: 0 }));
    const playerIdx = msgs.findIndex((m) => m.includes('used Spark Shot'));
    const foeIdx = msgs.findIndex((m) => m.includes('used Rock Toss'));
    expect(playerIdx).toBeGreaterThanOrEqual(0);
    expect(playerIdx).toBeLessThan(foeIdx === -1 ? Infinity : foeIdx);
  });

  it('priority moves outrank raw speed', () => {
    const rng = new FixedRNG(0.5);
    const slow = mk('golemite', 20, ['quickstrike']); // +1 priority
    const fast = mk('voltail', 20, ['sparkshot']);
    const e = engine([slow], [fast], rng);
    const msgs = texts(e.executeTurn({ type: 'move', moveIndex: 0 }));
    const qIdx = msgs.findIndex((m) => m.includes('used Quick Strike'));
    const sIdx = msgs.findIndex((m) => m.includes('used Spark Shot'));
    expect(qIdx).toBeLessThan(sIdx === -1 ? Infinity : sIdx);
  });

  it('paralysis halves speed in ordering', () => {
    const rng = new FixedRNG(0.5);
    const a = mk('galewing', 20, ['gustcut']); // spe 88
    const b = mk('voltail', 20, ['sparkshot']); // spe 110, will be paralyzed
    b.status = 'paralysis';
    const e = engine([a], [b], rng);
    // FixedRNG(0.5) → paralysis full-stop check chance(0.25) fails (0.5 > 0.25), so it acts, but later.
    const msgs = texts(e.executeTurn({ type: 'move', moveIndex: 0 }));
    const aIdx = msgs.findIndex((m) => m.includes('used Gust Cut'));
    const bIdx = msgs.findIndex((m) => m.includes('used Spark Shot'));
    expect(aIdx).toBeLessThan(bIdx === -1 ? Infinity : bIdx);
  });
});

describe('status and residuals', () => {
  it('status move inflicts and poison ticks 1/8 max HP at end of turn', () => {
    const rng = new FixedRNG(0.5);
    const player = mk('nibbit', 15, ['growl']);
    const foe = mk('murklob', 15, ['toxin']);
    const e = engine([player], [foe], rng);
    const maxHp = calcStats(player).hp;
    const events = e.executeTurn({ type: 'move', moveIndex: 0 });
    expect(player.status).toBe('poison');
    const tick = Math.max(1, Math.floor(maxHp / 8));
    const playerHpEvents = events.filter((ev) => ev.t === 'hp' && ev.side === 'player') as Extract<BattleEvent, { t: 'hp' }>[];
    expect(playerHpEvents[playerHpEvents.length - 1].hp).toBe(maxHp - tick);
  });

  it('a second status cannot stack', () => {
    const rng = new FixedRNG(0.5);
    const player = mk('nibbit', 15, ['growl']);
    player.status = 'burn';
    const foe = mk('murklob', 15, ['toxin']);
    const e = engine([player], [foe], rng);
    e.executeTurn({ type: 'move', moveIndex: 0 });
    expect(player.status).toBe('burn');
  });

  it('protect blocks damage', () => {
    const rng = new FixedRNG(0.5);
    const player = mk('glimkit', 20, ['protect']);
    const foe = mk('gnawber', 20, ['tackle']);
    const e = engine([player], [foe], rng);
    const before = player.hp;
    const msgs = texts(e.executeTurn({ type: 'move', moveIndex: 0 }));
    expect(msgs.some((m) => m.includes('protected itself'))).toBe(true);
    expect(player.hp).toBe(before);
  });
});

describe('PP and Struggle', () => {
  it('PP depletes on use', () => {
    const rng = new FixedRNG(0.5);
    const player = mk('emberling', 10, ['ember']);
    const foe = mk('pebblit', 10, ['tackle']);
    const e = engine([player], [foe], rng);
    const before = player.moves[0].pp;
    e.executeTurn({ type: 'move', moveIndex: 0 });
    expect(player.moves[0].pp).toBe(before - 1);
  });

  it('struggle works when out of PP', () => {
    const rng = new FixedRNG(0.5);
    const player = mk('emberling', 10, ['ember']);
    player.moves[0].pp = 0;
    const foe = mk('pebblit', 10, ['tackle']);
    const e = engine([player], [foe], rng);
    const msgs = texts(e.executeTurn({ type: 'move', moveIndex: -1 }));
    expect(msgs.some((m) => m.includes('used Struggle'))).toBe(true);
  });
});

describe('fainting and battle end', () => {
  it('foe faints → EXP awarded → wild battle won', () => {
    const rng = new FixedRNG(0.5);
    const player = mk('flarewolf', 30, ['scorch']);
    const foe = mk('larvit', 3, ['tackle']);
    const e = engine([player], [foe], rng);
    const expBefore = player.exp;
    const events = e.executeTurn({ type: 'move', moveIndex: 0 });
    expect(events.some((ev) => ev.t === 'faint' && ev.side === 'foe')).toBe(true);
    expect(events.some((ev) => ev.t === 'exp')).toBe(true);
    expect(player.exp).toBeGreaterThan(expBefore);
    expect(e.ended).toBe(true);
    expect(e.outcome).toBe('win');
  });

  it('player faint with party left → forced switch, then continues', () => {
    const rng = new FixedRNG(0.5);
    const weak = mk('larvit', 2, ['tackle']);
    weak.hp = 1;
    const backup = mk('chirpuff', 12, ['gustcut']);
    const foe = mk('flarewolf', 25, ['scorch']);
    const e = engine([weak, backup], [foe], rng);
    e.executeTurn({ type: 'move', moveIndex: 0 });
    expect(e.awaitingPlayerSwitch).toBe(true);
    expect(e.ended).toBe(false);
    const events = e.resolveSwitch(1);
    expect(events.some((ev) => ev.t === 'switch' && ev.side === 'player')).toBe(true);
    expect(e.awaitingPlayerSwitch).toBe(false);
  });

  it('whole party fainted → loss', () => {
    const rng = new FixedRNG(0.5);
    const weak = mk('larvit', 2, ['tackle']);
    weak.hp = 1;
    const foe = mk('flarewolf', 25, ['scorch']);
    const e = engine([weak], [foe], rng);
    e.executeTurn({ type: 'move', moveIndex: 0 });
    expect(e.ended).toBe(true);
    expect(e.outcome).toBe('loss');
  });

  it('trainer foe sends next creature after a faint', () => {
    const rng = new FixedRNG(0.5);
    const player = mk('flarewolf', 30, ['scorch']);
    const foe1 = mk('larvit', 3, ['tackle']);
    const foe2 = mk('nibbit', 10, ['tackle']);
    const e = engine([player], [foe1, foe2], rng, 'trainer');
    const events = e.executeTurn({ type: 'move', moveIndex: 0 });
    expect(e.ended).toBe(false);
    expect(events.some((ev) => ev.t === 'switch' && ev.side === 'foe' && ev.speciesId === 'nibbit')).toBe(true);
  });
});

describe('capture and escape', () => {
  it('master ball always captures in wild battles', () => {
    const rng = new FixedRNG(0.5);
    const player = mk('emberling', 10, ['ember']);
    const foe = mk('umbralis', 50, ['voidpulse']);
    const e = engine([player], [foe], rng);
    const events = e.executeTurn({ type: 'ball', ballId: 'masterball' });
    expect(events.some((ev) => ev.t === 'ballThrow' && ev.caught)).toBe(true);
    expect(e.outcome).toBe('caught');
    expect(e.capturedCreature).toBe(foe);
  });

  it('balls are refused in trainer battles', () => {
    const rng = new FixedRNG(0.5);
    const player = mk('emberling', 10, ['ember']);
    const foe = mk('nibbit', 10, ['tackle']);
    const e = engine([player], [foe], rng, 'trainer');
    const msgs = texts(e.executeTurn({ type: 'ball', ballId: 'basicball' }));
    expect(msgs.some((m) => m.includes("can't catch"))).toBe(true);
    expect(e.ended).toBe(false);
  });

  it('faster creature always escapes', () => {
    const rng = new FixedRNG(0.5);
    const player = mk('voltail', 30, ['sparkshot']);
    const foe = mk('golemite', 10, ['rocktoss']);
    const e = engine([player], [foe], rng);
    e.executeTurn({ type: 'run' });
    expect(e.outcome).toBe('fled');
  });
});

describe('determinism', () => {
  it('identical seeds produce identical battles', () => {
    const play = (seed: number) => {
      const rng = new RNG(seed);
      const player = createCreature(new RNG(5), 'emberling', 12, { moveIds: ['ember', 'scratch'] });
      const foe = createCreature(new RNG(6), 'pebblit', 12, { moveIds: ['rocktoss', 'tackle'] });
      const e = new BattleEngine({ kind: 'wild', playerParty: [player], foeParty: [foe] }, rng);
      const log: string[] = [];
      log.push(...texts(e.start()));
      for (let i = 0; i < 10 && !e.ended && !e.awaitingPlayerSwitch; i++) {
        log.push(...texts(e.executeTurn({ type: 'move', moveIndex: i % 2 })));
      }
      return log.join('|');
    };
    expect(play(777)).toBe(play(777));
    });
});
