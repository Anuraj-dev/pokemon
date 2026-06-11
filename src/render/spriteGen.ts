/**
 * Procedural sprite generation. Every sprite in the game can be drawn
 * deterministically to a canvas — creatures, characters, terrain tiles —
 * so the game runs with zero asset files present.
 */
import { RNG } from '../core/rng';
import { TYPE_COLORS, type TypeId } from '../data/types';
import { speciesById, type BodyShape } from '../data/species';

export const TILE = 32;
export const CREATURE_SIZE = 96;

/** Every character sprite archetype the game can render. */
export const CHAR_KEYS = [
  'player', 'rival', 'mom', 'professor', 'nurse', 'clerk', 'guide', 'oldman', 'boy', 'girl',
  'hiker', 'swimmer', 'ranger', 'scientist', 'grunt', 'admin', 'boss', 'leader1', 'leader2',
  'leader3', 'leader4', 'leader5', 'leader6', 'leader7', 'leader8', 'elite1', 'elite2',
  'elite3', 'elite4', 'fisher', 'lass', 'champion',
];

// ----------------------------------------------------------- color helpers

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

function rgbToCss(r: number, g: number, b: number): string {
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

export function shade(hex: number, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  if (factor >= 0) {
    return rgbToCss(r + (255 - r) * factor, g + (255 - g) * factor, b + (255 - b) * factor);
  }
  return rgbToCss(r * (1 + factor), g * (1 + factor), b * (1 + factor));
}

function hueShift(hex: number, deg: number): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  h = (h + deg + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const [rr, gg, bb] = rgb.map((v) => Math.round((v + m) * 255));
  return (rr << 16) | (gg << 8) | bb;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [canvas, ctx];
}

// ------------------------------------------------------- creature sprites

type Mask = (x: number, y: number) => number; // grid coords 0..1, returns weight

const ellipse = (cx: number, cy: number, rx: number, ry: number): Mask => (x, y) => {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  const d = dx * dx + dy * dy;
  return d < 1 ? 1 - d * 0.5 : 0;
};

const rect = (cx: number, cy: number, hw: number, hh: number): Mask => (x, y) =>
  Math.abs(x - cx) < hw && Math.abs(y - cy) < hh ? 0.9 : 0;

interface ShapeSpec {
  masks: { m: Mask; part: 'body' | 'accent' | 'limb' }[];
  eyeY: number; // 0..1
  eyeSpread: number;
}

function shapeSpec(shape: BodyShape, rng: RNG): ShapeSpec {
  const v = (base: number, jitter: number) => base + (rng.next() - 0.5) * jitter;
  switch (shape) {
    case 'quadruped':
      return {
        masks: [
          { m: ellipse(0.5, v(0.58, 0.06), v(0.3, 0.06), v(0.22, 0.05)), part: 'body' },
          { m: ellipse(0.5, v(0.32, 0.05), v(0.2, 0.05), v(0.17, 0.04)), part: 'body' },
          { m: ellipse(v(0.3, 0.04), 0.85, 0.07, 0.12), part: 'limb' },
          { m: ellipse(v(0.7, 0.04), 0.85, 0.07, 0.12), part: 'limb' },
          { m: ellipse(0.5, v(0.2, 0.04), v(0.09, 0.05), v(0.08, 0.04)), part: 'accent' }, // ears/crest
        ],
        eyeY: 0.32,
        eyeSpread: 0.1,
      };
    case 'biped':
      return {
        masks: [
          { m: ellipse(0.5, v(0.3, 0.05), v(0.19, 0.04), v(0.16, 0.04)), part: 'body' },
          { m: ellipse(0.5, v(0.62, 0.05), v(0.24, 0.05), v(0.21, 0.04)), part: 'body' },
          { m: ellipse(0.35, 0.88, 0.08, 0.1), part: 'limb' },
          { m: ellipse(0.65, 0.88, 0.08, 0.1), part: 'limb' },
          { m: ellipse(v(0.2, 0.04), 0.55, 0.08, 0.14), part: 'limb' },
          { m: ellipse(v(0.8, 0.04), 0.55, 0.08, 0.14), part: 'limb' },
          { m: ellipse(0.5, 0.62, 0.13, 0.12), part: 'accent' }, // belly
        ],
        eyeY: 0.28,
        eyeSpread: 0.09,
      };
    case 'bird':
      return {
        masks: [
          { m: ellipse(0.5, v(0.55, 0.05), v(0.22, 0.04), v(0.24, 0.04)), part: 'body' },
          { m: ellipse(0.5, v(0.28, 0.04), v(0.15, 0.03), v(0.13, 0.03)), part: 'body' },
          { m: ellipse(v(0.18, 0.05), 0.52, 0.12, v(0.2, 0.06)), part: 'accent' }, // wings
          { m: ellipse(v(0.82, 0.05), 0.52, 0.12, v(0.2, 0.06)), part: 'accent' },
          { m: rect(0.5, 0.92, 0.1, 0.06), part: 'limb' }, // feet
        ],
        eyeY: 0.27,
        eyeSpread: 0.08,
      };
    case 'serpent':
      return {
        masks: [
          { m: ellipse(0.5, v(0.7, 0.05), v(0.3, 0.05), v(0.2, 0.04)), part: 'body' }, // coil
          { m: ellipse(0.5, v(0.45, 0.05), v(0.22, 0.05), v(0.15, 0.04)), part: 'body' },
          { m: ellipse(0.5, v(0.24, 0.04), v(0.15, 0.04), v(0.13, 0.03)), part: 'body' }, // head
          { m: ellipse(0.5, 0.16, v(0.06, 0.04), 0.08), part: 'accent' }, // horn
        ],
        eyeY: 0.24,
        eyeSpread: 0.08,
      };
    case 'blob':
      return {
        masks: [
          { m: ellipse(0.5, v(0.58, 0.05), v(0.3, 0.06), v(0.28, 0.05)), part: 'body' },
          { m: ellipse(0.5, v(0.4, 0.06), v(0.22, 0.06), v(0.16, 0.05)), part: 'body' },
          { m: ellipse(0.5, 0.66, 0.16, 0.12), part: 'accent' },
        ],
        eyeY: 0.42,
        eyeSpread: 0.11,
      };
    case 'fish':
      return {
        masks: [
          { m: ellipse(0.5, 0.5, v(0.32, 0.05), v(0.2, 0.04)), part: 'body' },
          { m: ellipse(0.5, v(0.26, 0.05), 0.07, v(0.12, 0.04)), part: 'accent' }, // dorsal fin
          { m: ellipse(0.16, 0.5, 0.08, 0.13), part: 'accent' }, // side fins
          { m: ellipse(0.84, 0.5, 0.08, 0.13), part: 'accent' },
          { m: ellipse(0.5, 0.78, 0.14, 0.1), part: 'limb' }, // tail
        ],
        eyeY: 0.45,
        eyeSpread: 0.13,
      };
    case 'insect':
      return {
        masks: [
          { m: ellipse(0.5, v(0.3, 0.04), v(0.15, 0.04), v(0.13, 0.03)), part: 'body' },
          { m: ellipse(0.5, v(0.58, 0.05), v(0.2, 0.05), v(0.22, 0.04)), part: 'body' },
          { m: ellipse(v(0.22, 0.04), 0.5, 0.13, v(0.18, 0.06)), part: 'accent' }, // wings
          { m: ellipse(v(0.78, 0.04), 0.5, 0.13, v(0.18, 0.06)), part: 'accent' },
          { m: rect(0.38, 0.12, 0.02, 0.07), part: 'limb' }, // antennae
          { m: rect(0.62, 0.12, 0.02, 0.07), part: 'limb' },
        ],
        eyeY: 0.29,
        eyeSpread: 0.09,
      };
    case 'golem':
      return {
        masks: [
          { m: rect(0.5, v(0.55, 0.04), v(0.26, 0.04), v(0.22, 0.04)), part: 'body' },
          { m: rect(0.5, v(0.27, 0.04), v(0.17, 0.04), v(0.12, 0.03)), part: 'body' },
          { m: rect(0.18, 0.6, 0.08, 0.18), part: 'limb' },
          { m: rect(0.82, 0.6, 0.08, 0.18), part: 'limb' },
          { m: rect(0.35, 0.88, 0.09, 0.07), part: 'limb' },
          { m: rect(0.65, 0.88, 0.09, 0.07), part: 'limb' },
          { m: rect(0.5, 0.55, 0.12, 0.1), part: 'accent' }, // core
        ],
        eyeY: 0.27,
        eyeSpread: 0.09,
      };
    case 'spirit':
      return {
        masks: [
          { m: ellipse(0.5, v(0.4, 0.05), v(0.24, 0.05), v(0.26, 0.05)), part: 'body' },
          { m: ellipse(0.5, v(0.7, 0.05), v(0.16, 0.05), v(0.14, 0.05)), part: 'body' }, // tapering tail
          { m: ellipse(0.26, v(0.3, 0.06), 0.07, 0.1), part: 'accent' }, // wisps
          { m: ellipse(0.74, v(0.3, 0.06), 0.07, 0.1), part: 'accent' },
        ],
        eyeY: 0.38,
        eyeSpread: 0.1,
      };
  }
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Draw a creature sprite (front or back view) deterministically from its
 * species id. Returns a canvas of CREATURE_SIZE square.
 */
export function drawCreature(speciesId: string, view: 'front' | 'back', shiny = false): HTMLCanvasElement {
  const sp = speciesById(speciesId);
  const rng = new RNG(hashString(speciesId + ':' + sp.shape));
  const spec = shapeSpec(sp.shape, rng);
  const G = 24; // grid cells
  const PX = CREATURE_SIZE / G;
  const [canvas, ctx] = makeCanvas(CREATURE_SIZE, CREATURE_SIZE);

  let primary = TYPE_COLORS[sp.types[0]];
  let secondary = sp.types[1] ? TYPE_COLORS[sp.types[1]] : hueShift(primary, 30);
  if (shiny) {
    primary = hueShift(primary, 150);
    secondary = hueShift(secondary, 150);
  }

  // Field of cells: half-grid mirrored for symmetry.
  type Cell = 0 | 1 | 2 | 3; // empty | body | accent | limb
  const cells: Cell[][] = Array.from({ length: G }, () => Array<Cell>(G).fill(0));
  for (let gy = 0; gy < G; gy++) {
    for (let gx = 0; gx <= G / 2; gx++) {
      const x = (gx + 0.5) / G;
      const y = (gy + 0.5) / G;
      let best: Cell = 0;
      let bestW = 0.25 + (rng.next() - 0.5) * 0.25; // ragged noise threshold
      for (const { m, part } of spec.masks) {
        const w = m(x, y);
        if (w > bestW) {
          bestW = w;
          best = part === 'body' ? 1 : part === 'accent' ? 2 : 3;
        }
      }
      cells[gy][gx] = best;
      cells[gy][G - 1 - gx] = best;
    }
  }

  const colorFor = (c: Cell, gy: number): string => {
    const topLight = gy < G * 0.4 ? 0.12 : 0;
    switch (c) {
      case 1: return shade(primary, topLight);
      case 2: return shade(secondary, 0.15);
      case 3: return shade(primary, -0.3);
      default: return '';
    }
  };

  // Paint cells with outline.
  for (let gy = 0; gy < G; gy++) {
    for (let gx = 0; gx < G; gx++) {
      const c = cells[gy][gx];
      if (c === 0) continue;
      ctx.fillStyle = colorFor(c, gy);
      ctx.fillRect(gx * PX, gy * PX, PX, PX);
    }
  }
  // Outline pass
  ctx.fillStyle = shade(primary, -0.62);
  for (let gy = 0; gy < G; gy++) {
    for (let gx = 0; gx < G; gx++) {
      if (cells[gy][gx] === 0) continue;
      const edge =
        gy === 0 || gy === G - 1 || gx === 0 || gx === G - 1 ||
        cells[gy - 1][gx] === 0 || cells[gy + 1][gx] === 0 ||
        cells[gy][gx - 1] === 0 || cells[gy][gx + 1] === 0;
      if (edge) ctx.fillRect(gx * PX, gy * PX, PX, PX);
    }
  }

  if (view === 'front') {
    // Eyes
    const eyeGy = Math.floor(spec.eyeY * G);
    const spreadCells = Math.max(2, Math.floor(spec.eyeSpread * G));
    const cx = G / 2;
    for (const ex of [cx - spreadCells, cx + spreadCells - 1]) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ex * PX, eyeGy * PX, PX, PX * 2);
      ctx.fillStyle = '#101018';
      ctx.fillRect(ex * PX, (eyeGy + 1) * PX, PX, PX);
    }
    // Mouth hint
    ctx.fillStyle = shade(primary, -0.5);
    ctx.fillRect((cx - 1) * PX, (eyeGy + 3) * PX, PX * 2, Math.max(1, PX / 2));
  } else {
    // Back view: a darker dorsal stripe instead of a face.
    ctx.fillStyle = shade(primary, -0.25);
    for (let gy = 2; gy < G - 2; gy++) {
      if (cells[gy][Math.floor(G / 2)] !== 0) {
        ctx.fillRect((G / 2 - 1) * PX, gy * PX, PX * 2, PX);
      }
    }
  }
  return canvas;
}

