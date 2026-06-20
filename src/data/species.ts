/**
 * Species data — all 40 original creatures of the Veridia region,
 * organized in 18 evolution lines. Single source of truth for balance.
 */
import type { TypeId } from './types';
import type { StatKey } from './natures';
import type { GrowthRate } from './growth';

export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export type Evolution =
  | { method: 'level'; level: number; into: string }
  | { method: 'item'; item: string; into: string };

/** Body-plan hint for the procedural sprite generator. */
export type BodyShape =
  | 'quadruped'
  | 'biped'
  | 'bird'
  | 'serpent'
  | 'blob'
  | 'fish'
  | 'insect'
  | 'golem'
  | 'spirit';

export interface SpeciesData {
  id: string;
  num: number; // compendium number
  name: string;
  types: TypeId[];
  baseStats: BaseStats;
  ability: string;
  /** moves learned at each level; level 1 entries are starting moves */
  learnset: [level: number, moveId: string][];
  evolution?: Evolution;
  catchRate: number; // 3..255
  expYield: number;
  evYield: Partial<Record<StatKey, number>>;
  growth: GrowthRate;
  shape: BodyShape;
  flavor: string;
}

let num = 0;
export const SPECIES: Record<string, SpeciesData> = {};
export const SPECIES_ORDER: string[] = [];

function add(s: Omit<SpeciesData, 'num'>) {
  num++;
  SPECIES[s.id] = { ...s, num };
  SPECIES_ORDER.push(s.id);
}

// ============ Starter: Inferno line ============
add({
  id: 'emberling', name: 'Charmander', types: ['inferno'],
  baseStats: { hp: 44, atk: 58, def: 44, spa: 58, spd: 44, spe: 61 },
  ability: 'emberheart', growth: 'mediumSlow', catchRate: 45, expYield: 62,
  evYield: { spe: 1 }, shape: 'quadruped',
  learnset: [[1, 'scratch'], [1, 'growl'], [7, 'ember'], [9, 'quickstrike'], [13, 'flamefang'], [18, 'focus'], [22, 'scorch'], [28, 'willowisp'], [33, 'blazerush']],
  evolution: { method: 'level', level: 16, into: 'flarewolf' },
  flavor: 'A cinder kindles in its chest fur. It naps near hearths and wakes with a sneeze of sparks.',
});
add({
  id: 'flarewolf', name: 'Charmeleon', types: ['inferno'],
  baseStats: { hp: 58, atk: 78, def: 56, spa: 76, spd: 56, spe: 81 },
  ability: 'emberheart', growth: 'mediumSlow', catchRate: 45, expYield: 142,
  evYield: { spe: 2 }, shape: 'quadruped',
  learnset: [[1, 'scratch'], [1, 'growl'], [1, 'ember'], [13, 'flamefang'], [18, 'focus'], [24, 'scorch'], [30, 'willowisp'], [36, 'blazerush']],
  evolution: { method: 'level', level: 34, into: 'pyrothane' },
  flavor: 'It runs the ridgelines at dusk, leaving trails of embers that hang in the air like fireflies.',
});
add({
  id: 'pyrothane', name: 'Charizard', types: ['inferno', 'terra'],
  baseStats: { hp: 76, atk: 104, def: 78, spa: 96, spd: 74, spe: 97 },
  ability: 'emberheart', growth: 'mediumSlow', catchRate: 45, expYield: 240,
  evYield: { atk: 3 }, shape: 'quadruped',
  learnset: [[1, 'scratch'], [1, 'ember'], [1, 'flamefang'], [24, 'scorch'], [30, 'willowisp'], [34, 'landslide'], [40, 'blazerush'], [46, 'quake'], [52, 'infernova']],
  flavor: 'Its mane burns at the temperature of magma. Mountains are said to smolder where it sleeps.',
});

