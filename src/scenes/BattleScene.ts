/**
 * BattleScene — the visual layer over the pure battle engine: animated
 * HP/EXP bars, move effects, catching, EXP/level-ups, move learning,
 * and post-battle evolutions.
 */
import Phaser from 'phaser';
import { BattleEngine, type BattleEvent, type Side, STATUS_LABELS } from '../engine/battle';
import { calcStats, displayName, evolve, levelEvolution, type CreatureInstance } from '../engine/creature';
import { movesAtLevel } from '../data/species';
import { applyItemToCreature } from '../engine/itemUse';
import { getState, addCreature, removeFromBag, markCaught, type GameState } from '../engine/state';
import { speciesById } from '../data/species';
import { moveById } from '../data/moves';
import { itemById, ITEMS } from '../data/items';
import { totalExpFor } from '../data/growth';
import { TYPE_NAMES, TYPE_COLORS } from '../data/types';
import { gameRNG } from '../core/rng';
import { audio, type TrackId } from '../audio/audio';
import { creatureKey } from '../render/assets';
import { DialogBox, ListMenu, confirmMenu, GAME_W, GAME_H, UI_FONT, UI_FONT_SMALL, drawWindow, hpColor, sleep } from '../ui/ui';

export interface BattleRequest {
  kind: 'wild' | 'trainer';
  foeParty: CreatureInstance[];
  foeName?: string;
  foeIsSmart?: boolean;
  payBase?: number;
  canCatch: boolean;
  canRun: boolean;
  music: TrackId;
}

export type BattleOutcome = 'win' | 'loss' | 'fled' | 'caught';

interface InfoPanel {
  name: Phaser.GameObjects.Text;
  level: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
  hpBar: Phaser.GameObjects.Rectangle;
  hpBarW: number;
  hpText?: Phaser.GameObjects.Text;
  expBar?: Phaser.GameObjects.Rectangle;
  expBarW?: number;
}

export class BattleScene extends Phaser.Scene {
  private req!: BattleRequest;
  private resolveOutcome!: (o: BattleOutcome) => void;
  private engine!: BattleEngine;
  private dialog!: DialogBox;
  private foeSprite!: Phaser.GameObjects.Image;
  private playerSprite!: Phaser.GameObjects.Image;
  private foePanel!: InfoPanel;
  private playerPanel!: InfoPanel;
  private leveledUids = new Set<string>();

  constructor() {
    super('battle');
  }

  init(data: { req: BattleRequest; resolve: (o: BattleOutcome) => void }): void {
    this.req = data.req;
    this.resolveOutcome = data.resolve;
  }

  create(): void {
    audio.playMusic(this.req.music);
    this.leveledUids.clear();
    this.buildStage();
    this.dialog = new DialogBox(this);
    this.engine = new BattleEngine(
      {
        kind: this.req.kind,
        playerParty: getState().party,
        foeParty: this.req.foeParty,
        foeName: this.req.foeName,
        foeIsSmart: this.req.foeIsSmart,
        canRun: this.req.canRun,
        canCatch: this.req.canCatch,
      },
      gameRNG,
    );
    this.cameras.main.fadeIn(250, 8, 8, 16);
    void this.run();
  }

  // ------------------------------------------------------------- stage

  private buildStage(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(0x284868, 0x284868, 0x101820, 0x101820, 1);
    g.fillRect(0, 0, GAME_W, GAME_H - 80);
    g.fillStyle(0x101828, 1);
    g.fillRect(0, GAME_H - 80, GAME_W, 80);
    // platforms
    g.fillStyle(0x1c3048, 1);
    g.fillEllipse(352, 128, 170, 44);
    g.fillEllipse(120, 226, 190, 50);

    this.foeSprite = this.add.image(352, 96, '__DEFAULT').setVisible(false);
    this.playerSprite = this.add.image(120, 180, '__DEFAULT').setVisible(false).setScale(1.45);

    this.foePanel = this.buildPanel(8, 10, false);
    this.playerPanel = this.buildPanel(264, 152, true);
  }

