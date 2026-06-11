/**
 * Move data — single source of truth for every move in the game.
 * Effects are a closed, typed union interpreted by the battle engine.
 */
import type { TypeId } from './types';
import type { StatKey } from './natures';

export type MoveCategory = 'physical' | 'special' | 'status';
export type NonVolatileStatus = 'poison' | 'burn' | 'paralysis' | 'sleep' | 'freeze';

export type MoveEffect =
  /** Chance to inflict a non-volatile status on the target. */
  | { kind: 'status'; status: NonVolatileStatus; chance: number }
  /** Stat-stage changes; target 'self' or 'foe'; chance defaults to 1 for status moves. */
  | { kind: 'stages'; target: 'self' | 'foe'; stages: Partial<Record<Exclude<StatKey, 'hp'> | 'acc' | 'eva', number>>; chance?: number }
  /** Heal user for a fraction of damage dealt. */
  | { kind: 'drain'; fraction: number }
  /** User takes recoil equal to fraction of damage dealt. */
  | { kind: 'recoil'; fraction: number }
  /** Chance to make the target flinch (only matters if user moves first). */
  | { kind: 'flinch'; chance: number }
  /** Hits 2–5 times (weighted like the classics). */
  | { kind: 'multihit' }
  /** Two-turn move: charge on turn 1 (message), strike on turn 2. */
  | { kind: 'charge'; message: string }
  /** Heal the user a fraction of max HP. */
  | { kind: 'heal'; fraction: number }
  /** Chance to confuse the target. */
  | { kind: 'confuse'; chance: number }
  /** Plant a seed: target leaks 1/8 max HP to the user each turn. */
  | { kind: 'leech' }
  /** Protect the user from moves this turn (halving success on consecutive use). */
  | { kind: 'protect' }
  /** User faints; massive power. */
  | { kind: 'selfdestruct' }
  /** High critical-hit ratio (1/8 instead of 1/24). */
  | { kind: 'highcrit' }
  /** Priority is on the move record itself; this marks "never misses". */
  | { kind: 'suremiss-never' }
  /** Damage equals user's level. */
  | { kind: 'leveldamage' }
  /** Fully restore HP and fall asleep for 2 turns. */
  | { kind: 'rest' }
  /** Cure the user's party of status?? — not used; reserved. */
  | { kind: 'haze' };

export interface MoveData {
  id: string;
  name: string;
  type: TypeId;
  category: MoveCategory;
  power: number; // 0 for status moves
  accuracy: number; // 0..100; 0 = never misses
  pp: number;
  priority?: number;
  /** basic moves: no STAB, no type effectiveness either way (like Normal type) */
  typeless?: boolean;
  effects?: MoveEffect[];
  desc: string;
}

const M = (
  id: string,
  name: string,
  type: TypeId,
  category: MoveCategory,
  power: number,
  accuracy: number,
  pp: number,
  desc: string,
  extra?: Partial<MoveData>,
): MoveData => ({ id, name, type, category, power, accuracy, pp, desc, ...extra });

export const MOVES: Record<string, MoveData> = {};
function add(m: MoveData) {
  MOVES[m.id] = m;
}

// ---------- Inferno ----------
add(M('ember', 'Ember', 'inferno', 'special', 40, 100, 25, 'A weak flame. 10% chance to burn.', { effects: [{ kind: 'status', status: 'burn', chance: 0.1 }] }));
add(M('flamefang', 'Flame Fang', 'inferno', 'physical', 65, 95, 15, 'A fiery bite. 10% burn, 10% flinch.', { effects: [{ kind: 'status', status: 'burn', chance: 0.1 }, { kind: 'flinch', chance: 0.1 }] }));
add(M('scorch', 'Scorch', 'inferno', 'special', 80, 100, 15, 'A wave of searing heat. 10% chance to burn.', { effects: [{ kind: 'status', status: 'burn', chance: 0.1 }] }));
add(M('blazerush', 'Blaze Rush', 'inferno', 'physical', 90, 100, 10, 'A reckless flaming charge. 1/4 recoil.', { effects: [{ kind: 'recoil', fraction: 0.25 }] }));
add(M('infernova', 'Infernova', 'inferno', 'special', 110, 85, 5, 'A catastrophic eruption of flame. 20% burn.', { effects: [{ kind: 'status', status: 'burn', chance: 0.2 }] }));
add(M('willowisp', 'Will-o-Wisp', 'inferno', 'status', 0, 85, 15, 'Sinister flames burn the target.', { effects: [{ kind: 'status', status: 'burn', chance: 1 }] }));
add(M('sunbathe', 'Sunbathe', 'inferno', 'status', 0, 0, 10, 'Bask in warmth, sharply raising Sp. Atk.', { effects: [{ kind: 'stages', target: 'self', stages: { spa: 2 } }] }));

