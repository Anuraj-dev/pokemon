/**
 * MenuScene — the full menu suite layered over the overworld: pause menu,
 * party management, bag, PC box storage, compendium, shop, settings, saves.
 */
import Phaser from 'phaser';
import { getState, removeFromBag, addToBag, bagCount, MAX_PARTY, NUM_BOXES, BOX_SIZE } from '../engine/state';
import { calcStats, displayName, evolve, type CreatureInstance } from '../engine/creature';
import { movesAtLevel } from '../data/species';
import { applyItemToCreature } from '../engine/itemUse';
import { ITEMS, itemById } from '../data/items';
import { moveById } from '../data/moves';
import { speciesById, SPECIES_ORDER } from '../data/species';
import { natureById, STAT_NAMES, type StatKey } from '../data/natures';
import { abilityById } from '../data/abilities';
import { TYPE_NAMES } from '../data/types';
import { totalExpFor } from '../data/growth';
import { saveToSlot, formatPlaytime } from '../engine/save';
import { gameRNG } from '../core/rng';
import { audio } from '../audio/audio';
import { creatureKey } from '../render/assets';
import { DialogBox, ListMenu, confirmMenu, GAME_W, GAME_H, UI_FONT, UI_FONT_SMALL, drawWindow, hpColor } from '../ui/ui';

type MenuMode = 'pause' | 'box' | 'shop';

export class MenuScene extends Phaser.Scene {
  private mode: MenuMode = 'pause';
  private stock: string[] = [];
  private resolveDone!: (v: unknown) => void;
  private dialog!: DialogBox;

  constructor() {
    super('menu');
  }

  init(data: { mode: MenuMode; stock?: string[]; resolve: (v: unknown) => void }): void {
    this.mode = data.mode;
    this.stock = data.stock ?? [];
    this.resolveDone = data.resolve;
  }

