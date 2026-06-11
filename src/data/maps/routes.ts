/**
 * Route & wilderness maps — the roads, forest, and sea of Veridia,
 * with their encounter tables, trainers, signs, and ground items.
 */
import type { MapDef } from './defs';

export const ROUTE_MAPS: MapDef[] = [];
function add(m: MapDef) {
  ROUTE_MAPS.push(m);
}

// ============================================================== Route 1
add({
  id: 'route1',
  name: 'Route 1',
  music: 'route',
  grid: [
    '#########,,#########',
    '#........,,........#',
    '#..ggg...,,....s...#',
    '#..ggg...,,........#',
    '#..ggg...,,..ggg...#',
    '#........,,..ggg...#',
    '#........,,..ggg...#',
    '#........,,........#',
    '#..f.....,,......f.#',
    '#....ggg.,,.ggg....#',
    '#....ggg.,,.ggg....#',
    '#....ggg.,,.ggg....#',
    '#........,,........#',
    '#........,,........#',
    '#..ggg...,,...ggg..#',
    '#..ggg...,,...ggg..#',
    '#........,,........#',
    '#...s....,,........#',
    '#........,,........#',
    '#........,,........#',
    '#########,,#########',
  ],
  spawns: {
    south: { x: 10, y: 19, facing: 'up' },
    north: { x: 10, y: 1, facing: 'down' },
  },
  edges: [
    { side: 'south', to: 'embervale', spawn: 'north' },
    { side: 'north', to: 'thornbury', spawn: 'south' },
  ],
  signs: [
    { x: 15, y: 2, text: 'ROUTE 1\nNorth: Thornbury  South: Embervale' },
    { x: 4, y: 17, text: 'Tall grass hides wild creatures!\nWalk through it to meet them.' },
  ],
  npcs: [
    {
      id: 'trainer1',
      sprite: 'boy',
      x: 13,
      y: 12,
      facing: 'left',
      trainer: { trainerId: 'r1-youngster', sightRange: 3 },
      dialogue: ['Tall grass is the best classroom!'],
    },
    { id: 'item1', sprite: 'boy', x: 3, y: 8, facing: 'down', itemPickup: { item: 'potion', qty: 1 } },
    {
      id: 'rival1',
      sprite: 'rival',
      x: 12,
      y: 18,
      facing: 'left',
      showIf: { flag: 'rival1done', not: true },
      script: 'rival1',
    },
  ],
  triggers: [
    { x: 9, y: 18, script: 'rival1', showIf: { flag: 'rival1done', not: true } },
    { x: 10, y: 18, script: 'rival1', showIf: { flag: 'rival1done', not: true } },
    { x: 11, y: 18, script: 'rival1', showIf: { flag: 'rival1done', not: true } },
  ],
  encounters: {
    rate: 0.14,
    grass: [
      { speciesId: 'nibbit', min: 2, max: 4, weight: 35 },
      { speciesId: 'chirpuff', min: 2, max: 4, weight: 35 },
      { speciesId: 'larvit', min: 2, max: 3, weight: 30 },
    ],
  },
});