  private buildPanel(x: number, y: number, mine: boolean): InfoPanel {
    const w = 208;
    const h = mine ? 66 : 50;
    const g = this.add.graphics();
    drawWindow(g, x, y, w, h);
    const name = this.add.text(x + 10, y + 7, '', UI_FONT);
    const level = this.add.text(x + w - 12, y + 7, '', UI_FONT_SMALL).setOrigin(1, 0);
    const status = this.add.text(x + 10, y + 23, '', { ...UI_FONT_SMALL, color: '#f0d048' });
    this.add.text(x + 10, y + 27 + 8, 'HP', { ...UI_FONT_SMALL, color: '#a8b8d0' });
    const barX = x + 32;
    const barW = w - 44;
    this.add.rectangle(barX, y + 27 + 10, barW, 7, 0x283040).setOrigin(0, 0);
    const hpBar = this.add.rectangle(barX, y + 27 + 10, barW, 7, 0x48c858).setOrigin(0, 0);
    let hpText: Phaser.GameObjects.Text | undefined;
    let expBar: Phaser.GameObjects.Rectangle | undefined;
    if (mine) {
      hpText = this.add.text(x + w - 12, y + 30 + 16, '', UI_FONT_SMALL).setOrigin(1, 0);
      this.add.rectangle(barX, y + h - 9, barW, 4, 0x283040).setOrigin(0, 0);
      expBar = this.add.rectangle(barX, y + h - 9, 0, 4, 0x58a8e8).setOrigin(0, 0);
    }
    return { name, level, status, hpBar, hpBarW: barW, hpText, expBar, expBarW: barW };
  }

  private setPanel(side: Side, c: CreatureInstance): void {
    const panel = side === 'player' ? this.playerPanel : this.foePanel;
    const max = calcStats(c).hp;
    panel.name.setText(displayName(c));
    panel.level.setText(`Lv${c.level}`);
    panel.status.setText(c.status ? STATUS_LABELS[c.status] : '');
    const frac = Math.max(0, c.hp / max);
    panel.hpBar.width = panel.hpBarW * frac;
    panel.hpBar.fillColor = hpColor(frac);
    panel.hpText?.setText(`${c.hp}/${max}`);
    this.updateExpBar(c);
  }

  private updateExpBar(c: CreatureInstance): void {
    const panel = this.playerPanel;
    if (!panel.expBar) return;
    const sp = speciesById(c.speciesId);
    const cur = totalExpFor(sp.growth, c.level);
    const next = totalExpFor(sp.growth, Math.min(100, c.level + 1));
    const frac = next > cur ? Math.min(1, (c.exp - cur) / (next - cur)) : 1;
    panel.expBar.width = (panel.expBarW ?? 0) * frac;
  }

  private sprite(side: Side): Phaser.GameObjects.Image {
    return side === 'player' ? this.playerSprite : this.foeSprite;
  }

  // ------------------------------------------------------------- main loop

  private async run(): Promise<void> {
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
    await this.finish();
  }

  private firstAlive(): number {
    return getState().party.findIndex((c) => c.hp > 0);
  }