// ============ Starter: Aqua line ============
add({
  id: 'dribblet', name: 'Squirtle', types: ['aqua'],
  baseStats: { hp: 50, atk: 48, def: 52, spa: 62, spd: 56, spe: 41 },
  ability: 'tidalsurge', growth: 'mediumSlow', catchRate: 45, expYield: 62,
  evYield: { spa: 1 }, shape: 'blob',
  learnset: [[1, 'tackle'], [1, 'leer'], [7, 'splashjet'], [9, 'bubblebind'], [13, 'aquafang'], [18, 'mistveil'], [22, 'ripcurrent'], [28, 'frostbite'], [33, 'rest']],
  evolution: { method: 'level', level: 16, into: 'cascotter' },
  flavor: 'Its gelatinous body is 90% spring water. It seeps under doors to nap in cool cellars.',
});
add({
  id: 'cascotter', name: 'Wartortle', types: ['aqua'],
  baseStats: { hp: 64, atk: 64, def: 68, spa: 82, spd: 72, spe: 55 },
  ability: 'tidalsurge', growth: 'mediumSlow', catchRate: 45, expYield: 142,
  evYield: { spa: 2 }, shape: 'biped',
  learnset: [[1, 'tackle'], [1, 'splashjet'], [1, 'bubblebind'], [13, 'aquafang'], [18, 'mistveil'], [24, 'ripcurrent'], [30, 'frostbite'], [36, 'rest']],
  evolution: { method: 'level', level: 34, into: 'tidalord' },
  flavor: 'It sculpts waterfalls into slides for its young, riding them on its back all afternoon.',
});
add({
  id: 'tidalord', name: 'Blastoise', types: ['aqua', 'gale'],
  baseStats: { hp: 84, atk: 78, def: 88, spa: 106, spd: 92, spe: 77 },
  ability: 'tidalsurge', growth: 'mediumSlow', catchRate: 45, expYield: 240,
  evYield: { spa: 3 }, shape: 'serpent',
  learnset: [[1, 'splashjet'], [1, 'bubblebind'], [1, 'aquafang'], [24, 'ripcurrent'], [30, 'gustcut'], [34, 'razorgale'], [40, 'tidalsmash'], [46, 'frostbite'], [52, 'maelstrom']],
  flavor: 'Storm fronts follow it across the sea. Sailors leave offerings so it will swim ahead of them.',
});

// ============ Starter: Verdant line ============
add({
  id: 'sproutle', name: 'Bulbasaur', types: ['verdant'],
  baseStats: { hp: 52, atk: 56, def: 58, spa: 48, spd: 52, spe: 39 },
  ability: 'wildgrowth', growth: 'mediumSlow', catchRate: 45, expYield: 62,
  evYield: { def: 1 }, shape: 'quadruped',
  learnset: [[1, 'tackle'], [1, 'growl'], [7, 'vinewhip'], [9, 'leechseed'], [13, 'sporeburst'], [18, 'bulwark'], [22, 'leafblade'], [28, 'sleepspore'], [33, 'synthesis']],
  evolution: { method: 'level', level: 16, into: 'thornbeast' },
  flavor: 'A seed took root on its back at birth. The sprout grows exactly as fast as it does.',
});
add({
  id: 'thornbeast', name: 'Ivysaur', types: ['verdant'],
  baseStats: { hp: 68, atk: 76, def: 78, spa: 62, spd: 68, spe: 51 },
  ability: 'wildgrowth', growth: 'mediumSlow', catchRate: 45, expYield: 142,
  evYield: { def: 2 }, shape: 'quadruped',
  learnset: [[1, 'tackle'], [1, 'vinewhip'], [1, 'leechseed'], [13, 'sporeburst'], [18, 'bulwark'], [24, 'leafblade'], [30, 'sleepspore'], [36, 'synthesis']],
  evolution: { method: 'level', level: 34, into: 'sylvaurus' },
  flavor: 'Brambles armor its flanks. It grazes through thickets that would shred any other beast.',
});
add({
  id: 'sylvaurus', name: 'Venusaur', types: ['verdant', 'terra'],
  baseStats: { hp: 92, atk: 100, def: 98, spa: 76, spd: 86, spe: 63 },
  ability: 'wildgrowth', growth: 'mediumSlow', catchRate: 45, expYield: 240,
  evYield: { def: 3 }, shape: 'quadruped',
  learnset: [[1, 'vinewhip'], [1, 'leechseed'], [1, 'sporeburst'], [24, 'leafblade'], [30, 'landslide'], [34, 'bulwark'], [40, 'quake'], [46, 'synthesis'], [52, 'solarlance']],
  flavor: 'A grove grows on its back; whole flocks nest there. It walks once a season, to follow the sun.',
});