// ------------------------------------------------------ character sprites

export interface CharPalette {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  hat: string | null;
}

const SKINS = ['#e8b88a', '#c98e5a', '#8a5a32', '#f0c8a0'];
const HAIRS = ['#3a2a1a', '#181820', '#7a4a20', '#b8b8c0', '#a03020', '#d8a030'];
const SHIRTS = ['#c03028', '#2858c0', '#28a048', '#9038b0', '#e09020', '#208898', '#d05880', '#506070'];
const PANTS = ['#283048', '#503828', '#404858', '#6a4a6a'];

export function charPalette(key: string): CharPalette {
  if (key === 'player') {
    return { skin: '#e8b88a', hair: '#3a2a1a', shirt: '#c03028', pants: '#283048', hat: '#c03028' };
  }
  if (key === 'rival') {
    return { skin: '#e8b88a', hair: '#7050c0', shirt: '#283048', pants: '#404858', hat: null };
  }
  if (key.startsWith('grunt') || key === 'boss' || key === 'admin') {
    return { skin: '#d8a880', hair: '#181820', shirt: '#2a2a38', pants: '#181820', hat: '#383848' };
  }
  const rng = new RNG(hashString('char:' + key));
  return {
    skin: rng.pick(SKINS),
    hair: rng.pick(HAIRS),
    shirt: rng.pick(SHIRTS),
    pants: rng.pick(PANTS),
    hat: rng.chance(0.25) ? rng.pick(SHIRTS) : null,
  };
}

