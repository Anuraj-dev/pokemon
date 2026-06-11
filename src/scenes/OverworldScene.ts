/**
 * OverworldScene — tile world rendering, smooth grid movement, NPCs,
 * line-of-sight trainers, wild encounters, traversal abilities, warps,
 * and the cutscene script interpreter.
 */
import Phaser from 'phaser';
import { mapById, SHOP_STOCK } from '../data/maps';
import { LEGEND, tileAt, charAt, type MapDef, type NpcDef } from '../data/maps/defs';
import { SCRIPTS, type ScriptOp } from '../data/story';
import { trainerById, rivalTrainerId, type TrainerDef } from '../data/trainers';
import { itemById } from '../data/items';
import { getState, setFlag, getFlag, healParty, addToBag, removeFromBag, bagCount, addCreature, markSeen, type Facing } from '../engine/state';
import { createCreature, displayName } from '../engine/creature';
import { movesAtLevel } from '../data/species';
import { gameRNG } from '../core/rng';
import { audio, type TrackId } from '../audio/audio';
import { saveToSlot } from '../engine/save';
import { TILE } from '../render/spriteGen';
import { charKey, creatureKey, tileKey } from '../render/assets';
import { DialogBox, ListMenu, confirmMenu, fade, sleep, vpad, GAME_W, GAME_H, UI_FONT_SMALL, drawWindow } from '../ui/ui';
import type { BattleRequest, BattleOutcome } from './BattleScene';

const DIR_DELTA: Record<Facing, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

interface NpcEntity {
  def: NpcDef;
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  facing: Facing;
  moving: boolean;
}

/** session-only set of cut bushes, keyed `${mapId}:${x},${y}` */
const cutBushes = new Set<string>();

export class OverworldScene extends Phaser.Scene {
  private map!: MapDef;
  private mapRT!: Phaser.GameObjects.RenderTexture;
  private player!: Phaser.GameObjects.Image;
  private npcs: NpcEntity[] = [];
  private dialog!: DialogBox;
  private px = 0;
  private py = 0;
  private facing: Facing = 'down';
  private moving = false;
  private surfing = false;
  private uiBusy = 0;
  private justWarped = false;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private stepFrame = 0;
  private walkBob = 0;

  constructor() {
    super('overworld');
  }

  create(): void {
    const s = getState();
    this.dialog = new DialogBox(this);
    this.npcs = [];
    this.uiBusy = 0;
    this.moving = false;
    this.loadMap(s.player.mapId, null);
    this.px = s.player.x;
    this.py = s.player.y;
    this.facing = s.player.facing;
    this.placePlayer();
    this.cameras.main.fadeIn(300, 8, 8, 16);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,ENTER,Z,SPACE,X,ESC') as Record<string, Phaser.Input.Keyboard.Key>;
    vpad.emitter.on('start', this.onMenuKey, this);
    vpad.emitter.on('a', this.onConfirmKey, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      vpad.emitter.off('start', this.onMenuKey, this);
      vpad.emitter.off('a', this.onConfirmKey, this);
    });

