/**
 * ASCII→3D world compiler. Walks a MapDef grid and produces a THREE.Group:
 * a baked ground plane (tile canvases composited into one atlas texture),
 * instanced extruded boxes for solid tiles, and floating door labels.
 * Collision/encounters stay tile-grid lookups in the overworld controller —
 * this module is visuals only, so map integrity tests keep their teeth.
 */
import * as THREE from 'three';
import { LEGEND, type MapDef } from '../data/maps/defs';
import { TILE } from '../render/spriteGen';
import { spriteCanvas, tileKey } from './textures';

/** World scale: 1 tile = 1 unit. Tile (x,y) center sits at (x+0.5, y+0.5). */

/** Extrusion height per solid tile char; anything missing renders flat.
 *  Trees ('#'), tall grass ('g') and doors ('D') get bespoke geometry. */
const HEIGHTS: Record<string, number> = {
  b: 0.55, // bush
  _: 0.35, // ledge step
  R: 1.8, // rockwall
  M: 1.8, // climbwall
  C: 2.1, // cavewall
  B: 0.8, // boulder
  W: 1.9, // wall
  r: 2.5, // roofs sit taller than walls so buildings read as blocks
  u: 2.5,
  m: 2.5,
  y: 2.5,
  l: 2.5,
  w: 1.9, // window
  s: 0.8, // sign
  F: 0.65, // fence
  I: 2.1, // interior wall
  t: 0.9, // counter
  h: 1.6, // shelf
  P: 1.2, // pc
  H: 1.0, // healer
  T: 0.8, // table
  K: 1.8, // bookshelf
  A: 1.4, // statue
  x: 2.1, // void
  X: 2.1, // darkwall
};

export interface WorldView {
  group: THREE.Group;
  /** repaint ground + rebuild boxes (cut bushes, hot-swapped tiles) */
  rebuild: () => void;
  dispose: () => void;
}

/** deterministic per-tile jitter so decor never pops between rebuilds */
function hash2(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

let tuftTex: THREE.CanvasTexture | null = null;

/** transparent canvas of leaning grass blades for tall-grass tufts */
function grassTuftTexture(): THREE.CanvasTexture {
  if (tuftTex) return tuftTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 48;
  const ctx = c.getContext('2d')!;
  const greens = ['#2f8f3f', '#3da34d', '#57c25f', '#2a7d38'];
  for (let i = 0; i < 14; i++) {
    const x = 4 + i * 4.3 + Math.sin(i * 7.3) * 2;
    const lean = Math.sin(i * 3.1) * 9;
    const top = 6 + Math.abs(Math.sin(i * 5.7)) * 12;
    ctx.strokeStyle = greens[i % greens.length];
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(x, 48);
    ctx.quadraticCurveTo(x + lean * 0.4, 28, x + lean, top);
    ctx.stroke();
  }
  tuftTex = new THREE.CanvasTexture(c);
  tuftTex.magFilter = THREE.NearestFilter;
  tuftTex.minFilter = THREE.NearestFilter;
  tuftTex.colorSpace = THREE.SRGBColorSpace;
  return tuftTex;
}

let doorTex: THREE.CanvasTexture | null = null;

/** wooden door with frame and knob for 'D' facade tiles */
function doorTexture(): THREE.CanvasTexture {
  if (doorTex) return doorTex;
  const c = document.createElement('canvas');
  c.width = 48;
  c.height = 80;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#4a2c14';
  ctx.fillRect(0, 0, 48, 80);
  ctx.fillStyle = '#7a4a26';
  ctx.fillRect(4, 4, 40, 76);
  ctx.strokeStyle = '#5e3819';
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 9, 32, 30);
  ctx.strokeRect(8, 45, 32, 30);
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(12 + i * 8, 5);
    ctx.lineTo(12 + i * 8, 79);
    ctx.globalAlpha = 0.15;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = '#e8c050';
  ctx.beginPath();
  ctx.arc(38, 42, 3, 0, Math.PI * 2);
  ctx.fill();
  doorTex = new THREE.CanvasTexture(c);
  doorTex.magFilter = THREE.NearestFilter;
  doorTex.minFilter = THREE.NearestFilter;
  doorTex.colorSpace = THREE.SRGBColorSpace;
  return doorTex;
}

