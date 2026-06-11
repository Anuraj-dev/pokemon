/**
 * Town maps — the nine settlements of Veridia, plus their interiors.
 */
import type { MapDef } from './defs';
import { makeCenter, makeMart, makeHouse } from './interiors';

export const TOWN_MAPS: MapDef[] = [];
function add(m: MapDef) {
  TOWN_MAPS.push(m);
}

// ============================================================== Embervale
add({
  id: 'embervale',
  name: 'Embervale',
  music: 'town',
  grid: [
    '###########,,###########',
    '#..........,,..........#',
    '#..rrrrr...,,...rrrrr..#',
    '#..WwDwW...,,...WwDwW..#',
    '#...,......,,......,...#',
    '#...,,,,,,,,,,,,,,,,...#',
    '#..........,,..........#',
    '#..lllll...,,...f.f....#',
    '#..WwDwW...,,..........#',
    '#...,......,,...f.f....#',
    '#...,,,,,,,,,...........#'.slice(0, 23) + '#',
    '#..........,...........#',
    '#...f..f...,....s......#',
    '#..........,...........#',
    '#......................#',
    '########################',
  ],
  spawns: {
    start: { x: 12, y: 8, facing: 'down' },
    north: { x: 11, y: 1, facing: 'down' },
    'home-door': { x: 5, y: 4, facing: 'down' },
    'house-door': { x: 18, y: 4, facing: 'down' },
    'lab-door': { x: 5, y: 9, facing: 'down' },
  },
  edges: [{ side: 'north', to: 'route1', spawn: 'south' }],
  warps: [
    { x: 5, y: 3, to: 'embervale-home', spawn: 'door' },
    { x: 18, y: 3, to: 'embervale-house', spawn: 'door' },
    { x: 5, y: 8, to: 'lab', spawn: 'door' },
  ],
  signs: [{ x: 16, y: 12, text: 'EMBERVALE\n"Where journeys kindle."' }],
  npcs: [
    {
      id: 'kid',
      sprite: 'boy',
      x: 15,
      y: 8,
      facing: 'down',
      movement: 'wander',
      dialogue: ['Professor Alder studies creatures in that lab!', 'I heard she gives starters to new trainers!'],
    },
  ],
  triggers: [
    { x: 11, y: 1, script: 'block-no-starter', showIf: { flag: 'hasStarter', not: true } },
    { x: 12, y: 1, script: 'block-no-starter', showIf: { flag: 'hasStarter', not: true } },
  ],
});

add(makeHouse('embervale-home', 'Your Home', 'embervale', 'home-door', {
  id: 'mom',
  sprite: 'mom',
  script: 'mom-talk',
}));
add(makeHouse('embervale-house', 'Neighbor House', 'embervale', 'house-door', {
  id: 'neighbor',
  sprite: 'oldman',
  dialogue: [
    'Kael, the boy next door, left this morning. Said he would be Champion within the month.',
    'He is... a lot. But he works harder than anyone.',
  ],
}));

add({
  id: 'lab',
  name: 'Alder Creature Lab',
  music: 'town',
  indoor: true,
  grid: [
    'IIIIIIIIIIIIII',
    'IooKKoooooKKoI',
    'IooooooooooooI',
    'ITTooooooooToI',
    'IooooooooooooI',
    'IoooooooooTToI',
    'IooooooooooooI',
    'IIIIIIaaIIIIII',
  ],
  spawns: { door: { x: 6, y: 6, facing: 'up' } },
  warps: [
    { x: 6, y: 7, to: 'embervale', spawn: 'lab-door' },
    { x: 7, y: 7, to: 'embervale', spawn: 'lab-door' },
  ],
  npcs: [
    { id: 'professor', sprite: 'professor', x: 4, y: 2, facing: 'down', script: 'professor-starter' },
    {
      id: 'assistant',
      sprite: 'scientist',
      x: 11,
      y: 4,
      facing: 'left',
      dialogue: [
        'The professor mapped all 40 species native to Veridia.',
        'Her Compendium auto-records everything you see and catch.',
      ],
    },
  ],
});

