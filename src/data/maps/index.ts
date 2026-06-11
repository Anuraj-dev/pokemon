/**
 * World index — every map in the game, plus per-town shop stock.
 */
import type { MapDef } from './defs';
import { TOWN_MAPS } from './towns';
import { ROUTE_MAPS } from './routes';
import { DUNGEON_MAPS } from './dungeons';
import { GYM_MAPS } from './gyms';

export const MAPS: Record<string, MapDef> = {};
for (const m of [...TOWN_MAPS, ...ROUTE_MAPS, ...DUNGEON_MAPS, ...GYM_MAPS]) {
  if (MAPS[m.id]) throw new Error(`Duplicate map id: ${m.id}`);
  MAPS[m.id] = m;
}

export function mapById(id: string): MapDef {
  const m = MAPS[id];
  if (!m) throw new Error(`Unknown map: ${id}`);
  return m;
}

/** What each town's mart sells; later towns stock better gear. */
export const SHOP_STOCK: Record<string, string[]> = {
  thornbury: ['basicball', 'potion', 'antidote', 'paralyzeheal', 'repel'],
  duskhollow: ['basicball', 'potion', 'superpotion', 'antidote', 'burnsalve', 'paralyzeheal', 'awakening', 'repel'],
  voltis: ['basicball', 'greatball', 'superpotion', 'antidote', 'burnsalve', 'paralyzeheal', 'awakening', 'icemelt', 'repel', 'voltcharm'],
  portmaren: ['greatball', 'superpotion', 'hyperpotion', 'fullheal', 'revive', 'repel', 'aquacharm', 'oranberry'],
  crestfall: ['greatball', 'hyperpotion', 'fullheal', 'revive', 'repel', 'galecharm', 'oranberry', 'lumberry'],
  cinderpeak: ['greatball', 'ultraball', 'hyperpotion', 'fullheal', 'revive', 'ether', 'infernocharm', 'terracharm', 'lumberry'],
  nocturne: ['ultraball', 'hyperpotion', 'maxpotion', 'fullheal', 'revive', 'umbracharm', 'scopelens', 'focussash'],
  aurelia: ['ultraball', 'maxpotion', 'fullrestore', 'fullheal', 'maxrevive', 'ether', 'luminacharm', 'verdantcharm', 'focussash', 'linkstone'],
};
