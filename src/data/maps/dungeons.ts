/**
 * Dungeon maps — caves, the Eclipse warehouse/hideout, Hollow Isle, the
 * Spire, Victory Road, and the League buildings.
 */
import type { MapDef } from './defs';

export const DUNGEON_MAPS: MapDef[] = [];
function add(m: MapDef) {
  DUNGEON_MAPS.push(m);
}

// ============================================================== Quarry Cave
add({
  id: 'quarry',
  name: 'Duskhollow Quarry',
  music: 'cave',
  indoor: true,
  grid: [
    'CCCCCCCCCCCCCCCCCCCC',
    'CcceeecccccceeecccsC',
    'CcceeeccBccceeeccccC',
    'CcccccccccccccccccCC',
    'CccCCCCccccCCCCcccCC',
    'CccCeeeccccceeCcccMC',
    'CccCeeecBccceeCcccMC',
    'CcccccccccccccccccCC',
    'CccccccceeeeccccccCC',
    'CBcccccceeeecccccBCC',
    'CcccccccccccccccccCC',
    'CCCCCCCCCvCCCCCCCCCC',
  ],
  spawns: {
    entrance: { x: 9, y: 10, facing: 'up' },
    depths: { x: 17, y: 5, facing: 'left' },
  },
  warps: [
    { x: 9, y: 11, to: 'duskhollow', spawn: 'quarry' },
    { x: 18, y: 5, to: 'quarrydepths', spawn: 'top' },
    { x: 18, y: 6, to: 'quarrydepths', spawn: 'top' },
  ],
  signs: [{ x: 18, y: 1, text: 'QUARRY NOTICE\nShard veins below. Climbing Gear required past this point.' }],
  npcs: [
    {
      id: 'qgrunt1',
      sprite: 'grunt',
      x: 6,
      y: 3,
      facing: 'down',
      showIf: { flag: 'quarryEclipseDone', not: true },
      script: 'quarry-eclipse1',
    },
    {
      id: 'qgrunt2',
      sprite: 'grunt',
      x: 12,
      y: 8,
      facing: 'left',
      showIf: { flag: 'quarryEclipseDone', not: true },
      script: 'quarry-eclipse2',
    },
    { id: 'item1', sprite: 'boy', x: 1, y: 10, facing: 'down', itemPickup: { item: 'superpotion', qty: 1 } },
    { id: 'item2', sprite: 'boy', x: 16, y: 2, facing: 'down', itemPickup: { item: 'ether', qty: 1 } },
  ],
  encounters: {
    rate: 0.13,
    grass: [
      { speciesId: 'pebblit', min: 8, max: 11, weight: 35 },
      { speciesId: 'golemite', min: 10, max: 12, weight: 25 },
      { speciesId: 'battik', min: 9, max: 11, weight: 30 },
      { speciesId: 'magnerock', min: 11, max: 12, weight: 10 },
    ],
  },
});

add({
  id: 'quarrydepths',
  name: 'Quarry Depths',
  music: 'cave',
  indoor: true,
  grid: [
    'CCCCCCCCCCCCCCCC',
    'CvcccccccccccccC',
    'CcceeeccccBeeccC',
    'CcceeeccccceeccC',
    'CccccccBccccccCC',
    'CcCCCCccccCCCcCC',
    'CcceeecccccccccC',
    'CcceeeccBcceeccC',
    'CccccccccceeccCC',
    'CCCCCCCCCCCCCCCC',
  ],
  spawns: { top: { x: 1, y: 1, facing: 'down' } },
  warps: [{ x: 1, y: 1, to: 'quarry', spawn: 'depths' }],
  npcs: [
    { id: 'item1', sprite: 'boy', x: 13, y: 6, facing: 'down', itemPickup: { item: 'emberstone', qty: 1 } },
    { id: 'item2', sprite: 'boy', x: 5, y: 8, facing: 'down', itemPickup: { item: 'leftovers', qty: 1 } },
    { id: 'item3', sprite: 'boy', x: 14, y: 3, facing: 'down', itemPickup: { item: 'maxrevive', qty: 1 } },
  ],
  encounters: {
    rate: 0.14,
    grass: [
      { speciesId: 'golemite', min: 26, max: 30, weight: 35 },
      { speciesId: 'magnerock', min: 26, max: 30, weight: 30 },
      { speciesId: 'battik', min: 27, max: 30, weight: 25 },
      { speciesId: 'bouldrok', min: 28, max: 31, weight: 10 },
    ],
  },
});