// ---------- Aqua ----------
add(M('splashjet', 'Splash Jet', 'aqua', 'special', 40, 100, 25, 'A quick jet of water.'));
add(M('aquafang', 'Aqua Fang', 'aqua', 'physical', 65, 95, 15, 'A soaking bite. 10% flinch.', { effects: [{ kind: 'flinch', chance: 0.1 }] }));
add(M('ripcurrent', 'Rip Current', 'aqua', 'special', 80, 100, 15, 'A crushing current of water.'));
add(M('tidalsmash', 'Tidal Smash', 'aqua', 'physical', 95, 90, 10, 'A wall of water slams down.'));
add(M('maelstrom', 'Maelstrom', 'aqua', 'special', 110, 85, 5, 'A swirling vortex of immense power.'));
add(M('mistveil', 'Mist Veil', 'aqua', 'status', 0, 0, 15, 'A cool mist raises evasion.', { effects: [{ kind: 'stages', target: 'self', stages: { eva: 1 } }] }));
add(M('bubblebind', 'Bubble Bind', 'aqua', 'special', 50, 100, 20, 'Bubbles slow the target. Lowers Speed.', { effects: [{ kind: 'stages', target: 'foe', stages: { spe: -1 }, chance: 1 }] }));

// ---------- Verdant ----------
add(M('vinewhip', 'Vine Whip', 'verdant', 'physical', 45, 100, 25, 'Strikes with slender vines.'));
add(M('leafblade', 'Leaf Blade', 'verdant', 'physical', 80, 100, 15, 'A keen-edged leaf slash. High crit ratio.', { effects: [{ kind: 'highcrit' }] }));
add(M('sporeburst', 'Spore Burst', 'verdant', 'special', 70, 100, 15, 'A burst of stinging spores. 20% poison.', { effects: [{ kind: 'status', status: 'poison', chance: 0.2 }] }));
add(M('solarlance', 'Solar Lance', 'verdant', 'special', 120, 100, 10, 'Gathers light, then fires a piercing beam.', { effects: [{ kind: 'charge', message: 'is gathering light!' }] }));
add(M('leechseed', 'Leech Seed', 'verdant', 'status', 0, 90, 10, 'Plants a seed that drains HP each turn.', { effects: [{ kind: 'leech' }] }));
add(M('sleepspore', 'Sleep Spore', 'verdant', 'status', 0, 75, 15, 'Scatters spores that induce sleep.', { effects: [{ kind: 'status', status: 'sleep', chance: 1 }] }));
add(M('synthesis', 'Synthesis', 'verdant', 'status', 0, 0, 5, 'Restores half the user’s max HP.', { effects: [{ kind: 'heal', fraction: 0.5 }] }));
add(M('thornvolley', 'Thorn Volley', 'verdant', 'physical', 25, 90, 20, 'Fires 2–5 volleys of thorns.', { effects: [{ kind: 'multihit' }] }));

// ---------- Volt ----------
add(M('sparkshot', 'Spark Shot', 'volt', 'special', 40, 100, 25, 'A jolt of static. 10% paralysis.', { effects: [{ kind: 'status', status: 'paralysis', chance: 0.1 }] }));
add(M('voltclaw', 'Volt Claw', 'volt', 'physical', 65, 100, 15, 'Electrified claws rake the foe. 10% paralysis.', { effects: [{ kind: 'status', status: 'paralysis', chance: 0.1 }] }));
add(M('thunderlance', 'Thunder Lance', 'volt', 'special', 90, 95, 10, 'A spear of lightning. 10% paralysis.', { effects: [{ kind: 'status', status: 'paralysis', chance: 0.1 }] }));
add(M('stormcall', 'Storm Call', 'volt', 'special', 110, 80, 5, 'Calls down a devastating bolt. 20% paralysis.', { effects: [{ kind: 'status', status: 'paralysis', chance: 0.2 }] }));
add(M('staticfield', 'Static Field', 'volt', 'status', 0, 90, 20, 'A field of static paralyzes the target.', { effects: [{ kind: 'status', status: 'paralysis', chance: 1 }] }));
add(M('overclock', 'Overclock', 'volt', 'status', 0, 0, 20, 'Supercharges the user, sharply raising Speed.', { effects: [{ kind: 'stages', target: 'self', stages: { spe: 2 } }] }));
add(M('zapcannon', 'Zap Cannon', 'volt', 'special', 120, 50, 5, 'An inaccurate orb of plasma. Always paralyzes on hit.', { effects: [{ kind: 'status', status: 'paralysis', chance: 1 }] }));