// ============================================================== Whisperwood
add({
  id: 'whisperwood',
  name: 'Whisperwood',
  music: 'forest',
  grid: [
    '###########################',
    '#..........#....#.........#',
    '#.gggg.##..#.gg.#..gggg...#',
    '#.gggg.##....gg....gggg...#',
    '#.gggg.....#####..........#',
    '#......##..........##..#..#',
    '#..##..##..gggggg..##..#..#',
    ',..##......gggggg......#..#',
    ',..........gggggg.........,',
    '#..#####..............#...#',
    '#..#...#..ggg...ggg...##..#',
    '#..#.f.#..ggg...ggg...##..#',
    '#..#...#..ggg...ggg.......#',
    '#..#####..............s...#',
    '#.........##..##..........#',
    '#..gggg....######....f....#',
    '#..gggg...................#',
    '###########################',
  ],
  spawns: {
    east: { x: 26, y: 8, facing: 'left' },
    west: { x: 1, y: 7, facing: 'right' },
  },
  edges: [
    { side: 'east', to: 'thornbury', spawn: 'west' },
    { side: 'west', to: 'route2', spawn: 'east' },
  ],
  signs: [{ x: 22, y: 13, text: 'WHISPERWOOD\n"Listen. The leaves talk."' }],
  npcs: [
    {
      id: 'lass',
      sprite: 'lass',
      x: 7,
      y: 4,
      facing: 'down',
      trainer: { trainerId: 'forest-lass', sightRange: 3 },
      dialogue: ['The forest hums today...'],
    },
    {
      id: 'catcher',
      sprite: 'boy',
      x: 20,
      y: 12,
      facing: 'up',
      trainer: { trainerId: 'forest-catcher', sightRange: 3 },
      dialogue: ['Bugs rule!'],
    },
    { id: 'item1', sprite: 'boy', x: 5, y: 11, facing: 'down', itemPickup: { item: 'antidote', qty: 2 } },
    { id: 'item2', sprite: 'boy', x: 24, y: 15, facing: 'down', itemPickup: { item: 'basicball', qty: 3 } },
    {
      id: 'egrunt',
      sprite: 'grunt',
      x: 13,
      y: 7,
      facing: 'down',
      showIf: { flag: 'forestEclipseDone', not: true },
      script: 'forest-eclipse',
    },
    {
      id: 'glimkit',
      sprite: 'boy',
      creatureSprite: 'glimkit',
      x: 13,
      y: 8,
      facing: 'down',
      showIf: { flag: 'forestEclipseDone', not: true },
      script: 'forest-eclipse',
    },
  ],
  encounters: {
    rate: 0.16,
    grass: [
      { speciesId: 'larvit', min: 4, max: 6, weight: 30 },
      { speciesId: 'cocoonix', min: 5, max: 6, weight: 10 },
      { speciesId: 'chirpuff', min: 4, max: 6, weight: 20 },
      { speciesId: 'nibbit', min: 4, max: 6, weight: 18 },
      { speciesId: 'glimkit', min: 5, max: 7, weight: 10 },
      { speciesId: 'shadepup', min: 5, max: 7, weight: 10 },
      { speciesId: 'flutterveil', min: 8, max: 8, weight: 2 },
    ],
  },
});

// ============================================================== Route 2
add({
  id: 'route2',
  name: 'Route 2',
  music: 'route',
  grid: [
    '############################',
    '#..........................#',
    '#..ggg..ggg.....ggg........#',
    '#..ggg..ggg.....ggg....s...#',
    '#......................,...#',
    ',,,,,,,,,,,,,,,,,,,,,,,,,,,,',
    '#.....,....................,',
    '#..ggg,..ggg..ggg..........#',
    '#..ggg,..ggg..ggg..f.......#',
    '#......_____...............#',
    '#..........................#',
    '############################',
  ],
  spawns: {
    east: { x: 26, y: 5, facing: 'left' },
    west: { x: 1, y: 5, facing: 'right' },
  },
  edges: [
    { side: 'east', to: 'whisperwood', spawn: 'west' },
    { side: 'west', to: 'duskhollow', spawn: 'east' },
  ],
  signs: [{ x: 23, y: 3, text: 'ROUTE 2\nWest: Duskhollow  East: Whisperwood' }],
  npcs: [
    {
      id: 'hiker',
      sprite: 'hiker',
      x: 10,
      y: 6,
      facing: 'right',
      trainer: { trainerId: 'r2-hiker', sightRange: 3 },
      dialogue: ['Strong legs, strong life!'],
    },
    {
      id: 'wren',
      sprite: 'lass',
      x: 18,
      y: 4,
      facing: 'down',
      trainer: { trainerId: 'r2-lass', sightRange: 3 },
      dialogue: ['Static cling!'],
    },
    { id: 'item1', sprite: 'boy', x: 19, y: 8, facing: 'down', itemPickup: { item: 'superpotion', qty: 1 } },
  ],
  encounters: {
    rate: 0.13,
    grass: [
      { speciesId: 'nibbit', min: 6, max: 8, weight: 25 },
      { speciesId: 'chirpuff', min: 6, max: 8, weight: 25 },
      { speciesId: 'pebblit', min: 6, max: 8, weight: 30 },
      { speciesId: 'sparkit', min: 7, max: 9, weight: 20 },
    ],
  },
});

