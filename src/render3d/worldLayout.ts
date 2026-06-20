/**
 * World layout — stitches every edge-connected outdoor map onto one global
 * tile plane so the overworld streams like a single continuous world.
 *
 * Maps were authored standalone, so a strict edge-to-edge stitch overlaps;
 * instead each map is BFS-placed with adaptive gaps (pushed apart until
 * nothing collides), a tree/water hedge rings each map, and walkable
 * connector paths are carved through procedural wilderness between the
 * authored edge openings. Edges that point at non-stitched maps (e.g.
 * Victory Road → League) become warp strips just outside the border.
 */
import { MAPS } from '../data/maps';
import { LEGEND, type LegendEntry, type MapDef } from '../data/maps/defs';

const START_MAP = 'embervale';
const GAP_MIN = 5; // tiles of wilderness between joined maps
const MARGIN = 3; // extra clearance demanded while placing
const WORLD_FRINGE = 28; // roamable band around the region before the deep forest

export interface PlacedMap {
  map: MapDef;
  x: number; // global tile coords of map's (0,0)
  y: number;
  w: number;
  h: number;
}

export interface MapHit {
  map: MapDef;
  ox: number; // map origin in global coords
  oy: number;
  lx: number; // local tile coords inside the map
  ly: number;
}

export interface WorldLayout {
  placed: Map<string, PlacedMap>;
  /** global bounding box of all placed maps */
  bounds: { x0: number; y0: number; x1: number; y1: number };
  isPlaced(id: string): boolean;
  offsetOf(id: string): { x: number; y: number };
  mapAt(gx: number, gy: number): MapHit | null;
  /** effective tile char at a global coord (authored, carved, or wilderness) */
  charAt(gx: number, gy: number, cutBushes?: Set<string>): string;
  tileAt(gx: number, gy: number, cutBushes?: Set<string>): LegendEntry | null;
  /** border warps to non-stitched maps, keyed `${gx},${gy}` */
  exteriorWarps: Map<string, { to: string; spawn: string }>;
}

