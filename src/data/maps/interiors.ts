/**
 * Interior map templates — healing centers, marts, and houses are generated
 * from parameterized templates so every town gets consistent interiors.
 */
import type { MapDef, NpcDef } from './defs';

/** A healing center: nurse at counter, PC in the corner. */
export function makeCenter(townId: string, townName: string, exitMap: string, exitSpawn: string): MapDef {
  return {
    id: `${townId}-center`,
    name: `${townName} Center`,
    music: 'center',
    indoor: true,
    grid: [
      'IIIIIIIIIIIIII',
      'IooooooooooooI',
      'IoPooottoooooI',
      'IooooottoooooI',
      'IooooooooooooI',
      'IoTooooooooToI',
      'IooooooooooooI',
      'IIIIIIaaIIIIII',
    ],
    spawns: { door: { x: 6, y: 6, facing: 'up' } },
    warps: [
      { x: 6, y: 7, to: exitMap, spawn: exitSpawn },
      { x: 7, y: 7, to: exitMap, spawn: exitSpawn },
    ],
    npcs: [
      {
        id: 'nurse',
        sprite: 'nurse',
        x: 6,
        y: 1,
        facing: 'down',
        script: 'center-heal',
      },
      {
        id: 'lounger',
        sprite: 'boy',
        x: 10,
        y: 5,
        facing: 'left',
        movement: 'wander',
        dialogue: ['Centers heal your whole party for free.', 'They even autosave your game when you do!'],
      },
    ],
  };
}

/** A shop: clerk behind counter; inventory wired by town via SHOP_STOCK. */
export function makeMart(townId: string, townName: string, exitMap: string, exitSpawn: string): MapDef {
  return {
    id: `${townId}-mart`,
    name: `${townName} Mart`,
    music: 'center',
    indoor: true,
    grid: [
      'IIIIIIIIIIII',
      'IhhooooohhoI',
      'IooooooooooI',
      'ItoooooooooI',
      'IooooohhoooI',
      'IIIIaaIIIIII',
    ],
    spawns: { door: { x: 4, y: 4, facing: 'up' } },
    warps: [
      { x: 4, y: 5, to: exitMap, spawn: exitSpawn },
      { x: 5, y: 5, to: exitMap, spawn: exitSpawn },
    ],
    npcs: [
      {
        id: 'clerk',
        sprite: 'clerk',
        x: 1,
        y: 2,
        facing: 'right',
        script: `shop-${townId}`,
      },
    ],
  };
}

/** Generic small house with a chatty occupant. */
export function makeHouse(
  id: string,
  name: string,
  exitMap: string,
  exitSpawn: string,
  occupant: Omit<NpcDef, 'x' | 'y' | 'facing'> & { x?: number; y?: number; facing?: NpcDef['facing'] },
): MapDef {
  return {
    id,
    name,
    music: 'town',
    indoor: true,
    grid: [
      'IIIIIIIIII',
      'IKoooooTKI',
      'IooooooooI',
      'IoTooooooI',
      'IooooooooI',
      'IIIIaaIIII',
    ],
    spawns: { door: { x: 4, y: 4, facing: 'up' } },
    warps: [
      { x: 4, y: 5, to: exitMap, spawn: exitSpawn },
      { x: 5, y: 5, to: exitMap, spawn: exitSpawn },
    ],
    npcs: [{ x: 5, y: 2, facing: 'down', movement: 'static', ...occupant }],
  };
}