// ============================================================== Thornbury
add({
  id: 'thornbury',
  name: 'Thornbury',
  music: 'town',
  grid: [
    '############################',
    '#..........................#',
    '#..uuuuu....mmmmm....rrrrr.#',
    '#..WwDwW....WwDwW....WwDwW.#',
    '#....,........,.........,..#',
    '#....,,,,,,,,,,,,,,,,,,,,..#',
    '#.............,............#',
    ',............yyyyy.........#',
    ',............WwDwW.........#',
    '#..............,...........,',
    '#....s.........,...........,',
    '#..............,............#'.slice(0, 27) + '#',
    '#....f.f.......,...........#',
    '#..............,...........#',
    '#############,,,############',
  ],
  spawns: {
    south: { x: 13, y: 13, facing: 'up' },
    west: { x: 1, y: 7, facing: 'right' },
    east: { x: 26, y: 9, facing: 'left' },
    'center-door': { x: 5, y: 4, facing: 'down' },
    'mart-door': { x: 14, y: 4, facing: 'down' },
    'house-door': { x: 23, y: 4, facing: 'down' },
    'gym-door': { x: 15, y: 9, facing: 'down' },
  },
  edges: [
    { side: 'south', to: 'route1', spawn: 'north' },
    { side: 'west', to: 'whisperwood', spawn: 'east' },
    { side: 'east', to: 'route5', spawn: 'west' },
  ],
  warps: [
    { x: 5, y: 3, to: 'thornbury-center', spawn: 'door' },
    { x: 14, y: 3, to: 'thornbury-mart', spawn: 'door' },
    { x: 23, y: 3, to: 'thornbury-house', spawn: 'door' },
    { x: 15, y: 8, to: 'gym1', spawn: 'door' },
  ],
  signs: [{ x: 5, y: 10, text: 'THORNBURY\n"The town the forest planted."\nGYM: Leader Erika — Verdant type' }],
  npcs: [
    {
      id: 'guide',
      sprite: 'guide',
      x: 8,
      y: 7,
      facing: 'down',
      script: 'thornbury-guide',
    },
    {
      id: 'lady',
      sprite: 'girl',
      x: 20,
      y: 11,
      facing: 'left',
      movement: 'wander',
      dialogue: ['The forest west of here is lovely... but Team Eclipse was spotted inside.', 'East road? Overgrown. You would need a Cutter Charm.'],
    },
  ],
});
add(makeCenter('thornbury', 'Thornbury', 'thornbury', 'center-door'));
add(makeMart('thornbury', 'Thornbury', 'thornbury', 'mart-door'));
add(makeHouse('thornbury-house', 'Thornbury House', 'thornbury', 'house-door', {
  id: 'gran',
  sprite: 'oldman',
  dialogue: ['Eight gyms in Veridia, dear. Erika here is the gentlest.', 'They say the gym order is just a suggestion. The wilds, though — they do not scale down for anyone.'],
}));

// ============================================================== Duskhollow
add({
  id: 'duskhollow',
  name: 'Duskhollow',
  music: 'town',
  grid: [
    '##########,,############',
    '#.........,,...........#',
    '#..uuuuu..,,..mmmmm....#',
    '#..WwDwW..,,..WwDwW....#',
    '#....,....,,....,......#',
    '#....,,,,,,,,,,,,......#',
    '#.........,,...........#',
    '#..yyyyy..,,..RRRRRR...#',
    '#..WwDwW..,,..RcccccR..#'.slice(0, 23) + '#',
    '#....,....,,..RcccccR..#',
    '#....,....,,......,....#',
    '#....,,,,,,,,,,,,,,....#',
    '#.........,,...........#',
    '#...s......,,..........#'.slice(0, 23) + '#',
    '#.........,,...........#',
    '########################',
  ],
  spawns: {
    north: { x: 10, y: 1, facing: 'down' },
    east: { x: 22, y: 13, facing: 'left' },
    'center-door': { x: 5, y: 4, facing: 'down' },
    'mart-door': { x: 16, y: 4, facing: 'down' },
    'gym-door': { x: 5, y: 9, facing: 'down' },
    quarry: { x: 18, y: 10, facing: 'down' },
  },
  edges: [{ side: 'north', to: 'route3', spawn: 'south' }],
  warps: [
    { x: 5, y: 3, to: 'duskhollow-center', spawn: 'door' },
    { x: 16, y: 3, to: 'duskhollow-mart', spawn: 'door' },
    { x: 5, y: 8, to: 'gym2', spawn: 'door' },
    { x: 18, y: 9, to: 'quarry', spawn: 'entrance' },
  ],
  signs: [{ x: 4, y: 13, text: 'DUSKHOLLOW\n"Built on bedrock, run on grit."\nGYM: Leader Brock — Terra type' }],
  npcs: [
    {
      id: 'miner',
      sprite: 'hiker',
      x: 15,
      y: 10,
      facing: 'right',
      dialogue: ['The quarry cave glitters with Prism Shards lately.', 'Strange folk in dark uniforms went in an hour ago...'],
    },
  ],
  triggers: [],
});
add(makeCenter('duskhollow', 'Duskhollow', 'duskhollow', 'center-door'));
add(makeMart('duskhollow', 'Duskhollow', 'duskhollow', 'mart-door'));