/**
 * Draw one 32×32 character frame. dir: which way the character faces;
 * frame 0 = idle, 1/2 = walk cycle.
 */
export function drawCharFrame(pal: CharPalette, dir: 'down' | 'up' | 'left' | 'right', frame: number): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(TILE, TILE);
  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * 2, y * 2, w * 2, h * 2);
  };
  // Work in a 16×16 virtual grid (2px blocks).
  const outline = '#181820';
  const bob = frame === 0 ? 0 : frame === 1 ? 0 : 0;
  const legPhase = frame === 1 ? 1 : frame === 2 ? -1 : 0;

  // Legs
  if (dir === 'left' || dir === 'right') {
    const flip = dir === 'right';
    const f = (x: number) => (flip ? 15 - x : x);
    px(f(6) - (flip ? 1 : 0), 12 + Math.max(0, -legPhase), 2, 3 - Math.max(0, -legPhase), pal.pants);
    px(f(8) - (flip ? 1 : 0), 12 + Math.max(0, legPhase), 2, 3 - Math.max(0, legPhase), pal.pants);
  } else {
    px(5, 12 + Math.max(0, legPhase), 2, 3 - Math.max(0, legPhase), pal.pants);
    px(9, 12 + Math.max(0, -legPhase), 2, 3 - Math.max(0, -legPhase), pal.pants);
  }
  // Body
  px(5, 8 + bob, 6, 4, pal.shirt);
  px(4, 9 + bob, 1, 2, pal.shirt); // arms
  px(11, 9 + bob, 1, 2, pal.shirt);
  // Head
  px(4, 2 + bob, 8, 6, pal.skin);
  // Hair / hat
  if (pal.hat) {
    px(4, 1 + bob, 8, 2, pal.hat);
    px(3, 3 + bob, 10, 1, pal.hat);
  } else {
    px(4, 1 + bob, 8, 2, pal.hair);
  }
  if (dir === 'up') {
    // back of head: hair covers face area
    px(4, 3 + bob, 8, 4, pal.hair);
  } else if (dir === 'down') {
    px(4, 3 + bob, 1, 2, pal.hair);
    px(11, 3 + bob, 1, 2, pal.hair);
    // eyes
    px(6, 4 + bob, 1, 1, outline);
    px(9, 4 + bob, 1, 1, outline);
  } else {
    const ex = dir === 'left' ? 5 : 10;
    px(ex, 4 + bob, 1, 1, outline);
    const hx = dir === 'left' ? 10 : 4;
    px(hx, 3 + bob, 2, 3, pal.hair);
  }
  return canvas;
}