// ============================================================== Route 3
add({
  id: 'route3',
  name: 'Route 3',
  music: 'route',
  grid: [
    '#########,,#########',
    '#........,,........#',
    '#..ggg...,,...s....#',
    '#..ggg...,,........#',
    '#........,,..ggg...#',
    '#.._____.,,..ggg...#',
    '#........,,........#',
    '#..ggg...,,........#',
    '#..ggg...,,..ggg...#',
    '#........,,..ggg...#',
    '#........,,........#',
    '#..f.....,,.....f..#',
    '#........,,........#',
    '#..ggg...,,..ggg...#',
    '#..ggg...,,..ggg...#',
    '#........,,........#',
    '#########,,#########',
  ],
  spawns: {
    south: { x: 10, y: 15, facing: 'up' },
    north: { x: 10, y: 1, facing: 'down' },
  },
  edges: [
    { side: 'south', to: 'duskhollow', spawn: 'north' },
    { side: 'north', to: 'voltis', spawn: 'south' },
  ],
  signs: [{ x: 14, y: 2, text: 'ROUTE 3\nNorth: Voltis City  South: Duskhollow' }],
  npcs: [
    {
      id: 'ranger',
      sprite: 'ranger',
      x: 7,
      y: 7,
      facing: 'right',
      trainer: { trainerId: 'r3-ranger', sightRange: 4 },
      dialogue: ['Stay on the path, traveler.'],
    },
    {
      id: 'scientist',
      sprite: 'scientist',
      x: 13,
      y: 11,
      facing: 'left',
      trainer: { trainerId: 'r3-scientist', sightRange: 3 },
      dialogue: ['Data! I need data!'],
    },
    { id: 'item1', sprite: 'boy', x: 16, y: 11, facing: 'down', itemPickup: { item: 'paralyzeheal', qty: 2 } },
    {
      id: 'rival2',
      sprite: 'rival',
      x: 11,
      y: 13,
      facing: 'left',
      showIf: { flag: 'rival2done', not: true },
      script: 'rival2',
    },
  ],
  triggers: [
    { x: 9, y: 13, script: 'rival2', showIf: { flag: 'rival2done', not: true } },
    { x: 10, y: 13, script: 'rival2', showIf: { flag: 'rival2done', not: true } },
  ],
  encounters: {
    rate: 0.13,
    grass: [
      { speciesId: 'sparkit', min: 11, max: 13, weight: 30 },
      { speciesId: 'nibbit', min: 11, max: 13, weight: 20 },
      { speciesId: 'shadepup', min: 11, max: 13, weight: 20 },
      { speciesId: 'chirpuff', min: 12, max: 14, weight: 20 },
      { speciesId: 'magnerock', min: 12, max: 14, weight: 10 },
    ],
  },
});

