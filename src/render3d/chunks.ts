/**
 * Chunk streamer — Minecraft-style world paging. The stitched outdoor
 * plane is cut into CHUNK_SIZE² tile chunks; chunks inside the player's
 * chunk distance are built lazily (a few per frame), chunks outside a
 * hysteresis ring are disposed. Cut bushes and texture hot-swaps mark
 * individual chunks dirty for rebuild.
 */
import * as THREE from 'three';
import { CHUNK_SIZE, view } from '../engine/viewSettings';
import { worldLayout } from './worldLayout';
import { buildRegion, warpLabelText, type RegionView, type WarpLabel } from './world';

const BUILD_BUDGET_PER_FRAME = 2;

interface Chunk {
  view: RegionView;
  cx: number;
  cz: number;
}

export class ChunkManager {
  group = new THREE.Group();
  private chunks = new Map<string, Chunk>();
  private cutBushes: Set<string>;
  private labelsByChunk = new Map<string, WarpLabel[]>();

  constructor(cutBushes: Set<string>) {
    this.cutBushes = cutBushes;
    // pre-bucket PC/GYM labels by the chunk their warp tile sits in
    const layout = worldLayout();
    for (const r of layout.placed.values()) {
      for (const warp of r.map.warps ?? []) {
        const text = warpLabelText(warp.to);
        if (!text) continue;
        const gx = r.x + warp.x;
        const gy = r.y + warp.y;
        const key = this.key(Math.floor(gx / CHUNK_SIZE), Math.floor(gy / CHUNK_SIZE));
        if (!this.labelsByChunk.has(key)) this.labelsByChunk.set(key, []);
        this.labelsByChunk.get(key)!.push({ x: gx, y: gy, text });
      }
    }
  }

  private key(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  /** stream chunks around the player's global position */
  update(px: number, pz: number): void {
    const layout = worldLayout();
    const pcx = Math.floor(px / CHUNK_SIZE);
    const pcz = Math.floor(pz / CHUNK_SIZE);
    const r = view.chunkDistance;

    // dispose far chunks (one ring of hysteresis so walking doesn't thrash)
    for (const [key, c] of this.chunks) {
      if (Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz)) > r + 1) {
        this.group.remove(c.view.group);
        c.view.dispose();
        this.chunks.delete(key);
      }
    }

    // build missing chunks, nearest first, a few per frame
    let budget = BUILD_BUDGET_PER_FRAME;
    for (let ring = 0; ring <= r && budget > 0; ring++) {
      for (let cz = pcz - ring; cz <= pcz + ring && budget > 0; cz++) {
        for (let cx = pcx - ring; cx <= pcx + ring && budget > 0; cx++) {
          if (Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) !== ring) continue;
          const key = this.key(cx, cz);
          if (this.chunks.has(key)) continue;
          const rv = buildRegion(
            (x, y) => layout.charAt(x, y, this.cutBushes),
            cx * CHUNK_SIZE,
            cz * CHUNK_SIZE,
            CHUNK_SIZE,
            CHUNK_SIZE,
            this.labelsByChunk.get(key) ?? [],
          );
          this.group.add(rv.group);
          this.chunks.set(key, { view: rv, cx, cz });
          budget--;
        }
      }
    }
  }

  /** rebuild the chunk containing a global tile (cut bush, tile swap) */
  rebuildAt(gx: number, gy: number): void {
    const c = this.chunks.get(this.key(Math.floor(gx / CHUNK_SIZE), Math.floor(gy / CHUNK_SIZE)));
    c?.view.rebuild();
  }

  /** repaint everything built (texture hot-swap) */
  rebuildAll(): void {
    for (const c of this.chunks.values()) c.view.rebuild();
  }

  dispose(): void {
    for (const c of this.chunks.values()) {
      this.group.remove(c.view.group);
      c.view.dispose();
    }
    this.chunks.clear();
  }
}
