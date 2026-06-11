/**
 * Item data — balls, medicine, held items, evolution stones, key items.
 */
import type { TypeId } from './types';
import type { NonVolatileStatus } from './moves';

export type ItemCategory = 'medicine' | 'balls' | 'held' | 'evolution' | 'key';

export type ItemEffect =
  | { kind: 'ball'; bonus: number; master?: boolean }
  | { kind: 'healHp'; amount: number } // amount = HP restored; 9999 = full
  | { kind: 'cureStatus'; status: NonVolatileStatus | 'all' }
  | { kind: 'fullRestore' }
  | { kind: 'revive'; fraction: number }
  | { kind: 'restorePp'; amount: number } // per move; 9999 = full
  | { kind: 'repel'; steps: number }
  | { kind: 'evolve'; stone: string }
  | { kind: 'expBoost' } // held: 1.5× EXP
  | { kind: 'heldHealBerry'; threshold: number; fraction: number } // eat at <= threshold of max HP
  | { kind: 'heldStatusBerry'; status: NonVolatileStatus | 'all' } // cure own status when afflicted
  | { kind: 'heldTypeBoost'; type: TypeId; mult: number }
  | { kind: 'heldLeftovers'; fraction: number }
  | { kind: 'heldFocusSash' } // survive from full HP at 1 HP, consumed
  | { kind: 'heldCritBoost' } // crit stage +1 (1/8)
  | { kind: 'key' };

export interface ItemData {
  id: string;
  name: string;
  category: ItemCategory;
  price: number; // 0 = not buyable
  desc: string;
  effect: ItemEffect;
}

const I = (id: string, name: string, category: ItemCategory, price: number, desc: string, effect: ItemEffect): ItemData => ({
  id, name, category, price, desc, effect,
});

export const ITEMS: Record<string, ItemData> = {};
function add(i: ItemData) {
  ITEMS[i.id] = i;
}

// Balls
add(I('basicball', 'Basic Ball', 'balls', 200, 'A standard capture ball.', { kind: 'ball', bonus: 1.0 }));
add(I('greatball', 'Great Ball', 'balls', 600, 'A high-performance capture ball.', { kind: 'ball', bonus: 1.5 }));
add(I('ultraball', 'Ultra Ball', 'balls', 1200, 'An ultra-high-performance capture ball.', { kind: 'ball', bonus: 2.0 }));
add(I('masterball', 'Master Ball', 'balls', 0, 'The ultimate ball. It never fails.', { kind: 'ball', bonus: 255, master: true }));

// Medicine
add(I('potion', 'Potion', 'medicine', 300, 'Restores 20 HP.', { kind: 'healHp', amount: 20 }));
add(I('superpotion', 'Super Potion', 'medicine', 700, 'Restores 60 HP.', { kind: 'healHp', amount: 60 }));
add(I('hyperpotion', 'Hyper Potion', 'medicine', 1500, 'Restores 120 HP.', { kind: 'healHp', amount: 120 }));
add(I('maxpotion', 'Max Potion', 'medicine', 2500, 'Fully restores HP.', { kind: 'healHp', amount: 9999 }));
add(I('fullrestore', 'Full Restore', 'medicine', 3000, 'Fully restores HP and cures status.', { kind: 'fullRestore' }));
add(I('antidote', 'Antidote', 'medicine', 100, 'Cures poison.', { kind: 'cureStatus', status: 'poison' }));
add(I('burnsalve', 'Burn Salve', 'medicine', 250, 'Cures a burn.', { kind: 'cureStatus', status: 'burn' }));
add(I('paralyzeheal', 'Paralyze Heal', 'medicine', 200, 'Cures paralysis.', { kind: 'cureStatus', status: 'paralysis' }));
add(I('awakening', 'Awakening', 'medicine', 250, 'Wakes a sleeping creature.', { kind: 'cureStatus', status: 'sleep' }));
add(I('icemelt', 'Ice Melt', 'medicine', 250, 'Thaws a frozen creature.', { kind: 'cureStatus', status: 'freeze' }));
add(I('fullheal', 'Full Heal', 'medicine', 600, 'Cures all status conditions.', { kind: 'cureStatus', status: 'all' }));
add(I('revive', 'Revive', 'medicine', 1500, 'Revives a fainted creature to half HP.', { kind: 'revive', fraction: 0.5 }));
add(I('maxrevive', 'Max Revive', 'medicine', 4000, 'Revives a fainted creature to full HP.', { kind: 'revive', fraction: 1 }));
add(I('ether', 'Ether', 'medicine', 1200, 'Restores 10 PP of one move.', { kind: 'restorePp', amount: 10 }));
add(I('repel', 'Repel', 'medicine', 350, 'Repels weak wild creatures for 150 steps.', { kind: 'repel', steps: 150 }));