// ============ Rattata line (early Verdant rodent) ============
add({
  id: 'nibbit', name: 'Rattata', types: ['verdant'],
  baseStats: { hp: 42, atk: 52, def: 40, spa: 32, spd: 38, spe: 58 },
  ability: 'momentum', growth: 'mediumFast', catchRate: 255, expYield: 48,
  evYield: { spe: 1 }, shape: 'quadruped',
  learnset: [[1, 'tackle'], [3, 'growl'], [7, 'vinewhip'], [11, 'quickstrike'], [15, 'leechseed'], [19, 'thornvolley'], [25, 'leafblade']],
  evolution: { method: 'level', level: 18, into: 'gnawber' },
  flavor: 'Its front teeth never stop growing, so it never stops gnawing. Fence posts fear it.',
});
add({
  id: 'gnawber', name: 'Raticate', types: ['verdant'],
  baseStats: { hp: 64, atk: 80, def: 58, spa: 42, spd: 54, spe: 86 },
  ability: 'momentum', growth: 'mediumFast', catchRate: 127, expYield: 130,
  evYield: { spe: 2 }, shape: 'quadruped',
  learnset: [[1, 'tackle'], [1, 'vinewhip'], [1, 'quickstrike'], [19, 'thornvolley'], [24, 'leafblade'], [30, 'crushgrip'], [36, 'sleepspore']],
  flavor: 'It fells a tree in three bites and builds dams that reroute rivers around its burrow.',
});

// ============ Pidgey line (Gale bird) ============
add({
  id: 'chirpuff', name: 'Pidgey', types: ['gale'],
  baseStats: { hp: 40, atk: 45, def: 38, spa: 41, spd: 38, spe: 66 },
  ability: 'keeneye', growth: 'mediumFast', catchRate: 255, expYield: 50,
  evYield: { spe: 1 }, shape: 'bird',
  learnset: [[1, 'scratch'], [3, 'growl'], [7, 'gustcut'], [11, 'quickstrike'], [15, 'wingstrike'], [21, 'skydance'], [27, 'razorgale']],
  evolution: { method: 'level', level: 14, into: 'galewing' },
  flavor: 'A ball of down that bobs on the breeze. It chirps the same three notes at dawn, always.',
});
add({
  id: 'galewing', name: 'Pidgeotto', types: ['gale'],
  baseStats: { hp: 56, atk: 65, def: 52, spa: 57, spd: 52, spe: 88 },
  ability: 'keeneye', growth: 'mediumFast', catchRate: 120, expYield: 122,
  evYield: { spe: 2 }, shape: 'bird',
  learnset: [[1, 'gustcut'], [1, 'quickstrike'], [1, 'wingstrike'], [21, 'skydance'], [27, 'razorgale'], [33, 'tailwind-rush'], [39, 'divebomb']],
  evolution: { method: 'level', level: 32, into: 'tempestrel' },
  flavor: 'It surfs pressure fronts for days without landing, asleep on the wing.',
});
add({
  id: 'tempestrel', name: 'Pidgeot', types: ['gale'],
  baseStats: { hp: 76, atk: 85, def: 68, spa: 83, spd: 70, spe: 118 },
  ability: 'keeneye', growth: 'mediumFast', catchRate: 45, expYield: 216,
  evYield: { spe: 3 }, shape: 'bird',
  learnset: [[1, 'gustcut'], [1, 'wingstrike'], [1, 'skydance'], [27, 'razorgale'], [33, 'tailwind-rush'], [39, 'divebomb'], [46, 'tempest']],
  flavor: 'Lighthouse keepers read the weather by its flight path. Where it banks, the storm will turn.',
});

