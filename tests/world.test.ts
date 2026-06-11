/**
 * World integrity validation — catches map authoring mistakes:
 * ragged grids, warps to nowhere, spawns/NPCs/triggers on solid tiles,
 * unknown tiles/species/trainers/items/scripts.
 */
import { describe, it, expect } from 'vitest';
import { MAPS, SHOP_STOCK } from '../src/data/maps';
import { LEGEND, tileAt, charAt } from '../src/data/maps/defs';
import { SCRIPTS } from '../src/data/story';
import { TRAINERS } from '../src/data/trainers';
import { SPECIES } from '../src/data/species';
import { ITEMS } from '../src/data/items';
import { MOVES, type MoveData } from '../src/data/moves';
import { ABILITIES } from '../src/data/abilities';
import { CHAR_KEYS } from '../src/render/spriteGen';

const mapIds = Object.keys(MAPS);

describe('new game start', () => {
  it('start position and lastHeal are on walkable tiles of an existing map', async () => {
    const { newGameState } = await import('../src/engine/state');
    const s = newGameState('T');
    for (const pos of [{ map: s.player.mapId, x: s.player.x, y: s.player.y }, { map: s.lastHeal.mapId, x: s.lastHeal.x, y: s.lastHeal.y }]) {
      const m = MAPS[pos.map];
      expect(m, `map ${pos.map}`).toBeDefined();
      const t = tileAt(m, pos.x, pos.y);
      expect(t && !t.solid, `start at ${pos.map}:${pos.x},${pos.y} on '${charAt(m, pos.x, pos.y)}'`).toBe(true);
    }
  });
});

describe('map grids', () => {
  it('every map has a rectangular grid of known tiles', () => {
    for (const m of Object.values(MAPS)) {
      const w = m.grid[0].length;
      for (let y = 0; y < m.grid.length; y++) {
        expect(m.grid[y].length, `${m.id} row ${y} width (got ${m.grid[y].length}, want ${w}): "${m.grid[y]}"`).toBe(w);
        for (let x = 0; x < w; x++) {
          expect(LEGEND[m.grid[y][x]], `${m.id} unknown tile '${m.grid[y][x]}' at ${x},${y}`).toBeDefined();
        }
      }
    }
  });
});

function isWalkable(mapId: string, x: number, y: number): boolean {
  const m = MAPS[mapId];
  const t = tileAt(m, x, y);
  if (!t) return false;
  return !t.solid || !!t.water || !!t.climbable || !!t.cuttable;
}

describe('warps and spawns', () => {
  it('warps point to existing maps and spawns', () => {
    for (const m of Object.values(MAPS)) {
      for (const w of m.warps ?? []) {
        expect(mapIds, `${m.id} warp target ${w.to}`).toContain(w.to);
        expect(MAPS[w.to].spawns[w.spawn], `${m.id} warp ${w.to}:${w.spawn} missing spawn`).toBeDefined();
      }
      for (const e of m.edges ?? []) {
        expect(mapIds, `${m.id} edge target ${e.to}`).toContain(e.to);
        expect(MAPS[e.to].spawns[e.spawn], `${m.id} edge ${e.to}:${e.spawn} missing spawn`).toBeDefined();
      }
    }
  });

  it('spawn points are on walkable tiles', () => {
    for (const m of Object.values(MAPS)) {
      for (const [name, s] of Object.entries(m.spawns)) {
        const t = tileAt(m, s.x, s.y);
        expect(t, `${m.id} spawn ${name} out of bounds`).toBeTruthy();
        expect(t!.solid ?? false, `${m.id} spawn ${name} at ${s.x},${s.y} on solid '${charAt(m, s.x, s.y)}'`).toBe(false);
      }
    }
  });

  it('warp tiles themselves are walkable (or climbable)', () => {
    for (const m of Object.values(MAPS)) {
      for (const w of m.warps ?? []) {
        const t = tileAt(m, w.x, w.y);
        expect(t, `${m.id} warp at ${w.x},${w.y} out of bounds`).toBeTruthy();
        expect((t!.solid && !t!.climbable) ?? false, `${m.id} warp at ${w.x},${w.y} on solid '${charAt(m, w.x, w.y)}'`).toBe(false);
      }
    }
  });

  it('edge openings exist on the proper boundary', () => {
    for (const m of Object.values(MAPS)) {
      for (const e of m.edges ?? []) {
        const w = m.grid[0].length;
        const h = m.grid.length;
        let found = false;
        if (e.side === 'north') for (let x = 0; x < w; x++) found ||= isWalkable(m.id, x, 0);
        if (e.side === 'south') for (let x = 0; x < w; x++) found ||= isWalkable(m.id, x, h - 1);
        if (e.side === 'west') for (let y = 0; y < h; y++) found ||= isWalkable(m.id, 0, y);
        if (e.side === 'east') for (let y = 0; y < h; y++) found ||= isWalkable(m.id, w - 1, y);
        expect(found, `${m.id} edge ${e.side} has no walkable boundary tile`).toBe(true);
      }
    }
  });
});