// ---------- Terra ----------
add(M('rocktoss', 'Rock Toss', 'terra', 'physical', 50, 90, 20, 'Hurls a heavy stone.'));
add(M('mudshot', 'Mud Shot', 'terra', 'special', 55, 95, 15, 'A blast of mud. Lowers the target’s Speed.', { effects: [{ kind: 'stages', target: 'foe', stages: { spe: -1 }, chance: 1 }] }));
add(M('stoneedge', 'Stone Edge', 'terra', 'physical', 100, 80, 5, 'Impales the foe on sharpened stones. High crit.', { effects: [{ kind: 'highcrit' }] }));
add(M('quake', 'Quake', 'terra', 'physical', 100, 100, 10, 'The very ground heaves and shatters.'));
add(M('sandveil', 'Sand Veil', 'terra', 'status', 0, 100, 15, 'Flings sand, lowering the target’s accuracy.', { effects: [{ kind: 'stages', target: 'foe', stages: { acc: -1 }, chance: 1 }] }));
add(M('bulwark', 'Bulwark', 'terra', 'status', 0, 0, 20, 'Hardens the body, sharply raising Defense.', { effects: [{ kind: 'stages', target: 'self', stages: { def: 2 } }] }));
add(M('landslide', 'Landslide', 'terra', 'physical', 75, 90, 10, 'Buries the foe in rubble. 30% flinch.', { effects: [{ kind: 'flinch', chance: 0.3 }] }));

// ---------- Gale ----------
add(M('gustcut', 'Gust Cut', 'gale', 'special', 40, 100, 30, 'A slicing gust of wind.'));
add(M('wingstrike', 'Wing Strike', 'gale', 'physical', 60, 100, 20, 'Strikes with rigid wings.'));
add(M('skydance', 'Sky Dance', 'gale', 'status', 0, 0, 15, 'An aerial dance raising Attack and Speed.', { effects: [{ kind: 'stages', target: 'self', stages: { atk: 1, spe: 1 } }] }));
add(M('tempest', 'Tempest', 'gale', 'special', 110, 70, 5, 'A howling storm. 30% confusion.', { effects: [{ kind: 'confuse', chance: 0.3 }] }));
add(M('divebomb', 'Dive Bomb', 'gale', 'physical', 100, 95, 10, 'Soars high, then dives on the next turn.', { effects: [{ kind: 'charge', message: 'soared high into the sky!' }] }));
add(M('tailwind-rush', 'Tailwind Rush', 'gale', 'physical', 40, 100, 20, 'Always strikes first.', { priority: 1 }));
add(M('razorgale', 'Razor Gale', 'gale', 'special', 80, 100, 15, 'Blades of compressed wind. High crit ratio.', { effects: [{ kind: 'highcrit' }] }));

// ---------- Umbra ----------
add(M('shadowsnap', 'Shadow Snap', 'umbra', 'physical', 45, 100, 25, 'A bite from the darkness.'));
add(M('nightshade', 'Night Shade', 'umbra', 'special', 0, 100, 15, 'Deals damage equal to the user’s level.', { effects: [{ kind: 'leveldamage' }] }));
add(M('umbralclaw', 'Umbral Claw', 'umbra', 'physical', 70, 100, 15, 'Claws wreathed in shadow. High crit ratio.', { effects: [{ kind: 'highcrit' }] }));
add(M('voidpulse', 'Void Pulse', 'umbra', 'special', 85, 100, 10, 'A pulse of pure darkness. 20% to lower Sp. Def.', { effects: [{ kind: 'stages', target: 'foe', stages: { spd: -1 }, chance: 0.2 }] }));
add(M('eclipse', 'Eclipse', 'umbra', 'special', 120, 85, 5, 'Blots out all light. 10% confusion.', { effects: [{ kind: 'confuse', chance: 0.1 }] }));
add(M('dreadgaze', 'Dread Gaze', 'umbra', 'status', 0, 100, 15, 'A terrifying glare. Sharply lowers Attack.', { effects: [{ kind: 'stages', target: 'foe', stages: { atk: -2 }, chance: 1 }] }));
add(M('shadowsneak', 'Shadow Sneak', 'umbra', 'physical', 40, 100, 30, 'Strikes from the shadows first.', { priority: 1 }));