// ============ Caterpie line (bug) ============
add({
  id: 'larvit', name: 'Caterpie', types: ['verdant'],
  baseStats: { hp: 45, atk: 35, def: 40, spa: 30, spd: 35, spe: 40 },
  ability: 'regrowth', growth: 'fast', catchRate: 255, expYield: 39,
  evYield: { hp: 1 }, shape: 'insect',
  learnset: [[1, 'tackle'], [1, 'leechseed'], [7, 'thornvolley']],
  evolution: { method: 'level', level: 9, into: 'cocoonix' },
  flavor: 'It eats its weight in leaves daily and sleeps stuck to the underside of branches.',
});
add({
  id: 'cocoonix', name: 'Metapod', types: ['verdant'],
  baseStats: { hp: 50, atk: 30, def: 70, spa: 35, spd: 55, spe: 25 },
  ability: 'stonewall', growth: 'fast', catchRate: 200, expYield: 60,
  evYield: { def: 1 }, shape: 'blob',
  learnset: [[1, 'tackle'], [1, 'bulwark']],
  evolution: { method: 'level', level: 15, into: 'flutterveil' },
  flavor: 'Inside the silk shell, its body is rewriting itself. Tap it and it hums back, annoyed.',
});
add({
  id: 'flutterveil', name: 'Butterfree', types: ['verdant', 'gale'],
  baseStats: { hp: 65, atk: 45, def: 55, spa: 90, spd: 75, spe: 84 },
  ability: 'levitate', growth: 'fast', catchRate: 75, expYield: 168,
  evYield: { spa: 2 }, shape: 'insect',
  learnset: [[1, 'gustcut'], [1, 'sleepspore'], [15, 'sporeburst'], [20, 'dazzle'], [26, 'razorgale'], [32, 'luminance'], [38, 'tempest']],
  flavor: 'Powder from its wings glitters like stained glass. A single wingbeat scatters sleep over a meadow.',
});

// ============ Pikachu line (Volt) ============
add({
  id: 'sparkit', name: 'Pikachu', types: ['volt'],
  baseStats: { hp: 45, atk: 50, def: 40, spa: 65, spd: 50, spe: 80 },
  ability: 'staticcharge', growth: 'mediumFast', catchRate: 190, expYield: 70,
  evYield: { spe: 1 }, shape: 'quadruped',
  learnset: [[1, 'scratch'], [1, 'growl'], [6, 'sparkshot'], [11, 'quickstrike'], [16, 'voltclaw'], [22, 'staticfield'], [28, 'overclock'], [34, 'thunderlance']],
  evolution: { method: 'level', level: 24, into: 'voltail' },
  flavor: 'Its fur crackles when stroked. It hoards lost batteries under porches and licks them.',
});
add({
  id: 'voltail', name: 'Raichu', types: ['volt'],
  baseStats: { hp: 65, atk: 70, def: 58, spa: 100, spd: 72, spe: 110 },
  ability: 'staticcharge', growth: 'mediumFast', catchRate: 75, expYield: 180,
  evYield: { spe: 2 }, shape: 'quadruped',
  learnset: [[1, 'sparkshot'], [1, 'quickstrike'], [1, 'voltclaw'], [22, 'staticfield'], [28, 'overclock'], [34, 'thunderlance'], [42, 'stormcall'], [50, 'zapcannon']],
  flavor: 'Its three tails are living lightning rods. Whole towns once chained them to their roofs.',
});