  create(): void {
    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x080810, 0.55);
    this.dialog = new DialogBox(this, 3000);
    void this.runMode();
  }

  private async runMode(): Promise<void> {
    if (this.mode === 'pause') await this.pauseMenu();
    else if (this.mode === 'box') await this.boxMenu();
    else if (this.mode === 'shop') await this.shopMenu();
    this.close();
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume('overworld');
    this.resolveDone(undefined);
  }

  // ================================================================ pause

  private async pauseMenu(): Promise<void> {
    while (true) {
      const s = getState();
      const menu = new ListMenu(this, [
        { label: 'Compendium' },
        { label: 'Party', disabled: s.party.length === 0 },
        { label: 'Bag' },
        { label: 'Trainer Card' },
        { label: 'Save' },
        { label: 'Settings' },
        { label: 'Quit to Title' },
        { label: 'Close' },
      ], { x: GAME_W - 168, y: 16, width: 158 });
      const pick = await menu.choose();
      if (pick === null || pick === 7) return;
      switch (pick) {
        case 0: await this.compendium(); break;
        case 1: await this.partyMenu(); break;
        case 2: await this.bagMenu(); break;
        case 3: await this.trainerCard(); break;
        case 4: await this.saveMenu(); break;
        case 5: await this.settingsMenu(); break;
        case 6: {
          if (await this.confirmDialog('Quit to title? Unsaved progress will be lost.')) {
            this.scene.stop('overworld');
            this.scene.stop();
            audio.stopMusic();
            this.scene.start('title');
            this.resolveDone(undefined);
            return;
          }
          break;
        }
      }
    }
  }

  private async confirmDialog(text: string): Promise<boolean> {
    await this.dialog.show(text, { holdLastPage: true });
    const yes = await confirmMenu(this);
    this.dialog.hide();
    return yes;
  }

  // ================================================================ party

  private partyItems() {
    return getState().party.map((c) => {
      const max = calcStats(c).hp;
      return {
        label: `${displayName(c)} Lv${c.level}`,
        rightLabel: `${c.hp}/${max}${c.status ? ' ' + c.status.slice(0, 3).toUpperCase() : ''}`,
      };
    });
  }

  private async partyMenu(): Promise<void> {
    while (true) {
      const s = getState();
      const menu = new ListMenu(this, this.partyItems(), { x: 20, y: 20, width: 260, title: 'PARTY' });
      const pick = await menu.choose();
      if (pick === null) return;
      const c = s.party[pick];
      const action = new ListMenu(this, [
        { label: 'Summary' },
        { label: 'Switch' },
        { label: 'Give Item' },
        { label: 'Take Item', disabled: !c.heldItem },
        { label: 'Rename' },
        { label: 'Back' },
      ], { x: 300, y: 60, width: 150 });
      const act = await action.choose();
      switch (act) {
        case 0:
          await this.summary(c);
          break;
        case 1: {
          const other = new ListMenu(this, this.partyItems(), { x: 20, y: 20, width: 260, title: 'Swap with?' });
          const o = await other.choose();
          if (o !== null && o !== pick) {
            [s.party[pick], s.party[o]] = [s.party[o], s.party[pick]];
            audio.sfxMenuSelect();
          }
          break;
        }
        case 2:
          await this.giveItemTo(c);
          break;
        case 3: {
          if (c.heldItem) {
            addToBag(c.heldItem, 1);
            await this.dialog.show(`Took the ${itemById(c.heldItem).name} from ${displayName(c)}.`);
            c.heldItem = null;
          }
          break;
        }
        case 4: {
          try {
            const nick = window.prompt(`Nickname for ${speciesById(c.speciesId).name}:`, c.nickname ?? '')?.trim().slice(0, 12);
            if (nick !== undefined && nick !== null) c.nickname = nick || undefined;
          } catch { /* unavailable */ }
          break;
        }
        default:
          break;
      }
    }
  }

  private async giveItemTo(c: CreatureInstance): Promise<void> {
    const s = getState();
    const holdable = Object.entries(s.bag).filter(([id]) => {
      const cat = ITEMS[id]?.category;
      return cat === 'held' || cat === 'medicine' || cat === 'evolution';
    });
    if (holdable.length === 0) {
      await this.dialog.show('Nothing suitable to give.');
      return;
    }
    const menu = new ListMenu(this, holdable.map(([id, qty]) => ({ label: ITEMS[id].name, rightLabel: `×${qty}` })), {
      x: 300, y: 40, width: 170, visibleRows: 8, title: 'Give what?',
    });
    const pick = await menu.choose();
    if (pick === null) return;
    const itemId = holdable[pick][0];
    if (c.heldItem) {
      addToBag(c.heldItem, 1);
      await this.dialog.show(`Swapped out the ${itemById(c.heldItem).name}.`);
    }
    removeFromBag(itemId, 1);
    c.heldItem = itemId;
    await this.dialog.show(`${displayName(c)} now holds the ${itemById(itemId).name}.`);
  }

  private async summary(c: CreatureInstance): Promise<void> {
    const sp = speciesById(c.speciesId);
    const stats = calcStats(c);
    const nat = natureById(c.natureId);
    const ab = abilityById(sp.ability);
    const panel = this.add.container(0, 0).setDepth(2500);
    const g = this.add.graphics();
    drawWindow(g, 14, 12, GAME_W - 28, GAME_H - 24);
    panel.add(g);
    const img = this.add.image(80, 84, creatureKey(c.speciesId, 'front', c.shiny)).setScale(1.1);
    panel.add(img);
    const title = `${displayName(c)}${c.shiny ? ' ★' : ''}  Lv${c.level}`;
    panel.add(this.add.text(30, 24, title, UI_FONT));
    panel.add(this.add.text(30, 146, sp.types.map((t) => TYPE_NAMES[t]).join(' / '), { ...UI_FONT_SMALL, color: '#f0d048' }));
    panel.add(this.add.text(30, 162, `${nat.name} nature · ${ab.name}`, UI_FONT_SMALL));
    panel.add(this.add.text(30, 178, `Held: ${c.heldItem ? itemById(c.heldItem).name : '—'}`, UI_FONT_SMALL));
    const nextExp = c.level < 100 ? totalExpFor(sp.growth, c.level + 1) - c.exp : 0;
    panel.add(this.add.text(30, 194, `EXP ${c.exp} · next in ${nextExp}`, UI_FONT_SMALL));

    const statKeys: StatKey[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
    statKeys.forEach((k, i) => {
      const valText = k === 'hp' ? `${c.hp}/${stats.hp}` : `${stats[k]}`;
      panel.add(this.add.text(200, 50 + i * 17, STAT_NAMES[k], UI_FONT_SMALL));
      panel.add(this.add.text(285, 50 + i * 17, valText, { ...UI_FONT_SMALL, color: '#a8e0a8' }).setOrigin(1, 0));
    });
    panel.add(this.add.text(200, 28, 'MOVES', { ...UI_FONT_SMALL, color: '#f0d048' }).setOrigin(0, 0));
    c.moves.forEach((m, i) => {
      const mv = moveById(m.id);
      panel.add(this.add.text(310, 50 + i * 17, mv.name, UI_FONT_SMALL));
      panel.add(this.add.text(GAME_W - 32, 50 + i * 17, `${m.pp}/${mv.pp}`, UI_FONT_SMALL).setOrigin(1, 0));
    });
    panel.add(this.add.text(200, 28, '', UI_FONT_SMALL));
    panel.add(this.add.text(30, 216, this.wrap(sp.flavor, 62), { ...UI_FONT_SMALL, color: '#c8d0e8' }));
    panel.add(this.add.text(GAME_W / 2, GAME_H - 28, '— press confirm/cancel to close —', { ...UI_FONT_SMALL, color: '#8890a8' }).setOrigin(0.5));

    await this.waitDismiss();
    panel.destroy();
  }

  private wrap(text: string, width: number): string {
    const out: string[] = [];
    let line = '';
    for (const w of text.split(' ')) {
      if (line.length + w.length + 1 > width) {
        out.push(line);
        line = w;
      } else line = line ? line + ' ' + w : w;
    }
    if (line) out.push(line);
    return out.join('\n');
  }

  private waitDismiss(): Promise<void> {
    return new Promise((resolve) => {
      const menu = new ListMenu(this, [{ label: '' }], { x: -500, y: -500, width: 10 });
      void menu.choose().then(() => resolve());
    });
  }

  // ================================================================ bag

  private async bagMenu(): Promise<void> {
    const cats = [
      { id: 'medicine', label: 'Medicine' },
      { id: 'balls', label: 'Balls' },
      { id: 'held', label: 'Held Items' },
      { id: 'evolution', label: 'Evolution' },
      { id: 'key', label: 'Key Items' },
    ] as const;
    while (true) {
      const catMenu = new ListMenu(this, cats.map((c) => ({ label: c.label })), { x: 24, y: 24, width: 150, title: 'BAG' });
      const cp = await catMenu.choose();
      if (cp === null) return;
      const cat = cats[cp].id;
      while (true) {
        const s = getState();
        const entries = Object.entries(s.bag).filter(([id]) => ITEMS[id]?.category === cat);
        if (entries.length === 0) {
          await this.dialog.show('This pocket is empty.');
          break;
        }
        const info = this.add.text(24, GAME_H - 110, '', { ...UI_FONT_SMALL, color: '#a8c0e8' }).setDepth(2400);
        const list = new ListMenu(this, entries.map(([id, qty]) => ({ label: ITEMS[id].name, rightLabel: `×${qty}` })), {
          x: 190, y: 24, width: 200, visibleRows: 10, title: cats[cp].label,
          onHover: (i) => info.setText(this.wrap(ITEMS[entries[i][0]].desc, 60)),
        });
        const ip = await list.choose();
        info.destroy();
        if (ip === null) break;
        await this.useItemFromBag(entries[ip][0]);
      }
    }
  }

  private async useItemFromBag(itemId: string): Promise<void> {
    const s = getState();
    const item = itemById(itemId);
    const eff = item.effect;

    if (eff.kind === 'key') {
      await this.dialog.show(item.desc);
      return;
    }
    if (eff.kind === 'ball') {
      await this.dialog.show('Better save that for a wild battle!');
      return;
    }
    if (eff.kind === 'repel') {
      if (s.repelSteps > 0) {
        await this.dialog.show('A repel is already in effect.');
        return;
      }
      removeFromBag(itemId, 1);
      s.repelSteps = eff.steps;
      await this.dialog.show('You applied the repel. Weak wild creatures will keep their distance.');
      return;
    }
    if (eff.kind === 'expBoost' || eff.kind.startsWith('held')) {
      await this.dialog.show('This item should be HELD by a creature. Use Give in the Party menu.');
      return;
    }
    if (s.party.length === 0) {
      await this.dialog.show('You have no creatures.');
      return;
    }
    const target = new ListMenu(this, this.partyItems(), { x: 20, y: 24, width: 260, title: `Use ${item.name} on?` });
    const tp = await target.choose();
    if (tp === null) return;
    const c = s.party[tp];
    const result = applyItemToCreature(c, itemId);
    if (result.evolveInto) {
      removeFromBag(itemId, 1);
      await this.runEvolutionSimple(c, result.evolveInto);
      return;
    }
    await this.dialog.show(result.message);
    if (result.used) removeFromBag(itemId, 1);
  }

  private async runEvolutionSimple(c: CreatureInstance, into: string): Promise<void> {
    audio.sfxEvolve();
    const oldName = displayName(c);
    await this.dialog.show(`What?! ${oldName} is evolving!`);
    const level = c.level;
    evolve(c, into);
    const { markCaught } = await import('../engine/state');
    markCaught(into);
    await this.dialog.show(`${oldName} evolved into ${speciesById(into).name}!`);
    for (const moveId of movesAtLevel(into, level)) {
      if (c.moves.some((m) => m.id === moveId)) continue;
      const learnLevel = speciesById(into).learnset.find(([, id]) => id === moveId)?.[0];
      if (learnLevel !== level) continue;
      const mv = moveById(moveId);
      if (c.moves.length < 4) {
        c.moves.push({ id: moveId, pp: mv.pp });
        await this.dialog.show(`${displayName(c)} learned ${mv.name}!`);
      }
    }
  }

  // ================================================================ box

  private async boxMenu(): Promise<void> {
    const s = getState();
    let boxIndex = 0;
    while (true) {
      const box = s.boxes[boxIndex];
      const items = [
        { label: `◄ Box ${boxIndex + 1}/${NUM_BOXES} ►  (${box.length}/${BOX_SIZE})`, rightLabel: 'switch' },
        ...s.party.map((c) => ({ label: `[P] ${displayName(c)} Lv${c.level}`, rightLabel: `${c.hp > 0 ? 'OK' : 'FNT'}` })),
        ...box.map((c) => ({ label: `    ${displayName(c)} Lv${c.level}` })),
      ];
      const menu = new ListMenu(this, items, { x: 30, y: 16, width: 290, visibleRows: 12, title: 'CREATURE STORAGE' });
      const pick = await menu.choose();
      if (pick === null) return;
      if (pick === 0) {
        boxIndex = (boxIndex + 1) % NUM_BOXES;
        continue;
      }
      const inParty = pick <= s.party.length;
      const idx = inParty ? pick - 1 : pick - 1 - s.party.length;
      const c = inParty ? s.party[idx] : box[idx];
      const action = new ListMenu(this, [
        { label: 'Summary' },
        { label: inParty ? 'Deposit' : 'Withdraw' },
        { label: 'Release' },
        { label: 'Back' },
      ], { x: 330, y: 60, width: 130 });
      const act = await action.choose();
      if (act === 0) {
        await this.summary(c);
      } else if (act === 1) {
        if (inParty) {
          const healthyLeft = s.party.filter((p, i) => i !== idx && p.hp > 0).length;
          if (s.party.length === 1 || healthyLeft === 0) {
            await this.dialog.show("That's your last battle-ready creature!");
            continue;
          }
          if (box.length >= BOX_SIZE) {
            await this.dialog.show('This box is full.');
            continue;
          }
          s.party.splice(idx, 1);
          box.push(c);
        } else {
          if (s.party.length >= MAX_PARTY) {
            await this.dialog.show('Your party is full.');
            continue;
          }
          box.splice(idx, 1);
          s.party.push(c);
        }
        audio.sfxMenuSelect();
      } else if (act === 2) {
        if (inParty && (s.party.length === 1 || s.party.filter((p, i) => i !== idx && p.hp > 0).length === 0)) {
          await this.dialog.show("You can't release your last battle-ready creature!");
          continue;
        }
        if (await this.confirmDialog(`Release ${displayName(c)} back into the wild?`)) {
          if (inParty) s.party.splice(idx, 1);
          else box.splice(idx, 1);
          await this.dialog.show(`${displayName(c)} was released. Be well out there...`);
        }
      }
    }
  }

  // ================================================================ shop

  private async shopMenu(): Promise<void> {
    const s = getState();
    while (true) {
      await this.dialog.show(`Welcome! You have ₽${s.player.money}. How can I help?`, { holdLastPage: true });
      const menu = new ListMenu(this, [{ label: 'Buy' }, { label: 'Sell' }, { label: 'Leave' }], { x: GAME_W - 150, y: 40, width: 140 });
      const pick = await menu.choose();
      this.dialog.hide();
      if (pick === null || pick === 2) return;
      if (pick === 0) await this.buyMenu();
      else await this.sellMenu();
    }
  }

  private async buyMenu(): Promise<void> {
    const s = getState();
    while (true) {
      const info = this.add.text(24, GAME_H - 110, '', { ...UI_FONT_SMALL, color: '#a8c0e8' }).setDepth(2400);
      const list = new ListMenu(this, this.stock.map((id) => ({ label: ITEMS[id].name, rightLabel: `₽${ITEMS[id].price}` })), {
        x: 150, y: 20, width: 220, visibleRows: 10, title: `Buy — ₽${s.player.money}`,
        onHover: (i) => info.setText(this.wrap(ITEMS[this.stock[i]].desc, 60)),
      });
      const pick = await list.choose();
      info.destroy();
      if (pick === null) return;
      const item = ITEMS[this.stock[pick]];
      if (s.player.money < item.price) {
        await this.dialog.show("You can't afford that.");
        continue;
      }
      const qtyMenu = new ListMenu(this, [1, 5, 10].map((q) => ({
        label: `×${q}`, rightLabel: `₽${item.price * q}`, disabled: s.player.money < item.price * q,
      })), { x: 280, y: 90, width: 130, title: 'How many?' });
      const qp = await qtyMenu.choose();
      if (qp === null) continue;
      const qty = [1, 5, 10][qp];
      s.player.money -= item.price * qty;
      addToBag(item.id, qty);
      audio.sfxCatch();
      await this.dialog.show(`Bought ${qty}× ${item.name}!`);
    }
  }

  private async sellMenu(): Promise<void> {
    const s = getState();
    while (true) {
      const sellable = Object.entries(s.bag).filter(([id]) => {
        const it = ITEMS[id];
        return it && it.category !== 'key' && it.price > 0;
      });
      if (sellable.length === 0) {
        await this.dialog.show('You have nothing I can buy.');
        return;
      }
      const list = new ListMenu(this, sellable.map(([id, qty]) => ({
        label: ITEMS[id].name, rightLabel: `×${qty} · ₽${Math.floor(ITEMS[id].price / 2)}`,
      })), { x: 150, y: 20, width: 240, visibleRows: 10, title: `Sell — ₽${s.player.money}` });
      const pick = await list.choose();
      if (pick === null) return;
      const [id] = sellable[pick];
      const price = Math.floor(ITEMS[id].price / 2);
      removeFromBag(id, 1);
      s.player.money += price;
      audio.sfxCatch();
      await this.dialog.show(`Sold ${ITEMS[id].name} for ₽${price}.`);
    }
  }

  // ================================================================ misc

  private async trainerCard(): Promise<void> {
    const s = getState();
    const panel = this.add.container(0, 0).setDepth(2500);
    const g = this.add.graphics();
    drawWindow(g, 60, 50, GAME_W - 120, GAME_H - 110, { fill: 0x3858a8 });
    panel.add(g);
    panel.add(this.add.text(80, 66, `TRAINER ${s.player.name}`, UI_FONT));
    panel.add(this.add.text(80, 94, `Money     ₽${s.player.money}`, UI_FONT_SMALL));
    panel.add(this.add.text(80, 112, `Playtime  ${formatPlaytime(s.player.playtimeMs)}`, UI_FONT_SMALL));
    panel.add(this.add.text(80, 130, `Compendium  seen ${s.seen.length} · caught ${s.caught.length} / ${SPECIES_ORDER.length}`, UI_FONT_SMALL));
    panel.add(this.add.text(80, 156, 'BADGES', { ...UI_FONT_SMALL, color: '#f0d048' }));
    for (let i = 0; i < 8; i++) {
      const img = this.add.image(92 + i * 30, 184, `ui/badge${i}`);
      if (!s.player.badges.includes(`badge${i + 1}`)) img.setAlpha(0.18).setTint(0x404858);
      panel.add(img);
    }
    panel.add(this.add.text(GAME_W / 2, GAME_H - 74, '— press confirm/cancel to close —', { ...UI_FONT_SMALL, color: '#8890a8' }).setOrigin(0.5));
    await this.waitDismiss();
    panel.destroy();
  }

  private async compendium(): Promise<void> {
    const s = getState();
    while (true) {
      const items = SPECIES_ORDER.map((id) => {
        const sp = speciesById(id);
        const seen = s.seen.includes(id);
        const caught = s.caught.includes(id);
        return {
          label: `#${sp.num.toString().padStart(3, '0')} ${seen ? sp.name : '———'}`,
          rightLabel: caught ? '●' : seen ? '○' : '',
        };
      });
      const menu = new ListMenu(this, items, { x: 30, y: 14, width: 240, visibleRows: 13, title: `COMPENDIUM  ${s.caught.length}/${SPECIES_ORDER.length}` });
      const pick = await menu.choose();
      if (pick === null) return;
      const id = SPECIES_ORDER[pick];
      if (!s.seen.includes(id)) continue;
      const sp = speciesById(id);
      const panel = this.add.container(0, 0).setDepth(2500);
      const g = this.add.graphics();
      drawWindow(g, 50, 40, GAME_W - 100, GAME_H - 90);
      panel.add(g);
      panel.add(this.add.image(120, 130, creatureKey(id, 'front')).setScale(1.2));
      panel.add(this.add.text(200, 58, `#${sp.num.toString().padStart(3, '0')} ${sp.name}`, UI_FONT));
      panel.add(this.add.text(200, 80, sp.types.map((t) => TYPE_NAMES[t]).join(' / '), { ...UI_FONT_SMALL, color: '#f0d048' }));
      panel.add(this.add.text(200, 100, s.caught.includes(id) ? 'CAUGHT' : 'SEEN', { ...UI_FONT_SMALL, color: '#a8e0a8' }));
      panel.add(this.add.text(70, 200, this.wrap(s.caught.includes(id) ? sp.flavor : '? ? ? — catch one to record its full entry.', 52), UI_FONT_SMALL));
      await this.waitDismiss();
      panel.destroy();
    }
  }

  private async settingsMenu(): Promise<void> {
    const s = getState();
    while (true) {
      const items = [
        { label: 'Music Volume', rightLabel: `${Math.round(s.settings.musicVol * 100)}%` },
        { label: 'SFX Volume', rightLabel: `${Math.round(s.settings.sfxVol * 100)}%` },
        { label: 'Text Speed', rightLabel: ['Slow', 'Normal', 'Fast'][s.settings.textSpeed - 1] },
        { label: 'Done' },
      ];
      const menu = new ListMenu(this, items, { x: 120, y: 70, width: 240, title: 'SETTINGS  (confirm to cycle)' });
      const pick = await menu.choose();
      if (pick === null || pick === 3) return;
      if (pick === 0) {
        s.settings.musicVol = Math.round(((s.settings.musicVol + 0.25) % 1.25) * 100) / 100;
        if (s.settings.musicVol > 1) s.settings.musicVol = 0;
        audio.setMusicVolume(s.settings.musicVol);
      } else if (pick === 1) {
        s.settings.sfxVol = Math.round(((s.settings.sfxVol + 0.25) % 1.25) * 100) / 100;
        if (s.settings.sfxVol > 1) s.settings.sfxVol = 0;
        audio.setSfxVolume(s.settings.sfxVol);
        audio.sfxMenuSelect();
      } else if (pick === 2) {
        s.settings.textSpeed = (s.settings.textSpeed % 3) + 1;
      }
    }
  }

  private async saveMenu(): Promise<void> {
    const s = getState();
    const menu = new ListMenu(this, [
      { label: 'Slot 1' }, { label: 'Slot 2' }, { label: 'Slot 3' }, { label: 'Cancel' },
    ], { x: 150, y: 80, width: 180, title: 'Save to which slot?' });
    const pick = await menu.choose();
    if (pick === null || pick === 3) return;
    s.rngSeed = gameRNG.getSeed();
    const ok = saveToSlot(['slot1', 'slot2', 'slot3'][pick] as 'slot1' | 'slot2' | 'slot3', s);
    audio.sfxHeal();
    await this.dialog.show(ok ? `Saved to Slot ${pick + 1}!\nRemember: clearing browser data erases saves.` : 'Save failed — storage may be unavailable.');
  }
}