// ============================================================== Voltis City
add({
  id: 'voltis',
  name: 'Voltis City',
  music: 'town',
  grid: [
    '########################',
    '#......................#',
    '#..uuuuu....mmmmm......#',
    '#..WwDwW....WwDwW......#',
    '#....,........,........#',
    '#....,,,,,,,,,,,,,,....#',
    '#.........,......,.....#',
    '#..rrrrr..,..yyyyy.....#',
    '#..WwDwW..,..WwDwW.....#',
    '#....,....,....,.......#',
    '#....,,,,,,,,,,,,......,',
    '#.........,............,',
    '#...s.....,............#',
    '#.........,............#',
    '##########,,############',
  ],
  spawns: {
    south: { x: 10, y: 13, facing: 'up' },
    east: { x: 22, y: 10, facing: 'left' },
    'center-door': { x: 5, y: 4, facing: 'down' },
    'mart-door': { x: 14, y: 4, facing: 'down' },
    'house-door': { x: 5, y: 9, facing: 'down' },
    'gym-door': { x: 15, y: 9, facing: 'down' },
  },
  edges: [
    { side: 'south', to: 'route3', spawn: 'north' },
    { side: 'east', to: 'route4', spawn: 'west' },
  ],
  warps: [
    { x: 5, y: 3, to: 'voltis-center', spawn: 'door' },
    { x: 14, y: 3, to: 'voltis-mart', spawn: 'door' },
    { x: 5, y: 8, to: 'voltis-house', spawn: 'door' },
    { x: 15, y: 8, to: 'gym3', spawn: 'door' },
  ],
  signs: [{ x: 4, y: 12, text: 'VOLTIS CITY\n"The city that never sleeps — it recharges."\nGYM: Leader Lt. Surge — Volt type' }],
  npcs: [
    {
      id: 'engineer',
      sprite: 'scientist',
      x: 18,
      y: 6,
      facing: 'down',
      movement: 'wander',
      dialogue: ['The whole grid runs off tamed Raichu. Renewable AND adorable.', 'Heading east? Route 4 runs along the coast to Port Maren.'],
    },
  ],
});
add(makeCenter('voltis', 'Voltis City', 'voltis', 'center-door'));
add(makeMart('voltis', 'Voltis City', 'voltis', 'mart-door'));
add(makeHouse('voltis-house', 'Voltis House', 'voltis', 'house-door', {
  id: 'collector',
  sprite: 'oldman',
  script: 'voltis-collector',
}));