// ============================================================== Route 4
add({
  id: 'route4',
  name: 'Route 4',
  music: 'route',
  grid: [
    '############################',
    '#..........................#',
    '#..ggg.....ggg.....s.......#',
    '#..ggg.....ggg.............#',
    '#..........................#',
    ',,,,,,,,,,,,,,,,,,,,,,,,,,,,',
    '#......,...................,',
    '#..ggg.,.ggg...ggg.........#',
    '#..ggg.,.ggg...ggg.........#',
    '#......,...................#',
    '#~~~~..,..~~~~~~~~~~~~~~~~~#',
    '#~~~~.,,..~~~~~~~~~~~~~~~~~#',
    '#~~~~.,...~~~~~~~~~~~~~~~~~#',
    '#############,,#############',
  ],
  spawns: {
    west: { x: 1, y: 5, facing: 'right' },
    east: { x: 26, y: 5, facing: 'left' },
    south: { x: 13, y: 12, facing: 'up' },
  },
  edges: [
    { side: 'west', to: 'voltis', spawn: 'east' },
    { side: 'east', to: 'portmaren', spawn: 'west' },
    { side: 'south', to: 'route5', spawn: 'north' },
  ],
  signs: [{ x: 19, y: 2, text: 'ROUTE 4 — Coast Road\nWest: Voltis  East: Port Maren\nSouth path: Route 5 (overgrown)' }],
  npcs: [
    {
      id: 'fisher',
      sprite: 'fisher',
      x: 8,
      y: 9,
      facing: 'down',
      trainer: { trainerId: 'r4-fisher', sightRange: 3 },
      dialogue: ['The sea provides.'],
    },
    {
      id: 'swimmer',
      sprite: 'swimmer',
      x: 20,
      y: 7,
      facing: 'left',
      trainer: { trainerId: 'r4-swimmer', sightRange: 4 },
      dialogue: ['Race you to the buoy!'],
    },
    { id: 'item1', sprite: 'boy', x: 23, y: 8, facing: 'down', itemPickup: { item: 'greatball', qty: 3 } },
  ],
  encounters: {
    rate: 0.12,
    grass: [
      { speciesId: 'sparkit', min: 13, max: 15, weight: 25 },
      { speciesId: 'galewing', min: 14, max: 16, weight: 25 },
      { speciesId: 'gnawber', min: 14, max: 16, weight: 20 },
      { speciesId: 'shadepup', min: 13, max: 15, weight: 20 },
      { speciesId: 'battik', min: 13, max: 15, weight: 10 },
    ],
    water: [
      { speciesId: 'finlet', min: 15, max: 22, weight: 60 },
      { speciesId: 'murklob', min: 18, max: 25, weight: 30 },
      { speciesId: 'marlance', min: 26, max: 28, weight: 10 },
    ],
  },
});

// ============================================================== Route 5
add({
  id: 'route5',
  name: 'Route 5',
  music: 'route',
  grid: [
    '#############,,#############',
    '#............,,............#',
    '#..ggg..b....,,............#',
    '#..ggg..#..b.,,..ggg..s....#',
    '#..........................#',
    ',,,,,b,,,,,,,,,,,,,b,,,,,,,#',
    '#..........................#',
    '#...ggg...b...ggg......b...#',
    '#...ggg.......ggg..........#',
    '#..........f...............#',
    '############################',
  ],
  spawns: {
    west: { x: 1, y: 5, facing: 'right' },
    north: { x: 13, y: 1, facing: 'down' },
  },
  edges: [
    { side: 'west', to: 'thornbury', spawn: 'east' },
    { side: 'north', to: 'route4', spawn: 'south' },
  ],
  signs: [{ x: 22, y: 3, text: 'ROUTE 5 — Bramble Pass\nWest: Thornbury  North: Coast Road\nDense brush: Cutter Charm required' }],
  npcs: [
    {
      id: 'camper',
      sprite: 'boy',
      x: 17,
      y: 7,
      facing: 'left',
      trainer: { trainerId: 'r5-boy', sightRange: 3 },
      dialogue: ['Camping is intense! In tents!'],
    },
    { id: 'item1', sprite: 'boy', x: 12, y: 9, facing: 'down', itemPickup: { item: 'oranberry', qty: 2 } },
    { id: 'item2', sprite: 'boy', x: 25, y: 8, facing: 'down', itemPickup: { item: 'tidestone', qty: 1 } },
  ],
  encounters: {
    rate: 0.13,
    grass: [
      { speciesId: 'shadepup', min: 9, max: 12, weight: 30 },
      { speciesId: 'battik', min: 9, max: 12, weight: 25 },
      { speciesId: 'nibbit', min: 9, max: 11, weight: 20 },
      { speciesId: 'glimkit', min: 10, max: 12, weight: 25 },
    ],
  },
});