// ============================================================== Mt. Cinder
add({
  id: 'mtcinder',
  name: 'Mt. Cinder Tunnel',
  music: 'cave',
  indoor: true,
  grid: [
    'CCCCCCCCCCCCCCCCCCCCCCCC',
    'CcccccccccccccccccccccsC',
    'CcceeeccCCCCcceeeccccccC',
    'CcceeeccCCCCcceeecccccc,',
    'CccccccccccccccccccccccC',
    'CccCCcccceeeccccCCccccCC',
    'CccCCccBceeeccccCCccccCC',
    'CcccccccccccccccccccccCC',
    'CcceeeccccccBcceeeccccCC',
    'CcceeecccccccceeeccccCCC',
    'CccccccccccccccccccccCCC',
    'CCCCCCCCCCC,,CCCCCCCCCCC',
  ],
  spawns: {
    east: { x: 22, y: 3, facing: 'left' },
    south: { x: 11, y: 10, facing: 'up' },
  },
  edges: [
    { side: 'east', to: 'route7', spawn: 'west' },
    { side: 'south', to: 'cinderpeak', spawn: 'north' },
  ],
  signs: [{ x: 22, y: 1, text: 'MT. CINDER TUNNEL\nWest stair: Cinderpeak\nEast mouth: Route 7' }],
  npcs: [
    {
      id: 'pyra',
      sprite: 'scientist',
      x: 10,
      y: 7,
      facing: 'right',
      trainer: { trainerId: 'mtcinder-scientist', sightRange: 3 },
      dialogue: ['The readings spike near you...'],
    },
    { id: 'item1', sprite: 'boy', x: 1, y: 10, facing: 'down', itemPickup: { item: 'hyperpotion', qty: 1 } },
    { id: 'item2', sprite: 'boy', x: 20, y: 8, facing: 'down', itemPickup: { item: 'infernocharm', qty: 1 } },
  ],
  encounters: {
    rate: 0.14,
    grass: [
      { speciesId: 'magmite', min: 22, max: 25, weight: 35 },
      { speciesId: 'pebblit', min: 22, max: 24, weight: 20 },
      { speciesId: 'battik', min: 22, max: 25, weight: 25 },
      { speciesId: 'magnerock', min: 23, max: 25, weight: 15 },
      { speciesId: 'draklet', min: 24, max: 26, weight: 5 },
    ],
  },
});

// ============================================================== Warehouse
add({
  id: 'warehouse',
  name: 'Port Maren Warehouse',
  music: 'evil',
  indoor: true,
  grid: [
    'XXXXXXXXXXXXXXXX',
    'XddddddddddddddX',
    'XdXXddddddXXdddX',
    'XddddBddddddddX'.slice(0, 15) + 'X',
    'XddddddddddBdddX',
    'XdXXdddddddXXddX',
    'XddddddddddddddX',
    'XXXXXXXaaXXXXXXX',
  ],
  spawns: { door: { x: 7, y: 6, facing: 'up' } },
  warps: [
    { x: 7, y: 7, to: 'portmaren', spawn: 'warehouse-door' },
    { x: 8, y: 7, to: 'portmaren', spawn: 'warehouse-door' },
  ],
  npcs: [
    {
      id: 'wgrunt1',
      sprite: 'grunt',
      x: 4,
      y: 2,
      facing: 'down',
      showIf: { flag: 'warehouseCleared', not: true },
      trainer: { trainerId: 'eclipse-port1', sightRange: 4 },
      dialogue: ['The shipment is ours.'],
    },
    {
      id: 'wgrunt2',
      sprite: 'grunt',
      x: 12,
      y: 4,
      facing: 'left',
      showIf: { flag: 'warehouseCleared', not: true },
      trainer: { trainerId: 'eclipse-port2', sightRange: 3 },
      dialogue: ['You AGAIN?!'],
    },
    {
      id: 'mordent',
      sprite: 'admin',
      x: 8,
      y: 1,
      facing: 'down',
      showIf: { flag: 'warehouseCleared', not: true },
      script: 'warehouse-admin',
    },
    { id: 'item1', sprite: 'boy', x: 1, y: 6, facing: 'down', itemPickup: { item: 'lumberry', qty: 2 } },
  ],
});