// ============ Geodude line (Terra) ============
add({
  id: 'pebblit', name: 'Geodude', types: ['terra'],
  baseStats: { hp: 50, atk: 65, def: 80, spa: 30, spd: 45, spe: 25 },
  ability: 'stonewall', growth: 'mediumSlow', catchRate: 190, expYield: 60,
  evYield: { def: 1 }, shape: 'golem',
  learnset: [[1, 'tackle'], [1, 'leer'], [6, 'rocktoss'], [11, 'bulwark'], [16, 'mudshot'], [22, 'landslide'], [30, 'stoneedge']],
  evolution: { method: 'level', level: 22, into: 'bouldrok' },
  flavor: 'Easily mistaken for a pebble, until the pebble bites your boot.',
});
add({
  id: 'bouldrok', name: 'Graveler', types: ['terra'],
  baseStats: { hp: 70, atk: 90, def: 105, spa: 40, spd: 60, spe: 35 },
  ability: 'stonewall', growth: 'mediumSlow', catchRate: 90, expYield: 145,
  evYield: { def: 2 }, shape: 'golem',
  learnset: [[1, 'rocktoss'], [1, 'bulwark'], [1, 'mudshot'], [22, 'landslide'], [30, 'stoneedge'], [38, 'quake'], [46, 'detonate']],
  evolution: { method: 'level', level: 40, into: 'terradon' },
  flavor: 'It rolls downhill to travel and simply walks back up. Roads in quarry country bend around it.',
});
add({
  id: 'terradon', name: 'Golem', types: ['terra'],
  baseStats: { hp: 90, atk: 115, def: 125, spa: 50, spd: 75, spe: 45 },
  ability: 'prismshield', growth: 'mediumSlow', catchRate: 45, expYield: 230,
  evYield: { def: 3 }, shape: 'golem',
  learnset: [[1, 'rocktoss'], [1, 'mudshot'], [1, 'landslide'], [30, 'stoneedge'], [38, 'bulwark'], [44, 'quake'], [52, 'crushgrip']],
  flavor: 'Geologists argue over whether it is a creature with a mountain on it, or a mountain with a creature in it.',
});

// ============ Goldeen line (Aqua fish) ============
add({
  id: 'finlet', name: 'Goldeen', types: ['aqua'],
  baseStats: { hp: 40, atk: 45, def: 42, spa: 60, spd: 48, spe: 70 },
  ability: 'tidalsurge', growth: 'mediumFast', catchRate: 225, expYield: 56,
  evYield: { spa: 1 }, shape: 'fish',
  learnset: [[1, 'splashjet'], [4, 'leer'], [9, 'bubblebind'], [14, 'aquafang'], [20, 'mistveil'], [26, 'ripcurrent']],
  evolution: { method: 'level', level: 26, into: 'marlance' },
  flavor: 'It leaps from the water to snap at dragonflies, and misses, every single time.',
});
add({
  id: 'marlance', name: 'Seaking', types: ['aqua'],
  baseStats: { hp: 62, atk: 78, def: 60, spa: 92, spd: 66, spe: 102 },
  ability: 'adaptive', growth: 'mediumFast', catchRate: 80, expYield: 170,
  evYield: { spa: 2 }, shape: 'fish',
  learnset: [[1, 'splashjet'], [1, 'bubblebind'], [1, 'aquafang'], [26, 'ripcurrent'], [32, 'frostbite'], [38, 'tidalsmash'], [46, 'maelstrom']],
  flavor: 'Its bill can pierce a ship’s hull. Racing one along a current is a coastal rite of passage.',
});