// --------------------------------------------------------------- tiles

type TileDrawer = (ctx: CanvasRenderingContext2D, rng: RNG) => void;

function speckle(ctx: CanvasRenderingContext2D, rng: RNG, color: string, count: number) {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    ctx.fillRect(rng.int(0, TILE - 2), rng.int(0, TILE - 2), 2, 2);
  }
}

function fill(ctx: CanvasRenderingContext2D, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, TILE, TILE);
}

const GRASS_BASE = '#58a850';
const PATH_BASE = '#d8c890';
const WATER_BASE = '#3878c8';
const CAVE_FLOOR = '#7a6a58';
const INTERIOR_FLOOR = '#d8c8a8';

export const TILE_DRAWERS: Record<string, TileDrawer> = {
  grass: (ctx, rng) => {
    fill(ctx, GRASS_BASE);
    speckle(ctx, rng, '#4c9846', 14);
    speckle(ctx, rng, '#68b860', 8);
  },
  tallgrass: (ctx, rng) => {
    fill(ctx, '#48984a');
    speckle(ctx, rng, '#3a8040', 10);
    ctx.fillStyle = '#2e7036';
    for (let i = 0; i < 6; i++) {
      const x = 2 + i * 5 + rng.int(0, 2);
      ctx.fillRect(x, 8 + rng.int(0, 4), 3, 22);
      ctx.fillRect(x - 2, 14 + rng.int(0, 4), 2, 16);
    }
    ctx.fillStyle = '#56a85a';
    for (let i = 0; i < 5; i++) ctx.fillRect(4 + i * 6, 10 + rng.int(0, 6), 2, 10);
  },
  flowers: (ctx, rng) => {
    fill(ctx, GRASS_BASE);
    speckle(ctx, rng, '#4c9846', 10);
    for (const [fx, fy, c] of [[7, 9, '#e85a78'], [21, 7, '#f0d048'], [13, 21, '#e8e8f0'], [24, 22, '#e85a78']] as [number, number, string][]) {
      ctx.fillStyle = c;
      ctx.fillRect(fx - 2, fy, 6, 2);
      ctx.fillRect(fx, fy - 2, 2, 6);
      ctx.fillStyle = '#f8f0a0';
      ctx.fillRect(fx, fy, 2, 2);
    }
  },
  path: (ctx, rng) => {
    fill(ctx, PATH_BASE);
    speckle(ctx, rng, '#c8b878', 12);
    speckle(ctx, rng, '#e8dcb0', 6);
  },
  sand: (ctx, rng) => {
    fill(ctx, '#e8d8a0');
    speckle(ctx, rng, '#d8c488', 14);
  },
  tree: (ctx, rng) => {
    fill(ctx, GRASS_BASE);
    speckle(ctx, rng, '#4c9846', 6);
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(13, 22, 6, 8);
    ctx.fillStyle = '#1e5c2e';
    ctx.beginPath();
    ctx.arc(16, 13, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a7a3c';
    ctx.beginPath();
    ctx.arc(13, 10, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#38904a';
    ctx.beginPath();
    ctx.arc(19, 8, 5, 0, Math.PI * 2);
    ctx.fill();
  },
  bush: (ctx, rng) => {
    fill(ctx, GRASS_BASE);
    speckle(ctx, rng, '#4c9846', 6);
    ctx.fillStyle = '#2a7a3c';
    ctx.beginPath();
    ctx.arc(16, 18, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e5c2e';
    for (let i = 0; i < 5; i++) ctx.fillRect(8 + i * 4, 14 + (i % 2) * 5, 3, 3);
    ctx.fillStyle = '#48a058';
    ctx.fillRect(10, 12, 4, 3);
    ctx.fillRect(18, 15, 4, 3);
  },
  water: (ctx, rng) => {
    fill(ctx, WATER_BASE);
    ctx.fillStyle = '#5090d8';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(rng.int(0, 16), 4 + i * 8 + rng.int(0, 3), 12 + rng.int(0, 8), 2);
    }
    ctx.fillStyle = '#88b8e8';
    ctx.fillRect(rng.int(4, 20), rng.int(4, 24), 6, 2);
  },
  ledge: (ctx, rng) => {
    fill(ctx, GRASS_BASE);
    speckle(ctx, rng, '#4c9846', 8);
    ctx.fillStyle = '#b89858';
    ctx.fillRect(0, 20, TILE, 8);
    ctx.fillStyle = '#8a6a38';
    ctx.fillRect(0, 26, TILE, 6);
    ctx.fillStyle = '#d8c890';
    for (let i = 0; i < 4; i++) ctx.fillRect(i * 9, 20, 5, 3);
  },
  rockwall: (ctx, rng) => {
    fill(ctx, '#5a5048');
    ctx.fillStyle = '#6e6258';
    for (let i = 0; i < 6; i++) ctx.fillRect(rng.int(0, 24), rng.int(0, 24), 8, 6);
    ctx.strokeStyle = '#453c36';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, TILE - 2, TILE - 2);
  },
  climbwall: (ctx, rng) => {
    fill(ctx, '#6a5a48');
    ctx.fillStyle = '#7e6e58';
    for (let i = 0; i < 5; i++) ctx.fillRect(rng.int(0, 24), rng.int(0, 26), 9, 5);
    ctx.fillStyle = '#45382c';
    for (let y = 4; y < TILE; y += 8) {
      ctx.fillRect(8, y, 16, 3);
    }
  },
  cavefloor: (ctx, rng) => {
    fill(ctx, CAVE_FLOOR);
    speckle(ctx, rng, '#6a5a48', 12);
    speckle(ctx, rng, '#8a7a66', 8);
  },
  cavewall: (ctx, rng) => {
    fill(ctx, '#3a322c');
    ctx.fillStyle = '#48403a';
    for (let i = 0; i < 6; i++) ctx.fillRect(rng.int(0, 24), rng.int(0, 24), 9, 7);
    ctx.fillStyle = '#2a2420';
    ctx.fillRect(0, 28, TILE, 4);
  },
  boulder: (ctx, rng) => {
    TILE_DRAWERS.cavefloor(ctx, rng);
    ctx.fillStyle = '#8a8078';
    ctx.beginPath();
    ctx.arc(16, 17, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a89e94';
    ctx.fillRect(10, 10, 8, 5);
    ctx.fillStyle = '#5e564e';
    ctx.fillRect(12, 22, 10, 4);
  },
  wall: (ctx) => {
    fill(ctx, '#e8e0d0');
    ctx.fillStyle = '#d0c8b8';
    for (let y = 0; y < TILE; y += 8) {
      for (let x = (y / 8) % 2 === 0 ? 0 : 8; x < TILE; x += 16) {
        ctx.fillRect(x + 1, y + 1, 14, 6);
      }
    }
  },
  roof: (ctx) => {
    fill(ctx, '#c05848');
    ctx.fillStyle = '#a84838';
    for (let y = 2; y < TILE; y += 8) ctx.fillRect(0, y, TILE, 3);
    ctx.fillStyle = '#d87060';
    ctx.fillRect(0, 0, TILE, 2);
  },
  roofblue: (ctx) => {
    // healing center: bright Pokécenter red
    fill(ctx, '#e83830');
    ctx.fillStyle = '#c02820';
    for (let y = 2; y < TILE; y += 8) ctx.fillRect(0, y, TILE, 3);
    ctx.fillStyle = '#f86860';
    ctx.fillRect(0, 0, TILE, 2);
  },
  roofmart: (ctx) => {
    fill(ctx, '#3898b0');
    ctx.fillStyle = '#288098';
    for (let y = 2; y < TILE; y += 8) ctx.fillRect(0, y, TILE, 3);
  },
  roofgym: (ctx) => {
    // gym: bold purple
    fill(ctx, '#8048c8');
    ctx.fillStyle = '#6838a8';
    for (let y = 2; y < TILE; y += 8) ctx.fillRect(0, y, TILE, 3);
    ctx.fillStyle = '#9c68dc';
    ctx.fillRect(0, 0, TILE, 2);
  },
  rooflab: (ctx) => {
    fill(ctx, '#b08828');
    ctx.fillStyle = '#987018';
    for (let y = 2; y < TILE; y += 8) ctx.fillRect(0, y, TILE, 3);
  },
  door: (ctx) => {
    fill(ctx, '#e8e0d0');
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(6, 4, 20, 28);
    ctx.fillStyle = '#8a6a42';
    ctx.fillRect(8, 6, 16, 24);
    ctx.fillStyle = '#f0d048';
    ctx.fillRect(20, 18, 3, 3);
  },
  window: (ctx) => {
    fill(ctx, '#e8e0d0');
    ctx.fillStyle = '#586878';
    ctx.fillRect(6, 8, 20, 16);
    ctx.fillStyle = '#a8c8e8';
    ctx.fillRect(8, 10, 7, 12);
    ctx.fillRect(17, 10, 7, 12);
  },
  sign: (ctx, rng) => {
    TILE_DRAWERS.path(ctx, rng);
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(14, 18, 4, 12);
    ctx.fillStyle = '#a8845a';
    ctx.fillRect(4, 6, 24, 14);
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(7, 9, 18, 2);
    ctx.fillRect(7, 13, 14, 2);
  },
  fence: (ctx, rng) => {
    fill(ctx, GRASS_BASE);
    speckle(ctx, rng, '#4c9846', 6);
    ctx.fillStyle = '#b89868';
    ctx.fillRect(4, 10, 4, 16);
    ctx.fillRect(24, 10, 4, 16);
    ctx.fillRect(0, 14, TILE, 4);
    ctx.fillStyle = '#96784e';
    ctx.fillRect(0, 16, TILE, 2);
  },
  floor: (ctx, rng) => {
    fill(ctx, INTERIOR_FLOOR);
    ctx.fillStyle = '#c8b890';
    for (let y = 0; y < TILE; y += 8) ctx.fillRect(0, y, TILE, 2);
    speckle(ctx, rng, '#e0d4b8', 4);
  },
  carpet: (ctx) => {
    fill(ctx, '#b04848');
    ctx.fillStyle = '#c86060';
    ctx.fillRect(3, 3, TILE - 6, TILE - 6);
    ctx.fillStyle = '#d88080';
    ctx.fillRect(8, 8, TILE - 16, TILE - 16);
  },
  interiorwall: (ctx) => {
    fill(ctx, '#b8a888');
    ctx.fillStyle = '#a89878';
    for (let y = 0; y < TILE; y += 6) ctx.fillRect(0, y, TILE, 2);
    ctx.fillStyle = '#988868';
    ctx.fillRect(0, TILE - 6, TILE, 6);
  },
  counter: (ctx) => {
    fill(ctx, '#c8a868');
    ctx.fillStyle = '#e0c890';
    ctx.fillRect(0, 0, TILE, 12);
    ctx.fillStyle = '#a8884e';
    ctx.fillRect(0, 12, TILE, 4);
  },
  shelf: (ctx) => {
    fill(ctx, '#8a6a42');
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(2, 2, TILE - 4, TILE - 4);
    for (const [x, y, c] of [[6, 6, '#e05858'], [14, 6, '#5878e0'], [22, 6, '#58c068'], [6, 18, '#e0c858'], [14, 18, '#a868d0'], [22, 18, '#e08838']] as [number, number, string][]) {
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 5, 7);
    }
  },
  pc: (ctx) => {
    fill(ctx, INTERIOR_FLOOR);
    ctx.fillStyle = '#586878';
    ctx.fillRect(5, 6, 22, 18);
    ctx.fillStyle = '#78e8a0';
    ctx.fillRect(8, 9, 16, 10);
    ctx.fillStyle = '#384858';
    ctx.fillRect(10, 24, 12, 5);
  },
  healer: (ctx) => {
    fill(ctx, INTERIOR_FLOOR);
    ctx.fillStyle = '#d04848';
    ctx.beginPath();
    ctx.arc(16, 16, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(13, 8, 6, 16);
    ctx.fillRect(8, 13, 16, 6);
  },
  gymfloor: (ctx, rng) => {
    fill(ctx, '#c8c0b0');
    ctx.fillStyle = '#b8b0a0';
    for (let y = 0; y < TILE; y += 16) {
      for (let x = (y / 16) % 2 === 0 ? 0 : 16; x < TILE; x += 32) {
        ctx.fillRect(x, y, 16, 16);
      }
    }
    speckle(ctx, rng, '#d8d0c0', 3);
  },
  gympad: (ctx) => {
    fill(ctx, '#c8c0b0');
    ctx.fillStyle = '#e8b830';
    ctx.fillRect(4, 4, TILE - 8, TILE - 8);
    ctx.fillStyle = '#c89818';
    ctx.fillRect(8, 8, TILE - 16, TILE - 16);
  },
  warp: (ctx) => {
    fill(ctx, INTERIOR_FLOOR);
    ctx.fillStyle = '#8868c8';
    ctx.fillRect(4, 4, TILE - 8, TILE - 8);
    ctx.fillStyle = '#b098e8';
    ctx.fillRect(8, 8, TILE - 16, TILE - 16);
  },
  mat: (ctx) => {
    fill(ctx, INTERIOR_FLOOR);
    ctx.fillStyle = '#58a058';
    ctx.fillRect(2, 2, TILE - 4, TILE - 4);
    ctx.fillStyle = '#70b870';
    ctx.fillRect(5, 5, TILE - 10, TILE - 10);
  },
  table: (ctx) => {
    fill(ctx, INTERIOR_FLOOR);
    ctx.fillStyle = '#8a6a42';
    ctx.fillRect(4, 8, 24, 18);
    ctx.fillStyle = '#a8845a';
    ctx.fillRect(6, 10, 20, 12);
  },
  bookshelf: (ctx) => {
    fill(ctx, '#8a6a42');
    ctx.fillStyle = '#5a4022';
    ctx.fillRect(2, 2, 28, 28);
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = ['#c05848', '#4868c0', '#48a058', '#d8b838', '#9858b8', '#d87838'][(i + row) % 6];
        ctx.fillRect(4 + i * 4, 5 + row * 13, 3, 9);
      }
    }
  },
  statue: (ctx, rng) => {
    TILE_DRAWERS.gymfloor(ctx, rng);
    ctx.fillStyle = '#888898';
    ctx.fillRect(8, 20, 16, 8);
    ctx.fillStyle = '#a8a8b8';
    ctx.beginPath();
    ctx.arc(16, 12, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(12, 14, 8, 8);
  },
  void: (ctx) => {
    fill(ctx, '#101018');
  },
  bridge: (ctx) => {
    fill(ctx, WATER_BASE);
    ctx.fillStyle = '#b89868';
    ctx.fillRect(0, 2, TILE, 28);
    ctx.fillStyle = '#96784e';
    for (let x = 0; x < TILE; x += 8) ctx.fillRect(x, 2, 2, 28);
    ctx.fillStyle = '#7a5c38';
    ctx.fillRect(0, 0, TILE, 3);
    ctx.fillRect(0, 29, TILE, 3);
  },
  snow: (ctx, rng) => {
    fill(ctx, '#e8eef4');
    speckle(ctx, rng, '#d0dce8', 10);
  },
  darkfloor: (ctx, rng) => {
    fill(ctx, '#383848');
    ctx.fillStyle = '#30303e';
    for (let y = 0; y < TILE; y += 16) {
      for (let x = (y / 16) % 2 === 0 ? 0 : 16; x < TILE; x += 32) ctx.fillRect(x, y, 16, 16);
    }
    speckle(ctx, rng, '#404052', 4);
  },
  darkwall: (ctx) => {
    fill(ctx, '#202030');
    ctx.fillStyle = '#282840';
    for (let y = 0; y < TILE; y += 8) {
      for (let x = (y / 8) % 2 === 0 ? 0 : 8; x < TILE; x += 16) ctx.fillRect(x + 1, y + 1, 14, 6);
    }
  },
};

export function drawTile(name: string): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(TILE, TILE);
  const drawer = TILE_DRAWERS[name];
  const rng = new RNG(hashString('tile:' + name));
  if (drawer) drawer(ctx, rng);
  else {
    fill(ctx, '#ff00ff');
  }
  return canvas;
}

