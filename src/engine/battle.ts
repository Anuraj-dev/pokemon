/**
 * battle-engine — a pure, deterministic, turn-based battle state machine.
 * Given a battle state and chosen actions it mutates its own state and
 * returns an ordered event log for the presentation layer to animate.
 * No Phaser imports.
 */
import type { RNG } from '../core/rng';
import { moveById, type MoveData, type NonVolatileStatus } from '../data/moves';
import { effectiveness, type TypeId } from '../data/types';
import { speciesById } from '../data/species';
import { abilityById, type AbilityEffect } from '../data/abilities';
import { itemById } from '../data/items';
import {
  type CreatureInstance,
  calcStats,
  displayName,
  expGain,
  addExp,
  applyEvGain,
  type Stats,
} from './creature';
import { attemptCapture } from './capture';

export type Side = 'player' | 'foe';

export type StageKey = 'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'acc' | 'eva';

export interface Volatiles {
  confusionTurns: number; // 0 = not confused
  flinched: boolean;
  protected: boolean;
  protectStreak: number;
  charging: string | null; // moveId being charged
  seeded: boolean;
  sleepTurns: number; // counts down while asleep
  sashConsumed: boolean;
  berryConsumed: boolean;
}

export interface Battler {
  creature: CreatureInstance;
  stages: Record<StageKey, number>;
  volatiles: Volatiles;
}

export type BattleAction =
  | { type: 'move'; moveIndex: number }
  | { type: 'switch'; partyIndex: number }
  | { type: 'item' } // item already applied by caller; consumes the turn
  | { type: 'ball'; ballId: string }
  | { type: 'run' };

export type BattleEvent =
  | { t: 'text'; msg: string }
  | { t: 'moveAnim'; side: Side; moveId: string; moveType: TypeId; category: string }
  | { t: 'hp'; side: Side; hp: number; maxHp: number }
  | { t: 'effectiveness'; mult: number }
  | { t: 'crit' }
  | { t: 'faint'; side: Side }
  | { t: 'switch'; side: Side; speciesId: string; name: string; level: number }
  | { t: 'status'; side: Side; status: NonVolatileStatus | null }
  | { t: 'stat'; side: Side; stat: StageKey; delta: number }
  | { t: 'ballThrow'; shakes: number; caught: boolean }
  | { t: 'exp'; uid: string; amount: number }
  | { t: 'levelup'; uid: string; level: number }
  | { t: 'learnMove'; uid: string; moveId: string }
  | { t: 'end'; outcome: 'win' | 'loss' | 'fled' | 'caught' };

export interface BattleConfig {
  kind: 'wild' | 'trainer';
  playerParty: CreatureInstance[];
  foeParty: CreatureInstance[];
  foeName?: string; // trainer display name, e.g. "Leader Erika"
  foeIsSmart?: boolean; // gym leaders & co. pick the strongest move
  canRun?: boolean;
  canCatch?: boolean;
}

function freshVolatiles(): Volatiles {
  return {
    confusionTurns: 0,
    flinched: false,
    protected: false,
    protectStreak: 0,
    charging: null,
    seeded: false,
    sleepTurns: 0,
    sashConsumed: false,
    berryConsumed: false,
  };
}

function freshStages(): Record<StageKey, number> {
  return { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 };
}

function stageMult(stage: number): number {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}

function accStageMult(stage: number): number {
  return stage >= 0 ? (3 + stage) / 3 : 3 / (3 - stage);
}

/** Last-resort move when every slot is out of PP (moveIndex -1). */
export const STRUGGLE: MoveData = {
  id: 'struggle',
  name: 'Struggle',
  type: 'terra',
  category: 'physical',
  power: 40,
  accuracy: 0,
  pp: 1,
  typeless: true,
  effects: [{ kind: 'recoil', fraction: 0.25 }],
  desc: 'Used in desperation when no PP remains.',
};

const STAT_LABEL: Record<StageKey, string> = {
  atk: 'Attack',
  def: 'Defense',
  spa: 'Sp. Atk',
  spd: 'Sp. Def',
  spe: 'Speed',
  acc: 'accuracy',
  eva: 'evasiveness',
};

export class BattleEngine {
  readonly kind: 'wild' | 'trainer';
  readonly playerParty: CreatureInstance[];
  readonly foeParty: CreatureInstance[];
  readonly foeName?: string;
  readonly foeIsSmart: boolean;
  readonly canRun: boolean;
  readonly canCatch: boolean;

  player!: Battler;
  foe!: Battler;
  ended = false;
  outcome: 'win' | 'loss' | 'fled' | 'caught' | null = null;
  /** set when the player's active fainted and a switch is required mid-flow */
  awaitingPlayerSwitch = false;
  capturedCreature: CreatureInstance | null = null;
  runAttempts = 0;
  turn = 0;
  /** uids of player creatures that have faced the current foe creature */
  private participants = new Set<string>();

  private rng: RNG;
  private events: BattleEvent[] = [];

  constructor(cfg: BattleConfig, rng: RNG) {
    this.kind = cfg.kind;
    this.playerParty = cfg.playerParty;
    this.foeParty = cfg.foeParty;
    this.foeName = cfg.foeName;
    this.foeIsSmart = cfg.foeIsSmart ?? false;
    this.canRun = cfg.canRun ?? cfg.kind === 'wild';
    this.canCatch = cfg.canCatch ?? cfg.kind === 'wild';
    this.rng = rng;
  }

