/**
 * asset-resolver — registers procedural placeholder textures for every
 * logical sprite key, then (in the background) attempts to load real PNGs
 * from assets/sprites/<key>.png and hot-swaps them in when present.
 * The game never hard-depends on a single asset file.
 */
import Phaser from 'phaser';
import { SPECIES_ORDER } from '../data/species';
import { drawCreature, drawCharFrame, drawTile, drawBall, drawBadge, charPalette, TILE_DRAWERS, CHAR_KEYS } from './spriteGen';

export { CHAR_KEYS };

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

/** Generate and register every procedural texture. Idempotent. */
export function registerAllTextures(scene: Phaser.Scene): void {
  const tm = scene.textures;
  const addCanvas = (key: string, canvas: HTMLCanvasElement) => {
    if (!tm.exists(key)) tm.addCanvas(key, canvas);
  };

  for (const name of Object.keys(TILE_DRAWERS)) {
    addCanvas(tileKey(name), drawTile(name));
  }
  for (const id of SPECIES_ORDER) {
    addCanvas(creatureKey(id, 'front'), drawCreature(id, 'front'));
    addCanvas(creatureKey(id, 'back'), drawCreature(id, 'back'));
    addCanvas(creatureKey(id, 'front', true), drawCreature(id, 'front', true));
    addCanvas(creatureKey(id, 'back', true), drawCreature(id, 'back', true));
  }
  for (const name of CHAR_KEYS) {
    const pal = charPalette(name);
    for (const dir of DIRS) {
      for (let f = 0; f < 3; f++) {
        addCanvas(charKey(name, dir, f), drawCharFrame(pal, dir, f));
      }
    }
  }
  for (const ball of ['basicball', 'greatball', 'ultraball', 'masterball']) {
    addCanvas(`ui/${ball}`, drawBall(ball));
  }
  for (let i = 0; i < 8; i++) {
    addCanvas(`ui/badge${i}`, drawBadge(i));
  }
}

/**
 * Background hot-swap pass: try to load assets/sprites/<key>.png for every
 * logical key; replace the placeholder texture on success, silently ignore
 * 404s. Runs after the game is already playable.
 */
export function hotSwapFileAssets(scene: Phaser.Scene): void {
  const keys: string[] = [];
  for (const id of SPECIES_ORDER) {
    keys.push(
      creatureKey(id, 'front'),
      creatureKey(id, 'back'),
      creatureKey(id, 'front', true),
      creatureKey(id, 'back', true),
    );
  }
  for (const name of Object.keys(TILE_DRAWERS)) keys.push(tileKey(name));
  for (const name of CHAR_KEYS) {
    for (const dir of DIRS) for (let f = 0; f < 3; f++) keys.push(charKey(name, dir, f));
  }

  const loader = new Phaser.Loader.LoaderPlugin(scene);
  for (const key of keys) {
    loader.image(`file:${key}`, `assets/sprites/${key}.png`);
  }
  loader.on(Phaser.Loader.Events.FILE_COMPLETE, (loadedKey: string) => {
    if (!loadedKey.startsWith('file:')) return;
    const logical = loadedKey.slice(5);
    const src = scene.textures.get(loadedKey).getSourceImage() as HTMLImageElement;
    // Paint into the existing placeholder canvas in place: objects already
    // displaying this texture keep rendering (removing it breaks them).
    const existing = scene.textures.get(logical);
    if (existing instanceof Phaser.Textures.CanvasTexture) {
      existing.context.clearRect(0, 0, existing.width, existing.height);
      existing.context.imageSmoothingEnabled = false;
      existing.context.drawImage(src, 0, 0, existing.width, existing.height);
      existing.refresh();
    } else {
      if (scene.textures.exists(logical)) scene.textures.remove(logical);
      scene.textures.addImage(logical, src);
    }
  });
  loader.start();
}
