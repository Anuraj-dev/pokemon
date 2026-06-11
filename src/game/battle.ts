/**
 * Battle3D — the cinematic 3D arena over the pure battle engine: a floating
 * biome-themed platform in a skybox, creature sprite billboards, camera cuts
 * on attacks, particle bursts, and DOM HP panels/menus. All battle *logic*
 * lives untouched in engine/battle.ts; this file is pure presentation.
 */
import * as THREE from 'three';
import { BattleEngine, type BattleEvent, type Side, STATUS_LABELS } from '../engine/battle';
import { calcStats, displayName, evolve, levelEvolution, type CreatureInstance } from '../engine/creature';
import { movesAtLevel, speciesById } from '../data/species';
import { applyItemToCreature } from '../engine/itemUse';
import { getState, addCreature, removeFromBag, markCaught } from '../engine/state';
import { moveById } from '../data/moves';
import { itemById, ITEMS } from '../data/items';
import { totalExpFor } from '../data/growth';
import { TYPE_NAMES, TYPE_COLORS } from '../data/types';
import { gameRNG } from '../core/rng';
import { audio } from '../audio/audio';
import { Billboard } from '../render3d/billboard';
import { creatureKey, tileKey, spriteCanvas, spriteTexture } from '../render3d/textures';
import { DialogBox, ListMenu, confirmMenu, GAME_W, GAME_H, el, label, panel, hpColor, sleep } from '../ui/dom';
import type { BattleRequest, BattleOutcome, BattleBiome } from './battleTypes';

const BIOME_FLOOR: Record<BattleBiome, string> = {
  grass: 'tallgrass',
  cave: 'cavefloor',
  water: 'water',
  gym: 'gymfloor',
  dark: 'darkfloor',
  indoor: 'floor',
};

const BIOME_SKY: Record<BattleBiome, number> = {
  grass: 0x6fb1e0,
  cave: 0x0c0e18,
  water: 0x3a78b8,
  gym: 0x282838,
  dark: 0x050508,
  indoor: 0x201c28,
};

const PLAYER_POS = new THREE.Vector3(-2.1, 0, 2.0);
const FOE_POS = new THREE.Vector3(2.1, 0, -2.0);
const HOME_CAM = new THREE.Vector3(-4.6, 2.6, 6.4);
const HOME_LOOK = new THREE.Vector3(0.6, 1.0, -0.8);