  /** Begin the battle: send out both leads. Returns intro events. */
  start(): BattleEvent[] {
    this.events = [];
    const playerLead = this.playerParty.findIndex((c) => c.hp > 0);
    this.player = { creature: this.playerParty[playerLead], stages: freshStages(), volatiles: freshVolatiles() };
    this.foe = { creature: this.foeParty[0], stages: freshStages(), volatiles: freshVolatiles() };
    const foeC = this.foe.creature;
    if (this.kind === 'wild') {
      this.emit({ t: 'text', msg: `A wild ${displayName(foeC)} appeared!` });
    } else {
      this.emit({ t: 'text', msg: `${this.foeName ?? 'Trainer'} sent out ${displayName(foeC)}!` });
    }
    this.emit({ t: 'switch', side: 'foe', speciesId: foeC.speciesId, name: displayName(foeC), level: foeC.level });
    this.emit({ t: 'text', msg: `Go, ${displayName(this.player.creature)}!` });
    this.emit({
      t: 'switch',
      side: 'player',
      speciesId: this.player.creature.speciesId,
      name: displayName(this.player.creature),
      level: this.player.creature.level,
    });
    this.participants.add(this.player.creature.uid);
    this.fireSwitchInAbility('foe');
    this.fireSwitchInAbility('player');
    return this.flush();
  }

  // ---------------------------------------------------------------- helpers

  private emit(e: BattleEvent) {
    this.events.push(e);
  }

  private flush(): BattleEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  private battler(side: Side): Battler {
    return side === 'player' ? this.player : this.foe;
  }

  private other(side: Side): Side {
    return side === 'player' ? 'foe' : 'player';
  }

  private name(side: Side): string {
    const n = displayName(this.battler(side).creature);
    return side === 'foe' ? (this.kind === 'wild' ? `The wild ${n}` : `The foe's ${n}`) : n;
  }

  private ability(side: Side): AbilityEffect {
    return abilityById(speciesById(this.battler(side).creature.speciesId).ability).effect;
  }

  private heldEffect(side: Side) {
    const item = this.battler(side).creature.heldItem;
    return item ? itemById(item).effect : null;
  }

  private types(side: Side): TypeId[] {
    return speciesById(this.battler(side).creature.speciesId).types;
  }

  private stats(side: Side): Stats {
    return calcStats(this.battler(side).creature);
  }

  private effSpeed(side: Side): number {
    const b = this.battler(side);
    let spe = this.stats(side).spe * stageMult(b.stages.spe);
    if (b.creature.status === 'paralysis') spe = Math.floor(spe / 2);
    const ab = this.ability(side);
    return Math.floor(spe);
  }

  // ------------------------------------------------------------- main turn

  /**
   * Execute one full turn. The foe's action is chosen internally.
   * If the player's creature faints with party remaining, the engine stops
   * mid-turn with awaitingPlayerSwitch=true; call resolveSwitch() next.
   */
  executeTurn(playerAction: BattleAction): BattleEvent[] {
    if (this.ended || this.awaitingPlayerSwitch) return [];
    this.turn++;
    this.events = [];

    // Run attempt resolves before anything else.
    if (playerAction.type === 'run') {
      this.tryRun();
      return this.flush();
    }
    if (playerAction.type === 'ball') {
      this.throwBall(playerAction.ballId);
      if (!this.ended) this.foeTakesFreeTurn();
      return this.flush();
    }

    const foeAction = this.chooseFoeAction();

    // Charging overrides chosen action.
    const pAct = this.player.volatiles.charging
      ? ({ type: 'move', moveIndex: this.chargingIndex('player') } as BattleAction)
      : playerAction;
    const fAct = this.foe.volatiles.charging
      ? ({ type: 'move', moveIndex: this.chargingIndex('foe') } as BattleAction)
      : foeAction;

    const order = this.actionOrder(pAct, fAct);
    for (const side of order) {
      if (this.ended) break;
      const act = side === 'player' ? pAct : fAct;
      this.performAction(side, act);
      if (this.awaitingPlayerSwitch) return this.flush();
    }

    if (!this.ended && !this.awaitingPlayerSwitch) this.endOfTurn();
    return this.flush();
  }

  /** After awaitingPlayerSwitch, bring in the chosen party member. */
  resolveSwitch(partyIndex: number): BattleEvent[] {
    this.events = [];
    if (!this.awaitingPlayerSwitch) return [];
    this.awaitingPlayerSwitch = false;
    this.switchIn('player', partyIndex);
    return this.flush();
  }

  private chargingIndex(side: Side): number {
    const b = this.battler(side);
    const idx = b.creature.moves.findIndex((m) => m.id === b.volatiles.charging);
    return Math.max(0, idx);
  }

  private actionOrder(pAct: BattleAction, fAct: BattleAction): Side[] {
    const prio = (side: Side, act: BattleAction): number => {
      if (act.type === 'switch' || act.type === 'item') return 6;
      if (act.type === 'move') {
        const slot = this.battler(side).creature.moves[act.moveIndex];
        if (slot) return moveById(slot.id).priority ?? 0;
      }
      return 0;
    };
    const pPrio = prio('player', pAct);
    const fPrio = prio('foe', fAct);
    if (pPrio !== fPrio) return pPrio > fPrio ? ['player', 'foe'] : ['foe', 'player'];
    const pSpe = this.effSpeed('player');
    const fSpe = this.effSpeed('foe');
    if (pSpe !== fSpe) return pSpe > fSpe ? ['player', 'foe'] : ['foe', 'player'];
    return this.rng.chance(0.5) ? ['player', 'foe'] : ['foe', 'player'];
  }