describe('npcs and triggers', () => {
  it('npcs stand on walkable tiles, reference real sprites/trainers/items/scripts', () => {
    for (const m of Object.values(MAPS)) {
      for (const n of m.npcs ?? []) {
        const t = tileAt(m, n.x, n.y);
        expect(t, `${m.id} npc ${n.id} out of bounds`).toBeTruthy();
        expect(t!.solid ?? false, `${m.id} npc ${n.id} at ${n.x},${n.y} on solid '${charAt(m, n.x, n.y)}'`).toBe(false);
        if (!n.itemPickup && !n.creatureSprite) {
          expect(CHAR_KEYS, `${m.id} npc ${n.id} sprite ${n.sprite}`).toContain(n.sprite);
        }
        if (n.creatureSprite) expect(SPECIES[n.creatureSprite], `${m.id} npc ${n.id} creature ${n.creatureSprite}`).toBeDefined();
        if (n.trainer) expect(TRAINERS[n.trainer.trainerId], `${m.id} npc ${n.id} trainer ${n.trainer.trainerId}`).toBeDefined();
        if (n.itemPickup) expect(ITEMS[n.itemPickup.item], `${m.id} npc ${n.id} item ${n.itemPickup.item}`).toBeDefined();
        if (n.script) expect(SCRIPTS[n.script], `${m.id} npc ${n.id} script ${n.script}`).toBeDefined();
      }
      for (const t of m.triggers ?? []) {
        expect(SCRIPTS[t.script], `${m.id} trigger script ${t.script}`).toBeDefined();
        expect(isWalkable(m.id, t.x, t.y), `${m.id} trigger at ${t.x},${t.y} not walkable`).toBe(true);
      }
    }
  });
});

describe('encounters, trainers, shops, scripts', () => {
  it('encounter tables reference real species with sane levels', () => {
    for (const m of Object.values(MAPS)) {
      for (const table of [m.encounters?.grass, m.encounters?.water]) {
        for (const e of table ?? []) {
          expect(SPECIES[e.speciesId], `${m.id} encounter ${e.speciesId}`).toBeDefined();
          expect(e.min).toBeLessThanOrEqual(e.max);
          expect(e.min).toBeGreaterThan(0);
        }
      }
      // maps with encounter tiles need an encounter table (or vice versa is fine)
      const hasEncounterTile = m.grid.some((row) => [...row].some((ch) => LEGEND[ch]?.encounter));
      if (m.encounters?.grass) {
        expect(hasEncounterTile, `${m.id} has grass table but no encounter tiles`).toBe(true);
      }
    }
  });

  it('trainer parties reference real species and items', () => {
    for (const t of Object.values(TRAINERS)) {
      expect(t.party.length).toBeGreaterThan(0);
      for (const mon of t.party) {
        expect(SPECIES[mon.speciesId], `${t.id} species ${mon.speciesId}`).toBeDefined();
        if (mon.heldItem) expect(ITEMS[mon.heldItem], `${t.id} item ${mon.heldItem}`).toBeDefined();
      }
      expect(CHAR_KEYS, `${t.id} sprite ${t.sprite}`).toContain(t.sprite);
    }
  });

  it('shop stock references real buyable items', () => {
    for (const [town, stock] of Object.entries(SHOP_STOCK)) {
      for (const id of stock) {
        expect(ITEMS[id], `${town} stock ${id}`).toBeDefined();
        expect(ITEMS[id].price, `${town} stock ${id} not buyable`).toBeGreaterThan(0);
      }
    }
  });

  it('scripts reference real trainers, items, species, maps', () => {
    const walk = (ops: import('../src/data/story').ScriptOp[]) => {
      for (const op of ops) {
        switch (op.op) {
          case 'battle':
            expect(TRAINERS[op.trainerId], `script trainer ${op.trainerId}`).toBeDefined();
            break;
          case 'rivalBattle':
            for (const starter of ['emberling', 'dribblet', 'sproutle']) {
              const id = op.stage === 6 ? `champion-${starter}` : `rival${op.stage}-${starter}`;
              expect(TRAINERS[id], `rival trainer ${id}`).toBeDefined();
            }
            break;
          case 'wildBattle':
            expect(SPECIES[op.speciesId], `script species ${op.speciesId}`).toBeDefined();
            break;
          case 'giveItem':
            expect(ITEMS[op.item], `script item ${op.item}`).toBeDefined();
            break;
          case 'giveCreature':
            expect(SPECIES[op.speciesId], `script species ${op.speciesId}`).toBeDefined();
            break;
          case 'warp':
            expect(MAPS[op.map], `script warp ${op.map}`).toBeDefined();
            expect(MAPS[op.map].spawns[op.spawn], `script warp spawn ${op.map}:${op.spawn}`).toBeDefined();
            break;
          case 'shop':
            expect(SHOP_STOCK[op.townId], `script shop ${op.townId}`).toBeDefined();
            break;
          case 'if':
            walk(op.then);
            if (op.else) walk(op.else);
            break;
          case 'ifBadges':
            walk(op.then);
            if (op.else) walk(op.else);
            break;
          case 'choice':
            for (const o of op.options) walk(o.then);
            break;
          default:
            break;
        }
      }
    };
    for (const ops of Object.values(SCRIPTS)) walk(ops);
  });

  it('species learnsets/abilities/evolutions are consistent', () => {
    for (const s of Object.values(SPECIES)) {
      expect(ABILITIES[s.ability], `${s.id} ability ${s.ability}`).toBeDefined();
      for (const [lvl, moveId] of s.learnset) {
        expect(MOVES[moveId], `${s.id} move ${moveId}`).toBeDefined();
        expect(lvl).toBeGreaterThan(0);
      }
      if (s.evolution) {
        expect(SPECIES[s.evolution.into], `${s.id} evolves into ${s.evolution.into}`).toBeDefined();
        if (s.evolution.method === 'item') {
          expect(ITEMS[s.evolution.item], `${s.id} evolution item ${s.evolution.item}`).toBeDefined();
        }
      }
      // every species must know at least one damaging move at level 1-5 spawn levels
      const early = s.learnset.filter(([lvl]) => lvl <= 5).map(([, id]) => MOVES[id]);
      const damaging = early.filter((mv: MoveData) => mv.power > 0 || mv.effects?.some((e) => e.kind === 'leveldamage'));
      expect(damaging.length, `${s.id} has no damaging move by level 5`).toBeGreaterThan(0);
    }
  });
});