function tween(ms: number, fn: (k: number) => void): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      fn(k);
      if (k < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

interface DomPanel {
  root: HTMLDivElement;
  name: HTMLDivElement;
  level: HTMLDivElement;
  status: HTMLDivElement;
  hpBar: HTMLDivElement;
  hpText?: HTMLDivElement;
  expBar?: HTMLDivElement;
}

export class Battle3D {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  private req: BattleRequest;
  private engine: BattleEngine;
  private dialog = new DialogBox();
  private playerBB: Billboard;
  private foeBB: Billboard;
  private foePanel: DomPanel;
  private playerPanel: DomPanel;
  private leveledUids = new Set<string>();
  private disposables: { dispose(): void }[] = [];
  private domBits: HTMLElement[] = [];
  private shakeTime = 0;
  private camBase = HOME_CAM.clone();
  private camLook = HOME_LOOK.clone();

  constructor(req: BattleRequest) {
    this.req = req;
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.copy(HOME_CAM);
    this.camera.lookAt(HOME_LOOK);
    this.buildArena();

    this.playerBB = new Billboard(creatureKey('emberling', 'back'), 2.6, 2.6);
    this.foeBB = new Billboard(creatureKey('emberling', 'front'), 2.2, 2.2);
    this.playerBB.mesh.visible = false;
    this.foeBB.mesh.visible = false;
    this.scene.add(this.playerBB.mesh, this.foeBB.mesh);

    this.foePanel = this.buildPanel(8, 10, false);
    this.playerPanel = this.buildPanel(264, 152, true);

    this.engine = new BattleEngine(
      {
        kind: req.kind,
        playerParty: getState().party,
        foeParty: req.foeParty,
        foeName: req.foeName,
        foeIsSmart: req.foeIsSmart,
        canRun: req.canRun,
        canCatch: req.canCatch,
      },
      gameRNG,
    );
  }

  // ------------------------------------------------------------- stage

  private buildArena(): void {
    const biome = this.req.biome;
    const sky = BIOME_SKY[biome];
    this.scene.background = new THREE.Color(sky);
    this.scene.fog = new THREE.Fog(sky, 18, 45);

    const floorTex = new THREE.CanvasTexture(spriteCanvas(tileKey(BIOME_FLOOR[biome])));
    floorTex.magFilter = THREE.NearestFilter;
    floorTex.minFilter = THREE.NearestFilter;
    floorTex.colorSpace = THREE.SRGBColorSpace;
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(7, 7);

    const platGeo = new THREE.CylinderGeometry(5.6, 6.4, 1.4, 28);
    const platMat = [
      new THREE.MeshLambertMaterial({ color: 0x3a3a48 }),
      new THREE.MeshLambertMaterial({ map: floorTex }),
      new THREE.MeshLambertMaterial({ color: 0x2a2a36 }),
    ];
    const platform = new THREE.Mesh(platGeo, platMat);
    platform.position.y = -0.7;
    platform.receiveShadow = true;
    this.scene.add(platform);
    this.disposables.push(platGeo, floorTex, ...platMat);

    // floating rocks drifting in the sky for depth
    const rockGeo = new THREE.DodecahedronGeometry(0.6);
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x44485c });
    for (let i = 0; i < 7; i++) {
      const rock = new THREE.Mesh(rockGeo, rockMat);
      const a = (i / 7) * Math.PI * 2;
      rock.position.set(Math.cos(a) * (9 + (i % 3)), -1.5 + (i % 4) * 1.6, Math.sin(a) * (9 + ((i * 2) % 4)));
      rock.scale.setScalar(0.7 + (i % 3) * 0.5);
      this.scene.add(rock);
    }
    this.disposables.push(rockGeo, rockMat);

    const ambient = new THREE.AmbientLight(0xffffff, biome === 'cave' || biome === 'dark' ? 0.6 : 0.85);
    const key = new THREE.DirectionalLight(0xfff4e0, 0.9);
    key.position.set(6, 10, 6);
    key.castShadow = true;
    this.scene.add(ambient, key);
  }

  private buildPanel(x: number, y: number, mine: boolean): DomPanel {
    const w = 208;
    const h = mine ? 66 : 50;
    const root = panel(x, y, w, h);
    this.domBits.push(root);
    const name = label(root, 10, 5, '');
    const level = label(root, 0, 5, '', 'small');
    level.style.left = 'auto';
    level.style.right = '12px';
    const status = label(root, 10, 21, '', 'small gold');
    label(root, 10, 34, 'HP', 'small dim');
    const barX = 32;
    const barW = w - 44;
    const barBg = el('div', 'bar-bg', root);
    barBg.style.cssText += `left:${barX}px;top:37px;width:${barW}px;height:7px;`;
    const hpBar = el('div', 'bar', barBg);
    hpBar.style.background = '#48c858';
    let hpText: HTMLDivElement | undefined;
    let expBar: HTMLDivElement | undefined;
    if (mine) {
      hpText = label(root, 0, 46, '', 'small');
      hpText.style.left = 'auto';
      hpText.style.right = '12px';
      const expBg = el('div', 'bar-bg', root);
      expBg.style.cssText += `left:${barX}px;top:${h - 9}px;width:${barW}px;height:4px;`;
      expBar = el('div', 'bar', expBg);
      expBar.style.background = '#58a8e8';
      expBar.style.width = '0%';
    }
    return { root, name, level, status, hpBar, hpText, expBar };
  }

  private setPanel(side: Side, c: CreatureInstance): void {
    const p = side === 'player' ? this.playerPanel : this.foePanel;
    const max = calcStats(c).hp;
    p.name.textContent = displayName(c);
    p.level.textContent = `Lv${c.level}`;
    p.status.textContent = c.status ? STATUS_LABELS[c.status] : '';
    const frac = Math.max(0, c.hp / max);
    p.hpBar.style.width = `${frac * 100}%`;
    p.hpBar.style.background = hpColor(frac);
    if (p.hpText) p.hpText.textContent = `${c.hp}/${max}`;
    this.updateExpBar(c);
  }

  private updateExpBar(c: CreatureInstance): void {
    const p = this.playerPanel;
    if (!p.expBar) return;
    const sp = speciesById(c.speciesId);
    const cur = totalExpFor(sp.growth, c.level);
    const next = totalExpFor(sp.growth, Math.min(100, c.level + 1));
    const frac = next > cur ? Math.min(1, (c.exp - cur) / (next - cur)) : 1;
    p.expBar.style.width = `${frac * 100}%`;
  }

  private bb(side: Side): Billboard {
    return side === 'player' ? this.playerBB : this.foeBB;
  }

  private pos(side: Side): THREE.Vector3 {
    return side === 'player' ? PLAYER_POS : FOE_POS;
  }

  // ------------------------------------------------------------- render

  /** per-frame: billboards face camera; idle bob; screen shake */
  update(dt: number): void {
    const t = performance.now() / 1000;
    if (this.playerBB.mesh.visible) this.playerBB.mesh.position.y = 1.32 + Math.sin(t * 2.1) * 0.05;
    if (this.foeBB.mesh.visible) this.foeBB.mesh.position.y = 1.12 + Math.sin(t * 2.4 + 1) * 0.05;
    this.playerBB.update(this.camera.position);
    this.foeBB.update(this.camera.position);
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      this.camera.position.copy(this.camBase).add(
        new THREE.Vector3((Math.random() - 0.5) * 0.16, (Math.random() - 0.5) * 0.16, 0),
      );
    } else {
      this.camera.position.copy(this.camBase);
    }
    this.camera.lookAt(this.camLook);
  }

  onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  private async cutCamera(to: THREE.Vector3, look: THREE.Vector3, ms = 0): Promise<void> {
    if (ms === 0) {
      this.camBase.copy(to);
      this.camLook.copy(look);
      return;
    }
    const fromPos = this.camBase.clone();
    const fromLook = this.camLook.clone();
    await tween(ms, (k) => {
      const e = 1 - (1 - k) ** 3;
      this.camBase.lerpVectors(fromPos, to, e);
      this.camLook.lerpVectors(fromLook, look, e);
    });
  }

  // ------------------------------------------------------------- main loop

  async run(): Promise<BattleOutcome> {
    audio.playMusic(this.req.music);
    await this.cutCamera(HOME_CAM, HOME_LOOK, 600);
    await this.playEvents(this.engine.start());
    while (!this.engine.ended) {
      if (this.engine.awaitingPlayerSwitch) {
        const idx = await this.choosePartyMember('Send out which creature?', false);
        await this.playEvents(this.engine.resolveSwitch(idx ?? this.firstAlive()));
        continue;
      }
      const action = await this.chooseAction();
      if (action === null) continue;
      await this.playEvents(this.engine.executeTurn(action));
    }
    return this.finish();
  }

  private firstAlive(): number {
    return getState().party.findIndex((c) => c.hp > 0);
  }

  private async chooseAction(): Promise<Parameters<BattleEngine['executeTurn']>[0] | null> {
    const active = this.engine.player.creature;
    await this.dialog.show(`What will ${displayName(active)} do?`, { holdLastPage: true });
    const menu = new ListMenu(
      [{ label: 'FIGHT' }, { label: 'BAG' }, { label: 'TEAM' }, { label: this.req.canRun ? 'RUN' : 'RUN ✕' }],
      { x: GAME_W - 130, y: GAME_H - 172, width: 122 },
    );
    const pick = await menu.choose();
    if (pick === null) return null;
    switch (pick) {
      case 0:
        return this.chooseMove();
      case 1:
        return this.chooseBagAction();
      case 2: {
        const idx = await this.choosePartyMember('Switch to which creature?', true);
        if (idx === null) return null;
        return { type: 'switch', partyIndex: idx };
      }
      case 3:
        if (!this.req.canRun) {
          await this.dialog.show("You can't run from a trainer battle!");
          return null;
        }
        return { type: 'run' };
    }
    return null;
  }

  private async chooseMove(): Promise<Parameters<BattleEngine['executeTurn']>[0] | null> {
    const c = this.engine.player.creature;
    if (c.moves.every((m) => m.pp <= 0)) {
      await this.dialog.show(`${displayName(c)} has no moves left... it must Struggle!`);
      return { type: 'move', moveIndex: -1 };
    }
    const info = label(null, 12, GAME_H - 172, '', 'small blue');
    info.style.whiteSpace = 'pre';
    this.domBits.push(info);
    const items = c.moves.map((m) => {
      const mv = moveById(m.id);
      return { label: mv.name, rightLabel: `${m.pp}/${mv.pp}`, disabled: m.pp <= 0 };
    });
    const menu = new ListMenu(items, {
      x: GAME_W - 200,
      y: GAME_H - 78 - items.length * 18 - 20,
      width: 192,
      onHover: (i) => {
        const mv = moveById(c.moves[i].id);
        info.textContent = `${mv.typeless ? 'Basic' : TYPE_NAMES[mv.type]} · ${mv.category.toUpperCase()}\nPower ${mv.power || '—'} · Acc ${mv.accuracy || '—'}\n${mv.desc}`;
      },
    });
    const pick = await menu.choose();
    info.remove();
    if (pick === null) return null;
    return { type: 'move', moveIndex: pick };
  }

  private async chooseBagAction(): Promise<Parameters<BattleEngine['executeTurn']>[0] | null> {
    const s = getState();
    const usable = Object.entries(s.bag)
      .filter(([id]) => {
        const e = ITEMS[id]?.effect;
        return e && (e.kind === 'ball' || e.kind === 'healHp' || e.kind === 'cureStatus' || e.kind === 'fullRestore' || e.kind === 'revive' || e.kind === 'restorePp');
      })
      .map(([id, qty]) => ({ id, qty }));
    if (usable.length === 0) {
      await this.dialog.show('You have no usable items!');
      return null;
    }
    const menu = new ListMenu(usable.map((u) => ({ label: ITEMS[u.id].name, rightLabel: `×${u.qty}` })), {
      x: GAME_W - 210,
      y: 40,
      width: 200,
      visibleRows: 8,
      title: 'BAG',
    });
    const pick = await menu.choose();
    if (pick === null) return null;
    const itemId = usable[pick].id;
    const item = itemById(itemId);

    if (item.effect.kind === 'ball') {
      if (!this.req.canCatch) {
        await this.dialog.show("You can't catch another trainer's creature!");
        return null;
      }
      removeFromBag(itemId, 1);
      return { type: 'ball', ballId: itemId };
    }

    const idx = await this.choosePartyMember(`Use ${item.name} on whom?`, true, true);
    if (idx === null) return null;
    const target = s.party[idx];
    const result = applyItemToCreature(target, itemId);
    await this.dialog.show(result.message);
    if (!result.used) return null;
    removeFromBag(itemId, 1);
    if (target === this.engine.player.creature) this.setPanel('player', target);
    return { type: 'item' };
  }

  private async choosePartyMember(title: string, cancellable: boolean, allowAny = false): Promise<number | null> {
    const s = getState();
    const items = s.party.map((c) => {
      const max = calcStats(c).hp;
      const isActive = c === this.engine.player.creature;
      return {
        label: `${displayName(c)} Lv${c.level}`,
        rightLabel: `${c.hp}/${max}${isActive ? ' ◄' : ''}`,
        disabled: allowAny ? false : c.hp <= 0 || isActive,
      };
    });
    const menu = new ListMenu(items, { x: 24, y: 40, width: 250, visibleRows: 6, title });
    const pick = await menu.choose();
    if (pick === null) {
      if (cancellable) return null;
      return this.choosePartyMember(title, cancellable, allowAny);
    }
    return pick;
  }

  // ------------------------------------------------------------- playback

  private async playEvents(events: BattleEvent[]): Promise<void> {
    for (const ev of events) {
      switch (ev.t) {
        case 'text':
          await this.dialog.show(ev.msg, { autoMs: 1100 });
          break;
        case 'switch':
          await this.animSwitch(ev.side, ev.speciesId);
          break;
        case 'hp':
          await this.animHp(ev.side, ev.hp, ev.maxHp);
          break;
        case 'moveAnim':
          await this.animMove(ev.side, TYPE_COLORS[ev.moveType]);
          break;
        case 'effectiveness':
          audio.sfxHit(ev.mult);
          break;
        case 'crit':
          this.shakeTime = 0.25;
          break;
        case 'status': {
          const c = ev.side === 'player' ? this.engine.player.creature : this.engine.foe.creature;
          (ev.side === 'player' ? this.playerPanel : this.foePanel).status.textContent = c.status ? STATUS_LABELS[c.status] : '';
          break;
        }
        case 'stat': {
          await this.statFlash(ev.side, ev.delta > 0 ? 0xfff0a0 : 0xa0c0ff);
          break;
        }
        case 'faint':
          await this.animFaint(ev.side);
          break;
        case 'ballThrow':
          await this.animBall(ev.shakes, ev.caught);
          break;
        case 'exp': {
          const c = getState().party.find((p) => p.uid === ev.uid);
          if (c && c === this.engine.player.creature) this.updateExpBar(c);
          break;
        }
        case 'levelup': {
          audio.sfxLevelUp();
          this.leveledUids.add(ev.uid);
          const c = getState().party.find((p) => p.uid === ev.uid);
          if (c && c === this.engine.player.creature) this.setPanel('player', c);
          break;
        }
        case 'learnMove':
          await this.handleLearnMove(ev.uid, ev.moveId);
          break;
        case 'end':
          break;
      }
    }
  }

  private async animSwitch(side: Side, speciesId: string): Promise<void> {
    const c = side === 'player' ? this.engine.player.creature : this.engine.foe.creature;
    const bb = this.bb(side);
    bb.setSprite(creatureKey(speciesId, side === 'player' ? 'back' : 'front', c.shiny));
    bb.mesh.visible = true;
    bb.mesh.position.copy(this.pos(side)).setY(1.2);
    this.setPanel(side, c);
    audio.playCry(speciesId);
    const target = side === 'player' ? 1 : 0.88;
    await tween(320, (k) => {
      const e = 1 - (1 - k) ** 2;
      bb.mesh.scale.setScalar(0.15 + e * (target - 0.15));
      (bb.mesh.material as THREE.Material).opacity = e;
    });
    bb.mesh.scale.setScalar(target);
  }

  private animHp(side: Side, hp: number, maxHp: number): Promise<void> {
    const p = side === 'player' ? this.playerPanel : this.foePanel;
    const from = parseFloat(p.hpBar.style.width) / 100 || 0;
    const to = Math.max(0, hp / maxHp);
    if (p.hpText) p.hpText.textContent = `${hp}/${maxHp}`;
    return tween(360, (k) => {
      const e = 1 - (1 - k) ** 3;
      const frac = from + (to - from) * e;
      p.hpBar.style.width = `${frac * 100}%`;
      p.hpBar.style.background = hpColor(frac);
    });
  }

  private async animMove(side: Side, color: number): Promise<void> {
    const attacker = this.bb(side);
    const defender = this.bb(side === 'player' ? 'foe' : 'player');
    const defPos = this.pos(side === 'player' ? 'foe' : 'player');

    // camera cut behind the attacker's shoulder
    const atkPos = this.pos(side);
    const behind = atkPos.clone().sub(defPos).normalize().multiplyScalar(3.4).add(atkPos);
    behind.y = 2.0;
    await this.cutCamera(behind, defPos.clone().setY(1.2), 180);

    // lunge
    const home = atkPos.clone();
    const lunge = defPos.clone().sub(atkPos).multiplyScalar(0.32).add(atkPos);
    await tween(150, (k) => {
      const e = Math.sin(k * Math.PI);
      attacker.mesh.position.x = home.x + (lunge.x - home.x) * e;
      attacker.mesh.position.z = home.z + (lunge.z - home.z) * e;
    });
    attacker.mesh.position.x = home.x;
    attacker.mesh.position.z = home.z;

    // impact burst on defender
    audio.sfxHit(1);
    this.burst(defPos.clone().setY(1.2), color);
    this.shakeTime = 0.18;
    const defHome = defPos.clone();
    await tween(180, (k) => {
      defender.mesh.position.x = defHome.x + Math.sin(k * Math.PI * 4) * 0.12;
    });
    defender.mesh.position.x = defHome.x;

    await this.cutCamera(HOME_CAM, HOME_LOOK, 260);
  }

  private burst(at: THREE.Vector3, color: number): void {
    const mat = new THREE.SpriteMaterial({ color, depthWrite: false });
    const sprites: THREE.Sprite[] = [];
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Sprite(mat);
      s.scale.setScalar(0.16);
      s.position.copy(at);
      this.scene.add(s);
      sprites.push(s);
    }
    void tween(320, (k) => {
      sprites.forEach((s, i) => {
        const a = (Math.PI * 2 * i) / sprites.length;
        s.position.set(at.x + Math.cos(a) * k * 1.2, at.y + Math.sin(a) * k * 0.9, at.z + Math.cos(a + 1) * k * 0.5);
        mat.opacity = 1 - k;
      });
    }).then(() => {
      for (const s of sprites) this.scene.remove(s);
      mat.dispose();
    });
  }

  private async statFlash(side: Side, color: number): Promise<void> {
    const bb = this.bb(side);
    const mat = bb.mesh.material as THREE.MeshBasicMaterial;
    mat.color.setHex(color);
    await sleep(140);
    mat.color.setHex(0xffffff);
  }

  private async animFaint(side: Side): Promise<void> {
    const c = side === 'player' ? this.engine.player.creature : this.engine.foe.creature;
    audio.playCry(c.speciesId);
    audio.sfxFaint();
    const bb = this.bb(side);
    const mat = bb.mesh.material as THREE.MeshBasicMaterial;
    const y0 = bb.mesh.position.y;
    await tween(420, (k) => {
      bb.mesh.position.y = y0 - k * 0.9;
      mat.opacity = 1 - k;
    });
    bb.mesh.visible = false;
    mat.opacity = 1;
    bb.mesh.position.y = y0;
  }

  private async animBall(shakes: number, caught: boolean): Promise<void> {
    audio.sfxThrow();
    const ballMat = new THREE.SpriteMaterial({ map: spriteTexture('ui/basicball') });
    const ball = new THREE.Sprite(ballMat);
    ball.scale.setScalar(0.5);
    ball.position.copy(PLAYER_POS).setY(1.2);
    this.scene.add(ball);

    const from = ball.position.clone();
    const to = FOE_POS.clone().setY(1.1);
    await tween(450, (k) => {
      ball.position.lerpVectors(from, to, k);
      ball.position.y += Math.sin(k * Math.PI) * 1.6;
    });

    const foeMat = this.foeBB.mesh.material as THREE.MeshBasicMaterial;
    await tween(240, (k) => {
      this.foeBB.mesh.scale.setScalar(0.88 * (1 - k * 0.95));
      foeMat.opacity = 1 - k * 0.6;
    });
    this.foeBB.mesh.visible = false;
    foeMat.opacity = 1;
    this.foeBB.mesh.scale.setScalar(0.88);

    ball.position.y = 0.25;
    for (let i = 0; i < Math.min(3, shakes); i++) {
      await sleep(380);
      audio.sfxBallShake();
      await tween(180, (k) => {
        ball.material.rotation = Math.sin(k * Math.PI * 2) * 0.4;
      });
      ball.material.rotation = 0;
    }
    await sleep(320);
    if (caught) {
      audio.sfxCatch();
      ballMat.color.setHex(0x9098a8);
      this.burst(ball.position.clone().setY(0.6), 0xf0d048);
      await sleep(500);
    } else {
      this.scene.remove(ball);
      ballMat.dispose();
      this.foeBB.mesh.visible = true;
      await tween(200, (k) => {
        this.foeBB.mesh.scale.setScalar(0.05 + k * 0.83);
      });
      return;
    }
    this.scene.remove(ball);
    ballMat.dispose();
  }

  private async handleLearnMove(uid: string, moveId: string): Promise<void> {
    const c = getState().party.find((p) => p.uid === uid);
    if (!c || c.moves.some((m) => m.id === moveId)) return;
    const mv = moveById(moveId);
    if (c.moves.length < 4) {
      c.moves.push({ id: moveId, pp: mv.pp });
      await this.dialog.show(`${displayName(c)} learned ${mv.name}!`);
      return;
    }
    await this.dialog.show(`${displayName(c)} wants to learn ${mv.name}, but it already knows four moves.\nForget an old move?`, { holdLastPage: true });
    const items = [
      ...c.moves.map((m) => {
        const old = moveById(m.id);
        return { label: old.name, rightLabel: `${TYPE_NAMES[old.type]}` };
      }),
      { label: `Give up on ${mv.name}` },
    ];
    const menu = new ListMenu(items, { x: GAME_W - 230, y: 60, width: 220, title: 'Forget which move?' });
    const pick = await menu.choose();
    this.dialog.hide();
    if (pick === null || pick === 4) {
      await this.dialog.show(`${displayName(c)} did not learn ${mv.name}.`);
      return;
    }
    const old = moveById(c.moves[pick].id);
    c.moves[pick] = { id: moveId, pp: mv.pp };
    await this.dialog.show(`${displayName(c)} forgot ${old.name}...\n...and learned ${mv.name}!`);
  }

  // ------------------------------------------------------------- ending

  private async finish(): Promise<BattleOutcome> {
    const outcome = (this.engine.outcome ?? 'fled') as BattleOutcome;
    const s = getState();

    if (outcome === 'win' && this.req.kind === 'trainer' && this.req.payBase) {
      audio.playMusic('victory');
      const prize = this.req.payBase * Math.max(...this.req.foeParty.map((c) => c.level));
      s.player.money += prize;
      await this.dialog.show(`You defeated ${this.req.foeName}!\nYou got ₽${prize} for winning!`);
    }

    if (outcome === 'caught' && this.engine.capturedCreature) {
      audio.playMusic('victory');
      const c = this.engine.capturedCreature;
      c.ot = 'player';
      markCaught(c.speciesId);
      const sp = speciesById(c.speciesId);
      await this.dialog.show(`${sp.name}'s data was recorded in the Compendium!`);
      await this.dialog.show(`Give ${sp.name} a nickname?`, { holdLastPage: true });
      if (await confirmMenu()) {
        try {
          const nick = window.prompt(`Nickname for ${sp.name}:`, '')?.trim().slice(0, 12);
          if (nick) c.nickname = nick;
        } catch {
          /* prompt unavailable */
        }
      }
      this.dialog.hide();
      const where = addCreature(c);
      if (where === 'box') await this.dialog.show(`${displayName(c)} was sent to box storage.`);
      else if (where === 'lost') await this.dialog.show('All boxes are full! It was released...');
    }

    for (const c of s.party) {
      if (!this.leveledUids.has(c.uid)) continue;
      const into = levelEvolution(c);
      if (into) await this.runEvolution(c, into);
    }
    return outcome;
  }

  private async runEvolution(c: CreatureInstance, into: string): Promise<void> {
    await this.dialog.show(`What?! ${displayName(c)} is evolving!`, { holdLastPage: true });
    audio.sfxEvolve();
    const overlay = el('div', 'evolve-flash');
    const img = document.createElement('canvas');
    const paint = (id: string) => {
      const src = spriteCanvas(creatureKey(id, 'front', c.shiny));
      img.width = src.width;
      img.height = src.height;
      const ctx = img.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(src, 0, 0);
    };
    paint(c.speciesId);
    img.className = 'evolve-img';
    overlay.appendChild(img);
    for (let i = 0; i < 3; i++) {
      overlay.style.background = 'rgba(255,255,255,0.85)';
      await sleep(240);
      overlay.style.background = 'rgba(255,255,255,0)';
      await sleep(240);
    }
    const oldName = displayName(c);
    evolve(c, into);
    markCaught(into);
    paint(into);
    audio.playCry(into);
    await sleep(300);
    overlay.remove();
    const newName = speciesById(into).name;
    await this.dialog.show(`${oldName} evolved into ${newName}!`);
    for (const moveId of movesAtLevel(into, c.level).filter((id) => !c.moves.some((m) => m.id === id))) {
      const learnLevel = speciesById(into).learnset.find(([, id]) => id === moveId)?.[0];
      if (learnLevel === c.level) await this.handleLearnMove(c.uid, moveId);
    }
  }

  dispose(): void {
    this.dialog.destroy();
    for (const d of this.domBits) d.remove();
    for (const d of this.disposables) d.dispose();
    this.playerBB.dispose();
    this.foeBB.dispose();
  }
}
