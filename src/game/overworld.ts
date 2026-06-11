/**
 * Overworld3D — the free-roaming 3D world: analog movement with tile-grid
 * collision, pointer-lock orbit camera with crosshair interaction, wild
 * encounters, traversal abilities, warps, and the cutscene script
 * interpreter. Outdoors every edge-connected map is stitched onto one
 * global plane and streamed in chunks (see render3d/worldLayout + chunks);
 * interiors stay warp-loaded single maps. The grid data (maps, warps,
 * scripts) is untouched from 2D; only the space became continuous.
 */
import * as THREE from 'three';
import { mapById, SHOP_STOCK } from '../data/maps';
import { LEGEND, tileAt, charAt, type LegendEntry, type MapDef, type NpcDef } from '../data/maps/defs';
import { SCRIPTS, type ScriptOp } from '../data/story';
import { trainerById, rivalTrainerId, type TrainerDef } from '../data/trainers';
import { itemById } from '../data/items';
import { getState, setFlag, getFlag, healParty, addToBag, removeFromBag, bagCount, addCreature, markSeen, type Facing } from '../engine/state';
import { createCreature, displayName } from '../engine/creature';
import { movesAtLevel } from '../data/species';
import { gameRNG } from '../core/rng';
import { audio, type TrackId } from '../audio/audio';
import { saveToSlot } from '../engine/save';
import { buildWorld, applyAtmosphere, type WorldView } from '../render3d/world';
import { worldLayout } from '../render3d/worldLayout';
import { ChunkManager } from '../render3d/chunks';
import { Sky } from '../render3d/sky';
import { simRadiusTiles } from '../engine/viewSettings';
import { HumanNpc, BillboardNpc, type NpcVisual } from '../render3d/npc';
import { PlayerAvatar } from '../render3d/avatar';
import { creatureKey } from '../render3d/textures';
import { DialogBox, ListMenu, confirmMenu, fade, sleep, el, GAME_W, GAME_H } from '../ui/dom';
import { moveInput, runHeld, orbit, uiActive, pointerLocked, setCrosshairTarget } from '../input/input';
import type { BattleRequest, BattleOutcome } from './battleTypes';

const DIR_DELTA: Record<Facing, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

const PLAYER_RADIUS = 0.3;
const WALK_SPEED = 4.4; // tiles per second
const RUN_SPEED = 7.6;
const REACH = 2.6; // crosshair interaction range, tiles

interface NpcEntity {
  def: NpcDef;
  /** map this NPC belongs to (flags are keyed by it) */
  mapId: string;
  vis: NpcVisual;
  x: number; // tile coords — global outdoors, map-local indoors
  y: number;
  homeX: number;
  homeY: number;
  facing: Facing;
  moving: boolean;
}

type CrossTarget = { kind: 'npc'; npc: NpcEntity } | { kind: 'tile'; x: number; y: number };

/** session-only set of cut bushes, keyed `${mapId}:${lx},${ly}` (map-local) */
const cutBushes = new Set<string>();

export interface OverworldHooks {
  startBattle: (req: BattleRequest) => Promise<BattleOutcome>;
  openMenu: (mode: 'pause' | 'box' | 'shop', stock?: string[]) => Promise<'quit' | undefined>;
  showCredits: () => void;
}

export class Overworld3D {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  private hooks: OverworldHooks;
  private map!: MapDef;
  private outdoor = false; // stitched streaming world vs single interior map
  private view: WorldView | null = null;
  private chunks: ChunkManager | null = null;
  private sky: Sky | null = null;
  private npcs: NpcEntity[] = [];
  private avatar = new PlayerAvatar();
  private dialog = new DialogBox();
  private px = 0; // continuous coords, 1 unit = 1 tile; global when outdoor
  private pz = 0;
  private facing: Facing = 'down';
  private surfing = false;
  private uiBusy = 0;
  private scripted = false; // movePlayer / trainer-approach control lock
  private lastTileX = -1;
  private lastTileY = -1;
  private justWarped = false;
  private banner: HTMLDivElement | null = null;
  private npcTimer = 0;
  private camPos = new THREE.Vector3();
  private crossTarget: CrossTarget | null = null;
  private raycaster = new THREE.Raycaster();

  constructor(hooks: OverworldHooks) {
    this.hooks = hooks;
    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 400);
    this.scene.add(this.avatar.group);

    const s = getState();
    // legacy integer saves store tile indices; continuous coords sit at centers
    this.px = Number.isInteger(s.player.x) ? s.player.x + 0.5 : s.player.x;
    this.pz = Number.isInteger(s.player.y) ? s.player.y + 0.5 : s.player.y;
    // saves keep map-local coords; outdoors we roam in global plane coords
    if (worldLayout().isPlaced(s.player.mapId)) {
      const off = worldLayout().offsetOf(s.player.mapId);
      this.px += off.x;
      this.pz += off.y;
    }
    this.facing = s.player.facing;
    this.loadMap(s.player.mapId);
    this.lastTileX = Math.floor(this.px);
    this.lastTileY = Math.floor(this.pz);
    this.surfing = this.tileW(this.lastTileX, this.lastTileY)?.water ?? false;
    this.avatar.setSurfing(this.surfing);
    this.snapCamera();

