/**
 * Texture registry — procedural canvases from spriteGen, exposed as
 * THREE.CanvasTexture (world/battle) and snapshot canvases (DOM UI).
 * Real PNGs from assets/sprites/<key>.png hot-swap in by painting into
 * the cached canvas in place, exactly like the old Phaser loader did.
 */
import * as THREE from 'three';
import { SPECIES_ORDER } from '../data/species';
import { drawCreature, drawCharFrame, drawTile, drawBall, drawBadge, charPalette, TILE_DRAWERS, CHAR_KEYS } from '../render/spriteGen';

const DIRS = ['down', 'up', 'left', 'right'] as const;

export function creatureKey(speciesId: string, view: 'front' | 'back', shiny = false): string {
  return `creature/${speciesId}/${view}${shiny ? '/shiny' : ''}`;
}

export function charKey(name: string, dir: string, frame: number): string {
  return `char/${name}/${dir}/${frame}`;
}

export function tileKey(name: string): string {
  return `tile/${name}`;
}

interface Entry {
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture | null;
}

const registry = new Map<string, Entry>();

function register(key: string, canvas: HTMLCanvasElement): void {
  if (!registry.has(key)) registry.set(key, { canvas, texture: null });
}

/** Generate and register every procedural sprite. Idempotent. */
export function registerAllSprites(): void {
  if (registry.size > 0) return;
  for (const name of Object.keys(TILE_DRAWERS)) register(tileKey(name), drawTile(name));
  for (const id of SPECIES_ORDER) {
    register(creatureKey(id, 'front'), drawCreature(id, 'front'));
    register(creatureKey(id, 'back'), drawCreature(id, 'back'));
    register(creatureKey(id, 'front', true), drawCreature(id, 'front', true));
    register(creatureKey(id, 'back', true), drawCreature(id, 'back', true));
  }
  for (const name of CHAR_KEYS) {
    const pal = charPalette(name);
    for (const dir of DIRS) {
      for (let f = 0; f < 3; f++) register(charKey(name, dir, f), drawCharFrame(pal, dir, f));
    }
  }
  for (const ball of ['basicball', 'greatball', 'ultraball', 'masterball']) {
    register(`ui/${ball}`, drawBall(ball));
  }
  for (let i = 0; i < 8; i++) register(`ui/badge${i}`, drawBadge(i));
}

export function spriteCanvas(key: string): HTMLCanvasElement {
  const e = registry.get(key);
  if (!e) throw new Error(`Unknown sprite key: ${key}`);
  return e.canvas;
}

/** Shared crisp-pixel texture for a sprite key. */
export function spriteTexture(key: string): THREE.CanvasTexture {
  const e = registry.get(key);
  if (!e) throw new Error(`Unknown sprite key: ${key}`);
  if (!e.texture) {
    e.texture = new THREE.CanvasTexture(e.canvas);
    e.texture.magFilter = THREE.NearestFilter;
    e.texture.minFilter = THREE.NearestFilter;
    e.texture.colorSpace = THREE.SRGBColorSpace;
  }
  return e.texture;
}

/** A fresh canvas snapshot for DOM <canvas> usage (menus, summaries). */
export function spriteSnapshot(key: string, scale = 1): HTMLCanvasElement {
  const src = spriteCanvas(key);
  const c = document.createElement('canvas');
  c.width = src.width * scale;
  c.height = src.height * scale;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/**
 * Background hot-swap pass: try assets/sprites/<key>.png for every key;
 * paint successes into the cached canvas in place and refresh textures.
 */
export function hotSwapFileAssets(): void {
  for (const [key, entry] of registry) {
    const img = new Image();
    img.onload = () => {
      const ctx = entry.canvas.getContext('2d')!;
      ctx.clearRect(0, 0, entry.canvas.width, entry.canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, entry.canvas.width, entry.canvas.height);
      if (entry.texture) entry.texture.needsUpdate = true;
      onSwap?.(key);
    };
    img.src = `assets/sprites/${key}.png`;
  }
}

/** World rebuild hook — ground atlases bake tile canvases, so they listen. */
export let onSwap: ((key: string) => void) | null = null;

export function setOnSwap(fn: (key: string) => void): void {
  onSwap = fn;
}