// ============================================================== Hollow Isle
add({
  id: 'hollowisle',
  name: 'Hollow Isle',
  music: 'evil',
  grid: [
    '#########,,#########',
    '#SSSSSSSS,,SSSSSSSS#',
    '#SSSSSSSSSSSSSSSSSS#',
    '#SSXXXXXSSSXXXXXSSS#',
    '#SSXdddXSSSXdddXSSS#',
    '#SSXXDXXSSSXXDXXSSS#',
    '#SSSSSSSSSSSSSSSSSS#',
    '#SSSSSSSsSSSSSSSSSS#',
    '#SSSSSSSSSSSSSSSSSS#',
    '####################',
  ],
  spawns: {
    north: { x: 9, y: 1, facing: 'down' },
    'hideout-door': { x: 5, y: 6, facing: 'down' },
    'spire-door': { x: 13, y: 6, facing: 'down' },
  },
  edges: [{ side: 'north', to: 'route11', spawn: 'south' }],
  warps: [
    { x: 5, y: 5, to: 'hideout', spawn: 'door' },
    {
      x: 13,
      y: 5,
      to: 'spire',
      spawn: 'door',
      requires: 'hasEclipseKey',
      failText: 'The Spire door is sealed by a lock shaped like a crescent moon.\nSomething important must open it...',
    },
  ],
  signs: [{ x: 8, y: 7, text: 'HOLLOW ISLE\nWest ruin: an old cellar, recently disturbed.\nEast ruin: the Twinlight Spire.' }],
  npcs: [],
});

// ============================================================== Hideout
add({
  id: 'hideout',
  name: 'Eclipse Hideout',
  music: 'evil',
  indoor: true,
  grid: [
    'XXXXXXXXXXXXXXXXXX',
    'XddddddddddddddddX',
    'XdXXXddddddXXXXddX',
    'XddddddBddddddddX'.slice(0, 17) + 'X',
    'XdXXdddddddddXXddX',
    'XddddddddddddddddX',
    'XdddXXXddddXXXdddX',
    'XddddddddddddddddX',
    'XXXXXXXXaaXXXXXXXX',
  ],
  spawns: { door: { x: 8, y: 7, facing: 'up' } },
  warps: [
    { x: 8, y: 8, to: 'hollowisle', spawn: 'hideout-door' },
    { x: 9, y: 8, to: 'hollowisle', spawn: 'hideout-door' },
  ],
  npcs: [
    {
      id: 'hgrunt1',
      sprite: 'grunt',
      x: 4,
      y: 5,
      facing: 'right',
      showIf: { flag: 'hideoutCleared', not: true },
      trainer: { trainerId: 'eclipse-hideout1', sightRange: 4 },
      dialogue: ['INTRUDER!'],
    },
    {
      id: 'hgrunt2',
      sprite: 'grunt',
      x: 13,
      y: 3,
      facing: 'down',
      showIf: { flag: 'hideoutCleared', not: true },
      trainer: { trainerId: 'eclipse-hideout2', sightRange: 3 },
      dialogue: ['Silence!'],
    },
    {
      id: 'mordent2',
      sprite: 'admin',
      x: 8,
      y: 3,
      facing: 'down',
      showIf: { flag: 'hideoutCleared', not: true },
      script: 'hideout-admin',
    },
    {
      id: 'noxim',
      sprite: 'boss',
      x: 9,
      y: 1,
      facing: 'down',
      showIf: { flag: 'hideoutCleared', not: true },
      script: 'hideout-boss',
    },
    { id: 'item1', sprite: 'boy', x: 16, y: 7, facing: 'down', itemPickup: { item: 'fullrestore', qty: 2 } },
    { id: 'item2', sprite: 'boy', x: 1, y: 7, facing: 'down', itemPickup: { item: 'focussash', qty: 1 } },
  ],
});