  // ------------------------------------------------------------ actions

  private performAction(side: Side, act: BattleAction) {
    const b = this.battler(side);
    if (b.creature.hp <= 0) return;
    switch (act.type) {
      case 'switch':
        if (side === 'player') this.switchIn('player', act.partyIndex);
        break;
      case 'item':
        // effect already applied by the caller; just narrate nothing extra
        break;
      case 'move':
        this.useMove(side, act.moveIndex);
        break;
      case 'ball':
      case 'run':
        break; // handled earlier
    }
  }

  private switchIn(side: Side, partyIndex: number) {
    const party = side === 'player' ? this.playerParty : this.foeParty;
    const incoming = party[partyIndex];
    if (!incoming || incoming.hp <= 0) return;
    const b = this.battler(side);
    const wasOut = b.creature.hp > 0;
    if (wasOut) this.emit({ t: 'text', msg: `${this.name(side)} was recalled!` });
    if (side === 'player') {
      this.player = { creature: incoming, stages: freshStages(), volatiles: freshVolatiles() };
      this.emit({ t: 'text', msg: `Go, ${displayName(incoming)}!` });
    } else {
      this.foe = { creature: incoming, stages: freshStages(), volatiles: freshVolatiles() };
      this.emit({ t: 'text', msg: `${this.foeName ?? 'The trainer'} sent out ${displayName(incoming)}!` });
      this.participants = new Set([this.player.creature.uid]);
    }
    this.emit({ t: 'switch', side, speciesId: incoming.speciesId, name: displayName(incoming), level: incoming.level });
    if (side === 'player') this.participants.add(incoming.uid);
    this.fireSwitchInAbility(side);
  }

  private fireSwitchInAbility(side: Side) {
    const ab = this.ability(side);
    if (ab.kind === 'intimidate') {
      const foeSide = this.other(side);
      if (this.battler(foeSide).creature.hp > 0) {
        const abilityName = abilityById(speciesById(this.battler(side).creature.speciesId).ability).name;
        this.emit({ t: 'text', msg: `${this.name(side)}'s ${abilityName} cuts ${this.name(foeSide)}'s Attack!` });
        this.applyStages(foeSide, { atk: -1 }, true);
      }
    }
  }

  private tryRun() {
    if (!this.canRun) {
      this.emit({ t: 'text', msg: `You can't run from a trainer battle!` });
      return;
    }
    this.runAttempts++;
    const pSpe = this.effSpeed('player');
    const fSpe = this.effSpeed('foe');
    let escaped = false;
    if (pSpe >= fSpe) escaped = true;
    else {
      const f = Math.floor((pSpe * 128) / Math.max(1, fSpe) + 30 * this.runAttempts) % 256;
      escaped = this.rng.int(0, 255) < f;
    }
    if (escaped) {
      this.emit({ t: 'text', msg: 'Got away safely!' });
      this.ended = true;
      this.outcome = 'fled';
      this.emit({ t: 'end', outcome: 'fled' });
    } else {
      this.emit({ t: 'text', msg: `Can't escape!` });
      this.foeTakesFreeTurn();
    }
  }

  private foeTakesFreeTurn() {
    if (this.ended) return;
    const act = this.foe.volatiles.charging
      ? ({ type: 'move', moveIndex: this.chargingIndex('foe') } as BattleAction)
      : this.chooseFoeAction();
    this.performAction('foe', act);
    if (!this.ended && !this.awaitingPlayerSwitch) this.endOfTurn();
  }

  private throwBall(ballId: string) {
    const item = itemById(ballId);
    if (item.effect.kind !== 'ball') return;
    if (!this.canCatch) {
      this.emit({ t: 'text', msg: `You can't catch another trainer's creature!` });
      return;
    }
    const target = this.foe.creature;
    const maxHp = calcStats(target).hp;
    const sp = speciesById(target.speciesId);
    this.emit({ t: 'text', msg: `You threw a ${item.name}!` });
    const result = attemptCapture(this.rng, maxHp, target.hp, sp.catchRate, item.effect.bonus, target.status, item.effect.master);
    this.emit({ t: 'ballThrow', shakes: result.shakes, caught: result.caught });
    if (result.caught) {
      this.emit({ t: 'text', msg: `Gotcha! ${displayName(target)} was caught!` });
      this.capturedCreature = target;
      this.ended = true;
      this.outcome = 'caught';
      this.emit({ t: 'end', outcome: 'caught' });
    } else {
      const flavor = [
        'Oh no! It broke free!',
        'Aargh! Almost had it!',
        'Shoot! It was so close, too!',
        'It appeared to be caught!',
      ][Math.min(3, result.shakes)];
      this.emit({ t: 'text', msg: flavor });
    }
  }

  // ------------------------------------------------------------ move use