function hash2(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

let cached: WorldLayout | null = null;

export function worldLayout(): WorldLayout {
  if (cached) return cached;

  // ---------------------------------------------------------- placement
  const placed = new Map<string, PlacedMap>();
  const put = (id: string, x: number, y: number) => {
    const m = MAPS[id];
    placed.set(id, { map: m, x, y, w: m.grid[0].length, h: m.grid.length });
  };

  const overlapsAny = (x: number, y: number, w: number, h: number): boolean => {
    for (const r of placed.values()) {
      if (x - MARGIN < r.x + r.w && r.x < x + w + MARGIN && y - MARGIN < r.y + r.h && r.y < y + h + MARGIN) return true;
    }
    return false;
  };

  put(START_MAP, 0, 0);
  const queue = [START_MAP];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const a = placed.get(id)!;
    for (const e of a.map.edges ?? []) {
      if (placed.has(e.to)) continue;
      const b = MAPS[e.to];
      if (!b) continue;
      // only mutual joins stitch; one-way edges (Victory Road → League hall,
      // which warps back) become border warps instead
      const recip = b.edges?.find((r) => r.to === id);
      if (!recip) continue;
      const bw = b.grid[0].length;
      const bh = b.grid.length;
      const arriveB = b.spawns[e.spawn];
      const arriveA = recip ? a.map.spawns[recip.spawn] : null;
      const alongX = e.side === 'north' || e.side === 'south';
      let perp = alongX
        ? a.x + (arriveA ? arriveA.x : Math.floor(a.w / 2)) - (arriveB ? arriveB.x : Math.floor(bw / 2))
        : a.y + (arriveA ? arriveA.y : Math.floor(a.h / 2)) - (arriveB ? arriveB.y : Math.floor(bh / 2));
      // push along the edge axis until the slot is free
      for (let gap = GAP_MIN; gap < 400; gap++) {
        const bx = alongX ? perp : e.side === 'west' ? a.x - gap - bw : a.x + a.w + gap;
        const by = alongX ? (e.side === 'north' ? a.y - gap - bh : a.y + a.h + gap) : perp;
        if (!overlapsAny(bx, by, bw, bh)) {
          put(e.to, bx, by);
          queue.push(e.to);
          break;
        }
      }
    }
  }

  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const r of placed.values()) {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w);
    y1 = Math.max(y1, r.y + r.h);
  }
  const bounds = { x0, y0, x1, y1 };

  // ------------------------------------------------ hedges + connectors
  const overrides = new Map<string, string>();
  const oKey = (x: number, y: number) => `${x},${y}`;

  const borderChar = (r: PlacedMap, gx: number, gy: number): string => {
    // nearest authored tile inside the rect, to continue water as water
    const lx = Math.min(r.w - 1, Math.max(0, gx - r.x));
    const ly = Math.min(r.h - 1, Math.max(0, gy - r.y));
    return r.map.grid[ly][lx];
  };

  for (const r of placed.values()) {
    for (let gx = r.x - 1; gx <= r.x + r.w; gx++) {
      for (const gy of [r.y - 1, r.y + r.h]) {
        const ch = borderChar(r, gx, gy);
        overrides.set(oKey(gx, gy), LEGEND[ch]?.water ? '~' : '#');
      }
    }
    for (let gy = r.y; gy < r.y + r.h; gy++) {
      for (const gx of [r.x - 1, r.x + r.w]) {
        const ch = borderChar(r, gx, gy);
        overrides.set(oKey(gx, gy), LEGEND[ch]?.water ? '~' : '#');
      }
    }
  }

  /** carve one walkable tile plus soft shoulders */
  const carve = (x: number, y: number, ch: string) => {
    overrides.set(oKey(x, y), ch);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const k = oKey(x + dx, y + dy);
      const cur = overrides.get(k);
      if (cur !== ',' && cur !== '~') overrides.set(k, '.');
    }
  };

  /** L-shaped corridor between two global points (axis-major first) */
  const carvePath = (ax: number, ay: number, bx: number, by: number, vertical: boolean, ch: string) => {
    let x = ax;
    let y = ay;
    carve(x, y, ch);
    if (vertical) {
      while (y !== by) {
        y += Math.sign(by - y);
        carve(x, y, ch);
      }
      while (x !== bx) {
        x += Math.sign(bx - x);
        carve(x, y, ch);
      }
    } else {
      while (x !== bx) {
        x += Math.sign(bx - x);
        carve(x, y, ch);
      }
      while (y !== by) {
        y += Math.sign(by - y);
        carve(x, y, ch);
      }
    }
  };

  const exteriorWarps = new Map<string, { to: string; spawn: string }>();
  const joined = new Set<string>();

  for (const a of placed.values()) {
    for (const e of a.map.edges ?? []) {
      const b = placed.get(e.to);
      const arriveB = MAPS[e.to]?.spawns[e.spawn];
      const recip = MAPS[e.to]?.edges?.find((r) => r.to === a.map.id);
      const arriveA = recip ? a.map.spawns[recip.spawn] : null;

      // exit point just outside A's border on the edge side
      const ax = e.side === 'west' ? a.x - 1 : e.side === 'east' ? a.x + a.w : a.x + (arriveA?.x ?? Math.floor(a.w / 2));
      const ay = e.side === 'north' ? a.y - 1 : e.side === 'south' ? a.y + a.h : a.y + (arriveA?.y ?? Math.floor(a.h / 2));

      if (!b) {
        // border warp into a non-stitched map (league etc.) — a 3-wide strip
        if (arriveB || MAPS[e.to]) {
          const vertical = e.side === 'north' || e.side === 'south';
          for (let d = -1; d <= 1; d++) {
            const wx = vertical ? ax + d : ax;
            const wy = vertical ? ay : ay + d;
            overrides.set(oKey(wx, wy), 'a');
            exteriorWarps.set(oKey(wx, wy), { to: e.to, spawn: e.spawn });
          }
        }
        continue;
      }

      const jk = [a.map.id, e.to].sort().join('|');
      if (joined.has(jk)) continue;
      joined.add(jk);

      // entry point just outside B's border facing back
      const bx = e.side === 'west' ? b.x + b.w : e.side === 'east' ? b.x - 1 : b.x + (arriveB?.x ?? Math.floor(b.w / 2));
      const by = e.side === 'north' ? b.y + b.h : e.side === 'south' ? b.y - 1 : b.y + (arriveB?.y ?? Math.floor(b.h / 2));

      const aWater = LEGEND[borderChar(a, ax, ay)]?.water ?? false;
      const bWater = LEGEND[borderChar(b, bx, by)]?.water ?? false;
      const ch = aWater && bWater ? '~' : ',';
      carvePath(ax, ay, bx, by, e.side === 'north' || e.side === 'south', ch);
    }
  }

  // ------------------------------------------------------------- lookup
  const rects = [...placed.values()];

  const mapAt = (gx: number, gy: number): MapHit | null => {
    for (const r of rects) {
      if (gx >= r.x && gx < r.x + r.w && gy >= r.y && gy < r.y + r.h) {
        return { map: r.map, ox: r.x, oy: r.y, lx: gx - r.x, ly: gy - r.y };
      }
    }
    return null;
  };

  const wildChar = (gx: number, gy: number): string => {
    const out =
      Math.max(bounds.x0 - gx, gx - bounds.x1, bounds.y0 - gy, gy - bounds.y1, 0);
    if (out > WORLD_FRINGE) {
      // world border: near-solid forest, lightly jittered so it isn't a wall
      return hash2(gx, gy) < 0.92 ? '#' : '.';
    }
    const h = hash2(gx, gy);
    if (h < 0.11) return '#';
    if (h < 0.15) return 'f';
    return '.';
  };

  const charAt = (gx: number, gy: number, cutBushes?: Set<string>): string => {
    const hit = mapAt(gx, gy);
    if (hit) {
      const ch = hit.map.grid[hit.ly][hit.lx];
      if (cutBushes && LEGEND[ch]?.cuttable && cutBushes.has(`${hit.map.id}:${hit.lx},${hit.ly}`)) {
        return hit.map.indoor ? 'c' : '.';
      }
      return ch;
    }
    return overrides.get(oKey(gx, gy)) ?? wildChar(gx, gy);
  };

  cached = {
    placed,
    bounds,
    isPlaced: (id) => placed.has(id),
    offsetOf: (id) => {
      const r = placed.get(id);
      if (!r) throw new Error(`Map not in world layout: ${id}`);
      return { x: r.x, y: r.y };
    },
    mapAt,
    charAt,
    tileAt: (gx, gy, cut) => LEGEND[charAt(gx, gy, cut)] ?? null,
    exteriorWarps,
  };
  return cached;
}