// Evolution stones
add(I('emberstone', 'Ember Stone', 'evolution', 2100, 'Radiates intense heat. Evolves certain creatures.', { kind: 'evolve', stone: 'emberstone' }));
add(I('tidestone', 'Tide Stone', 'evolution', 2100, 'Eternally wet to the touch. Evolves certain creatures.', { kind: 'evolve', stone: 'tidestone' }));
add(I('duskstone', 'Dusk Stone', 'evolution', 2100, 'Holds captured shadow. Evolves certain creatures.', { kind: 'evolve', stone: 'duskstone' }));
add(I('dawnstone', 'Dawn Stone', 'evolution', 2100, 'Glows with inner light. Evolves certain creatures.', { kind: 'evolve', stone: 'dawnstone' }));
add(I('linkstone', 'Link Stone', 'evolution', 3000, 'A mysterious bonded pair of stones. Evolves certain creatures.', { kind: 'evolve', stone: 'linkstone' }));

// Held items
add(I('luckycharm', 'Lucky Charm', 'held', 0, 'Held: the holder earns 1.5× EXP.', { kind: 'expBoost' }));
add(I('oranberry', 'Oran Berry', 'held', 200, 'Held: restores 30% HP when HP falls below half.', { kind: 'heldHealBerry', threshold: 0.5, fraction: 0.3 }));
add(I('lumberry', 'Lum Berry', 'held', 500, 'Held: cures any status condition once.', { kind: 'heldStatusBerry', status: 'all' }));
add(I('leftovers', 'Morsel Charm', 'held', 0, 'Held: restores a little HP every turn.', { kind: 'heldLeftovers', fraction: 1 / 16 }));
add(I('focussash', 'Focus Sash', 'held', 2000, 'Held: survive a KO from full HP with 1 HP. One use.', { kind: 'heldFocusSash' }));
add(I('scopelens', 'Scope Lens', 'held', 1500, 'Held: boosts critical-hit ratio.', { kind: 'heldCritBoost' }));
add(I('infernocharm', 'Inferno Charm', 'held', 1000, 'Held: boosts Inferno moves 20%.', { kind: 'heldTypeBoost', type: 'inferno', mult: 1.2 }));
add(I('aquacharm', 'Aqua Charm', 'held', 1000, 'Held: boosts Aqua moves 20%.', { kind: 'heldTypeBoost', type: 'aqua', mult: 1.2 }));
add(I('verdantcharm', 'Verdant Charm', 'held', 1000, 'Held: boosts Verdant moves 20%.', { kind: 'heldTypeBoost', type: 'verdant', mult: 1.2 }));
add(I('voltcharm', 'Volt Charm', 'held', 1000, 'Held: boosts Volt moves 20%.', { kind: 'heldTypeBoost', type: 'volt', mult: 1.2 }));
add(I('terracharm', 'Terra Charm', 'held', 1000, 'Held: boosts Terra moves 20%.', { kind: 'heldTypeBoost', type: 'terra', mult: 1.2 }));
add(I('galecharm', 'Gale Charm', 'held', 1000, 'Held: boosts Gale moves 20%.', { kind: 'heldTypeBoost', type: 'gale', mult: 1.2 }));
add(I('umbracharm', 'Umbra Charm', 'held', 1000, 'Held: boosts Umbra moves 20%.', { kind: 'heldTypeBoost', type: 'umbra', mult: 1.2 }));
add(I('luminacharm', 'Lumina Charm', 'held', 1000, 'Held: boosts Lumina moves 20%.', { kind: 'heldTypeBoost', type: 'lumina', mult: 1.2 }));

// Key items
add(I('cuttercharm', 'Cutter Charm', 'key', 0, 'Lets your lead creature slash through dense brush.', { kind: 'key' }));
add(I('wavecharm', 'Wave Charm', 'key', 0, 'Lets you ride your creatures across water.', { kind: 'key' }));
add(I('climbinggear', 'Climbing Gear', 'key', 0, 'Lets you scale rocky walls.', { kind: 'key' }));
add(I('compendium', 'Compendium', 'key', 0, 'A device that records every creature you meet.', { kind: 'key' }));
add(I('eclipsekey', 'Eclipse Key', 'key', 0, 'Opens the locked doors of Team Eclipse.', { kind: 'key' }));
add(I('prismshard', 'Prism Shard', 'key', 0, 'A shard humming with twinned light and shadow.', { kind: 'key' }));

export function itemById(id: string): ItemData {
  const i = ITEMS[id];
  if (!i) throw new Error(`Unknown item: ${id}`);
  return i;
}
