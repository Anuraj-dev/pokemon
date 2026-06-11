/**
 * Field/battle item application — shared by the bag menu and battle bag.
 * Pure: mutates the creature, reports what happened.
 */
import { itemById } from '../data/items';
import { moveById } from '../data/moves';
import { calcStats, displayName, itemEvolution, type CreatureInstance } from './creature';

export interface ItemUseResult {
  used: boolean;
  message: string;
  /** set when an evolution item was accepted; caller runs the sequence */
  evolveInto?: string;
}

export function applyItemToCreature(c: CreatureInstance, itemId: string): ItemUseResult {
  const item = itemById(itemId);
  const eff = item.effect;
  const max = calcStats(c).hp;
  const name = displayName(c);

  switch (eff.kind) {
    case 'healHp': {
      if (c.hp <= 0) return { used: false, message: `${name} has fainted — it needs a Revive.` };
      if (c.hp >= max) return { used: false, message: `${name}'s HP is already full.` };
      const healed = Math.min(max - c.hp, eff.amount);
      c.hp += healed;
      return { used: true, message: `${name} recovered ${healed} HP!` };
    }
    case 'cureStatus': {
      if (c.hp <= 0) return { used: false, message: `${name} has fainted.` };
      if (!c.status) return { used: false, message: `${name} has no status condition.` };
      if (eff.status !== 'all' && c.status !== eff.status) {
        return { used: false, message: `It won't have any effect on ${name}.` };
      }
      c.status = null;
      return { used: true, message: `${name} is back to normal!` };
    }
    case 'fullRestore': {
      if (c.hp <= 0) return { used: false, message: `${name} has fainted — it needs a Revive.` };
      if (c.hp >= max && !c.status) return { used: false, message: `${name} is already in perfect shape.` };
      c.hp = max;
      c.status = null;
      return { used: true, message: `${name} was fully restored!` };
    }
    case 'revive': {
      if (c.hp > 0) return { used: false, message: `${name} hasn't fainted.` };
      c.hp = Math.max(1, Math.floor(max * eff.fraction));
      c.status = null;
      return { used: true, message: `${name} was revived!` };
    }
    case 'restorePp': {
      let restored = false;
      for (const slot of c.moves) {
        const cap = moveById(slot.id).pp;
        if (slot.pp < cap) {
          slot.pp = Math.min(cap, slot.pp + eff.amount);
          restored = true;
        }
      }
      if (!restored) return { used: false, message: `${name}'s moves are full of PP.` };
      return { used: true, message: `${name}'s move PP was restored!` };
    }
    case 'evolve': {
      const into = itemEvolution(c, itemId);
      if (!into) return { used: false, message: `It won't have any effect on ${name}.` };
      return { used: true, message: '', evolveInto: into };
    }
    default:
      return { used: false, message: 'It can\'t be used on a creature.' };
  }
}