    // Intro: brand-new game gets a welcome nudge toward the lab.
    if (!getFlag('introSeen')) {
      setFlag('introSeen');
      void this.runUI(async () => {
        await this.dialog.show(`Welcome to Embervale, ${s.player.name}! Professor Alder is waiting in the lab to the southwest.`);
      });
    }
  }

  // ============================================================ map setup

  private loadMap(mapId: string, _from: string | null): void {
    this.map = mapById(mapId);
    getState().player.mapId = mapId;
    this.mapRT?.destroy();
    for (const n of this.npcs) n.sprite.destroy();
    this.npcs = [];

    const w = this.map.grid[0].length * TILE;
    const h = this.map.grid.length * TILE;
    this.mapRT = this.add.renderTexture(0, 0, w, h).setOrigin(0, 0).setDepth(0);
    this.redrawMap();

    this.physics?.world?.setBounds(0, 0, w, h);
    this.cameras.main.setBounds(0, 0, Math.max(w, GAME_W), Math.max(h, GAME_H));
    if (w < GAME_W) this.cameras.main.setBounds(-(GAME_W - w) / 2, 0, GAME_W, Math.max(h, GAME_H));

    for (const def of this.map.npcs ?? []) {
      if (!this.npcVisible(def)) continue;
      const tex = def.itemPickup
        ? 'ui/basicball'
        : def.creatureSprite
          ? creatureKey(def.creatureSprite, 'front')
          : charKey(def.sprite, def.facing, 0);
      const sprite = this.add.image(def.x * TILE + TILE / 2, def.y * TILE + TILE / 2 - 6, tex);
      if (def.creatureSprite) sprite.setDisplaySize(40, 40);
      sprite.setDepth(def.y + 10);
      this.npcs.push({ def, sprite, x: def.x, y: def.y, homeX: def.x, homeY: def.y, facing: def.facing, moving: false });
    }

    // ambient wander timers
    this.time.removeAllEvents();
    this.time.addEvent({ delay: 1400, loop: true, callback: () => this.tickNpcs() });

    audio.playMusic(this.map.music as TrackId);
    this.showMapBanner();
  }

  private redrawMap(): void {
    this.mapRT.clear();
    for (let y = 0; y < this.map.grid.length; y++) {
      for (let x = 0; x < this.map.grid[y].length; x++) {
        let ch = this.map.grid[y][x];
        if (LEGEND[ch]?.cuttable && cutBushes.has(`${this.map.id}:${x},${y}`)) {
          ch = this.map.indoor ? 'c' : '.';
        }
        this.mapRT.draw(tileKey(LEGEND[ch]?.tile ?? 'void'), x * TILE, y * TILE);
      }
    }
    this.drawBuildingLabels();
  }

  /** Paint "PC"/"GYM" signage on the roof tile above center and gym doors. */
  private drawBuildingLabels(): void {
    for (const w of this.map.warps ?? []) {
      const label = w.to.endsWith('-center') ? 'PC' : /^gym\d+$/.test(w.to) ? 'GYM' : null;
      if (!label) continue;
      const t = this.add.text(0, 0, label, {
        fontFamily: 'monospace',
        fontStyle: 'bold',
        fontSize: label === 'PC' ? '16px' : '13px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      });
      this.mapRT.draw(t, w.x * TILE + (TILE - t.width) / 2, (w.y - 1) * TILE + (TILE - t.height) / 2);
      t.destroy();
    }
  }

  private npcVisible(def: NpcDef): boolean {
    if (def.itemPickup && getFlag(`i:${this.map.id}:${def.id}`)) return false;
    if (def.showIf) {
      const v = getFlag(def.showIf.flag);
      const want = def.showIf.value ?? true;
      const match = v === want || (!!v && def.showIf.value === undefined);
      if (def.showIf.not ? match : !match) return false;
    }
    return true;
  }

  private placePlayer(): void {
    this.player?.destroy();
    this.player = this.add.image(this.px * TILE + TILE / 2, this.py * TILE + TILE / 2 - 6, charKey('player', this.facing, 0));
    this.player.setDepth(this.py + 10);
    this.cameras.main.startFollow(this.player, true, 0.18, 0.18);
  }

  private showMapBanner(): void {
    const g = this.add.graphics().setScrollFactor(0).setDepth(900);
    drawWindow(g, 6, 6, 12 + this.map.name.length * 7.5, 24);
    const t = this.add.text(14, 11, this.map.name, UI_FONT_SMALL).setScrollFactor(0).setDepth(901);
    this.tweens.add({
      targets: [g, t],
      alpha: 0,
      delay: 1800,
      duration: 400,
      onComplete: () => {
        g.destroy();
        t.destroy();
      },
    });
  }

  // ============================================================ update loop

  update(_time: number, delta: number): void {
    if (!this.player) return;
    getState().player.playtimeMs += delta;
    if (this.uiBusy > 0 || this.moving) return;

    if (Phaser.Input.Keyboard.JustDown(this.keys.ENTER) || Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
      this.onMenuKey();
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.Z) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      this.onConfirmKey();
      return;
    }

    const dir = this.heldDir();
    if (dir) this.tryMove(dir);
  }

  private heldDir(): Facing | null {
    const k = this.keys;
    if (k.UP.isDown || k.W.isDown || vpad.dirs.up) return 'up';
    if (k.DOWN.isDown || k.S.isDown || vpad.dirs.down) return 'down';
    if (k.LEFT.isDown || k.A.isDown || vpad.dirs.left) return 'left';
    if (k.RIGHT.isDown || k.D.isDown || vpad.dirs.right) return 'right';
    return null;
  }

  private running(): boolean {
    return this.keys.SHIFT.isDown || vpad.bHeld;
  }

  // ============================================================ movement

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
    return this.npcs.find((n) => n.x === x && n.y === y && this.npcVisible(n.def)) ?? null;
  }

  private walkable(x: number, y: number, forNpc = false): boolean {
    const t = tileAt(this.map, x, y);
    if (!t) return false;
    if (this.npcAt(x, y)) return false;
    if (forNpc && (x === this.px && y === this.py)) return false;
    if (t.water) return !forNpc && (this.surfing || this.canSurf());
    if (t.climbable) return !forNpc && this.canClimb();
    if (t.cuttable) return cutBushes.has(`${this.map.id}:${x},${y}`);
    if (t.ledge) return false; // handled as hop
    return !t.solid;
  }

  private tryMove(dir: Facing): void {
    const [dx, dy] = DIR_DELTA[dir];
    const tx = this.px + dx;
    const ty = this.py + dy;

    if (this.facing !== dir) {
      this.facing = dir;
      getState().player.facing = dir;
      this.player.setTexture(charKey('player', dir, 0));
      // small turn delay feels right; if key released we just face
    }

    // Edge of map?
    if (ty < 0 || ty >= this.map.grid.length || tx < 0 || tx >= this.map.grid[0].length) {
      const side = ty < 0 ? 'north' : ty >= this.map.grid.length ? 'south' : tx < 0 ? 'west' : 'east';
      const edge = this.map.edges?.find((e) => e.side === side);
      if (edge) void this.travelTo(edge.to, edge.spawn);
      return;
    }

    const t = tileAt(this.map, tx, ty)!;

    // Ledge hop (down only)
    if (t.ledge && dir === 'down' && this.walkable(tx, ty + 1)) {
      this.hopLedge(tx, ty + 1);
      return;
    }

    if (!this.walkable(tx, ty)) {
      audio.sfxBump();
      return;
    }

    const wasWater = tileAt(this.map, this.px, this.py)?.water ?? false;
    const toWater = !!t.water;
    if (toWater && !this.surfing) {
      this.surfing = true;
      this.player.setTint(0x9ad0ff);
    }

    this.stepTo(tx, ty, () => {
      if (!toWater && this.surfing) {
        this.surfing = false;
        this.player.clearTint();
      }
      void this.afterStep(wasWater || toWater);
    });
  }

  private stepTo(tx: number, ty: number, onDone: () => void): void {
    this.moving = true;
    this.px = tx;
    this.py = ty;
    getState().player.x = tx;
    getState().player.y = ty;
    const ms = this.running() ? 95 : 165;
    this.stepFrame = this.stepFrame === 1 ? 2 : 1;
    this.player.setTexture(charKey('player', this.facing, this.stepFrame));
    this.player.setDepth(ty + 10);
    this.tweens.add({
      targets: this.player,
      x: tx * TILE + TILE / 2,
      y: ty * TILE + TILE / 2 - 6,
      duration: ms,
      ease: 'Linear',
      onComplete: () => {
        this.moving = false;
        this.player.setTexture(charKey('player', this.facing, 0));
        onDone();
      },
    });
  }

  private hopLedge(tx: number, ty: number): void {
    this.moving = true;
    audio.sfxThrow();
    this.px = tx;
    this.py = ty;
    getState().player.x = tx;
    getState().player.y = ty;
    this.player.setDepth(ty + 10);
    this.tweens.add({
      targets: this.player,
      x: tx * TILE + TILE / 2,
      duration: 320,
    });
    this.tweens.add({
      targets: this.player,
      y: ty * TILE + TILE / 2 - 26,
      duration: 160,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.player.setY(ty * TILE + TILE / 2 - 6);
        this.moving = false;
        void this.afterStep(false);
      },
    });
  }

  private async afterStep(onWater: boolean): Promise<void> {
    const s = getState();
    // Warp tiles
    if (!this.justWarped) {
      const warp = this.map.warps?.find((w) => w.x === this.px && w.y === this.py);
      if (warp) {
        if (warp.requires && !getFlag(warp.requires)) {
          if (warp.failText) {
            await this.runUI(async () => this.dialog.show(warp.failText!));
          }
        } else {
          void this.travelTo(warp.to, warp.spawn);
          return;
        }
      }
    }
    this.justWarped = false;

    // Step triggers
    const trig = this.map.triggers?.find((t) => t.x === this.px && t.y === this.py);
    if (trig && this.triggerActive(trig.showIf)) {
      await this.runScript(SCRIPTS[trig.script]);
      return;
    }

    // Repel countdown
    if (s.repelSteps > 0) s.repelSteps--;

    // Trainer line of sight
    if (await this.checkTrainerSight()) return;

    // Wild encounters
    const tile = tileAt(this.map, this.px, this.py);
    const table = onWater && tile?.water ? this.map.encounters?.water : tile?.encounter ? this.map.encounters?.grass : null;
    if (table && table.length > 0) {
      const rate = this.map.encounters?.rate ?? 0.12;
      if (gameRNG.chance(rate)) {
        const entry = gameRNG.weighted(table.map((e) => ({ item: e, weight: e.weight })));
        const level = gameRNG.int(entry.min, entry.max);
        const lead = s.party.find((c) => c.hp > 0);
        if (s.repelSteps > 0 && lead && level < lead.level) return;
        if (s.party.length === 0) return; // can't battle without a creature
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

  // ============================================================ interaction

  private onMenuKey(): void {
    if (this.uiBusy > 0 || this.moving) return;
    void this.runUI(async () => {
      audio.sfxMenuSelect();
      await this.openSubScene('menu', { mode: 'pause' });
    });
  }

  private onConfirmKey(): void {
    if (this.uiBusy > 0 || this.moving) return;
    void this.interact();
  }

  private async interact(): Promise<void> {
    const [dx, dy] = DIR_DELTA[this.facing];
    let tx = this.px + dx;
    let ty = this.py + dy;
    let npc = this.npcAt(tx, ty);
    const tch = charAt(this.map, tx, ty);

    // reach across counters
    if (!npc && (tch === 't' || tch === 'H')) {
      npc = this.npcAt(tx + dx, ty + dy);
    }

    if (npc) {
      await this.interactNpc(npc);
      return;
    }

    // signs
    const sign = this.map.signs?.find((s) => s.x === tx && s.y === ty);
    if (sign) {
      await this.runUI(async () => this.dialog.show(sign.text));
      return;
    }

    // PC
    if (tch === 'P') {
      await this.runUI(async () => {
        audio.sfxMenuSelect();
        await this.dialog.show('You booted up the storage PC.');
        await this.openSubScene('menu', { mode: 'box' });
      });
      return;
    }

    // cuttable bush
    const t = tileAt(this.map, tx, ty);
    if (t?.cuttable && !cutBushes.has(`${this.map.id}:${tx},${ty}`)) {
      await this.runUI(async () => {
        if (this.canCut()) {
          await this.dialog.show('The brush is dense... Cut it down?', { holdLastPage: true });
          const yes = await confirmMenu(this);
          this.dialog.hide();
          if (yes) {
            cutBushes.add(`${this.map.id}:${tx},${ty}`);
            audio.sfxHit(1);
            this.redrawMap();
          }
        } else {
          await this.dialog.show('Dense brush blocks the way. Something sharp could clear it...');
        }
      });
      return;
    }

    // water hint
    if (t?.water && !this.surfing && !this.canSurf()) {
      await this.runUI(async () => this.dialog.show('The water is deep and blue. With a Wave Charm, your creatures could carry you across.'));
    }
  }

  private async interactNpc(npc: NpcEntity): Promise<void> {
    const def = npc.def;
    // face the player
    if (!def.itemPickup && !def.creatureSprite) {
      npc.facing = oppositeOf(this.facing);
      npc.sprite.setTexture(charKey(def.sprite, npc.facing, 0));
    }

    if (def.itemPickup) {
      await this.runUI(async () => {
        addToBag(def.itemPickup!.item, def.itemPickup!.qty);
        setFlag(`i:${this.map.id}:${def.id}`);
        npc.sprite.setVisible(false);
        audio.sfxCatch();
        const name = itemById(def.itemPickup!.item).name;
        await this.dialog.show(`You found ${def.itemPickup!.qty > 1 ? `${def.itemPickup!.qty}× ` : ''}${name}!`);
      });
      return;
    }

    if (def.trainer) {
      const beaten = !!getFlag(`t:${this.map.id}:${def.id}`);
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
    for (const npc of this.npcs) {
      const def = npc.def;
      if (!def.trainer || !this.npcVisible(def)) continue;
      if (getFlag(`t:${this.map.id}:${def.id}`)) continue;
      const [fdx, fdy] = DIR_DELTA[npc.facing];
      for (let r = 1; r <= def.trainer.sightRange; r++) {
        const sx = npc.x + fdx * r;
        const sy = npc.y + fdy * r;
        if (sx === this.px && sy === this.py) {
          await this.engageTrainer(npc, true);
          return true;
        }
        const t = tileAt(this.map, sx, sy);
        if (!t || t.solid || this.npcAt(sx, sy)) break;
      }
    }
    return false;
  }

  private async engageTrainer(npc: NpcEntity, approach: boolean): Promise<void> {
    const def = npc.def;
    const trainer = trainerById(def.trainer!.trainerId);
    await this.runUI(async () => {
      if (approach) {
        // exclamation + walk up
        audio.sfxEncounter();
        const mark = this.add.text(npc.sprite.x, npc.sprite.y - 30, '!', { fontFamily: 'monospace', fontSize: '20px', color: '#f0d048', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(500);
        await sleep(this, 500);
        mark.destroy();
        const [fdx, fdy] = DIR_DELTA[npc.facing];
        while (Math.abs(npc.x + fdx - this.px) + Math.abs(npc.y + fdy - this.py) > 0) {
          const nx = npc.x + fdx;
          const ny = npc.y + fdy;
          if (nx === this.px && ny === this.py) break;
          await this.npcStep(npc, nx, ny);
        }
        this.facing = oppositeOf(npc.facing);
        this.player.setTexture(charKey('player', this.facing, 0));
      }
      await this.dialog.show(`${trainer.name}: ${trainer.intro}`);
      const outcome = await this.startTrainerBattle(trainer);
      if (outcome === 'win') {
        setFlag(`t:${this.map.id}:${def.id}`);
        await this.dialog.show(`${trainer.name}: ${trainer.defeat}`);
      }
    });
  }

  private npcStep(npc: NpcEntity, nx: number, ny: number): Promise<void> {
    return new Promise((resolve) => {
      npc.x = nx;
      npc.y = ny;
      npc.sprite.setTexture(charKey(npc.def.sprite, npc.facing, 1));
      this.tweens.add({
        targets: npc.sprite,
        x: nx * TILE + TILE / 2,
        y: ny * TILE + TILE / 2 - 6,
        duration: 180,
        onComplete: () => {
          npc.sprite.setTexture(charKey(npc.def.sprite, npc.facing, 0));
          npc.sprite.setDepth(ny + 10);
          resolve();
        },
      });
    });
  }

  private tickNpcs(): void {
    if (this.uiBusy > 0) return;
    for (const npc of this.npcs) {
      if (!this.npcVisible(npc.def) || npc.moving) continue;
      const move = npc.def.movement;
      if (move === 'wander' && gameRNG.chance(0.5)) {
        const dir = gameRNG.pick(['up', 'down', 'left', 'right'] as Facing[]);
        npc.facing = dir;
        const [dx, dy] = DIR_DELTA[dir];
        const nx = npc.x + dx;
        const ny = npc.y + dy;
        npc.sprite.setTexture(charKey(npc.def.sprite, dir, 0));
        if (
          Math.abs(nx - npc.homeX) <= 2 &&
          Math.abs(ny - npc.homeY) <= 2 &&
          this.walkable(nx, ny, true) &&
          !(tileAt(this.map, nx, ny)?.encounter)
        ) {
          npc.moving = true;
          void this.npcStep(npc, nx, ny).then(() => (npc.moving = false));
        }
      } else if (move === 'spin' && gameRNG.chance(0.6)) {
        npc.facing = gameRNG.pick(['up', 'down', 'left', 'right'] as Facing[]);
        npc.sprite.setTexture(charKey(npc.def.sprite, npc.facing, 0));
      }
    }
  }

  // ============================================================ battles

  private buildTrainerParty(t: TrainerDef) {
    return t.party.map((m) =>
      createCreature(gameRNG, m.speciesId, m.level, { ot: t.id, heldItem: m.heldItem ?? null, moveIds: movesAtLevel(m.speciesId, m.level) }),
    );
  }

  private startBattle(req: BattleRequest): Promise<BattleOutcome> {
    return new Promise((resolve) => {
      this.scene.pause();
      this.scene.launch('battle', { req, resolve });
    });
  }

  private async startWildBattle(speciesId: string, level: number, resolveFlag?: string): Promise<BattleOutcome> {
    const foe = createCreature(gameRNG, speciesId, level);
    markSeen(speciesId);
    const outcome = await this.startBattle({
      kind: 'wild',
      foeParty: [foe],
      canCatch: true,
      canRun: true,
      music: speciesId === 'umbralis' ? 'battle-final' : 'battle-wild',
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
    const outcome = await this.startBattle({
      kind: 'trainer',
      foeParty: this.buildTrainerParty(t),
      foeName: t.name,
      foeIsSmart: t.smart,
      payBase: t.payBase,
      canCatch: false,
      canRun: false,
      music: isBoss ? 'battle-final' : isGym ? 'battle-gym' : t.id.startsWith('eclipse') ? 'evil' : 'battle-trainer',
    });
    if (outcome === 'loss') await this.blackout();
    else audio.playMusic(this.map.music as TrackId);
    return outcome;
  }

  private async blackout(): Promise<void> {
    const s = getState();
    const penalty = Math.floor(s.player.money / 2);
    s.player.money -= penalty;
    healParty();
    await this.runUI(async () => {
      await this.dialog.show(`You blacked out!${penalty > 0 ? `\nYou dropped ₽${penalty} in the scramble...` : ''}`);
    });
    await fade(this, 'out', 350);
    s.player.mapId = s.lastHeal.mapId;
    s.player.x = s.lastHeal.x;
    s.player.y = s.lastHeal.y;
    this.scene.restart();
  }

  // ============================================================ travel

  private async travelTo(mapId: string, spawn: string): Promise<void> {
    this.uiBusy++;
    await fade(this, 'out', 240);
    const target = mapById(mapId);
    const sp = target.spawns[spawn];
    this.loadMap(mapId, this.map.id);
    this.px = sp.x;
    this.py = sp.y;
    this.facing = sp.facing;
    const s = getState();
    s.player.x = sp.x;
    s.player.y = sp.y;
    s.player.facing = sp.facing;
    this.justWarped = true;
    const onWater = tileAt(this.map, sp.x, sp.y)?.water ?? false;
    this.surfing = onWater;
    this.placePlayer();
    if (onWater) this.player.setTint(0x9ad0ff);
    await fade(this, 'in', 240);
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

  private openSubScene(key: string, data: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve) => {
      this.scene.pause();
      this.scene.launch(key, { ...data, resolve });
    });
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
          const menu = new ListMenu(this, op.options.map((o) => ({ label: o.label })), {
            x: GAME_W - 190,
            y: GAME_H - 78 - op.options.length * 18 - 24,
            width: 180,
          });
          let pick = await menu.choose();
          if (pick === null) pick = op.options.length - 1; // cancel = last option
          this.dialog.hide();
          await this.execOps(op.options[pick].then);
          break;
        }
        case 'battle': {
          this.dialog.hide();
          const t = trainerById(op.trainerId);
          const outcome = await this.startTrainerBattle(t);
          if (outcome !== 'win') return; // blackout already handled
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
        case 'autosave':
          s.lastHeal = { mapId: this.map.id, x: this.px, y: this.py };
          s.rngSeed = gameRNG.getSeed();
          saveToSlot('auto', s);
          break;
        case 'warp':
          this.dialog.hide();
          await this.travelTo(op.map, op.spawn);
          break;
        case 'movePlayer':
          for (const dir of op.path) {
            this.facing = dir;
            const [dx, dy] = DIR_DELTA[dir];
            await new Promise<void>((resolve) => this.stepTo(this.px + dx, this.py + dy, resolve));
          }
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
          await this.openSubScene('menu', { mode: 'shop', stock: SHOP_STOCK[op.townId] });
          break;
        case 'credits':
          this.dialog.hide();
          saveToSlot('auto', s);
          this.scene.stop('menu');
          this.scene.start('credits');
          return;
      }
    }
  }

  private refreshNpcVisibility(): void {
    for (const npc of this.npcs) {
      npc.sprite.setVisible(this.npcVisible(npc.def));
    }
  }
}

function oppositeOf(f: Facing): Facing {
  return f === 'up' ? 'down' : f === 'down' ? 'up' : f === 'left' ? 'right' : 'left';
}