// ============ Ponyta line (Inferno/Terra) ============
add({
  id: 'magmite', name: 'Ponyta', types: ['inferno', 'terra'],
  baseStats: { hp: 55, atk: 70, def: 75, spa: 50, spd: 50, spe: 30 },
  ability: 'thermalcore', growth: 'mediumSlow', catchRate: 150, expYield: 75,
  evYield: { atk: 1 }, shape: 'golem',
  learnset: [[1, 'ember'], [1, 'rocktoss'], [10, 'leer'], [16, 'flamefang'], [22, 'landslide'], [28, 'scorch'], [36, 'stoneedge']],
  evolution: { method: 'level', level: 28, into: 'magmaul' },
  flavor: 'A crust of cooled lava hides its molten core. It dozes in kiln rooms, paying rent in heat.',
});
add({
  id: 'magmaul', name: 'Rapidash', types: ['inferno', 'terra'],
  baseStats: { hp: 75, atk: 100, def: 95, spa: 70, spd: 70, spe: 40 },
  ability: 'thermalcore', growth: 'mediumSlow', catchRate: 60, expYield: 175,
  evYield: { atk: 2 }, shape: 'golem',
  learnset: [[1, 'ember'], [1, 'rocktoss'], [1, 'flamefang'], [22, 'landslide'], [28, 'scorch'], [36, 'stoneedge'], [44, 'quake'], [50, 'infernova']],
  flavor: 'When it claps its fists together, the shockwave glows. Smiths beg shavings off its knuckles.',
});

// ============ Growlithe line (Umbra) ============
add({
  id: 'shadepup', name: 'Growlithe', types: ['umbra'],
  baseStats: { hp: 50, atk: 65, def: 45, spa: 60, spd: 45, spe: 70 },
  ability: 'menace', growth: 'mediumFast', catchRate: 140, expYield: 72,
  evYield: { atk: 1 }, shape: 'quadruped',
  learnset: [[1, 'shadowsnap'], [1, 'leer'], [8, 'quickstrike'], [13, 'nightshade'], [19, 'dreadgaze'], [25, 'umbralclaw'], [32, 'shadowsneak'], [40, 'voidpulse']],
  evolution: { method: 'item', item: 'duskstone', into: 'duskhound' },
  flavor: 'It naps inside other creatures’ shadows for warmth. The shadows do not seem to mind.',
});
add({
  id: 'duskhound', name: 'Arcanine', types: ['umbra'],
  baseStats: { hp: 70, atk: 95, def: 62, spa: 88, spd: 62, spe: 98 },
  ability: 'menace', growth: 'mediumFast', catchRate: 50, expYield: 178,
  evYield: { atk: 2 }, shape: 'quadruped',
  learnset: [[1, 'shadowsnap'], [1, 'nightshade'], [1, 'umbralclaw'], [25, 'dreadgaze'], [32, 'shadowsneak'], [40, 'voidpulse'], [48, 'eclipse']],
  flavor: 'It howls at the new moon — the only night dark enough to hide its whole pack at once.',
});

// ============ Clefairy line (Lumina) ============
add({
  id: 'glimkit', name: 'Clefairy', types: ['lumina'],
  baseStats: { hp: 48, atk: 40, def: 48, spa: 70, spd: 62, spe: 52 },
  ability: 'purebody', growth: 'mediumFast', catchRate: 140, expYield: 70,
  evYield: { spa: 1 }, shape: 'spirit',
  learnset: [[1, 'glimmer'], [1, 'growl'], [8, 'dazzle'], [13, 'halostrike'], [19, 'luminance'], [25, 'radiantbeam'], [33, 'purifyinglight']],
  evolution: { method: 'item', item: 'dawnstone', into: 'luminara' },
  flavor: 'It glows brighter when praised. Children carry them in lanterns that are never lit.',
});
add({
  id: 'luminara', name: 'Clefable', types: ['lumina'],
  baseStats: { hp: 68, atk: 55, def: 68, spa: 108, spd: 92, spe: 74 },
  ability: 'prismshield', growth: 'mediumFast', catchRate: 50, expYield: 184,
  evYield: { spa: 2 }, shape: 'spirit',
  learnset: [[1, 'glimmer'], [1, 'dazzle'], [1, 'halostrike'], [25, 'radiantbeam'], [33, 'purifyinglight'], [41, 'luminance'], [49, 'novaflare']],
  flavor: 'Its halo bends light into gentle illusions. Lost travelers follow it home and forget they were lost.',
});