  private useMove(side: Side, moveIndex: number) {
    const b = this.battler(side);
    const foeSide = this.other(side);
    const f = this.battler(foeSide);
    const c = b.creature;

    // Pre-move status interruptions
    if (b.volatiles.flinched) {
      this.emit({ t: 'text', msg: `${this.name(side)} flinched and couldn't move!` });
      b.volatiles.flinched = false;
      return;
    }
    if (c.status === 'sleep') {
      if (b.volatiles.sleepTurns > 0) {
        b.volatiles.sleepTurns--;
        this.emit({ t: 'text', msg: `${this.name(side)} is fast asleep.` });
        return;
      }
      c.status = null;
      this.emit({ t: 'status', side, status: null });
      this.emit({ t: 'text', msg: `${this.name(side)} woke up!` });
    }
    if (c.status === 'freeze') {
      if (this.rng.chance(0.2)) {
        c.status = null;
        this.emit({ t: 'status', side, status: null });
        this.emit({ t: 'text', msg: `${this.name(side)} thawed out!` });
      } else {
        this.emit({ t: 'text', msg: `${this.name(side)} is frozen solid!` });
        return;
      }
    }
    if (c.status === 'paralysis' && this.rng.chance(0.25)) {
      this.emit({ t: 'text', msg: `${this.name(side)} is paralyzed! It can't move!` });
      b.volatiles.charging = null;
      return;
    }
    if (b.volatiles.confusionTurns > 0) {
      b.volatiles.confusionTurns--;
      if (b.volatiles.confusionTurns === 0) {
        this.emit({ t: 'text', msg: `${this.name(side)} snapped out of confusion!` });
      } else {
        this.emit({ t: 'text', msg: `${this.name(side)} is confused!` });
        if (this.rng.chance(1 / 3)) {
          this.emit({ t: 'text', msg: 'It hurt itself in its confusion!' });
          const stats = this.stats(side);
          const atk = stats.atk * stageMult(b.stages.atk);
          const def = stats.def * stageMult(b.stages.def);
          const dmg = Math.max(1, Math.floor((((2 * c.level) / 5 + 2) * 40 * (atk / def)) / 50 + 2));
          this.dealDamage(side, dmg);
          b.volatiles.charging = null;
          if (this.checkFaint(side)) return;
          return;
        }
      }
    }

    const struggle = moveIndex === -1;
    const slot = struggle ? null : c.moves[moveIndex];
    if (!struggle && !slot) return;
    const move = struggle ? STRUGGLE : moveById(slot!.id);

    // Charging two-turn moves
    const chargeEffect = move.effects?.find((e) => e.kind === 'charge');
    if (chargeEffect && chargeEffect.kind === 'charge') {
      if (b.volatiles.charging !== move.id) {
        b.volatiles.charging = move.id;
        this.emit({ t: 'text', msg: `${this.name(side)} ${chargeEffect.message}` });
        return;
      }
      b.volatiles.charging = null;
    }

    if (slot) {
      if (slot.pp <= 0) {
        this.emit({ t: 'text', msg: `${this.name(side)} has no PP left for ${move.name}!` });
        return;
      }
      slot.pp--;
    }

    this.emit({ t: 'text', msg: `${this.name(side)} used ${move.name}!` });

    // Protect
    if (move.effects?.some((e) => e.kind === 'protect')) {
      const odds = 1 / Math.pow(2, b.volatiles.protectStreak);
      if (this.rng.chance(odds)) {
        b.volatiles.protected = true;
        b.volatiles.protectStreak++;
        this.emit({ t: 'text', msg: `${this.name(side)} protected itself!` });
      } else {
        b.volatiles.protectStreak = 0;
        this.emit({ t: 'text', msg: 'But it failed!' });
      }
      return;
    }
    b.volatiles.protectStreak = 0;

    // Rest
    if (move.effects?.some((e) => e.kind === 'rest')) {
      const max = calcStats(c).hp;
      if (c.hp >= max) {
        this.emit({ t: 'text', msg: 'But it failed!' });
        return;
      }
      c.hp = max;
      c.status = 'sleep';
      b.volatiles.sleepTurns = 2;
      this.emit({ t: 'status', side, status: 'sleep' });
      this.emit({ t: 'hp', side, hp: c.hp, maxHp: max });
      this.emit({ t: 'text', msg: `${this.name(side)} slept and became healthy!` });
      return;
    }

    // Self-heal status moves
    const healEffect = move.effects?.find((e) => e.kind === 'heal');
    if (move.category === 'status' && healEffect && healEffect.kind === 'heal') {
      const max = calcStats(c).hp;
      if (c.hp >= max) {
        this.emit({ t: 'text', msg: 'But it failed!' });
        return;
      }
      c.hp = Math.min(max, c.hp + Math.floor(max * healEffect.fraction));
      this.emit({ t: 'hp', side, hp: c.hp, maxHp: max });
      this.emit({ t: 'text', msg: `${this.name(side)} regained health!` });
      return;
    }

    // Target protection
    if (f.volatiles.protected && move.category !== 'status') {
      this.emit({ t: 'text', msg: `${this.name(foeSide)} protected itself!` });
      return;
    }

    // Self-targeting stage moves never miss
    const selfStages = move.effects?.find((e) => e.kind === 'stages' && e.target === 'self');
    if (move.category === 'status' && selfStages && selfStages.kind === 'stages') {
      this.applyStages(side, selfStages.stages, false);
      return;
    }

    // Accuracy check
    if (!this.accuracyCheck(side, foeSide, move)) {
      this.emit({ t: 'text', msg: `${this.name(side)}'s attack missed!` });
      return;
    }

    // every move animates — status moves get their own recipes too
    this.emit({ t: 'moveAnim', side, moveId: move.id, moveType: move.type, category: move.category });

    if (move.category === 'status') {
      this.applyStatusMove(side, foeSide, move);
      return;
    }

    const foeTypes = this.types(foeSide);
    const foeAbility = this.ability(foeSide);
    if (!move.typeless && foeAbility.kind === 'typeImmune' && foeAbility.type === move.type) {
      const abName = abilityById(speciesById(f.creature.speciesId).ability).name;
      this.emit({ t: 'text', msg: `It doesn't affect ${this.name(foeSide)}... (${abName})` });
      return;
    }
    const typeMult = move.typeless ? 1 : effectiveness(move.type, foeTypes);
    if (typeMult === 0) {
      this.emit({ t: 'text', msg: `It doesn't affect ${this.name(foeSide)}...` });
      return;
    }

    const multihit = move.effects?.find((e) => e.kind === 'multihit');
    const hits = multihit ? this.rng.weighted([
      { item: 2, weight: 35 }, { item: 3, weight: 35 }, { item: 4, weight: 15 }, { item: 5, weight: 15 },
    ]) : 1;

    let totalDamage = 0;
    let lastCrit = false;
    for (let h = 0; h < hits; h++) {
      if (f.creature.hp <= 0) break;
      const { damage, crit } = this.computeDamage(side, foeSide, move, typeMult);
      lastCrit = crit;
      const dealt = this.dealDamage(foeSide, damage);
      totalDamage += dealt;
      if (crit) this.emit({ t: 'crit' });
    }
    if (hits > 1) this.emit({ t: 'text', msg: `Hit ${hits} time(s)!` });
    if (lastCrit) this.emit({ t: 'text', msg: 'A critical hit!' });
    if (typeMult > 1) this.emit({ t: 'text', msg: `It's super effective!` });
    else if (typeMult < 1) this.emit({ t: 'text', msg: `It's not very effective...` });
    this.emit({ t: 'effectiveness', mult: typeMult });

    // Inferno moves thaw a frozen target
    if (move.type === 'inferno' && f.creature.status === 'freeze' && f.creature.hp > 0) {
      f.creature.status = null;
      this.emit({ t: 'status', side: foeSide, status: null });
      this.emit({ t: 'text', msg: `${this.name(foeSide)} thawed out!` });
    }

    // Secondary effects
    if (f.creature.hp > 0 && move.effects) {
      for (const eff of move.effects) {
        switch (eff.kind) {
          case 'status':
            if (this.rng.chance(eff.chance)) this.tryInflictStatus(foeSide, eff.status, false);
            break;
          case 'stages':
            if (this.rng.chance(eff.chance ?? 1)) {
              this.applyStages(eff.target === 'self' ? side : foeSide, eff.stages, eff.target !== 'self');
            }
            break;
          case 'flinch':
            if (this.rng.chance(eff.chance)) f.volatiles.flinched = true;
            break;
          case 'confuse':
            if (this.rng.chance(eff.chance) && f.volatiles.confusionTurns === 0) {
              f.volatiles.confusionTurns = this.rng.int(2, 4);
              this.emit({ t: 'text', msg: `${this.name(foeSide)} became confused!` });
            }
            break;
          default:
            break;
        }
      }
    }
    // Drain / recoil
    const drain = move.effects?.find((e) => e.kind === 'drain');
    if (drain && drain.kind === 'drain' && totalDamage > 0) {
      const max = calcStats(c).hp;
      c.hp = Math.min(max, c.hp + Math.max(1, Math.floor(totalDamage * drain.fraction)));
      this.emit({ t: 'hp', side, hp: c.hp, maxHp: max });
      this.emit({ t: 'text', msg: `${this.name(foeSide)} had its energy drained!` });
    }
    const recoil = move.effects?.find((e) => e.kind === 'recoil');
    if (recoil && recoil.kind === 'recoil' && totalDamage > 0) {
      this.emit({ t: 'text', msg: `${this.name(side)} is damaged by recoil!` });
      this.dealDamage(side, Math.max(1, Math.floor(totalDamage * recoil.fraction)));
    }
    if (move.effects?.some((e) => e.kind === 'selfdestruct')) {
      this.dealDamage(side, c.hp);
    }

    // Contact abilities (physical moves count as contact)
    if (move.category === 'physical' && f.creature.hp > 0 && c.hp > 0) {
      const fAb = this.ability(foeSide);
      if (fAb.kind === 'contactStatus' && this.rng.chance(fAb.chance)) {
        this.tryInflictStatus(side, fAb.status, true);
      }
    }

    this.afterDamageItemChecks(foeSide);
    this.afterDamageItemChecks(side);

    this.checkFaint(foeSide);
    this.checkFaint(side);
  }

