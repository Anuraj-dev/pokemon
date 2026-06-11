/** Temporary full-report validator: collects ALL world issues at once. */
import { describe, it } from 'vitest';
import { MAPS } from '../src/data/maps';
import { LEGEND, tileAt, charAt } from '../src/data/maps/defs';

const issues: string[] = [];

function isWalkable(mapId: string, x: number, y: number): boolean {
  const m = MAPS[mapId];
  const t = tileAt(m, x, y);
  if (!t) return false;
  return !t.solid || !!t.water || !!t.climbable || !!t.cuttable;
}

describe('full world report', () => {
  it('collects all issues', () => {
    for (const m of Object.values(MAPS)) {
      const w = m.grid[0].length;
      for (let y = 0; y < m.grid.length; y++) {
        if (m.grid[y].length !== w) issues.push(`${m.id} row ${y} width ${m.grid[y].length} != ${w}: "${m.grid[y]}"`);
        for (let x = 0; x < m.grid[y].length; x++) {
          if (!LEGEND[m.grid[y][x]]) issues.push(`${m.id} unknown tile '${m.grid[y][x]}' at ${x},${y}`);
        }
      }
      for (const [name, s] of Object.entries(m.spawns)) {
        const t = tileAt(m, s.x, s.y);
        if (!t || t.solid) issues.push(`${m.id} spawn ${name} at ${s.x},${s.y} bad (tile '${charAt(m, s.x, s.y)}')`);
      }
      for (const wp of m.warps ?? []) {
        if (!MAPS[wp.to]) issues.push(`${m.id} warp to missing map ${wp.to}`);
        else if (!MAPS[wp.to].spawns[wp.spawn]) issues.push(`${m.id} warp ${wp.to}:${wp.spawn} missing spawn`);
        const t = tileAt(m, wp.x, wp.y);
        if (!t || (t.solid && !t.climbable)) issues.push(`${m.id} warp tile at ${wp.x},${wp.y} solid '${charAt(m, wp.x, wp.y)}'`);
      }
      for (const e of m.edges ?? []) {
        if (!MAPS[e.to]) issues.push(`${m.id} edge to missing map ${e.to}`);
        else if (!MAPS[e.to].spawns[e.spawn]) issues.push(`${m.id} edge ${e.to}:${e.spawn} missing spawn`);
        const h = m.grid.length;
        let found = false;
        if (e.side === 'north') for (let x = 0; x < w; x++) found ||= isWalkable(m.id, x, 0);
        if (e.side === 'south') for (let x = 0; x < w; x++) found ||= isWalkable(m.id, x, h - 1);
        if (e.side === 'west') for (let y = 0; y < h; y++) found ||= isWalkable(m.id, 0, y);
        if (e.side === 'east') for (let y = 0; y < h; y++) found ||= isWalkable(m.id, w - 1, y);
        if (!found) issues.push(`${m.id} edge ${e.side} has no walkable boundary tile`);
      }
      for (const n of m.npcs ?? []) {
        const t = tileAt(m, n.x, n.y);
        if (!t || t.solid) issues.push(`${m.id} npc ${n.id} at ${n.x},${n.y} bad (tile '${charAt(m, n.x, n.y)}')`);
      }
      for (const tr of m.triggers ?? []) {
        if (!isWalkable(m.id, tr.x, tr.y)) issues.push(`${m.id} trigger at ${tr.x},${tr.y} not walkable ('${charAt(m, tr.x, tr.y)}')`);
      }
      for (const sg of m.signs ?? []) {
        const t = tileAt(m, sg.x, sg.y);
        if (!t) issues.push(`${m.id} sign at ${sg.x},${sg.y} out of bounds`);
      }
    }
    // eslint-disable-next-line no-console
    console.log('ISSUES (' + issues.length + '):\n' + issues.join('\n'));
  });
});
