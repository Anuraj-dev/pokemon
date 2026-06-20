import { describe, expect, it } from 'vitest';
import { worldLayout } from '../src/render3d/worldLayout';
import { MAPS } from '../src/data/maps';

describe('stitched world layout', () => {
  const layout = worldLayout();

  it('places every edge-connected map exactly once', () => {
    // everything reachable from embervale through edges must be in the world
    const expected = new Set<string>(['embervale']);
    let grew = true;
    while (grew) {
      grew = false;
      for (const id of [...expected]) {
        for (const e of MAPS[id].edges ?? []) {
          if (MAPS[e.to] && MAPS[e.to].edges?.some((r) => r.to === id) && !expected.has(e.to)) {
            expected.add(e.to);
            grew = true;
          }
        }
      }
    }
    for (const id of expected) expect(layout.isPlaced(id), `${id} should be stitched`).toBe(true);
  });

  it('never overlaps two maps', () => {
    const rects = [...layout.placed.values()];
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `${a.map.id} overlaps ${b.map.id}`).toBe(false);
      }
    }
  });

  it('keeps authored tiles intact under global lookup', () => {
    for (const r of layout.placed.values()) {
      const midY = Math.floor(r.h / 2);
      for (let lx = 0; lx < r.w; lx++) {
        expect(layout.charAt(r.x + lx, r.y + midY)).toBe(r.map.grid[midY][lx]);
      }
    }
  });

  it('carves a walkable connector for every stitched edge join', () => {
    for (const r of layout.placed.values()) {
      for (const e of r.map.edges ?? []) {
        if (!layout.isPlaced(e.to)) continue;
        // just outside the border at the join there must be no tree hedge
        const recip = MAPS[e.to].edges?.find((x) => x.to === r.map.id);
        const arrive = recip ? r.map.spawns[recip.spawn] : null;
        if (!arrive) continue;
        const gx = e.side === 'west' ? r.x - 1 : e.side === 'east' ? r.x + r.w : r.x + arrive.x;
        const gy = e.side === 'north' ? r.y - 1 : e.side === 'south' ? r.y + r.h : r.y + arrive.y;
        const ch = layout.charAt(gx, gy);
        expect([',', '~', '.']).toContain(ch);
      }
    }
  });

  it('exposes border warps for edges into non-stitched maps', () => {
    // victory road's north edge leads to the league interior
    const vr = layout.placed.get('victoryroad');
    expect(vr).toBeDefined();
    const found = [...layout.exteriorWarps.values()].some((w) => w.to === 'league');
    expect(found).toBe(true);
  });

  it('maps tile hits back to local coordinates', () => {
    const r = layout.placed.get('embervale')!;
    const hit = layout.mapAt(r.x + 5, r.y + 7);
    expect(hit?.map.id).toBe('embervale');
    expect(hit?.lx).toBe(5);
    expect(hit?.ly).toBe(7);
  });
});