  private accuracyCheck(side: Side, foeSide: Side, move: MoveData): boolean {
    if (move.accuracy <= 0) return true;
    const b = this.battler(side);
    const f = this.battler(foeSide);
    const keenEye = this.ability(side).kind === 'keeneye';
    const accStage = keenEye ? Math.max(0, b.stages.acc) : b.stages.acc;
    const evaStage = keenEye ? 0 : f.stages.eva;
    const stage = Math.max(-6, Math.min(6, accStage - evaStage));
    const chance = (move.accuracy / 100) * accStageMult(stage);
    return this.rng.chance(Math.min(1, chance));
  }

  private computeDamage(side: Side, foeSide: Side, move: MoveData, typeMult: number): { damage: number; crit: boolean } {
    const b = this.battler(side);
    const f = this.battler(foeSide);
    const c = b.creature;

    // Fixed level damage
    if (move.effects?.some((e) => e.kind === 'leveldamage')) {
      return { damage: c.level, crit: false };
    }

    // Crit determination
    let critDenom = move.effects?.some((e) => e.kind === 'highcrit') ? 8 : 24;
    const held = this.heldEffect(side);
    if (held?.kind === 'heldCritBoost') critDenom = Math.max(2, Math.floor(critDenom / 3));
    let crit = this.rng.chance(1 / critDenom);
    if (this.ability(foeSide).kind === 'shellguard') crit = false;

    const atkStats = this.stats(side);
    const defStats = this.stats(foeSide);
    const physical = move.category === 'physical';
    let atkStage = physical ? b.stages.atk : b.stages.spa;
    let defStage = physical ? f.stages.def : f.stages.spd;
    if (crit) {
      atkStage = Math.max(0, atkStage); // crits ignore the attacker's drops
      defStage = Math.min(0, defStage); // and the defender's boosts
    }
    let atk = (physical ? atkStats.atk : atkStats.spa) * stageMult(atkStage);
    const def = (physical ? defStats.def : defStats.spd) * stageMult(defStage);

    const ab = this.ability(side);
    if (ab.kind === 'guts' && c.status) atk *= 1.5;

    let power = move.power;
    if (ab.kind === 'technician' && power <= 60) power *= 1.5;
    if (!move.typeless && ab.kind === 'pinchBoost' && move.type === ab.type && c.hp <= Math.floor(calcStats(c).hp / 3)) {
      power *= 1.5;
    }

    const stabBase = !move.typeless && this.types(side).includes(move.type) ? (ab.kind === 'adaptive' ? 2 : 1.5) : 1;
    const critMult = crit ? 1.5 : 1;
    const rand = 0.85 + this.rng.next() * 0.15;
    const burnMult = physical && c.status === 'burn' && ab.kind !== 'guts' ? 0.5 : 1;
    let itemMult = 1;
    if (held?.kind === 'heldTypeBoost' && held.type === move.type && !move.typeless) itemMult = held.mult;
    let filterMult = 1;
    if (this.ability(foeSide).kind === 'filter' && typeMult > 1) filterMult = 0.75;

    const baseDmg = (((2 * c.level) / 5 + 2) * power * (atk / def)) / 50 + 2;
    const modifier = stabBase * typeMult * critMult * rand * burnMult * itemMult * filterMult;
    const damage = Math.max(1, Math.floor(baseDmg * modifier));
    return { damage, crit };
  }