// ============================================================== Route 6
add({
  id: 'route6',
  name: 'Route 6',
  music: 'route',
  grid: [
    '#########,,#########',
    '#........,,........#',
    '#..ggg...,,...s....#',
    '#..ggg...,,........#',
    '#........,,..ggg...#',
    '#___.....,,..ggg...#',
    '#........,,........#',
    '#..ggg...,,........#',
    '#..ggg...,,...___..#',
    '#........,,........#',
    '#..f.....,,..ggg...#',
    '#........,,..ggg...#',
    '#........,,........#',
    '#########,,#########',
  ],
  spawns: {
    south: { x: 10, y: 12, facing: 'up' },
    north: { x: 10, y: 1, facing: 'down' },
  },
  edges: [
    { side: 'south', to: 'portmaren', spawn: 'north' },
    { side: 'north', to: 'crestfall', spawn: 'south' },
  ],
  signs: [{ x: 14, y: 2, text: 'ROUTE 6 — Cliff Steps\nNorth: Crestfall  South: Port Maren' }],
  npcs: [
    {
      id: 'hiker',
      sprite: 'hiker',
      x: 7,
      y: 7,
      facing: 'right',
      trainer: { trainerId: 'r6-hiker', sightRange: 3 },
      dialogue: ['These cliffs test everyone.'],
    },
    {
      id: 'ranger',
      sprite: 'ranger',
      x: 13,
      y: 10,
      facing: 'left',
      trainer: { trainerId: 'r6-ranger', sightRange: 3 },
      dialogue: ['The wind howls tonight.'],
    },
    { id: 'item1', sprite: 'boy', x: 3, y: 10, facing: 'down', itemPickup: { item: 'hyperpotion', qty: 1 } },
  ],
  encounters: {
    rate: 0.13,
    grass: [
      { speciesId: 'galewing', min: 17, max: 19, weight: 30 },
      { speciesId: 'battik', min: 17, max: 19, weight: 25 },
      { speciesId: 'pebblit', min: 17, max: 19, weight: 25 },
      { speciesId: 'gnawber', min: 18, max: 20, weight: 15 },
      { speciesId: 'draklet', min: 18, max: 20, weight: 5 },
    ],
  },
});

// ============================================================== Route 7
add({
  id: 'route7',
  name: 'Route 7',
  music: 'route',
  grid: [
    '############################',
    '#RRRRRRRRRRRRRR............#',
    '#R.........................#',
    '#R..ggg...ggg....s.........#',
    '#...ggg...ggg..............#',
    ',,,,,,,,,,,,,,,,,,,,,,,,,,,,',
    '#..........................,',
    '#...ggg....ggg.....ggg.....#',
    '#...ggg....ggg.....ggg.....#',
    '#..........f...............#',
    '#RRRRRRRRRRRRRRRRRRRR......#',
    '############################',
  ],
  spawns: {
    east: { x: 26, y: 5, facing: 'left' },
    west: { x: 1, y: 5, facing: 'right' },
  },
  edges: [
    { side: 'east', to: 'crestfall', spawn: 'west' },
    { side: 'west', to: 'mtcinder', spawn: 'east' },
  ],
  signs: [{ x: 17, y: 3, text: 'ROUTE 7 — High Pass\nEast: Crestfall  West: Mt. Cinder Tunnel' }],
  npcs: [
    {
      id: 'hiker',
      sprite: 'hiker',
      x: 9,
      y: 6,
      facing: 'right',
      trainer: { trainerId: 'mtcinder-hiker', sightRange: 3 },
      dialogue: ['The tunnel ahead glows warm.'],
    },
    { id: 'item1', sprite: 'boy', x: 22, y: 8, facing: 'down', itemPickup: { item: 'fullheal', qty: 2 } },
  ],
  encounters: {
    rate: 0.13,
    grass: [
      { speciesId: 'galewing', min: 20, max: 23, weight: 25 },
      { speciesId: 'pebblit', min: 20, max: 23, weight: 25 },
      { speciesId: 'sparkit', min: 21, max: 23, weight: 20 },
      { speciesId: 'gnawber', min: 21, max: 24, weight: 20 },
      { speciesId: 'draklet', min: 21, max: 24, weight: 10 },
    ],
  },
});