// ============================================================== Port Maren
add({
  id: 'portmaren',
  name: 'Port Maren',
  music: 'town',
  grid: [
    '#############,,#############',
    '#..........................#',
    '#..uuuuu...mmmmm...rrrrr...#',
    '#..WwDwW...WwDwW...WwDwW...#',
    ',....,.......,.......,.....#',
    ',....,,,,,,,,,,,,,,,,,,....#',
    '#.........,................#',
    '#..yyyyy..,...XXXXXX.......#',
    '#..WwDwW..,...XddddX.......#',
    '#....,....,...XddddX.......#',
    '#....,....,......d.........#',
    '#....,,,,,,,,,,,,d,,,......#',
    '#.........,................#',
    '#...s.....,.....SSSSSS.....#',
    '#.........,....SSSSSSSS....#',
    '#SSSSSSSSSSSSSSSSSSSSSSSS..#',
    '#~~~~~~~~~~~~~~~~~~~~~~~~..#',
    '#~~~~~~~~~~~~~~~~~~~~~~~~..#',
  ],
  spawns: {
    west: { x: 1, y: 4, facing: 'right' },
    north: { x: 13, y: 1, facing: 'down' },
    'center-door': { x: 5, y: 4, facing: 'down' },
    'mart-door': { x: 13, y: 4, facing: 'down' },
    'house-door': { x: 21, y: 4, facing: 'down' },
    'gym-door': { x: 5, y: 9, facing: 'down' },
    'warehouse-door': { x: 17, y: 10, facing: 'down' },
    dock: { x: 12, y: 15, facing: 'down' },
  },
  edges: [
    { side: 'west', to: 'route4', spawn: 'east' },
    { side: 'north', to: 'route6', spawn: 'south' },
    { side: 'south', to: 'route11', spawn: 'north' },
  ],
  warps: [
    { x: 5, y: 3, to: 'portmaren-center', spawn: 'door' },
    { x: 13, y: 3, to: 'portmaren-mart', spawn: 'door' },
    { x: 21, y: 3, to: 'portmaren-house', spawn: 'door' },
    { x: 5, y: 8, to: 'gym4', spawn: 'door' },
    { x: 17, y: 10, to: 'warehouse', spawn: 'door' },
  ],
  signs: [{ x: 4, y: 13, text: 'PORT MAREN\n"Half the town is boats."\nGYM: Leader Misty — Aqua type\nSouth: open sea — riders only' }],
  npcs: [
    {
      id: 'sailor',
      sprite: 'fisher',
      x: 10,
      y: 14,
      facing: 'down',
      dialogue: ['See that island on the horizon? Hollow Isle. Nothing good ever came off it.', 'With a Wave Charm you could ride your own creature out there.'],
    },
    {
      id: 'dockguard',
      sprite: 'ranger',
      x: 16,
      y: 12,
      facing: 'down',
      showIf: { flag: 'warehouseCleared', not: true },
      dialogue: ['The old warehouse? Sealed up. Strangers in dark coats moved in last night.', 'I would not go in there without a strong team.'],
    },
    {
      id: 'rival3',
      sprite: 'rival',
      x: 11,
      y: 6,
      facing: 'left',
      showIf: { flag: 'rival3done', not: true },
      script: 'rival3',
    },
  ],
  triggers: [
    { x: 10, y: 6, script: 'rival3', showIf: { flag: 'rival3done', not: true } },
    { x: 10, y: 7, script: 'rival3', showIf: { flag: 'rival3done', not: true } },
  ],
});
add(makeCenter('portmaren', 'Port Maren', 'portmaren', 'center-door'));
add(makeMart('portmaren', 'Port Maren', 'portmaren', 'mart-door'));
add(makeHouse('portmaren-house', 'Harbor House', 'portmaren', 'house-door', {
  id: 'captain',
  sprite: 'oldman',
  dialogue: ['Forty years at sea, and the strangest thing I ever saw was the Spire on Hollow Isle lighting up at night.', 'Half light, half shadow. Like the sky could not make up its mind.'],
}));

// ============================================================== Crestfall
add({
  id: 'crestfall',
  name: 'Crestfall',
  music: 'town',
  grid: [
    '########################',
    '#......................#',
    '#..uuuuu....mmmmm......#',
    '#..WwDwW....WwDwW......#',
    ',....,........,........#',
    ',....,,,,,,,,,,,,......#',
    '#.........,............#',
    '#..yyyyy..,............#',
    '#..WwDwW..,..rrrrr.....#',
    '#....,....,..WwDwW.....#',
    '#....,,,,,,,...,.......#',
    '#.........,....,.......#',
    '#__________,___________#',
    '#.........,............#',
    '#...s.....,............#',
    '##########,,############',
  ],
  spawns: {
    west: { x: 1, y: 4, facing: 'right' },
    south: { x: 10, y: 14, facing: 'up' },
    'center-door': { x: 5, y: 4, facing: 'down' },
    'mart-door': { x: 14, y: 4, facing: 'down' },
    'gym-door': { x: 5, y: 9, facing: 'down' },
    'house-door': { x: 15, y: 10, facing: 'down' },
  },
  edges: [
    { side: 'west', to: 'route7', spawn: 'east' },
    { side: 'south', to: 'route6', spawn: 'north' },
  ],
  warps: [
    { x: 5, y: 3, to: 'crestfall-center', spawn: 'door' },
    { x: 14, y: 3, to: 'crestfall-mart', spawn: 'door' },
    { x: 5, y: 8, to: 'gym5', spawn: 'door' },
    { x: 15, y: 9, to: 'crestfall-house', spawn: 'door' },
  ],
  signs: [{ x: 4, y: 14, text: 'CRESTFALL\n"Mind the wind. Mind the drop."\nGYM: Leader Falkner — Gale type' }],
  npcs: [
    {
      id: 'glider',
      sprite: 'ranger',
      x: 18,
      y: 6,
      facing: 'down',
      movement: 'wander',
      dialogue: ['West of here is Mt. Cinder. The tunnel passes under the peak to Cinderpeak village.', 'Those ledges below town? One way down. No way back up without walking around.'],
    },
  ],
});
add(makeCenter('crestfall', 'Crestfall', 'crestfall', 'center-door'));
add(makeMart('crestfall', 'Crestfall', 'crestfall', 'mart-door'));
add(makeHouse('crestfall-house', 'Cliffside House', 'crestfall', 'house-door', {
  id: 'weatherlady',
  sprite: 'girl',
  dialogue: ['I chart the storms. Lately they all curve around Hollow Isle. Storms do not DO that.', 'Something out there is bending the weather.'],
}));