  /** Apply damage with sturdy/sash checks; returns actual HP lost. */
  private dealDamage(side: Side, amount: number): number {
    const b = this.battler(side);
    const c = b.creature;
    const max = calcStats(c).hp;
    let dmg = Math.min(c.hp, amount);
    const wasFull = c.hp === max;
    if (dmg >= c.hp && wasFull) {
      const ab = this.ability(side);
      const held = this.heldEffect(side);
      if (ab.kind === 'sturdy') {
        dmg = c.hp - 1;
        this.emit({ t: 'text', msg: `${this.name(side)} endured the hit with Stonewall!` });
      } else if (held?.kind === 'heldFocusSash' && !b.volatiles.sashConsumed) {
        dmg = c.hp - 1;
        b.volatiles.sashConsumed = true;
        c.heldItem = null;
        this.emit({ t: 'text', msg: `${this.name(side)} hung on using its Focus Sash!` });
      }
    }
    c.hp -= dmg;
    this.emit({ t: 'hp', side, hp: c.hp, maxHp: max });
    return dmg;
  }

  private afterDamageItemChecks(side: Side) {
    const b = this.battler(side);
    const c = b.creature;
    if (c.hp <= 0) return;
    const held = this.heldEffect(side);
    const max = calcStats(c).hp;
    if (held?.kind === 'heldHealBerry' && !b.volatiles.berryConsumed && c.hp <= max * held.threshold) {
      b.volatiles.berryConsumed = true;
      const itemName = itemById(c.heldItem!).name;
      c.heldItem = null;
      c.hp = Math.min(max, c.hp + Math.floor(max * held.fraction));
      this.emit({ t: 'text', msg: `${this.name(side)} ate its ${itemName} and recovered!` });
      this.emit({ t: 'hp', side, hp: c.hp, maxHp: max });
    }
    if (held?.kind === 'heldStatusBerry' && c.status) {
      const itemName = itemById(c.heldItem!).name;
      c.heldItem = null;
      c.status = null;
      this.emit({ t: 'status', side, status: null });
      this.emit({ t: 'text', msg: `${this.name(side)}'s ${itemName} cured its status!` });
    }
  }