// ============================================================== Spire
add({
  id: 'spire',
  name: 'Twinlight Spire',
  music: 'evil',
  indoor: true,
  grid: [
    'XXXXXXXXXXXX',
    'XddddddddddX',
    'XdddAddAdddX',
    'XddddddddddX',
    'XddddddddddX',
    'XdddAddAdddX',
    'XddddddddddX',
    'XXXXXaaXXXXX',
  ],
  spawns: { door: { x: 5, y: 6, facing: 'up' } },
  warps: [
    { x: 5, y: 7, to: 'hollowisle', spawn: 'spire-door' },
    { x: 6, y: 7, to: 'hollowisle', spawn: 'spire-door' },
  ],
  npcs: [
    {
      id: 'noxim2',
      sprite: 'boss',
      x: 5,
      y: 2,
      facing: 'down',
      showIf: { flag: 'spireCleared', not: true },
      script: 'spire-boss',
    },
    {
      id: 'umbralis',
      sprite: 'boy',
      creatureSprite: 'umbralis',
      x: 6,
      y: 1,
      facing: 'down',
      showIf: { flag: 'umbralisResolved', not: true },
      script: 'umbralis-encounter',
    },
  ],
  triggers: [
    { x: 5, y: 4, script: 'spire-boss', showIf: { flag: 'spireCleared', not: true } },
    { x: 6, y: 4, script: 'spire-boss', showIf: { flag: 'spireCleared', not: true } },
  ],
});

// ============================================================== Victory Road
add({
  id: 'victoryroad',
  name: 'Victory Road',
  music: 'cave',
  indoor: true,
  grid: [
    'CCCCCCCCCC,,CCCCCCCC',
    'CccccccccccccccccccC',
    'CcceeeccCCCCceeecccC',
    'CcceeeccCCCCceeecccC',
    'CccccccccccccccccccC',
    'CcCCccccBccccccCCccC',
    'CcCCcccccccccccCCccC',
    'CccccceeeecccccccccC',
    'CccccceeeeccccBccccC',
    'CccccccccccccccccccC',
    'CBccCCCCccccCCCCcccC',
    'CcccCCCCceecCCCCcccC',
    'CccccccccccccccccccC',
    'CCCCCCCCC,,CCCCCCCCC',
  ],
  spawns: {
    south: { x: 9, y: 12, facing: 'up' },
    north: { x: 10, y: 1, facing: 'down' },
  },
  edges: [
    { side: 'south', to: 'route12', spawn: 'north' },
    { side: 'north', to: 'league', spawn: 'lobby' },
  ],
  npcs: [
    {
      id: 'ace1',
      sprite: 'ranger',
      x: 5,
      y: 4,
      facing: 'right',
      trainer: { trainerId: 'vr-ace1', sightRange: 4 },
      dialogue: ['Are you an almost?'],
    },
    {
      id: 'ace2',
      sprite: 'lass',
      x: 14,
      y: 7,
      facing: 'left',
      trainer: { trainerId: 'vr-ace2', sightRange: 4 },
      dialogue: ['One more battle, then.'],
    },
    {
      id: 'ace3',
      sprite: 'hiker',
      x: 10,
      y: 9,
      facing: 'down',
      trainer: { trainerId: 'vr-ace3', sightRange: 3 },
      dialogue: ['I AM the gate!'],
    },
    {
      id: 'rival5',
      sprite: 'rival',
      x: 10,
      y: 4,
      facing: 'down',
      showIf: { flag: 'rival5done', not: true },
      script: 'rival5',
    },
    { id: 'item1', sprite: 'boy', x: 1, y: 12, facing: 'down', itemPickup: { item: 'linkstone', qty: 1 } },
    { id: 'item2', sprite: 'boy', x: 18, y: 1, facing: 'down', itemPickup: { item: 'maxpotion', qty: 2 } },
  ],
  triggers: [
    { x: 9, y: 4, script: 'rival5', showIf: { flag: 'rival5done', not: true } },
    { x: 11, y: 4, script: 'rival5', showIf: { flag: 'rival5done', not: true } },
  ],
  encounters: {
    rate: 0.13,
    grass: [
      { speciesId: 'bouldrok', min: 39, max: 43, weight: 25 },
      { speciesId: 'magnerock', min: 38, max: 42, weight: 20 },
      { speciesId: 'duskhound', min: 39, max: 42, weight: 15 },
      { speciesId: 'golemite', min: 39, max: 42, weight: 25 },
      { speciesId: 'drakhorn', min: 40, max: 44, weight: 15 },
    ],
  },
});