// ============ Zubat line (Gale/Umbra bat) ============
add({
  id: 'battik', name: 'Zubat', types: ['gale', 'umbra'],
  baseStats: { hp: 42, atk: 50, def: 38, spa: 52, spd: 40, spe: 75 },
  ability: 'keeneye', growth: 'mediumFast', catchRate: 225, expYield: 54,
  evYield: { spe: 1 }, shape: 'bird',
  learnset: [[1, 'gustcut'], [1, 'leer'], [7, 'shadowsnap'], [12, 'wingstrike'], [18, 'nightshade'], [24, 'shadowsneak'], [30, 'razorgale']],
  evolution: { method: 'level', level: 26, into: 'nocturnix' },
  flavor: 'It maps caves by singing into the dark and remembering the shape of the echo.',
});
add({
  id: 'nocturnix', name: 'Golbat', types: ['gale', 'umbra'],
  baseStats: { hp: 66, atk: 72, def: 58, spa: 82, spd: 64, spe: 105 },
  ability: 'keeneye', growth: 'mediumFast', catchRate: 75, expYield: 160,
  evYield: { spe: 2 }, shape: 'bird',
  learnset: [[1, 'gustcut'], [1, 'shadowsnap'], [1, 'wingstrike'], [24, 'shadowsneak'], [30, 'razorgale'], [37, 'voidpulse'], [44, 'tempest']],
  flavor: 'On moonless nights it flies so silently that owls turn to watch it pass, professionally jealous.',
});

// ============ Singles ============
add({
  id: 'murklob', name: 'Muk', types: ['aqua', 'umbra'],
  baseStats: { hp: 80, atk: 60, def: 70, spa: 85, spd: 90, spe: 35 },
  ability: 'venomhide', growth: 'mediumFast', catchRate: 90, expYield: 165,
  evYield: { spd: 2 }, shape: 'blob',
  learnset: [[1, 'splashjet'], [1, 'toxin'], [12, 'bubblebind'], [18, 'nightshade'], [24, 'voidpulse'], [30, 'ripcurrent'], [38, 'rest'], [44, 'maelstrom']],
  flavor: 'It drifts in harbor shallows pretending to be a sunken coat. Do not pick up the coat.',
});
add({
  id: 'magnerock', name: 'Magneton', types: ['terra', 'volt'],
  baseStats: { hp: 60, atk: 55, def: 95, spa: 90, spd: 75, spe: 45 },
  ability: 'levitate', growth: 'mediumFast', catchRate: 90, expYield: 168,
  evYield: { def: 1, spa: 1 }, shape: 'golem',
  learnset: [[1, 'sparkshot'], [1, 'rocktoss'], [14, 'staticfield'], [20, 'mudshot'], [26, 'thunderlance'], [32, 'bulwark'], [40, 'stoneedge'], [48, 'zapcannon']],
  flavor: 'A lodestone that woke up. It hovers a stubborn hand-width above the ground at all times.',
});

// ============ Cubone line (Link Stone) ============
add({
  id: 'golemite', name: 'Cubone', types: ['terra'],
  baseStats: { hp: 70, atk: 85, def: 90, spa: 40, spd: 55, spe: 30 },
  ability: 'grit', growth: 'slow', catchRate: 100, expYield: 135,
  evYield: { atk: 1, def: 1 }, shape: 'golem',
  learnset: [[1, 'tackle'], [1, 'rocktoss'], [12, 'bulwark'], [18, 'landslide'], [26, 'crushgrip'], [34, 'stoneedge'], [42, 'quake']],
  evolution: { method: 'item', item: 'linkstone', into: 'gargantuan' },
  flavor: 'Carved by a civilization no one remembers, animated by something no one understands.',
});
add({
  id: 'gargantuan', name: 'Marowak', types: ['terra'],
  baseStats: { hp: 95, atk: 120, def: 115, spa: 50, spd: 70, spe: 40 },
  ability: 'grit', growth: 'slow', catchRate: 45, expYield: 223,
  evYield: { atk: 2, def: 1 }, shape: 'golem',
  learnset: [[1, 'rocktoss'], [1, 'bulwark'], [1, 'landslide'], [26, 'crushgrip'], [34, 'stoneedge'], [42, 'quake'], [50, 'detonate']],
  flavor: 'Two Cubone bonded through a Link Stone become one. It remembers being both of them.',
});