  private applyStatusMove(side: Side, foeSide: Side, move: MoveData) {
    if (!move.effects) {
      this.emit({ t: 'text', msg: 'But nothing happened!' });
      return;
    }
    for (const eff of move.effects) {
      switch (eff.kind) {
        case 'status':
          this.tryInflictStatus(foeSide, eff.status, true);
          break;
        case 'stages':
          this.applyStages(eff.target === 'self' ? side : foeSide, eff.stages, eff.target !== 'self');
          break;
        case 'leech': {
          const f = this.battler(foeSide);
          if (this.types(foeSide).includes('verdant')) {
            this.emit({ t: 'text', msg: `It doesn't affect ${this.name(foeSide)}...` });
          } else if (f.volatiles.seeded) {
            this.emit({ t: 'text', msg: 'But it failed!' });
          } else {
            f.volatiles.seeded = true;
            this.emit({ t: 'text', msg: `${this.name(foeSide)} was seeded!` });
          }
          break;
        }
        case 'confuse': {
          const f = this.battler(foeSide);
          if (f.volatiles.confusionTurns === 0) {
            f.volatiles.confusionTurns = this.rng.int(2, 4);
            this.emit({ t: 'text', msg: `${this.name(foeSide)} became confused!` });
          } else {
            this.emit({ t: 'text', msg: 'But it failed!' });
          }
          break;
        }
        default:
          break;
      }
    }
  }

  private tryInflictStatus(side: Side, status: NonVolatileStatus, announceFail: boolean) {
    const b = this.battler(side);
    const c = b.creature;
    if (c.hp <= 0) return;
    if (c.status) {
      if (announceFail) this.emit({ t: 'text', msg: `${this.name(side)} is already ${describeStatus(c.status)}!` });
      return;
    }
    const ab = this.ability(side);
    if (ab.kind === 'statusImmune' && (ab.status === 'all' || ab.status === status)) {
      if (announceFail) this.emit({ t: 'text', msg: `It doesn't affect ${this.name(side)}...` });
      return;
    }
    const types = this.types(side);
    if (status === 'burn' && types.includes('inferno')) {
      if (announceFail) this.emit({ t: 'text', msg: `It doesn't affect ${this.name(side)}...` });
      return;
    }
    if (status === 'paralysis' && types.includes('volt')) {
      if (announceFail) this.emit({ t: 'text', msg: `It doesn't affect ${this.name(side)}...` });
      return;
    }
    if (status === 'freeze' && types.includes('aqua')) {
      if (announceFail) this.emit({ t: 'text', msg: `It doesn't affect ${this.name(side)}...` });
      return;
    }
    if (status === 'poison' && types.includes('umbra')) {
      if (announceFail) this.emit({ t: 'text', msg: `It doesn't affect ${this.name(side)}...` });
      return;
    }
    c.status = status;
    if (status === 'sleep') b.volatiles.sleepTurns = this.rng.int(1, 3);
    this.emit({ t: 'status', side, status });
    this.emit({ t: 'text', msg: `${this.name(side)} ${statusInflictText(status)}` });
  }

  private applyStages(side: Side, stages: Partial<Record<StageKey, number>>, isFromFoe: boolean) {
    const b = this.battler(side);
    if (b.creature.hp <= 0) return;
    for (const [key, delta] of Object.entries(stages) as [StageKey, number][]) {
      if (!delta) continue;
      const before = b.stages[key];
      const after = Math.max(-6, Math.min(6, before + delta));
      if (after === before) {
        this.emit({
          t: 'text',
          msg: `${this.name(side)}'s ${STAT_LABEL[key]} won't go any ${delta > 0 ? 'higher' : 'lower'}!`,
        });
        continue;
      }
      b.stages[key] = after;
      const real = after - before;
      const adverb = Math.abs(real) >= 2 ? ' sharply' : '';
      this.emit({ t: 'stat', side, stat: key, delta: real });
      this.emit({
        t: 'text',
        msg: `${this.name(side)}'s ${STAT_LABEL[key]}${adverb} ${real > 0 ? 'rose' : 'fell'}!`,
      });
    }
  }

  // -------------------------------------------------------- faint / end

  private checkFaint(side: Side): boolean {
    const b = this.battler(side);
    if (b.creature.hp > 0) return false;
    this.emit({ t: 'faint', side });
    this.emit({ t: 'text', msg: `${this.name(side)} fainted!` });

    if (side === 'foe') {
      this.awardExp();
      const next = this.foeParty.findIndex((c) => c.hp > 0);
      if (next === -1) {
        this.ended = true;
        this.outcome = 'win';
        this.emit({ t: 'end', outcome: 'win' });
      } else {
        this.switchIn('foe', next);
      }
    } else {
      const hasMore = this.playerParty.some((c) => c.hp > 0);
      if (!hasMore) {
        this.ended = true;
        this.outcome = 'loss';
        this.emit({ t: 'end', outcome: 'loss' });
      } else {
        this.awaitingPlayerSwitch = true;
      }
    }
    return true;
  }