// ---------- Lumina ----------
add(M('glimmer', 'Glimmer', 'lumina', 'special', 40, 100, 30, 'A dazzling mote of light.'));
add(M('radiantbeam', 'Radiant Beam', 'lumina', 'special', 80, 100, 15, 'A beam of focused radiance.'));
add(M('purifyinglight', 'Purifying Light', 'lumina', 'status', 0, 0, 10, 'Healing light restores half max HP.', { effects: [{ kind: 'heal', fraction: 0.5 }] }));
add(M('dazzle', 'Dazzle', 'lumina', 'status', 0, 100, 20, 'Blinding light lowers accuracy.', { effects: [{ kind: 'stages', target: 'foe', stages: { acc: -1 }, chance: 1 }] }));
add(M('novaflare', 'Nova Flare', 'lumina', 'special', 120, 85, 5, 'An annihilating burst of starlight.'));
add(M('halostrike', 'Halo Strike', 'lumina', 'physical', 75, 100, 15, 'A ring of hard light. 20% to lower Defense.', { effects: [{ kind: 'stages', target: 'foe', stages: { def: -1 }, chance: 0.2 }] }));
add(M('luminance', 'Luminance', 'lumina', 'status', 0, 0, 15, 'Inner light raises Sp. Atk and Sp. Def.', { effects: [{ kind: 'stages', target: 'self', stages: { spa: 1, spd: 1 } }] }));

// ---------- Universal / utility (typed neutral-ish picks) ----------
add(M('tackle', 'Tackle', 'terra', 'physical', 40, 100, 35, 'A basic full-body charge.', { typeless: true }));
add(M('scratch', 'Scratch', 'gale', 'physical', 40, 100, 35, 'Rakes the foe with sharp claws.', { typeless: true }));
add(M('growl', 'Growl', 'terra', 'status', 0, 100, 40, 'An unnerving growl. Lowers the foe’s Attack.', { effects: [{ kind: 'stages', target: 'foe', stages: { atk: -1 }, chance: 1 }] }));
add(M('leer', 'Leer', 'umbra', 'status', 0, 100, 40, 'An intimidating leer. Lowers the foe’s Defense.', { effects: [{ kind: 'stages', target: 'foe', stages: { def: -1 }, chance: 1 }] }));
add(M('quickstrike', 'Quick Strike', 'gale', 'physical', 40, 100, 30, 'An almost invisible first strike.', { priority: 1, typeless: true }));
add(M('focus', 'Focus', 'terra', 'status', 0, 0, 20, 'Sharpens focus, raising Attack and Sp. Atk.', { effects: [{ kind: 'stages', target: 'self', stages: { atk: 1, spa: 1 } }] }));
add(M('protect', 'Protect', 'lumina', 'status', 0, 0, 10, 'Blocks all moves aimed at the user this turn.', { priority: 4, effects: [{ kind: 'protect' }] }));
add(M('rest', 'Rest', 'aqua', 'status', 0, 0, 10, 'Sleeps for two turns, fully restoring HP.', { effects: [{ kind: 'rest' }] }));
add(M('toxin', 'Toxin', 'umbra', 'status', 0, 90, 10, 'Coats the foe in potent venom, poisoning it.', { effects: [{ kind: 'status', status: 'poison', chance: 1 }] }));
add(M('frostbite', 'Frostbite', 'aqua', 'special', 70, 100, 15, 'Bitter cold gnaws the foe. 10% freeze.', { effects: [{ kind: 'status', status: 'freeze', chance: 0.1 }] }));
add(M('detonate', 'Detonate', 'inferno', 'physical', 200, 100, 5, 'The user explodes, fainting in the process.', { effects: [{ kind: 'selfdestruct' }] }));
add(M('crushgrip', 'Crush Grip', 'terra', 'physical', 80, 100, 15, 'Crushes the foe with raw strength.', { typeless: true }));

export function moveById(id: string): MoveData {
  const m = MOVES[id];
  if (!m) throw new Error(`Unknown move: ${id}`);
  return m;
}