// ============================================================== Cinderpeak
add({
  id: 'cinderpeak',
  name: 'Cinderpeak',
  music: 'town',
  grid: [
    '###########,,###########',
    '#RRRRRRRRRR,,RRRRRRRRRR#',
    '#R........,,..........R#',
    '#..uuuuu..,,..mmmmm....#',
    '#..WwDwW..,,..WwDwW....#',
    '#....,....,,....,......#',
    '#....,,,,,,,,,,,,......#',
    '#.........,,...........#',
    '#..yyyyy..,,..rrrrr....#',
    '#..WwDwW..,,..WwDwW....#',
    '#....,....,,....,......#',
    '#....,,,,,,,,,,,,......#',
    '#.........,,...........#',
    '#...s.....,,...........#',
    '##########,,############',
  ],
  spawns: {
    north: { x: 11, y: 2, facing: 'down' },
    south: { x: 10, y: 13, facing: 'up' },
    'center-door': { x: 5, y: 5, facing: 'down' },
    'mart-door': { x: 16, y: 5, facing: 'down' },
    'gym-door': { x: 5, y: 10, facing: 'down' },
    'house-door': { x: 16, y: 10, facing: 'down' },
  },
  edges: [
    { side: 'north', to: 'mtcinder', spawn: 'south' },
    { side: 'south', to: 'route8', spawn: 'north' },
  ],
  warps: [
    { x: 5, y: 4, to: 'cinderpeak-center', spawn: 'door' },
    { x: 16, y: 4, to: 'cinderpeak-mart', spawn: 'door' },
    { x: 5, y: 9, to: 'gym6', spawn: 'door' },
    { x: 16, y: 9, to: 'cinderpeak-house', spawn: 'door' },
  ],
  signs: [{ x: 4, y: 13, text: 'CINDERPEAK\n"Warm hearths, warmer hearts."\nGYM: Leader Blaine — Inferno type' }],
  npcs: [
    {
      id: 'forgekid',
      sprite: 'boy',
      x: 18,
      y: 7,
      facing: 'down',
      movement: 'wander',
      dialogue: ['The old climber in that house mapped every cliff in Veridia!', 'She says the quarry near Duskhollow has a hidden lower level.'],
    },
  ],
});
add(makeCenter('cinderpeak', 'Cinderpeak', 'cinderpeak', 'center-door'));
add(makeMart('cinderpeak', 'Cinderpeak', 'cinderpeak', 'mart-door'));
add(makeHouse('cinderpeak-house', 'Climber House', 'cinderpeak', 'house-door', {
  id: 'climber',
  sprite: 'hiker',
  script: 'climber-gear',
}));