  private async chooseAction(): Promise<Parameters<BattleEngine['executeTurn']>[0] | null> {
    const active = this.engine.player.creature;
    await this.dialog.show(`What will ${displayName(active)} do?`, { holdLastPage: true });
    const menu = new ListMenu(this, [
      { label: 'FIGHT' },
      { label: 'BAG' },
      { label: 'TEAM' },
      { label: this.req.canRun ? 'RUN' : 'RUN ✕', disabled: !this.req.canRun && false },
    ], { x: GAME_W - 130, y: GAME_H - 172, width: 122 });
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
    const info = this.add.text(12, GAME_H - 172, '', { ...UI_FONT_SMALL, color: '#a8c0e8' }).setDepth(1300);
    const items = c.moves.map((m) => {
      const mv = moveById(m.id);
      return { label: mv.name, rightLabel: `${m.pp}/${mv.pp}`, disabled: m.pp <= 0 };
    });
    const menu = new ListMenu(this, items, {
      x: GAME_W - 200,
      y: GAME_H - 78 - items.length * 18 - 20,
      width: 192,
      onHover: (i) => {
        const mv = moveById(c.moves[i].id);
        info.setText(`${mv.typeless ? 'Basic' : TYPE_NAMES[mv.type]} · ${mv.category.toUpperCase()}\nPower ${mv.power || '—'} · Acc ${mv.accuracy || '—'}\n${mv.desc}`);
      },
    });
    const pick = await menu.choose();
    info.destroy();
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
    const menu = new ListMenu(this, usable.map((u) => ({ label: ITEMS[u.id].name, rightLabel: `×${u.qty}` })), {
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
    const items = s.party.map((c, i) => {
      const max = calcStats(c).hp;
      const isActive = c === this.engine.player.creature;
      return {
        label: `${displayName(c)} Lv${c.level}`,
        rightLabel: `${c.hp}/${max}${isActive ? ' ◄' : ''}`,
        disabled: allowAny ? false : c.hp <= 0 || isActive,
      };
    });
    const menu = new ListMenu(this, items, { x: 24, y: 40, width: 250, visibleRows: 6, title });
    while (true) {
      const pick = await menu.choose();
      if (pick === null) {
        if (cancellable) return null;
        // forced switch: rebuild and retry
        return this.choosePartyMember(title, cancellable, allowAny);
      }
      return pick;
    }
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
          this.cameras.main.shake(160, 0.012);
          break;
        case 'status': {
          const c = ev.side === 'player' ? this.engine.player.creature : this.engine.foe.creature;
          (ev.side === 'player' ? this.playerPanel : this.foePanel).status.setText(c.status ? STATUS_LABELS[c.status] : '');
          break;
        }
        case 'stat':
          this.sprite(ev.side).setTintFill(ev.delta > 0 ? 0xfff0a0 : 0xa0c0ff);
          await sleep(this, 120);
          this.sprite(ev.side).clearTint();
          break;
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

  private animSwitch(side: Side, speciesId: string): Promise<void> {
    return new Promise((resolve) => {
      const c = side === 'player' ? this.engine.player.creature : this.engine.foe.creature;
      const spr = this.sprite(side);
      spr.setTexture(creatureKey(speciesId, side === 'player' ? 'back' : 'front', c.shiny));
      spr.setVisible(true).setAlpha(0).setScale(side === 'player' ? 0.4 : 0.3);
      spr.y = side === 'player' ? 180 : 96;
      spr.clearTint();
      this.setPanel(side, c);
      audio.playCry(speciesId);
      this.tweens.add({
        targets: spr,
        alpha: 1,
        scale: side === 'player' ? 1.45 : 1.05,
        duration: 320,
        ease: 'Back.easeOut',
        onComplete: () => resolve(),
      });
    });
  }

  private animHp(side: Side, hp: number, maxHp: number): Promise<void> {
    return new Promise((resolve) => {
      const panel = side === 'player' ? this.playerPanel : this.foePanel;
      const frac = Math.max(0, hp / maxHp);
      this.tweens.add({
        targets: panel.hpBar,
        width: panel.hpBarW * frac,
        duration: 360,
        ease: 'Cubic.easeOut',
        onUpdate: () => {
          panel.hpBar.fillColor = hpColor(panel.hpBar.width / panel.hpBarW);
        },
        onComplete: () => resolve(),
      });
      panel.hpText?.setText(`${hp}/${maxHp}`);
    });
  }

  private animMove(side: Side, color: number): Promise<void> {
    return new Promise((resolve) => {
      const attacker = this.sprite(side);
      const defender = this.sprite(side === 'player' ? 'foe' : 'player');
      const dx = side === 'player' ? 26 : -26;
      this.tweens.add({
        targets: attacker,
        x: attacker.x + dx,
        duration: 110,
        yoyo: true,
        ease: 'Quad.easeOut',
        onComplete: () => {
          // impact burst on defender
          for (let i = 0; i < 8; i++) {
            const p = this.add.rectangle(defender.x, defender.y, 5, 5, color).setDepth(50);
            const a = (Math.PI * 2 * i) / 8;
            this.tweens.add({
              targets: p,
              x: defender.x + Math.cos(a) * 36,
              y: defender.y + Math.sin(a) * 30,
              alpha: 0,
              duration: 260,
              onComplete: () => p.destroy(),
            });
          }
          defender.setTintFill(0xffffff);
          this.tweens.add({
            targets: defender,
            x: defender.x + (side === 'player' ? 8 : -8),
            duration: 60,
            yoyo: true,
            repeat: 2,
            onComplete: () => {
              defender.clearTint();
              resolve();
            },
          });
        },
      });
    });
  }

  private animFaint(side: Side): Promise<void> {
    return new Promise((resolve) => {
      const c = side === 'player' ? this.engine.player.creature : this.engine.foe.creature;
      audio.playCry(c.speciesId);
      audio.sfxFaint();
      const spr = this.sprite(side);
      this.tweens.add({
        targets: spr,
        y: spr.y + 36,
        alpha: 0,
        duration: 420,
        ease: 'Quad.easeIn',
        onComplete: () => {
          spr.setVisible(false).setAlpha(1).setY(spr.y - 36);
          resolve();
        },
      });
    });
  }

  private async animBall(shakes: number, caught: boolean): Promise<void> {
    audio.sfxThrow();
    const ball = this.add.image(120, 200, 'ui/basicball').setDepth(60);
    await new Promise<void>((resolve) => {
      this.tweens.add({ targets: ball, x: this.foeSprite.x, duration: 450, ease: 'Sine.easeOut', onComplete: () => resolve() });
      this.tweens.add({ targets: ball, y: this.foeSprite.y - 60, duration: 225, ease: 'Quad.easeOut' });
      this.tweens.add({ targets: ball, y: this.foeSprite.y, duration: 225, delay: 225, ease: 'Quad.easeIn' });
    });
    // creature sucked in
    await new Promise<void>((resolve) => {
      this.tweens.add({ targets: this.foeSprite, scale: 0.05, alpha: 0.4, duration: 240, onComplete: () => resolve() });
    });
    this.foeSprite.setVisible(false);
    for (let i = 0; i < Math.min(3, shakes); i++) {
      await sleep(this, 380);
      audio.sfxBallShake();
      await new Promise<void>((resolve) => {
        this.tweens.add({ targets: ball, angle: 18, duration: 90, yoyo: true, repeat: 1, onComplete: () => { ball.setAngle(0); resolve(); } });
      });
    }
    await sleep(this, 320);
    if (caught) {
      audio.sfxCatch();
      ball.setTint(0x9098a8);
      for (let i = 0; i < 3; i++) {
        const star = this.add.text(ball.x - 18 + i * 18, ball.y - 22, '✦', { ...UI_FONT, color: '#f0d048' }).setDepth(61);
        this.tweens.add({ targets: star, y: star.y - 12, alpha: 0, duration: 600, onComplete: () => star.destroy() });
      }
      await sleep(this, 500);
    } else {
      ball.destroy();
      this.foeSprite.setVisible(true);
      await new Promise<void>((resolve) => {
        this.tweens.add({ targets: this.foeSprite, scale: 1.05, alpha: 1, duration: 200, onComplete: () => resolve() });
      });
      return;
    }
    ball.destroy();
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
    const menu = new ListMenu(this, items, { x: GAME_W - 230, y: 60, width: 220, title: 'Forget which move?' });
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

  private async finish(): Promise<void> {
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
      if (await confirmMenu(this)) {
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

    // post-battle level evolutions
    for (const c of s.party) {
      if (!this.leveledUids.has(c.uid)) continue;
      const into = levelEvolution(c);
      if (into) await this.runEvolution(c, into);
    }

    this.cameras.main.fadeOut(250, 8, 8, 16);
    await sleep(this, 260);
    this.scene.stop();
    this.scene.resume('overworld');
    this.resolveOutcome(outcome);
  }

  private async runEvolution(c: CreatureInstance, into: string): Promise<void> {
    await this.dialog.show(`What?! ${displayName(c)} is evolving!`, { holdLastPage: true });
    audio.sfxEvolve();
    const overlay = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0xffffff, 0).setDepth(2000);
    const img = this.add.image(GAME_W / 2, GAME_H / 2 - 40, creatureKey(c.speciesId, 'front', c.shiny)).setDepth(2001).setScale(1.2);
    for (let i = 0; i < 3; i++) {
      await new Promise<void>((resolve) => {
        this.tweens.add({ targets: overlay, fillAlpha: 0.85, duration: 240, yoyo: true, onComplete: () => resolve() });
      });
    }
    const oldName = displayName(c);
    const hadNickname = !!c.nickname;
    evolve(c, into);
    markCaught(into);
    img.setTexture(creatureKey(into, 'front', c.shiny));
    audio.playCry(into);
    await new Promise<void>((resolve) => {
      this.tweens.add({ targets: overlay, fillAlpha: 0, duration: 300, onComplete: () => resolve() });
    });
    const newName = speciesById(into).name;
    await this.dialog.show(`${hadNickname ? oldName : oldName} evolved into ${newName}!`);
    // learn any moves the new form gets at this exact level
    for (const moveId of movesAtLevel(into, c.level).filter((id) => !c.moves.some((m) => m.id === id))) {
      const learnLevel = speciesById(into).learnset.find(([, id]) => id === moveId)?.[0];
      if (learnLevel === c.level) await this.handleLearnMove(c.uid, moveId);
    }
    img.destroy();
    overlay.destroy();
  }
}