function effectiveChar(map: MapDef, x: number, y: number, cutBushes: Set<string>): string {
  const ch = map.grid[y][x];
  if (LEGEND[ch]?.cuttable && cutBushes.has(`${map.id}:${x},${y}`)) {
    return map.indoor ? 'c' : '.';
  }
  return ch;
}

export function buildWorld(map: MapDef, cutBushes: Set<string>): WorldView {
  const group = new THREE.Group();
  const w = map.grid[0].length;
  const h = map.grid.length;
  let built: THREE.Object3D[] = [];
  let boxResources: { dispose(): void }[] = [];
  const disposables: { dispose(): void }[] = [];

  // ---- ground plane with baked atlas
  const groundCanvas = document.createElement('canvas');
  groundCanvas.width = w * TILE;
  groundCanvas.height = h * TILE;
  const groundTex = new THREE.CanvasTexture(groundCanvas);
  groundTex.magFilter = THREE.NearestFilter;
  groundTex.minFilter = THREE.NearestFilter;
  groundTex.colorSpace = THREE.SRGBColorSpace;

  const paintGround = () => {
    const ctx = groundCanvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = effectiveChar(map, x, y, cutBushes);
        // 'D' gets a real 3D door mesh; painting the flat door sprite under it
        // reads as a second door from above, so lay walkable floor instead.
        const tile = ch === 'D' ? (map.indoor ? 'floor' : 'path') : (LEGEND[ch]?.tile ?? 'void');
        ctx.drawImage(spriteCanvas(tileKey(tile)), x * TILE, y * TILE);
      }
    }
    groundTex.needsUpdate = true;
  };

  const groundGeo = new THREE.PlaneGeometry(w, h);
  const groundMat = new THREE.MeshLambertMaterial({ map: groundTex });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(w / 2, 0, h / 2);
  ground.receiveShadow = true;
  group.add(ground);
  disposables.push(groundGeo, groundMat, groundTex);

  // ---- extruded solids, one InstancedMesh per tile character
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);

  const buildBoxes = () => {
    for (const o of built) group.remove(o);
    for (const d of boxResources) d.dispose();
    built = [];
    boxResources = [];

    const byChar = new Map<string, { x: number; y: number }[]>();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = effectiveChar(map, x, y, cutBushes);
        if (!(ch in HEIGHTS)) continue;
        if (!byChar.has(ch)) byChar.set(ch, []);
        byChar.get(ch)!.push({ x, y });
      }
    }

    const m = new THREE.Matrix4();
    for (const [ch, cells] of byChar) {
      const height = HEIGHTS[ch];
      const tex = new THREE.CanvasTexture(spriteCanvas(tileKey(LEGEND[ch].tile)));
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshLambertMaterial({ map: tex });
      const inst = new THREE.InstancedMesh(boxGeo, mat, cells.length);
      inst.castShadow = true;
      inst.receiveShadow = true;
      cells.forEach((c, i) => {
        // slight inset so adjacent boxes don't z-fight at shared faces
        m.makeScale(1.001, height, 1.001);
        m.setPosition(c.x + 0.5, height / 2, c.y + 0.5);
        inst.setMatrixAt(i, m);
      });
      inst.instanceMatrix.needsUpdate = true;
      group.add(inst);
      built.push(inst);
      boxResources.push(tex, mat, inst);
    }
  };

  // ---- trees: trunk + two-tier blobby foliage, jittered per tile
  const treeCells: { x: number; y: number }[] = [];
  const grassCells: { x: number; y: number }[] = [];
  const doorCells: { x: number; y: number }[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = map.grid[y][x];
      if (ch === '#') treeCells.push({ x, y });
      else if (ch === 'g') grassCells.push({ x, y });
      else if (ch === 'D') doorCells.push({ x, y });
    }
  }

  if (treeCells.length > 0) {
    const trunkGeo = new THREE.CylinderGeometry(0.09, 0.15, 0.85, 6);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
    const folGeo = new THREE.IcosahedronGeometry(0.55, 0);
    const folMat = new THREE.MeshLambertMaterial({ color: 0x2e8540, flatShading: true });
    const topGeo = new THREE.IcosahedronGeometry(0.36, 0);
    const topMat = new THREE.MeshLambertMaterial({ color: 0x3da653, flatShading: true });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCells.length);
    const blobs = new THREE.InstancedMesh(folGeo, folMat, treeCells.length);
    const tops = new THREE.InstancedMesh(topGeo, topMat, treeCells.length);
    trunks.castShadow = blobs.castShadow = tops.castShadow = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    treeCells.forEach((c, i) => {
      const jx = (hash2(c.x, c.y) - 0.5) * 0.22;
      const jz = (hash2(c.y, c.x) - 0.5) * 0.22;
      const s = 0.88 + hash2(c.x * 3, c.y * 7) * 0.32;
      q.setFromAxisAngle(up, hash2(c.x * 5, c.y * 11) * Math.PI * 2);
      const cx = c.x + 0.5 + jx;
      const cz = c.y + 0.5 + jz;
      m.compose(new THREE.Vector3(cx, 0.42 * s, cz), q, new THREE.Vector3(s, s, s));
      trunks.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(cx, 1.02 * s, cz), q, new THREE.Vector3(s, s * 0.92, s));
      blobs.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(cx + jx * 0.5, 1.52 * s, cz), q, new THREE.Vector3(s, s, s));
      tops.setMatrixAt(i, m);
    });
    group.add(trunks, blobs, tops);
    disposables.push(trunkGeo, trunkMat, folGeo, folMat, topGeo, topMat, trunks, blobs, tops);
  }

  // ---- tall grass: two crossed blade-planes per encounter tile
  if (grassCells.length > 0) {
    const tex = grassTuftTexture();
    const bladeGeo = new THREE.PlaneGeometry(0.95, 0.62);
    const bladeMat = new THREE.MeshLambertMaterial({
      map: tex,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      transparent: true,
    });
    const a = new THREE.InstancedMesh(bladeGeo, bladeMat, grassCells.length);
    const b = new THREE.InstancedMesh(bladeGeo, bladeMat, grassCells.length);
    a.castShadow = b.castShadow = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const one = new THREE.Vector3(1, 1, 1);
    grassCells.forEach((c, i) => {
      const jx = (hash2(c.x, c.y) - 0.5) * 0.2;
      const jz = (hash2(c.y, c.x) - 0.5) * 0.2;
      const rot = hash2(c.x * 13, c.y * 3) * Math.PI;
      const pos = new THREE.Vector3(c.x + 0.5 + jx, 0.3, c.y + 0.5 + jz);
      q.setFromAxisAngle(up, rot + Math.PI / 4);
      m.compose(pos, q, one);
      a.setMatrixAt(i, m);
      q.setFromAxisAngle(up, rot - Math.PI / 4);
      m.compose(pos, q, one);
      b.setMatrixAt(i, m);
    });
    group.add(a, b);
    disposables.push(bladeGeo, bladeMat, a, b);
  }

  // ---- doors: framed wooden panel recessed into the facade gap
  if (doorCells.length > 0) {
    const tex = doorTexture();
    const doorGeo = new THREE.BoxGeometry(0.84, 1.5, 0.12);
    const side = new THREE.MeshLambertMaterial({ color: 0x3a2210 });
    const face = new THREE.MeshLambertMaterial({ map: tex });
    const frameGeo = new THREE.BoxGeometry(1.0, 1.66, 0.08);
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x4a2c14 });
    // wall-textured lintel fills the facade gap between door top and roofline
    const wallTex = new THREE.CanvasTexture(spriteCanvas(tileKey('wall')));
    wallTex.magFilter = THREE.NearestFilter;
    wallTex.minFilter = THREE.NearestFilter;
    wallTex.colorSpace = THREE.SRGBColorSpace;
    const lintelMat = new THREE.MeshLambertMaterial({ map: wallTex });
    const lintelGeo = new THREE.BoxGeometry(1.001, 0.3, 1.001);
    for (const c of doorCells) {
      const door = new THREE.Mesh(doorGeo, [side, side, side, side, face, face]);
      door.position.set(c.x + 0.5, 0.75, c.y + 0.5);
      door.castShadow = true;
      const frame = new THREE.Mesh(frameGeo, frameMat);
      frame.position.set(c.x + 0.5, 0.83, c.y + 0.44);
      const lintel = new THREE.Mesh(lintelGeo, lintelMat);
      lintel.position.set(c.x + 0.5, 1.75, c.y + 0.5);
      lintel.castShadow = true;
      group.add(door, frame, lintel);
    }
    disposables.push(doorGeo, side, face, frameGeo, frameMat, lintelGeo, lintelMat, wallTex);
  }

  // ---- floating PC/GYM labels above warp doors
  for (const warp of map.warps ?? []) {
    const text = warp.to.endsWith('-center') ? 'PC' : /^gym\d+$/.test(warp.to) ? 'GYM' : null;
    if (!text) continue;
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 40;
    const ctx = c.getContext('2d')!;
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#000';
    ctx.strokeText(text, 48, 20);
    ctx.fillStyle = '#fff';
    ctx.fillText(text, 48, 20);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.5, 0.62, 1);
    sprite.position.set(warp.x + 0.5, 2.1, warp.y + 0.35);
    group.add(sprite);
    disposables.push(tex, mat);
  }

  paintGround();
  buildBoxes();

  return {
    group,
    rebuild: () => {
      paintGround();
      buildBoxes();
    },
    dispose: () => {
      for (const d of [...disposables, ...boxResources]) d.dispose();
      boxGeo.dispose();
    },
  };
}