// ============ Dratini line (pseudo-legendary) ============
add({
  id: 'draklet', name: 'Dratini', types: ['gale'],
  baseStats: { hp: 45, atk: 60, def: 45, spa: 55, spd: 45, spe: 55 },
  ability: 'momentum', growth: 'slow', catchRate: 45, expYield: 65,
  evYield: { atk: 1 }, shape: 'serpent',
  learnset: [[1, 'scratch'], [1, 'leer'], [9, 'gustcut'], [15, 'wingstrike'], [22, 'skydance'], [29, 'razorgale']],
  evolution: { method: 'level', level: 30, into: 'drakhorn' },
  flavor: 'Hatchlings glide before they can walk. They imprint on the first storm they survive.',
});
add({
  id: 'drakhorn', name: 'Dragonair', types: ['gale'],
  baseStats: { hp: 62, atk: 82, def: 64, spa: 75, spd: 62, spe: 75 },
  ability: 'momentum', growth: 'slow', catchRate: 45, expYield: 150,
  evYield: { atk: 2 }, shape: 'serpent',
  learnset: [[1, 'gustcut'], [1, 'wingstrike'], [1, 'skydance'], [29, 'razorgale'], [35, 'flamefang'], [41, 'divebomb']],
  evolution: { method: 'level', level: 48, into: 'dracryon' },
  flavor: 'Its horns ring like struck bronze in high wind. Mountain monks tune their bells to the sound.',
});
add({
  id: 'dracryon', name: 'Dragonite', types: ['gale', 'inferno'],
  baseStats: { hp: 88, atk: 120, def: 85, spa: 110, spd: 85, spe: 112 },
  ability: 'adaptive', growth: 'slow', catchRate: 30, expYield: 290,
  evYield: { atk: 3 }, shape: 'serpent',
  learnset: [[1, 'wingstrike'], [1, 'skydance'], [1, 'razorgale'], [35, 'flamefang'], [41, 'divebomb'], [48, 'scorch'], [55, 'tempest'], [62, 'infernova']],
  flavor: 'It breathes heat-shimmer instead of flame; the sky warps around it as it flies.',
});

// ============ Legendary ============
add({
  id: 'umbralis', name: 'Mewtwo', types: ['umbra', 'lumina'],
  baseStats: { hp: 100, atk: 90, def: 95, spa: 130, spd: 110, spe: 105 },
  ability: 'prismshield', growth: 'slow', catchRate: 3, expYield: 340,
  evYield: { spa: 3 }, shape: 'spirit',
  learnset: [[1, 'voidpulse'], [1, 'radiantbeam'], [1, 'dreadgaze'], [1, 'luminance'], [55, 'eclipse'], [60, 'novaflare'], [65, 'purifyinglight'], [70, 'tempest']],
  flavor: 'Half its body absorbs all light; the other half releases it. Eclipses are said to be its heartbeat.',
});

export function speciesById(id: string): SpeciesData {
  const s = SPECIES[id];
  if (!s) throw new Error(`Unknown species: ${id}`);
  return s;
}

/** Moves a species knows at a given level: latest 4 from its learnset. */
export function movesAtLevel(id: string, level: number): string[] {
  const s = speciesById(id);
  const known: string[] = [];
  for (const [lvl, move] of s.learnset) {
    if (lvl <= level && !known.includes(move)) known.push(move);
  }
  return known.slice(-4);
}