// ============================================================== Nocturne
add({
  id: 'nocturne',
  name: 'Nocturne Town',
  music: 'town',
  grid: [
    '##########,,############',
    '#.........,,...........#',
    '#..uuuuu..,,..mmmmm....#',
    '#..WwDwW..,,..WwDwW....#',
    '#....,....,,....,......#',
    '#....,,,,,,,,,,,,......#',
    '#.........,,...........#',
    '#..yyyyy..,,..rrrrr....#',
    '#..WwDwW..,,..WwDwW....#',
    '#....,....,,....,......#',
    '#....,,,,,,,,,,,,......,',
    '#.........,,...........,',
    '#...s.....,,...........#',
    '#.........,,...........#',
    '#.........,,...........#',
    '########################',
  ],
  spawns: {
    north: { x: 10, y: 1, facing: 'down' },
    east: { x: 22, y: 10, facing: 'left' },
    'center-door': { x: 5, y: 4, facing: 'down' },
    'mart-door': { x: 16, y: 4, facing: 'down' },
    'gym-door': { x: 5, y: 9, facing: 'down' },
    'house-door': { x: 16, y: 9, facing: 'down' },
    quarrydepths: { x: 10, y: 14, facing: 'up' },
  },
  edges: [
    { side: 'north', to: 'route8', spawn: 'south' },
    { side: 'east', to: 'route10', spawn: 'west' },
  ],
  warps: [
    { x: 5, y: 3, to: 'nocturne-center', spawn: 'door' },
    { x: 16, y: 3, to: 'nocturne-mart', spawn: 'door' },
    { x: 5, y: 8, to: 'gym7', spawn: 'door' },
    { x: 16, y: 8, to: 'nocturne-house', spawn: 'door' },
  ],
  signs: [{ x: 4, y: 12, text: 'NOCTURNE TOWN\n"The stars are brighter here."\nGYM: Leader Piers — Umbra type' }],
  npcs: [
    {
      id: 'stargazer',
      sprite: 'lass',
      x: 18,
      y: 12,
      facing: 'up',
      dialogue: ['We keep the streetlights off so we can see the sky.', 'Team Eclipse came recruiting once. Piers chased them out personally.'],
    },
    {
      id: 'rival4',
      sprite: 'rival',
      x: 12,
      y: 6,
      facing: 'left',
      showIf: { flag: 'rival4done', not: true },
      script: 'rival4',
    },
  ],
  triggers: [
    { x: 10, y: 6, script: 'rival4', showIf: { flag: 'rival4done', not: true } },
    { x: 11, y: 6, script: 'rival4', showIf: { flag: 'rival4done', not: true } },
  ],
});
add(makeCenter('nocturne', 'Nocturne Town', 'nocturne', 'center-door'));
add(makeMart('nocturne', 'Nocturne Town', 'nocturne', 'mart-door'));
add(makeHouse('nocturne-house', 'Observatory Cottage', 'nocturne', 'house-door', {
  id: 'astronomer',
  sprite: 'scientist',
  script: 'astronomer-talk',
}));

// ============================================================== Aurelia
add({
  id: 'aurelia',
  name: 'Aurelia',
  music: 'town',
  grid: [
    '###########,,###########',
    '#..........,,..........#',
    '#..uuuuu...,,...mmmmm..#',
    '#..WwDwW...,,...WwDwW..#',
    '#....,.....,,.....,....#',
    '#....,,,,,,,,,,,,,,....#',
    '#..........,,..........#',
    '#..rrrrr...,,...yyyyy..#',
    '#..WwDwW...,,...WwDwW..#',
    '#....,.....,,.....,....#',
    '#....,,,,,,,,,,,,,,....#',
    ',..........,,..........#',
    ',...s......,,..........#',
    '#..........,,..........#',
    '#..f.f.f...,,...f.f.f..#',
    '########################',
  ],
  spawns: {
    north: { x: 11, y: 1, facing: 'down' },
    west: { x: 1, y: 11, facing: 'right' },
    'center-door': { x: 5, y: 4, facing: 'down' },
    'mart-door': { x: 18, y: 4, facing: 'down' },
    'house-door': { x: 5, y: 9, facing: 'down' },
    'gym-door': { x: 18, y: 9, facing: 'down' },
  },
  edges: [
    { side: 'north', to: 'route12', spawn: 'south' },
    { side: 'west', to: 'route10', spawn: 'east' },
  ],
  warps: [
    { x: 5, y: 3, to: 'aurelia-center', spawn: 'door' },
    { x: 18, y: 3, to: 'aurelia-mart', spawn: 'door' },
    { x: 5, y: 8, to: 'aurelia-house', spawn: 'door' },
    { x: 18, y: 8, to: 'gym8', spawn: 'door' },
  ],
  signs: [{ x: 4, y: 12, text: 'AURELIA\n"The golden gate of the League."\nGYM: Leader Valerie — Lumina type\nNorth: Victory Road' }],
  npcs: [
    {
      id: 'leaguefan',
      sprite: 'boy',
      x: 15,
      y: 12,
      facing: 'down',
      movement: 'wander',
      dialogue: ['The League sits past Victory Road, north of town. Eight badges or the gate stays shut.', 'Rumor says someone young just swept the Elite Four...'],
    },
  ],
});
add(makeCenter('aurelia', 'Aurelia', 'aurelia', 'center-door'));
add(makeMart('aurelia', 'Aurelia', 'aurelia', 'mart-door'));
add(makeHouse('aurelia-house', 'Aurelia House', 'aurelia', 'house-door', {
  id: 'historian',
  sprite: 'oldman',
  dialogue: [
    'Necrozma, the Twinlight — half shadow, half radiance. The Spire on Hollow Isle is its roost.',
    'Long ago it slept whenever the region was at peace. If someone woke it angry... I shudder to think.',
  ],
}));