// ----------------------------------------------------------------- misc

export function drawBall(tier: string): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(24, 24);
  const top = tier === 'greatball' ? '#3868d8' : tier === 'ultraball' ? '#282830' : tier === 'masterball' ? '#9038b0' : '#e04838';
  ctx.fillStyle = '#181820';
  ctx.beginPath();
  ctx.arc(12, 12, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.arc(12, 12, 8.5, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#f0f0f0';
  ctx.beginPath();
  ctx.arc(12, 12, 8.5, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = '#181820';
  ctx.fillRect(3, 11, 18, 3);
  ctx.fillStyle = '#f0f0f0';
  ctx.beginPath();
  ctx.arc(12, 12, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#181820';
  ctx.beginPath();
  ctx.arc(12, 12, 1.5, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

export function drawBadge(index: number): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(20, 20);
  const colors = Object.values(TYPE_COLORS);
  const color = colors[index % colors.length];
  ctx.fillStyle = shade(color, -0.3);
  ctx.beginPath();
  const sides = 3 + (index % 4);
  for (let i = 0; i <= sides * 2; i++) {
    const r = i % 2 === 0 ? 9 : 5;
    const a = (Math.PI * i) / sides - Math.PI / 2;
    const x = 10 + r * Math.cos(a);
    const y = 10 + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(color, 0.25);
  ctx.beginPath();
  ctx.arc(10, 10, 4, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}