// ============================================================== League
add({
  id: 'league',
  name: 'Veridia League',
  music: 'gym',
  indoor: true,
  grid: [
    'IIIIIIvvIIIIII',
    'IGGGGGGGGGGGGI',
    'IGGAGGGGGGAGGI',
    'IGGGGGGGGGGGGI',
    'IGGGGGGGGGGGGI',
    'IGGAGGGGGGAGGI',
    'IGGGGGGGGGGGGI',
    'IIIIIIaaIIIIII',
  ],
  spawns: { lobby: { x: 6, y: 6, facing: 'up' } },
  warps: [
    { x: 6, y: 7, to: 'victoryroad', spawn: 'north' },
    { x: 7, y: 7, to: 'victoryroad', spawn: 'north' },
    { x: 6, y: 0, to: 'elite1room', spawn: 'door' },
    { x: 7, y: 0, to: 'elite1room', spawn: 'door' },
  ],
  npcs: [
    {
      id: 'leaguenurse',
      sprite: 'nurse',
      x: 2,
      y: 4,
      facing: 'right',
      script: 'center-heal',
    },
    {
      id: 'attendant',
      sprite: 'guide',
      x: 11,
      y: 4,
      facing: 'left',
      dialogue: [
        'Beyond this hall wait the Elite Four — then the Champion.',
        'There is no healing between battles. Stock up and steel yourself.',
        'Once you step through, the only way out is victory... or the door behind you.',
      ],
    },
  ],
});

function eliteRoom(n: 1 | 2 | 3 | 4, eliteSprite: string, nextMap: string): MapDef {
  return {
    id: `elite${n}room`,
    name: `Elite Chamber ${n}`,
    music: 'gym',
    indoor: true,
    grid: [
      'IIIIIIvvIIIIII',
      'IGGGGGGGGGGGGI',
      'IGGGGGGGGGGGGI',
      'IGAGGGGGGGGAGI',
      'IGGGGGGGGGGGGI',
      'IIIIIIaaIIIIII',
    ],
    spawns: { door: { x: 6, y: 4, facing: 'up' }, back: { x: 6, y: 1, facing: 'down' } },
    warps: [
      { x: 6, y: 5, to: n === 1 ? 'league' : `elite${n - 1}room`, spawn: n === 1 ? 'lobby' : 'back' },
      { x: 7, y: 5, to: n === 1 ? 'league' : `elite${n - 1}room`, spawn: n === 1 ? 'lobby' : 'back' },
      {
        x: 6, y: 0, to: nextMap, spawn: 'door',
        requires: `elite${n}done`,
        failText: 'The door is sealed. The chamber\'s keeper must be defeated first.',
      },
      {
        x: 7, y: 0, to: nextMap, spawn: 'door',
        requires: `elite${n}done`,
        failText: 'The door is sealed. The chamber\'s keeper must be defeated first.',
      },
    ],
    npcs: [
      {
        id: `elite${n}`,
        sprite: eliteSprite,
        x: 6,
        y: 2,
        facing: 'down',
        script: `elite${n}-battle`,
      },
    ],
  };
}

add(eliteRoom(1, 'elite1', 'elite2room'));
add(eliteRoom(2, 'elite2', 'elite3room'));
add(eliteRoom(3, 'elite3', 'elite4room'));
add(eliteRoom(4, 'elite4', 'championroom'));

add({
  id: 'championroom',
  name: 'Champion Hall',
  music: 'gym',
  indoor: true,
  grid: [
    'IIIIIIIIIIIIII',
    'IGGGGGGGGGGGGI',
    'IGGAGGGGGGAGGI',
    'IGGGGkkGGGGGGI',
    'IGGGGkkGGGGGGI',
    'IGGGGGGGGGGGGI',
    'IIIIIIaaIIIIII',
  ],
  spawns: { door: { x: 6, y: 5, facing: 'up' } },
  warps: [
    { x: 6, y: 6, to: 'elite4room', spawn: 'back' },
    { x: 7, y: 6, to: 'elite4room', spawn: 'back' },
  ],
  npcs: [
    {
      id: 'champion',
      sprite: 'champion',
      x: 5,
      y: 3,
      facing: 'down',
      script: 'champion-battle',
    },
  ],
});