/** Scene atmosphere per map: sky color, fog, lights. */
export function applyAtmosphere(scene: THREE.Scene, map: MapDef): void {
  const isCave = /cave|hollow|depth|tunnel|shrine/.test(map.id) || map.grid.some((r) => r.includes('C'));
  const isDark = map.grid.some((r) => r.includes('X') || r.includes('d'));
  const sky = map.indoor ? 0x16161f : isDark ? 0x05050a : isCave ? 0x0a0c14 : 0x7eb8e0;
  scene.background = new THREE.Color(sky);
  scene.fog = new THREE.Fog(sky, map.indoor ? 18 : 24, map.indoor ? 38 : 60);

  const ambient = new THREE.AmbientLight(0xffffff, map.indoor || isCave || isDark ? 0.55 : 0.75);
  ambient.name = 'ambient';
  const sun = new THREE.DirectionalLight(0xfff4e0, map.indoor || isCave || isDark ? 0.5 : 0.95);
  sun.name = 'sun';
  sun.position.set(14, 22, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const span = Math.max(map.grid[0].length, map.grid.length) / 2 + 4;
  sun.shadow.camera.left = -span;
  sun.shadow.camera.right = span;
  sun.shadow.camera.top = span;
  sun.shadow.camera.bottom = -span;
  sun.shadow.camera.far = 80;
  sun.target.position.set(map.grid[0].length / 2, 0, map.grid.length / 2);
  sun.position.add(sun.target.position);
  scene.add(ambient, sun, sun.target);
}