// ============================================================== Route 8
add({
  id: 'route8',
  name: 'Route 8',
  music: 'route',
  grid: [
    '#########,,#########',
    '#........,,........#',
    '#..ggg...,,...s....#',
    '#..ggg...,,........#',
    '#........,,..ggg...#',
    '#........,,..ggg...#',
    '#..ggg...,,........#',
    '#..ggg...,,..ggg...#',
    '#........,,..ggg...#',
    '#...f....,,........#',
    '#........,,........#',
    '#..ggg...,,...f....#',
    '#..ggg...,,........#',
    '#........,,........#',
    '#########,,#########',
  ],
  spawns: {
    north: { x: 10, y: 1, facing: 'down' },
    south: { x: 10, y: 13, facing: 'up' },
  },
  edges: [
    { side: 'north', to: 'cinderpeak', spawn: 'south' },
    { side: 'south', to: 'nocturne', spawn: 'north' },
  ],
  signs: [{ x: 14, y: 2, text: 'ROUTE 8 — Dusk Road\nNorth: Cinderpeak  South: Nocturne' }],
  npcs: [
    {
      id: 'picnicker',
      sprite: 'girl',
      x: 6,
      y: 5,
      facing: 'right',
      trainer: { trainerId: 'r8-girl', sightRange: 3 },
      dialogue: ['The dusk light is perfect here.'],
    },
    {
      id: 'ranger',
      sprite: 'ranger',
      x: 14,
      y: 9,
      facing: 'left',
      trainer: { trainerId: 'r8-ranger', sightRange: 4 },
      dialogue: ['Almost full circle, traveler.'],
    },
    { id: 'item1', sprite: 'boy', x: 4, y: 9, facing: 'down', itemPickup: { item: 'duskstone', qty: 1 } },
  ],
  encounters: {
    rate: 0.13,
    grass: [
      { speciesId: 'shadepup', min: 25, max: 28, weight: 30 },
      { speciesId: 'glimkit', min: 25, max: 28, weight: 25 },
      { speciesId: 'flutterveil', min: 26, max: 28, weight: 20 },
      { speciesId: 'battik', min: 26, max: 29, weight: 20 },
      { speciesId: 'murklob', min: 27, max: 29, weight: 5 },
    ],
  },
});

// ============================================================== Route 10
add({
  id: 'route10',
  name: 'Route 10',
  music: 'route',
  grid: [
    '############################',
    '#..........................#',
    '#..ggg....ggg....s.........#',
    '#..ggg....ggg..............#',
    '#..........................#',
    ',,,,,,,,,,,,,,,,,,,,,,,,,,,,',
    '#..........................,',
    '#...ggg.....ggg....ggg.....#',
    '#...ggg.....ggg....ggg.....#',
    '#......f...........f.......#',
    '############################',
  ],
  spawns: {
    west: { x: 1, y: 5, facing: 'right' },
    east: { x: 26, y: 5, facing: 'left' },
  },
  edges: [
    { side: 'west', to: 'nocturne', spawn: 'east' },
    { side: 'east', to: 'aurelia', spawn: 'west' },
  ],
  signs: [{ x: 17, y: 2, text: 'ROUTE 10 — Pilgrim Way\nWest: Nocturne  East: Aurelia' }],
  npcs: [
    {
      id: 'selene',
      sprite: 'lass',
      x: 8,
      y: 6,
      facing: 'right',
      trainer: { trainerId: 'r10-lass', sightRange: 3 },
      dialogue: ['Pilgrims walk this road to the League.'],
    },
    {
      id: 'vellum',
      sprite: 'scientist',
      x: 19,
      y: 7,
      facing: 'left',
      trainer: { trainerId: 'r10-scientist', sightRange: 3 },
      dialogue: ['Particles! Everywhere!'],
    },
    { id: 'item1', sprite: 'boy', x: 7, y: 9, facing: 'down', itemPickup: { item: 'dawnstone', qty: 1 } },
    { id: 'item2', sprite: 'boy', x: 24, y: 9, facing: 'down', itemPickup: { item: 'ultraball', qty: 3 } },
  ],
  encounters: {
    rate: 0.13,
    grass: [
      { speciesId: 'glimkit', min: 29, max: 32, weight: 30 },
      { speciesId: 'flutterveil', min: 29, max: 32, weight: 25 },
      { speciesId: 'nocturnix', min: 30, max: 33, weight: 20 },
      { speciesId: 'gnawber', min: 29, max: 32, weight: 15 },
      { speciesId: 'voltail', min: 31, max: 33, weight: 10 },
    ],
  },
});

