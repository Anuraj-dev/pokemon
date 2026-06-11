/**
 * Abilities — declarative records interpreted by the battle engine via
 * effect hooks (onSwitchIn, onModifyDamage, onResidual, onStatusAttempt, ...).
 */
import type { TypeId } from './types';
import type { NonVolatileStatus } from './moves';

export type AbilityEffect =
  /** Boost moves of `type` by 1.5× when HP ≤ 1/3 (starter "pinch" abilities). */
  | { kind: 'pinchBoost'; type: TypeId }
  /** On switch-in, lower the foe's Attack one stage. */
  | { kind: 'intimidate' }
  /** Immune to damaging moves of this type. */
  | { kind: 'typeImmune'; type: TypeId }
  /** 30% to paralyze/burn/poison attackers that hit with physical moves. */
  | { kind: 'contactStatus'; status: NonVolatileStatus; chance: number }
  /** +1 Speed at the end of every turn. */
  | { kind: 'speedBoost' }
  /** Take 0.75× damage from super-effective hits. */
  | { kind: 'filter' }
  /** Heal 1/16 max HP at end of each turn. */
  | { kind: 'regrowth' }
  /** ×1.5 Attack while statused; burn does not halve physical damage. */
  | { kind: 'guts' }
  /** Survive any hit from full HP with 1 HP. */
  | { kind: 'sturdy' }
  /** Cannot be afflicted by the given status. */
  | { kind: 'statusImmune'; status: NonVolatileStatus | 'all' }
  /** STAB is 2× instead of 1.5×. */
  | { kind: 'adaptive' }
  /** Moves with power ≤ 60 gain 1.5× power. */
  | { kind: 'technician' }
  /** Critical hits cannot land on this creature. */
  | { kind: 'shellguard' }
  /** Accuracy of this creature's moves can't be lowered & ignores foe evasion. */
  | { kind: 'keeneye' };

export interface AbilityData {
  id: string;
  name: string;
  desc: string;
  effect: AbilityEffect;
}

const A = (id: string, name: string, desc: string, effect: AbilityEffect): AbilityData => ({ id, name, desc, effect });

export const ABILITIES: Record<string, AbilityData> = {};
function add(a: AbilityData) {
  ABILITIES[a.id] = a;
}

add(A('emberheart', 'Ember Heart', 'Powers up Inferno moves in a pinch.', { kind: 'pinchBoost', type: 'inferno' }));
add(A('tidalsurge', 'Tidal Surge', 'Powers up Aqua moves in a pinch.', { kind: 'pinchBoost', type: 'aqua' }));
add(A('wildgrowth', 'Wild Growth', 'Powers up Verdant moves in a pinch.', { kind: 'pinchBoost', type: 'verdant' }));
add(A('menace', 'Menace', 'Lowers the foe’s Attack on entry.', { kind: 'intimidate' }));
add(A('levitate', 'Levitate', 'Floats above the ground; immune to Terra moves.', { kind: 'typeImmune', type: 'terra' }));
add(A('staticcharge', 'Static Charge', 'May paralyze attackers on contact.', { kind: 'contactStatus', status: 'paralysis', chance: 0.3 }));
add(A('flameaura', 'Flame Aura', 'May burn attackers on contact.', { kind: 'contactStatus', status: 'burn', chance: 0.3 }));
add(A('venomhide', 'Venom Hide', 'May poison attackers on contact.', { kind: 'contactStatus', status: 'poison', chance: 0.3 }));
add(A('momentum', 'Momentum', 'Speed rises every turn.', { kind: 'speedBoost' }));
add(A('prismshield', 'Prism Shield', 'Weakens super-effective hits.', { kind: 'filter' }));
add(A('regrowth', 'Regrowth', 'Gradually restores HP each turn.', { kind: 'regrowth' }));
add(A('grit', 'Grit', 'Boosts Attack when suffering a status condition.', { kind: 'guts' }));
add(A('stonewall', 'Stonewall', 'Survives a one-hit KO from full HP.', { kind: 'sturdy' }));
add(A('purebody', 'Pure Body', 'Immune to all status conditions.', { kind: 'statusImmune', status: 'all' }));
add(A('thermalcore', 'Thermal Core', 'Cannot be burned.', { kind: 'statusImmune', status: 'burn' }));
add(A('adaptive', 'Adaptive', 'Same-type moves hit even harder.', { kind: 'adaptive' }));
add(A('precision', 'Precision', 'Powers up weaker moves.', { kind: 'technician' }));
add(A('shellguard', 'Shell Guard', 'Blocks critical hits.', { kind: 'shellguard' }));
add(A('keeneye', 'Keen Eye', 'Never misses due to evasion tricks.', { kind: 'keeneye' }));

export function abilityById(id: string): AbilityData {
  const a = ABILITIES[id];
  if (!a) throw new Error(`Unknown ability: ${id}`);
  return a;
}