  private awardExp() {
    const defeated = this.foe.creature;
    const sp = speciesById(defeated.speciesId);
    const alive = this.playerParty.filter((c) => c.hp > 0 && this.participants.has(c.uid) && c.level < 100);
    if (alive.length === 0) return;
    for (const c of alive) {
      applyEvGain(c, sp);
      const lucky = c.heldItem === 'luckycharm';
      const amount = expGain(sp, defeated.level, alive.length, { trainer: this.kind === 'trainer', luckyCharm: lucky });
      const res = addExp(c, amount);
      this.emit({ t: 'exp', uid: c.uid, amount });
      this.emit({ t: 'text', msg: `${displayName(c)} gained ${amount} EXP!` });
      for (const lvl of res.leveledTo) {
        this.emit({ t: 'levelup', uid: c.uid, level: lvl });
        this.emit({ t: 'text', msg: `${displayName(c)} grew to level ${lvl}!` });
      }
      for (const nm of res.newMoves) {
        this.emit({ t: 'learnMove', uid: c.uid, moveId: nm.moveId });
      }
    }
  }

  // -------------------------------------------------------- end of turn

  private endOfTurn() {
    for (const side of ['player', 'foe'] as Side[]) {
      if (this.ended) return;
      const b = this.battler(side);
      const c = b.creature;
      if (c.hp <= 0) continue;
      const max = calcStats(c).hp;
      const foeSide = this.other(side);

      if (c.status === 'poison') {
        this.emit({ t: 'text', msg: `${this.name(side)} is hurt by poison!` });
        this.dealDamage(side, Math.max(1, Math.floor(max / 8)));
      } else if (c.status === 'burn') {
        this.emit({ t: 'text', msg: `${this.name(side)} is hurt by its burn!` });
        this.dealDamage(side, Math.max(1, Math.floor(max / 16)));
      }
      if (c.hp > 0 && b.volatiles.seeded && this.battler(foeSide).creature.hp > 0) {
        const sap = Math.max(1, Math.floor(max / 8));
        this.emit({ t: 'text', msg: `${this.name(side)}'s health is sapped by Leech Seed!` });
        const dealt = this.dealDamage(side, sap);
        const foeC = this.battler(foeSide).creature;
        const foeMax = calcStats(foeC).hp;
        foeC.hp = Math.min(foeMax, foeC.hp + dealt);
        this.emit({ t: 'hp', side: foeSide, hp: foeC.hp, maxHp: foeMax });
      }
      if (c.hp > 0) {
        const ab = this.ability(side);
        if (ab.kind === 'regrowth' && c.hp < max) {
          c.hp = Math.min(max, c.hp + Math.max(1, Math.floor(max / 16)));
          this.emit({ t: 'text', msg: `${this.name(side)} restored a little HP!` });
          this.emit({ t: 'hp', side, hp: c.hp, maxHp: max });
        }
        if (ab.kind === 'speedBoost' && b.stages.spe < 6) {
          this.applyStages(side, { spe: 1 }, false);
        }
        const held = this.heldEffect(side);
        if (held?.kind === 'heldLeftovers' && c.hp < max) {
          c.hp = Math.min(max, c.hp + Math.max(1, Math.floor(max * held.fraction)));
          this.emit({ t: 'text', msg: `${this.name(side)} restored HP with its ${itemById(c.heldItem!).name}!` });
          this.emit({ t: 'hp', side, hp: c.hp, maxHp: max });
        }
      }
      b.volatiles.protected = false;
      b.volatiles.flinched = false;
      this.checkFaint(side);
      if (this.awaitingPlayerSwitch) return;
    }
  }

  // -------------------------------------------------------- foe AI

  private chooseFoeAction(): BattleAction {
    const b = this.foe;
    const usable = b.creature.moves
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => m.pp > 0);
    if (usable.length === 0) return { type: 'move', moveIndex: -1 }; // Struggle
    if (!this.foeIsSmart) {
      return { type: 'move', moveIndex: this.rng.pick(usable).i };
    }
    // Smart AI: score moves by estimated damage / utility.
    const foeTypes = this.types('player');
    let best = usable[0];
    let bestScore = -1;
    for (const u of usable) {
      const move = moveById(u.m.id);
      let score: number;
      if (move.category === 'status') {
        const playerHasStatus = this.player.creature.status !== null;
        score = this.turn <= 2 && !playerHasStatus ? 45 : 15;
      } else {
        const mult = move.typeless ? 1 : effectiveness(move.type, foeTypes);
        const stab = !move.typeless && this.types('foe').includes(move.type) ? 1.5 : 1;
        score = move.power * mult * stab * (move.accuracy === 0 ? 1 : move.accuracy / 100);
      }
      score *= 0.85 + this.rng.next() * 0.3; // slight unpredictability
      if (score > bestScore) {
        bestScore = score;
        best = u;
      }
    }
    return { type: 'move', moveIndex: best.i };
  }
}

function describeStatus(s: NonVolatileStatus): string {
  switch (s) {
    case 'poison': return 'poisoned';
    case 'burn': return 'burned';
    case 'paralysis': return 'paralyzed';
    case 'sleep': return 'asleep';
    case 'freeze': return 'frozen';
  }
}

function statusInflictText(s: NonVolatileStatus): string {
  switch (s) {
    case 'poison': return 'was poisoned!';
    case 'burn': return 'was burned!';
    case 'paralysis': return 'is paralyzed! It may be unable to move!';
    case 'sleep': return 'fell asleep!';
    case 'freeze': return 'was frozen solid!';
  }
}

export const STATUS_LABELS: Record<NonVolatileStatus, string> = {
  poison: 'PSN',
  burn: 'BRN',
  paralysis: 'PAR',
  sleep: 'SLP',
  freeze: 'FRZ',
};