// ============================================================== Route 11 (sea)
add({
  id: 'route11',
  name: 'Route 11 — Maren Sea',
  music: 'route',
  grid: [
    '#########,,#########',
    '#SSSSSSSS,,SSSSSSSS#',
    '#S~~~~~~~~~~~~~~~~S#',
    '#S~~~~~~~~~~~~~~~~S#',
    '#S~~~##~~~~~##~~~~S#',
    '#S~~~##~~~~~##~~~~S#',
    '#S~~~~~~~~~~~~~~~~S#',
    '#S~~~~~~~~~~~~~~~~S#',
    '#S~~~~~~s~~~~~~~~~S#',
    '#S~~~~~~~~~~~~~~~~S#',
    '#S~~~~~~~~~~~~~~~~S#',
    '#SSSSSSSS,,SSSSSSSS#',
    '#########,,#########',
  ],
  spawns: {
    north: { x: 10, y: 1, facing: 'down' },
    south: { x: 10, y: 11, facing: 'down' },
  },
  edges: [
    { side: 'north', to: 'portmaren', spawn: 'dock' },
    { side: 'south', to: 'hollowisle', spawn: 'north' },
  ],
  signs: [{ x: 8, y: 8, text: 'MAREN SEA\nSouth: Hollow Isle\nSwimmers beware — deep water.' }],
  npcs: [],
  encounters: {
    rate: 0.1,
    water: [
      { speciesId: 'finlet', min: 25, max: 32, weight: 40 },
      { speciesId: 'murklob', min: 28, max: 34, weight: 35 },
      { speciesId: 'marlance', min: 30, max: 35, weight: 25 },
    ],
  },
});

// ============================================================== Route 12
add({
  id: 'route12',
  name: 'Route 12 — Victory Approach',
  music: 'route',
  grid: [
    '#########,,#########',
    '#........,,........#',
    '#..ggg...,,...s....#',
    '#..ggg...,,........#',
    '#........,,........#',
    '#........,,..ggg...#',
    '#..ggg...,,..ggg...#',
    '#..ggg...,,........#',
    '#........,,........#',
    '#########,,#########',
  ],
  spawns: {
    south: { x: 10, y: 8, facing: 'up' },
    north: { x: 10, y: 1, facing: 'down' },
  },
  edges: [
    { side: 'south', to: 'aurelia', spawn: 'north' },
    { side: 'north', to: 'victoryroad', spawn: 'south' },
  ],
  signs: [{ x: 14, y: 2, text: 'ROUTE 12\nNorth: Victory Road — League challengers only.\nEIGHT BADGES REQUIRED.' }],
  npcs: [
    {
      id: 'gatekeeper',
      sprite: 'ranger',
      x: 10,
      y: 3,
      facing: 'down',
      script: 'league-gate',
    },
  ],
  encounters: {
    rate: 0.12,
    grass: [
      { speciesId: 'gnawber', min: 36, max: 39, weight: 30 },
      { speciesId: 'nocturnix', min: 36, max: 39, weight: 25 },
      { speciesId: 'voltail', min: 37, max: 40, weight: 20 },
      { speciesId: 'flutterveil', min: 36, max: 39, weight: 20 },
      { speciesId: 'draklet', min: 38, max: 40, weight: 5 },
    ],
  },
});