    if (!getFlag('introSeen')) {
      setFlag('introSeen');
      void this.runUI(async () => {
        await this.dialog.show(`Welcome to Embervale, ${s.player.name}! Professor Alder is waiting in the lab to the southwest.`);
      });
    }
  }

  // ============================================================ map setup

  private loadMap(mapId: string): void {
    this.map = mapById(mapId);
    getState().player.mapId = mapId;
    if (this.view) {
      this.scene.remove(this.view.group);
      this.view.dispose();
      this.view = null;
    }
    if (this.chunks) {
      this.scene.remove(this.chunks.group);
      this.chunks.dispose();
      this.chunks = null;
    }
    if (this.sky) {
      this.scene.remove(this.sky.group);
      this.sky.dispose(this.scene);
      this.sky = null;
    }
    for (const n of this.npcs) {
      this.scene.remove(n.vis.obj);
      n.vis.dispose();
    }
    this.npcs = [];
    // interior atmosphere lights are re-added per map
    for (const name of ['ambient', 'sun']) {
      const old = this.scene.getObjectByName(name);
      if (old) this.scene.remove(old);
    }
    this.scene.background = null;
    this.scene.fog = null;

    this.outdoor = worldLayout().isPlaced(mapId);
    if (this.outdoor) {
      this.chunks = new ChunkManager(cutBushes);
      this.scene.add(this.chunks.group);
      this.sky = new Sky(this.scene);
      this.scene.add(this.sky.group);
      // the whole stitched world's NPCs exist at once; sim distance gates them
      for (const r of worldLayout().placed.values()) {
        for (const def of r.map.npcs ?? []) this.spawnNpc(def, r.map.id, r.x, r.y);
      }
    } else {
      this.view = buildWorld(this.map, cutBushes);
      this.scene.add(this.view.group);
      applyAtmosphere(this.scene, this.map);
      for (const def of this.map.npcs ?? []) this.spawnNpc(def, this.map.id, 0, 0);
    }

    audio.playMusic(this.map.music as TrackId);
    this.showMapBanner();
  }

  private spawnNpc(def: NpcDef, mapId: string, ox: number, oy: number): void {
    let vis: NpcVisual;
    if (def.itemPickup) {
      vis = new BillboardNpc('ui/basicball', 0.45);
    } else if (def.creatureSprite) {
      vis = new BillboardNpc(creatureKey(def.creatureSprite, 'front'), 1.3);
    } else {
      vis = new HumanNpc(def.sprite, def.facing);
    }
    const x = ox + def.x;
    const y = oy + def.y;
    vis.setPosition(x + 0.5, y + 0.5);
    const npc: NpcEntity = { def, mapId, vis, x, y, homeX: x, homeY: y, facing: def.facing, moving: false };
    vis.setVisible(this.npcVisible(npc));
    this.scene.add(vis.obj);
    this.npcs.push(npc);
  }

  private npcVisible(npc: NpcEntity): boolean {
    const def = npc.def;
    if (def.itemPickup && getFlag(`i:${npc.mapId}:${def.id}`)) return false;
    if (def.showIf) {
      const v = getFlag(def.showIf.flag);
      const want = def.showIf.value ?? true;
      const match = v === want || (!!v && def.showIf.value === undefined);
      if (def.showIf.not ? match : !match) return false;
    }
    return true;
  }

  private refreshNpcVisibility(): void {
    for (const npc of this.npcs) npc.vis.setVisible(this.npcVisible(npc) && this.npcInSim(npc));
  }

  private npcInSim(npc: NpcEntity): boolean {
    if (!this.outdoor) return true;
    return Math.max(Math.abs(npc.x + 0.5 - this.px), Math.abs(npc.y + 0.5 - this.pz)) <= simRadiusTiles();
  }

  private showMapBanner(): void {
    this.banner?.remove();
    const b = el('div', 'win banner');
    b.textContent = this.map.name;
    b.style.left = '6px';
    b.style.top = '6px';
    this.banner = b;
    setTimeout(() => {
      b.style.transition = 'opacity 400ms';
      b.style.opacity = '0';
      setTimeout(() => b.remove(), 450);
    }, 1800);
  }

  // ===================================================== world tile access

  /** effective tile char at world coords (cut bushes applied), both modes */
  private charW(x: number, y: number): string {
    if (this.outdoor) return worldLayout().charAt(x, y, cutBushes);
    const ch = charAt(this.map, x, y);
    if (LEGEND[ch]?.cuttable && cutBushes.has(`${this.map.id}:${x},${y}`)) return this.map.indoor ? 'c' : '.';
    return ch;
  }

  private tileW(x: number, y: number): LegendEntry | null {
    if (this.outdoor) return worldLayout().tileAt(x, y, cutBushes);
    return tileAt(this.map, x, y);
  }

  /** authored map under a world tile + its local coords (this.map indoors) */
  private mapUnder(x: number, y: number): { map: MapDef; lx: number; ly: number } | null {
    if (!this.outdoor) {
      if (y < 0 || y >= this.map.grid.length || x < 0 || x >= this.map.grid[0].length) return null;
      return { map: this.map, lx: x, ly: y };
    }
    const hit = worldLayout().mapAt(x, y);
    return hit ? { map: hit.map, lx: hit.lx, ly: hit.ly } : null;
  }

  /** session cut-bush key for a world tile, or null when nothing cuttable */
  private cutKey(x: number, y: number): string | null {
    const hit = this.mapUnder(x, y);
    return hit ? `${hit.map.id}:${hit.lx},${hit.ly}` : null;
  }

  /** keep the save's map-local player coords in sync with world coords */
  private syncSaveCoords(): void {
    const s = getState();
    if (this.outdoor) {
      const off = worldLayout().offsetOf(s.player.mapId);
      s.player.x = this.px - off.x;
      s.player.y = this.pz - off.y;
    } else {
      s.player.x = this.px;
      s.player.y = this.pz;
    }
  }

  // ============================================================ collision

  private canSurf(): boolean {
    return bagCount('wavecharm') > 0 && !!getFlag('badge4');
  }

  private canCut(): boolean {
    return bagCount('cuttercharm') > 0 && !!getFlag('badge1');
  }

  private canClimb(): boolean {
    return bagCount('climbinggear') > 0 && !!getFlag('badge6');
  }

  private npcAt(x: number, y: number): NpcEntity | null {
    return this.npcs.find((n) => n.x === x && n.y === y && this.npcVisible(n)) ?? null;
  }

  /** Is tile (x,y) passable for the player right now? Ledges count as solid. */
  private passable(x: number, y: number): boolean {
    const t = this.tileW(x, y);
    if (!t) return false;
    if (this.npcAt(x, y)) return false;
    if (t.water) return this.surfing || this.canSurf();
    if (t.climbable) return this.canClimb();
    if (t.cuttable) return false; // cut bushes already read as floor
    if (t.ledge) return false;
    return !t.solid;
  }

  /** Circle-vs-tile-grid test at center (cx,cz). */
  private blocked(cx: number, cz: number): boolean {
    const r = PLAYER_RADIUS;
    for (let ty = Math.floor(cz - r); ty <= Math.floor(cz + r); ty++) {
      for (let tx = Math.floor(cx - r); tx <= Math.floor(cx + r); tx++) {
        if (this.passable(tx, ty)) continue;
        // closest point on tile rect to circle center
        const nx = Math.max(tx, Math.min(cx, tx + 1));
        const nz = Math.max(ty, Math.min(cz, ty + 1));
        if ((cx - nx) ** 2 + (cz - nz) ** 2 < r * r) return true;
      }
    }
    return false;
  }

  // ============================================================ update loop

  update(dt: number): void {
    getState().player.playtimeMs += dt * 1000;
    this.npcTimer += dt;
    if (this.npcTimer > 1.4) {
      this.npcTimer = 0;
      this.tickNpcs();
    }

    const busy = this.uiBusy > 0 || this.scripted || uiActive();
    if (!busy) this.movePlayer(dt);
    else this.avatar.setMoving(0);

    this.avatar.group.position.set(this.px, this.surfing ? 0.08 : 0, this.pz);
    this.avatar.update(dt);
    this.updateCamera(dt);

    this.chunks?.update(this.px, this.pz);
    this.sky?.update(dt, this.px, this.pz);

    const sim = simRadiusTiles();
    for (const npc of this.npcs) {
      if (this.outdoor && Math.max(Math.abs(npc.x + 0.5 - this.px), Math.abs(npc.y + 0.5 - this.pz)) > sim) {
        npc.vis.setVisible(false);
        continue;
      }
      npc.vis.setVisible(this.npcVisible(npc));
      npc.vis.update(dt, this.camPos);
    }

    this.updateCrosshair(busy);
  }

  private movePlayer(dt: number): void {
    const input = moveInput();
    if (input.x === 0 && input.y === 0) {
      this.avatar.setMoving(0);
      return;
    }
    const speed = runHeld() ? RUN_SPEED : WALK_SPEED;
    const sin = Math.sin(orbit.yaw);
    const cos = Math.cos(orbit.yaw);
    // camera-relative: forward pushes away from the camera
    let vx = -sin * input.y + cos * input.x;
    let vz = -cos * input.y - sin * input.x;
    const len = Math.hypot(vx, vz);
    vx = (vx / len) * speed;
    vz = (vz / len) * speed;

    this.avatar.heading = Math.atan2(vx, vz);
    this.avatar.setMoving(speed);
    this.facing = Math.abs(vx) > Math.abs(vz) ? (vx > 0 ? 'right' : 'left') : vz > 0 ? 'down' : 'up';
    getState().player.facing = this.facing;

    // ledge hop: pushing south into a ledge with landing room vaults it
    if (vz > 0) {
      const lx = Math.floor(this.px);
      const lz = Math.floor(this.pz + vz * dt + PLAYER_RADIUS);
      const t = this.tileW(lx, lz);
      if (t?.ledge && lz > Math.floor(this.pz) && this.passable(lx, lz + 1)) {
        void this.hopLedge(lx, lz + 1);
        return;
      }
    }

    // axis-separated slide
    let moved = false;
    const nx = this.px + vx * dt;
    if (!this.blocked(nx, this.pz)) {
      this.px = nx;
      moved = true;
    }
    const nz = this.pz + vz * dt;
    if (!this.blocked(this.px, nz)) {
      this.pz = nz;
      moved = true;
    }
    if (!moved) this.avatar.setMoving(speed * 0.25);

    // interiors keep hard borders (and their edge warps); outdoors the
    // stitched world just continues
    if (!this.outdoor) {
      const m = PLAYER_RADIUS + 0.12;
      const edge =
        this.pz < m && vz < 0
          ? 'north'
          : this.pz > this.map.grid.length - m && vz > 0
            ? 'south'
            : this.px < m && vx < 0
              ? 'west'
              : this.px > this.map.grid[0].length - m && vx > 0
                ? 'east'
                : null;
      if (edge) {
        const e = this.map.edges?.find((d) => d.side === edge);
        if (e) {
          void this.travelTo(e.to, e.spawn);
          return;
        }
        this.px = Math.min(Math.max(this.px, PLAYER_RADIUS), this.map.grid[0].length - PLAYER_RADIUS);
        this.pz = Math.min(Math.max(this.pz, PLAYER_RADIUS), this.map.grid.length - PLAYER_RADIUS);
      }
    }

    this.syncSaveCoords();

    // surf state follows the tile underfoot
    const tx = Math.floor(this.px);
    const ty = Math.floor(this.pz);
    const here = this.tileW(tx, ty);
    if (here?.water && !this.surfing) {
      this.surfing = true;
      this.avatar.setSurfing(true);
    } else if (!here?.water && this.surfing) {
      this.surfing = false;
      this.avatar.setSurfing(false);
    }

    if (tx !== this.lastTileX || ty !== this.lastTileY) {
      this.lastTileX = tx;
      this.lastTileY = ty;
      void this.onTileEntered(tx, ty);
    }
  }

  private async hopLedge(tx: number, ty: number): Promise<void> {
    this.scripted = true;
    audio.sfxThrow();
    const fromX = this.px;
    const fromZ = this.pz;
    const toX = tx + 0.5;
    const toZ = ty + 0.5;
    const dur = 0.34;
    let t = 0;
    await new Promise<void>((resolve) => {
      const step = () => {
        t += 1 / 60 / dur;
        const k = Math.min(1, t);
        this.px = fromX + (toX - fromX) * k;
        this.pz = fromZ + (toZ - fromZ) * k;
        this.avatar.group.position.y = Math.sin(k * Math.PI) * 0.55;
        if (k < 1) requestAnimationFrame(step);
        else resolve();
      };
      step();
    });
    this.avatar.group.position.y = 0;
    this.scripted = false;
    this.syncSaveCoords();
    this.lastTileX = Math.floor(this.px);
    this.lastTileY = Math.floor(this.pz);
    void this.onTileEntered(this.lastTileX, this.lastTileY);
  }

  /** Per-tile-crossing checks — warps, region change, triggers, repel,
   *  trainers, encounters. */
  private async onTileEntered(tx: number, ty: number): Promise<void> {
    const s = getState();
    const under = this.mapUnder(tx, ty);

    // crossing into another stitched map: hand over music/banner/save anchor
    if (this.outdoor && under && under.map.id !== this.map.id) {
      this.map = under.map;
      s.player.mapId = under.map.id;
      this.syncSaveCoords();
      audio.playMusic(this.map.music as TrackId);
      this.showMapBanner();
    }

    if (!this.justWarped) {
      const warp = under?.map.warps?.find((w) => w.x === under.lx && w.y === under.ly);
      if (warp) {
        if (warp.requires && !getFlag(warp.requires)) {
          if (warp.failText) await this.runUI(async () => this.dialog.show(warp.failText!));
        } else {
          void this.travelTo(warp.to, warp.spawn);
          return;
        }
      }
      // border strips into non-stitched maps (Victory Road → League)
      if (this.outdoor) {
        const ext = worldLayout().exteriorWarps.get(`${tx},${ty}`);
        if (ext) {
          void this.travelTo(ext.to, ext.spawn);
          return;
        }
      }
    }
    this.justWarped = false;

    const trig = under?.map.triggers?.find((t) => t.x === under.lx && t.y === under.ly);
    if (trig && this.triggerActive(trig.showIf)) {
      await this.runScript(SCRIPTS[trig.script]);
      return;
    }

    if (s.repelSteps > 0) s.repelSteps--;

    if (await this.checkTrainerSight()) return;

    if (getFlag('cheat:noencounters')) return;
    const tile = this.tileW(tx, ty);
    const enc = under?.map.encounters;
    const table = this.surfing && tile?.water ? enc?.water : tile?.encounter ? enc?.grass : null;
    if (table && table.length > 0) {
      const rate = enc?.rate ?? 0.12;
      if (gameRNG.chance(rate)) {
        const entry = gameRNG.weighted(table.map((e) => ({ item: e, weight: e.weight })));
        const level = gameRNG.int(entry.min, entry.max);
        const lead = s.party.find((c) => c.hp > 0);
        if (s.repelSteps > 0 && lead && level < lead.level) return;
        if (s.party.length === 0) return;
        await this.startWildBattle(entry.speciesId, level);
      }
    }
  }

  private triggerActive(showIf?: { flag: string; value?: boolean | number; not?: boolean }): boolean {
    if (!showIf) return true;
    const v = getFlag(showIf.flag);
    const match = showIf.value !== undefined ? v === showIf.value : !!v;
    return showIf.not ? !match : match;
  }

  // ============================================================ camera

  private updateCamera(dt: number): void {
    const targetX = this.px;
    const targetZ = this.pz;
    const dh = orbit.dist * Math.cos(orbit.pitch);
    const dv = orbit.dist * Math.sin(orbit.pitch);
    const want = new THREE.Vector3(targetX + Math.sin(orbit.yaw) * dh, dv + 0.9, targetZ + Math.cos(orbit.yaw) * dh);
    // pointer-locked mouse look snaps; drag-orbit keeps the soft chase
    const k = pointerLocked() ? 1 : 1 - Math.exp(-dt * 7);
    this.camPos.lerp(want, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(targetX, 1.0, targetZ);
  }

  private snapCamera(): void {
    const dh = orbit.dist * Math.cos(orbit.pitch);
    const dv = orbit.dist * Math.sin(orbit.pitch);
    this.camPos.set(this.px + Math.sin(orbit.yaw) * dh, dv + 0.9, this.pz + Math.cos(orbit.yaw) * dh);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.px, 1.0, this.pz);
  }

  onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  // ====================================================== crosshair target

  /** What would the crosshair use right now? NPCs win, then notable tiles. */
  private findCrossTarget(): CrossTarget | null {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

    let best: { npc: NpcEntity; d: number } | null = null;
    for (const npc of this.npcs) {
      if (!npc.vis.obj.visible) continue;
      if (Math.hypot(npc.x + 0.5 - this.px, npc.y + 0.5 - this.pz) > REACH + 0.6) continue;
      const hit = this.raycaster.intersectObject(npc.vis.obj, true);
      if (hit.length > 0 && (best === null || hit[0].distance < best.d)) best = { npc, d: hit[0].distance };
    }
    if (best) return { kind: 'npc', npc: best.npc };

    // ground intersection → notable tile within reach
    const ray = this.raycaster.ray;
    if (Math.abs(ray.direction.y) > 1e-4) {
      const t = -ray.origin.y / ray.direction.y;
      if (t > 0) {
        const gx = Math.floor(ray.origin.x + ray.direction.x * t);
        const gy = Math.floor(ray.origin.z + ray.direction.z * t);
        if (Math.hypot(gx + 0.5 - this.px, gy + 0.5 - this.pz) <= REACH) {
          const ch = this.charW(gx, gy);
          const tile = LEGEND[ch];
          const under = this.mapUnder(gx, gy);
          const isSign = under?.map.signs?.some((s) => s.x === under.lx && s.y === under.ly) ?? false;
          if (isSign || ch === 'P' || ch === 'H' || tile?.cuttable || (tile?.water && !this.surfing)) {
            return { kind: 'tile', x: gx, y: gy };
          }
        }
      }
    }
    return null;
  }

  private crossLabel(t: CrossTarget): string {
    if (t.kind === 'npc') {
      const def = t.npc.def;
      if (def.itemPickup) return 'Pick up';
      if (def.trainer && !getFlag(`t:${t.npc.mapId}:${def.id}`)) return 'Challenge';
      return 'Talk';
    }
    const ch = this.charW(t.x, t.y);
    if (ch === 'P') return 'Storage PC';
    if (ch === 'H') return 'Heal';
    if (LEGEND[ch]?.cuttable) return this.canCut() ? 'Cut' : 'Dense brush';
    if (LEGEND[ch]?.water) return this.canSurf() ? 'Surf' : 'Water';
    return 'Read';
  }

  private updateCrosshair(busy: boolean): void {
    if (busy || !pointerLocked()) {
      this.crossTarget = null;
      setCrosshairTarget(null);
      return;
    }
    this.crossTarget = this.findCrossTarget();
    setCrosshairTarget(this.crossTarget ? this.crossLabel(this.crossTarget) : null);
  }

  // ============================================================ interaction

  onMenuKey(): void {
    if (this.uiBusy > 0 || this.scripted) return;
    void this.runUI(async () => {
      audio.sfxMenuSelect();
      const r = await this.hooks.openMenu('pause');
      if (r === 'quit') this.quitRequested = true;
    });
  }

  quitRequested = false;

  onConfirmKey(): void {
    if (this.uiBusy > 0 || this.scripted) return;
    void this.interact();
  }

  private async interact(): Promise<void> {
    // crosshair target wins; classic facing-tile interact is the fallback
    let npc: NpcEntity | null = null;
    let tx: number;
    let ty: number;
    if (this.crossTarget?.kind === 'npc') {
      npc = this.crossTarget.npc;
      tx = npc.x;
      ty = npc.y;
    } else if (this.crossTarget?.kind === 'tile') {
      tx = this.crossTarget.x;
      ty = this.crossTarget.y;
    } else {
      const [dx, dy] = DIR_DELTA[this.facing];
      tx = Math.floor(this.px + dx * 0.85);
      ty = Math.floor(this.pz + dy * 0.85);
    }
    const tch = this.charW(tx, ty);
    if (!npc) npc = this.npcAt(tx, ty);

    // reach across counters
    if (!npc && (tch === 't' || tch === 'H')) {
      const [dx, dy] = DIR_DELTA[this.facing];
      npc = this.npcAt(tx + dx, ty + dy);
    }

    if (npc) {
      await this.interactNpc(npc);
      return;
    }

    const under = this.mapUnder(tx, ty);
    const sign = under?.map.signs?.find((s) => s.x === under.lx && s.y === under.ly);
    if (sign) {
      await this.runUI(async () => this.dialog.show(sign.text));
      return;
    }

    if (tch === 'P') {
      await this.runUI(async () => {
        audio.sfxMenuSelect();
        await this.dialog.show('You booted up the storage PC.');
        await this.hooks.openMenu('box');
      });
      return;
    }

    const t = this.tileW(tx, ty);
    const ck = this.cutKey(tx, ty);
    if (t?.cuttable && ck && !cutBushes.has(ck)) {
      await this.runUI(async () => {
        if (this.canCut()) {
          await this.dialog.show('The brush is dense... Cut it down?', { holdLastPage: true });
          const yes = await confirmMenu();
          this.dialog.hide();
          if (yes) {
            cutBushes.add(ck);
            audio.sfxHit(1);
            if (this.outdoor) this.chunks?.rebuildAt(tx, ty);
            else this.view?.rebuild();
          }
        } else {
          await this.dialog.show('Dense brush blocks the way. Something sharp could clear it...');
        }
      });
      return;
    }

    if (t?.water && !this.surfing && !this.canSurf()) {
      await this.runUI(async () => this.dialog.show('The water is deep and blue. With a Wave Charm, your creatures could carry you across.'));
    }
  }

  private async interactNpc(npc: NpcEntity): Promise<void> {
    const def = npc.def;
    if (!def.itemPickup && !def.creatureSprite) {
      npc.facing = oppositeOf(this.facing);
      npc.vis.setFacing(npc.facing);
    }

    if (def.itemPickup) {
      await this.runUI(async () => {
        addToBag(def.itemPickup!.item, def.itemPickup!.qty);
        setFlag(`i:${npc.mapId}:${def.id}`);
        npc.vis.setVisible(false);
        audio.sfxCatch();
        const name = itemById(def.itemPickup!.item).name;
        await this.dialog.show(`You found ${def.itemPickup!.qty > 1 ? `${def.itemPickup!.qty}× ` : ''}${name}!`);
      });
      return;
    }

    if (def.trainer) {
      const beaten = !!getFlag(`t:${npc.mapId}:${def.id}`);
      if (!beaten) {
        await this.engageTrainer(npc, false);
        return;
      }
      const t = trainerById(def.trainer.trainerId);
      await this.runUI(async () => this.dialog.show(t.postDefeat ?? t.defeat));
      return;
    }

    if (def.script) {
      await this.runScript(SCRIPTS[def.script]);
      return;
    }

    if (def.dialogue) {
      await this.runUI(async () => {
        for (const line of def.dialogue!) await this.dialog.show(line);
      });
    }
  }

  // ============================================================ trainers

  private async checkTrainerSight(): Promise<boolean> {
    const ptx = Math.floor(this.px);
    const pty = Math.floor(this.pz);
    for (const npc of this.npcs) {
      const def = npc.def;
      if (!def.trainer || !this.npcVisible(npc) || !this.npcInSim(npc)) continue;
      if (getFlag(`t:${npc.mapId}:${def.id}`)) continue;
      const [fdx, fdy] = DIR_DELTA[npc.facing];
      for (let r = 1; r <= def.trainer.sightRange; r++) {
        const sx = npc.x + fdx * r;
        const sy = npc.y + fdy * r;
        if (sx === ptx && sy === pty) {
          await this.engageTrainer(npc, true);
          return true;
        }
        const t = this.tileW(sx, sy);
        if (!t || t.solid || this.npcAt(sx, sy)) break;
      }
    }
    return false;
  }

  private async engageTrainer(npc: NpcEntity, approach: boolean): Promise<void> {
    const def = npc.def;
    const trainer = trainerById(def.trainer!.trainerId);
    await this.runUI(async () => {
      this.scripted = true;
      try {
        if (approach) {
          audio.sfxEncounter();
          const mark = this.exclamation(npc);
          await sleep(500);
          mark();
          const ptx = Math.floor(this.px);
          const pty = Math.floor(this.pz);
          const [fdx, fdy] = DIR_DELTA[npc.facing];
          while (true) {
            const nx = npc.x + fdx;
            const ny = npc.y + fdy;
            if (nx === ptx && ny === pty) break;
            if (Math.abs(nx - ptx) + Math.abs(ny - pty) === 0) break;
            await this.npcStep(npc, nx, ny);
            if (Math.abs(npc.x + fdx - ptx) + Math.abs(npc.y + fdy - pty) === 0) break;
          }
          this.facing = oppositeOf(npc.facing);
          this.avatar.heading = Math.atan2(DIR_DELTA[this.facing][0], DIR_DELTA[this.facing][1]);
        }
        await this.dialog.show(`${trainer.name}: ${trainer.intro}`);
        const outcome = await this.startTrainerBattle(trainer);
        if (outcome === 'win') {
          setFlag(`t:${npc.mapId}:${def.id}`);
          await this.dialog.show(`${trainer.name}: ${trainer.defeat}`);
        }
      } finally {
        this.scripted = false;
      }
    });
  }

  /** floating '!' above an NPC; returns a remover */
  private exclamation(npc: NpcEntity): () => void {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 48;
    const ctx = c.getContext('2d')!;
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'center';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#000';
    ctx.strokeText('!', 16, 40);
    ctx.fillStyle = '#f0d048';
    ctx.fillText('!', 16, 40);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.5, 0.75, 1);
    sprite.position.set(npc.x + 0.5, 1.7, npc.y + 0.5);
    this.scene.add(sprite);
    return () => {
      this.scene.remove(sprite);
      tex.dispose();
      mat.dispose();
    };
  }

  private npcStep(npc: NpcEntity, nx: number, ny: number): Promise<void> {
    return new Promise((resolve) => {
      const fromX = npc.x;
      const fromY = npc.y;
      npc.x = nx;
      npc.y = ny;
      npc.vis.setMoving(1 / 0.18);
      let t = 0;
      const step = () => {
        t += 1 / 60 / 0.18;
        const k = Math.min(1, t);
        npc.vis.setPosition(fromX + 0.5 + (nx - fromX) * k, fromY + 0.5 + (ny - fromY) * k);
        if (k < 1) requestAnimationFrame(step);
        else {
          npc.vis.setMoving(0);
          resolve();
        }
      };
      step();
    });
  }

  private tickNpcs(): void {
    if (this.uiBusy > 0) return;
    const ptx = Math.floor(this.px);
    const pty = Math.floor(this.pz);
    for (const npc of this.npcs) {
      if (!this.npcVisible(npc) || npc.moving || !this.npcInSim(npc)) continue;
      const move = npc.def.movement;
      if (move === 'wander' && gameRNG.chance(0.5)) {
        const dir = gameRNG.pick(['up', 'down', 'left', 'right'] as Facing[]);
        npc.facing = dir;
        npc.vis.setFacing(dir);
        const [dx, dy] = DIR_DELTA[dir];
        const nx = npc.x + dx;
        const ny = npc.y + dy;
        const t = this.tileW(nx, ny);
        if (
          Math.abs(nx - npc.homeX) <= 2 &&
          Math.abs(ny - npc.homeY) <= 2 &&
          t &&
          !t.solid &&
          !t.water &&
          !t.encounter &&
          !this.npcAt(nx, ny) &&
          !(nx === ptx && ny === pty)
        ) {
          npc.moving = true;
          void this.npcStep(npc, nx, ny).then(() => (npc.moving = false));
        }
      } else if (move === 'spin' && gameRNG.chance(0.6)) {
        npc.facing = gameRNG.pick(['up', 'down', 'left', 'right'] as Facing[]);
        npc.vis.setFacing(npc.facing);
      }
    }
  }

  // ============================================================ battles

  private buildTrainerParty(t: TrainerDef) {
    return t.party.map((m) =>
      createCreature(gameRNG, m.speciesId, m.level, { ot: t.id, heldItem: m.heldItem ?? null, moveIds: movesAtLevel(m.speciesId, m.level) }),
    );
  }

  private async startWildBattle(speciesId: string, level: number, resolveFlag?: string): Promise<BattleOutcome> {
    const foe = createCreature(gameRNG, speciesId, level);
    markSeen(speciesId);
    const outcome = await this.hooks.startBattle({
      kind: 'wild',
      foeParty: [foe],
      canCatch: true,
      canRun: true,
      music: speciesId === 'umbralis' ? 'battle-final' : 'battle-wild',
      biome: this.biome(),
    });
    if (resolveFlag && (outcome === 'win' || outcome === 'caught')) setFlag(resolveFlag);
    if (outcome === 'loss') await this.blackout();
    else audio.playMusic(this.map.music as TrackId);
    return outcome;
  }

  private async startTrainerBattle(t: TrainerDef): Promise<BattleOutcome> {
    for (const m of t.party) markSeen(m.speciesId);
    const isBoss = t.id.startsWith('eclipse-boss') || t.id.startsWith('elite') || t.id.startsWith('champion');
    const isGym = t.id.includes('-leader');
    const outcome = await this.hooks.startBattle({
      kind: 'trainer',
      foeParty: this.buildTrainerParty(t),
      foeName: t.name,
      foeIsSmart: t.smart,
      payBase: t.payBase,
      canCatch: false,
      canRun: false,
      music: isBoss ? 'battle-final' : isGym ? 'battle-gym' : t.id.startsWith('eclipse') ? 'evil' : 'battle-trainer',
      biome: this.biome(),
    });
    if (outcome === 'loss') await this.blackout();
    else audio.playMusic(this.map.music as TrackId);
    return outcome;
  }

  /** battle-arena theming derived from where the fight started */
  private biome(): 'grass' | 'cave' | 'water' | 'gym' | 'dark' | 'indoor' {
    if (this.surfing) return 'water';
    if (/^gym\d+$/.test(this.map.id)) return 'gym';
    if (this.map.grid.some((r) => r.includes('X') || r.includes('d'))) return 'dark';
    if (/cave|hollow|depth|tunnel|shrine/.test(this.map.id)) return 'cave';
    if (this.map.indoor) return 'indoor';
    return 'grass';
  }

  private async blackout(): Promise<void> {
    const s = getState();
    const penalty = Math.floor(s.player.money / 2);
    s.player.money -= penalty;
    healParty();
    await this.runUI(async () => {
      await this.dialog.show(`You blacked out!${penalty > 0 ? `\nYou dropped ₽${penalty} in the scramble...` : ''}`);
    });
    await fade('out', 350);
    s.player.mapId = s.lastHeal.mapId;
    s.player.x = s.lastHeal.x;
    s.player.y = s.lastHeal.y;
    this.px = Number.isInteger(s.player.x) ? s.player.x + 0.5 : s.player.x;
    this.pz = Number.isInteger(s.player.y) ? s.player.y + 0.5 : s.player.y;
    this.loadMap(s.lastHeal.mapId);
    if (this.outdoor) {
      const off = worldLayout().offsetOf(s.lastHeal.mapId);
      this.px += off.x;
      this.pz += off.y;
    }
    this.justWarped = true;
    this.lastTileX = Math.floor(this.px);
    this.lastTileY = Math.floor(this.pz);
    this.surfing = false;
    this.avatar.setSurfing(false);
    this.snapCamera();
    await fade('in', 350);
  }

  // ============================================================ travel

  private async travelTo(mapId: string, spawn: string): Promise<void> {
    this.uiBusy++;
    await fade('out', 240);
    const target = mapById(mapId);
    const sp = target.spawns[spawn];
    const layout = worldLayout();
    if (layout.isPlaced(mapId)) {
      // outdoor target: reuse the streaming world when already roaming it
      if (!this.outdoor) {
        this.loadMap(mapId);
      } else {
        this.map = target;
        getState().player.mapId = mapId;
        audio.playMusic(target.music as TrackId);
        this.showMapBanner();
      }
      const off = layout.offsetOf(mapId);
      this.px = off.x + sp.x + 0.5;
      this.pz = off.y + sp.y + 0.5;
    } else {
      this.loadMap(mapId);
      this.px = sp.x + 0.5;
      this.pz = sp.y + 0.5;
    }
    this.facing = sp.facing;
    this.avatar.heading = Math.atan2(DIR_DELTA[sp.facing][0], DIR_DELTA[sp.facing][1]);
    const s = getState();
    s.player.x = sp.x + 0.5;
    s.player.y = sp.y + 0.5;
    s.player.facing = sp.facing;
    this.justWarped = true;
    this.lastTileX = Math.floor(this.px);
    this.lastTileY = Math.floor(this.pz);
    const onWater = this.tileW(this.lastTileX, this.lastTileY)?.water ?? false;
    this.surfing = onWater;
    this.avatar.setSurfing(onWater);
    // build the arrival area before the fade lifts so there's no void flash
    this.chunks?.update(this.px, this.pz);
    this.snapCamera();
    await fade('in', 240);
    this.uiBusy--;
  }

  // ============================================================ scripts

  private async runUI(fn: () => Promise<void>): Promise<void> {
    this.uiBusy++;
    try {
      await fn();
    } finally {
      this.uiBusy--;
    }
  }

  async runScript(ops: ScriptOp[]): Promise<void> {
    await this.runUI(async () => {
      await this.execOps(ops);
      this.dialog.hide();
    });
  }

  private async execOps(ops: ScriptOp[]): Promise<void> {
    const s = getState();
    for (const op of ops) {
      switch (op.op) {
        case 'say':
          await this.dialog.show(op.text);
          break;
        case 'choice': {
          await this.dialog.show(op.prompt, { holdLastPage: true });
          const menu = new ListMenu(op.options.map((o) => ({ label: o.label })), {
            x: GAME_W - 190,
            y: GAME_H - 78 - op.options.length * 18 - 24,
            width: 180,
          });
          let pick = await menu.choose();
          if (pick === null) pick = op.options.length - 1;
          this.dialog.hide();
          await this.execOps(op.options[pick].then);
          break;
        }
        case 'battle': {
          this.dialog.hide();
          const t = trainerById(op.trainerId);
          const outcome = await this.startTrainerBattle(t);
          if (outcome !== 'win') return;
          if (op.winFlag) setFlag(op.winFlag);
          break;
        }
        case 'rivalBattle': {
          this.dialog.hide();
          const starter = (getFlag('starter') as string) || 'emberling';
          const id = op.stage === 6 ? `champion-${starter}` : rivalTrainerId(op.stage, starter);
          const outcome = await this.startTrainerBattle(trainerById(id));
          if (outcome !== 'win') return;
          if (op.winFlag) setFlag(op.winFlag);
          break;
        }
        case 'wildBattle': {
          this.dialog.hide();
          await this.startWildBattle(op.speciesId, op.level, op.resolveFlag);
          break;
        }
        case 'giveItem': {
          addToBag(op.item, op.qty);
          audio.sfxCatch();
          await this.dialog.show(`You received ${op.qty > 1 ? `${op.qty}× ` : ''}${itemById(op.item).name}!`);
          break;
        }
        case 'giveCreature': {
          const c = createCreature(gameRNG, op.speciesId, op.level, { ot: 'player', perfectIvs: op.perfect });
          const where = addCreature(c);
          audio.sfxLevelUp();
          await this.dialog.show(`${displayName(c)} joined your ${where === 'party' ? 'team' : 'box storage'}!`);
          break;
        }
        case 'setFlag':
          setFlag(op.flag, op.value ?? true);
          this.refreshNpcVisibility();
          break;
        case 'if': {
          const v = getFlag(op.flag);
          const match = op.value !== undefined ? v === op.value : !!v;
          const pass = op.not ? !match : match;
          await this.execOps(pass ? op.then : op.else ?? []);
          break;
        }
        case 'ifBadges':
          await this.execOps(s.player.badges.length >= op.count ? op.then : op.else ?? []);
          break;
        case 'heal':
          healParty();
          if (!op.silent) audio.sfxHeal();
          break;
        case 'autosave': {
          // lastHeal keeps map-local coords like the rest of the save
          const off = this.outdoor ? worldLayout().offsetOf(this.map.id) : { x: 0, y: 0 };
          s.lastHeal = { mapId: this.map.id, x: this.px - off.x, y: this.pz - off.y };
          s.rngSeed = gameRNG.getSeed();
          saveToSlot('auto', s);
          break;
        }
        case 'warp':
          this.dialog.hide();
          await this.travelTo(op.map, op.spawn);
          break;
        case 'movePlayer':
          this.scripted = true;
          for (const dir of op.path) {
            this.facing = dir;
            const [dx, dy] = DIR_DELTA[dir];
            this.avatar.heading = Math.atan2(dx, dy);
            this.avatar.setMoving(WALK_SPEED);
            const toX = this.px + dx;
            const toZ = this.pz + dy;
            let t = 0;
            const fromX = this.px;
            const fromZ = this.pz;
            await new Promise<void>((resolve) => {
              const step = () => {
                t += 1 / 60 / 0.22;
                const k = Math.min(1, t);
                this.px = fromX + (toX - fromX) * k;
                this.pz = fromZ + (toZ - fromZ) * k;
                if (k < 1) requestAnimationFrame(step);
                else resolve();
              };
              step();
            });
          }
          this.avatar.setMoving(0);
          this.scripted = false;
          this.syncSaveCoords();
          this.lastTileX = Math.floor(this.px);
          this.lastTileY = Math.floor(this.pz);
          break;
        case 'badge': {
          const id = `badge${op.index + 1}`;
          if (!s.player.badges.includes(id)) s.player.badges.push(id);
          break;
        }
        case 'sfx':
          ({ heal: () => audio.sfxHeal(), badge: () => audio.sfxBadge(), levelup: () => audio.sfxLevelUp(), select: () => audio.sfxMenuSelect(), evolve: () => audio.sfxEvolve() })[op.name]();
          break;
        case 'music':
          audio.playMusic(op.track);
          break;
        case 'shop':
          this.dialog.hide();
          await this.hooks.openMenu('shop', SHOP_STOCK[op.townId]);
          break;
        case 'credits':
          this.dialog.hide();
          saveToSlot('auto', s);
          this.hooks.showCredits();
          return;
      }
    }
  }

  /** texture hot-swap landed: repaint whatever view is live */
  onAssetsSwapped(): void {
    this.chunks?.rebuildAll();
    this.view?.rebuild();
  }

  dispose(): void {
    this.banner?.remove();
    this.dialog.destroy();
    setCrosshairTarget(null);
    if (this.view) {
      this.scene.remove(this.view.group);
      this.view.dispose();
    }
    if (this.chunks) {
      this.scene.remove(this.chunks.group);
      this.chunks.dispose();
    }
    if (this.sky) {
      this.scene.remove(this.sky.group);
      this.sky.dispose(this.scene);
    }
    for (const n of this.npcs) n.vis.dispose();
    this.avatar.dispose();
  }
}

function oppositeOf(f: Facing): Facing {
  return f === 'up' ? 'down' : f === 'down' ? 'up' : f === 'left' ? 'right' : 'left';
}
