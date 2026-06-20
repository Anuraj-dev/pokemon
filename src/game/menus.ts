/**
 * Menu suite — pause menu, party management, bag, PC box storage,
 * compendium, shop, settings, saves — as DOM overlays over the 3D world.
 * A straight port of the old MenuScene flows onto the DOM toolkit.
 */
import { getState, removeFromBag, addToBag, MAX_PARTY, NUM_BOXES, BOX_SIZE, markCaught, healParty, setFlag, getFlag } from '../engine/state';
import { calcStats, displayName, evolve, addExp, levelEvolution, type CreatureInstance } from '../engine/creature';
import { movesAtLevel, speciesById, SPECIES_ORDER } from '../data/species';
import { applyItemToCreature } from '../engine/itemUse';
import { ITEMS, itemById } from '../data/items';
import { moveById } from '../data/moves';
import { natureById, STAT_NAMES, type StatKey } from '../data/natures';
import { abilityById } from '../data/abilities';
import { TYPE_NAMES } from '../data/types';
import { totalExpFor } from '../data/growth';
import { saveToSlot, formatPlaytime } from '../engine/save';
import { gameRNG } from '../core/rng';
import { audio } from '../audio/audio';
import { creatureKey, spriteSnapshot } from '../render3d/textures';
import { DialogBox, ListMenu, confirmMenu, waitDismiss, GAME_W, GAME_H, el, label, panel, wrapText } from '../ui/dom';
import { view, setViewSetting, VIEW_LIMITS } from '../engine/viewSettings';
import { setMode } from './debug';

export type MenuMode = 'pause' | 'box' | 'shop';

export class MenuSuite {
  private dialog!: DialogBox;
  private dim!: HTMLDivElement;
  private quit = false;

  /** Run a menu mode to completion. Resolves 'quit' if quit-to-title chosen. */
  async open(mode: MenuMode, stock: string[] = []): Promise<'quit' | undefined> {
    this.quit = false;
    this.dim = el('div', 'scrim', document.body);
    this.dialog = new DialogBox();
    setMode('menu', true);
    try {
      if (mode === 'pause') await this.pauseMenu();
      else if (mode === 'box') await this.boxMenu();
      else await this.shopMenu(stock);
    } finally {
      setMode('menu', false);
      this.dialog.destroy();
      this.dim.remove();
    }
    return this.quit ? 'quit' : undefined;
  }

  // ================================================================ pause

  private async pauseMenu(): Promise<void> {
    while (true) {
      const s = getState();
      const menu = new ListMenu(
        [
          { label: 'Compendium' },
          { label: 'Party', disabled: s.party.length === 0 },
          { label: 'Bag' },
          { label: 'Trainer Card' },
          { label: 'Save' },
          { label: 'Settings' },
          { label: 'Cheats' },
          { label: 'Quit to Title' },
          { label: 'Close' },
        ],
        { x: GAME_W - 168, y: 16, width: 158 },
      );
      const pick = await menu.choose();
      if (pick === null || pick === 8) return;
      switch (pick) {
        case 0: await this.compendium(); break;
        case 1: await this.partyMenu(); break;
        case 2: await this.bagMenu(); break;
        case 3: await this.trainerCard(); break;
        case 4: await this.saveMenu(); break;
        case 5: await this.settingsMenu(); break;
        case 6: await this.cheatsMenu(); break;
        case 7: {
          if (await this.confirmDialog('Quit to title? Unsaved progress will be lost.')) {
            audio.stopMusic();
            this.quit = true;
            return;
          }
          break;
        }
      }
    }
  }

  private async confirmDialog(text: string): Promise<boolean> {
    await this.dialog.show(text, { holdLastPage: true });
    const yes = await confirmMenu();
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
      const menu = new ListMenu(this.partyItems(), { x: 20, y: 20, width: 260, title: 'PARTY' });
      const pick = await menu.choose();
      if (pick === null) return;
      const c = s.party[pick];
      const action = new ListMenu(
        [
          { label: 'Summary' },
          { label: 'Switch' },
          { label: 'Give Item' },
          { label: 'Take Item', disabled: !c.heldItem },
          { label: 'Rename' },
          { label: 'Back' },
        ],
        { x: 300, y: 60, width: 150 },
      );
      const act = await action.choose();
      switch (act) {
        case 0:
          await this.summary(c);
          break;
        case 1: {
          const other = new ListMenu(this.partyItems(), { x: 20, y: 20, width: 260, title: 'Swap with?' });
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
    const menu = new ListMenu(holdable.map(([id, qty]) => ({ label: ITEMS[id].name, rightLabel: `×${qty}` })), {
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
    const p = panel(14, 12, GAME_W - 28, GAME_H - 24);
    const img = spriteSnapshot(creatureKey(c.speciesId, 'front', c.shiny));
    img.className = 'sprite';
    img.style.cssText += 'left:28px;top:30px;width:106px;height:106px;';
    p.appendChild(img);
    label(p, 16, 12, `${displayName(c)}${c.shiny ? ' ★' : ''}  Lv${c.level}`);
    label(p, 16, 134, sp.types.map((t) => TYPE_NAMES[t]).join(' / '), 'small gold');
    label(p, 16, 150, `${nat.name} nature · ${ab.name}`, 'small');
    label(p, 16, 166, `Held: ${c.heldItem ? itemById(c.heldItem).name : '—'}`, 'small');
    const nextExp = c.level < 100 ? totalExpFor(sp.growth, c.level + 1) - c.exp : 0;
    label(p, 16, 182, `EXP ${c.exp} · next in ${nextExp}`, 'small');

    const statKeys: StatKey[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
    statKeys.forEach((k, i) => {
      const valText = k === 'hp' ? `${c.hp}/${stats.hp}` : `${stats[k]}`;
      label(p, 186, 38 + i * 17, STAT_NAMES[k], 'small');
      label(p, 246, 38 + i * 17, valText, 'small green');
    });
    label(p, 186, 16, 'MOVES', 'small gold');
    c.moves.forEach((m, i) => {
      const mv = moveById(m.id);
      label(p, 296, 38 + i * 17, mv.name, 'small');
      label(p, 396, 38 + i * 17, `${m.pp}/${mv.pp}`, 'small');
    });
    const flavor = label(p, 16, 204, wrapText(sp.flavor, 62).join('\n'), 'small blue');
    flavor.style.whiteSpace = 'pre';
    label(p, GAME_W / 2 - 120, GAME_H - 52, '— press confirm/cancel to close —', 'small dim');

    await waitDismiss();
    p.remove();
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
      const catMenu = new ListMenu(cats.map((c) => ({ label: c.label })), { x: 24, y: 24, width: 150, title: 'BAG' });
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
        const info = label(null, 24, GAME_H - 110, '', 'small blue');
        info.style.whiteSpace = 'pre';
        const list = new ListMenu(entries.map(([id, qty]) => ({ label: ITEMS[id].name, rightLabel: `×${qty}` })), {
          x: 190, y: 24, width: 200, visibleRows: 10, title: cats[cp].label,
          onHover: (i) => (info.textContent = wrapText(ITEMS[entries[i][0]].desc, 60).join('\n')),
        });
        const ip = await list.choose();
        info.remove();
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
    const target = new ListMenu(this.partyItems(), { x: 20, y: 24, width: 260, title: `Use ${item.name} on?` });
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
      const menu = new ListMenu(items, { x: 30, y: 16, width: 290, visibleRows: 12, title: 'CREATURE STORAGE' });
      const pick = await menu.choose();
      if (pick === null) return;
      if (pick === 0) {
        boxIndex = (boxIndex + 1) % NUM_BOXES;
        continue;
      }
      const inParty = pick <= s.party.length;
      const idx = inParty ? pick - 1 : pick - 1 - s.party.length;
      const c = inParty ? s.party[idx] : box[idx];
      const action = new ListMenu(
        [{ label: 'Summary' }, { label: inParty ? 'Deposit' : 'Withdraw' }, { label: 'Release' }, { label: 'Back' }],
        { x: 330, y: 60, width: 130 },
      );
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

  private async shopMenu(stock: string[]): Promise<void> {
    const s = getState();
    while (true) {
      await this.dialog.show(`Welcome! You have ₽${s.player.money}. How can I help?`, { holdLastPage: true });
      const menu = new ListMenu([{ label: 'Buy' }, { label: 'Sell' }, { label: 'Leave' }], { x: GAME_W - 150, y: 40, width: 140 });
      const pick = await menu.choose();
      this.dialog.hide();
      if (pick === null || pick === 2) return;
      if (pick === 0) await this.buyMenu(stock);
      else await this.sellMenu();
    }
  }

  private async buyMenu(stock: string[]): Promise<void> {
    const s = getState();
    while (true) {
      const info = label(null, 24, GAME_H - 110, '', 'small blue');
      info.style.whiteSpace = 'pre';
      const list = new ListMenu(stock.map((id) => ({ label: ITEMS[id].name, rightLabel: `₽${ITEMS[id].price}` })), {
        x: 150, y: 20, width: 220, visibleRows: 10, title: `Buy — ₽${s.player.money}`,
        onHover: (i) => (info.textContent = wrapText(ITEMS[stock[i]].desc, 60).join('\n')),
      });
      const pick = await list.choose();
      info.remove();
      if (pick === null) return;
      const item = ITEMS[stock[pick]];
      if (s.player.money < item.price) {
        await this.dialog.show("You can't afford that.");
        continue;
      }
      const qtyMenu = new ListMenu(
        [1, 5, 10].map((q) => ({ label: `×${q}`, rightLabel: `₽${item.price * q}`, disabled: s.player.money < item.price * q })),
        { x: 280, y: 90, width: 130, title: 'How many?' },
      );
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
      const list = new ListMenu(
        sellable.map(([id, qty]) => ({ label: ITEMS[id].name, rightLabel: `×${qty} · ₽${Math.floor(ITEMS[id].price / 2)}` })),
        { x: 150, y: 20, width: 240, visibleRows: 10, title: `Sell — ₽${s.player.money}` },
      );
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

  // ================================================================ cheats

  /** Pick a party member; resolves the creature or null. */
  private async pickPartyMember(title: string): Promise<CreatureInstance | null> {
    const s = getState();
    if (s.party.length === 0) {
      await this.dialog.show('You have no creatures.');
      return null;
    }
    const menu = new ListMenu(this.partyItems(), { x: 20, y: 20, width: 260, title });
    const pick = await menu.choose();
    return pick === null ? null : s.party[pick];
  }

  private async cheatLevelUp(levels: number): Promise<void> {
    const c = await this.pickPartyMember(`Level up which creature? (+${levels})`);
    if (!c) return;
    if (c.level >= 100) {
      await this.dialog.show(`${displayName(c)} is already at the level cap.`);
      return;
    }
    const sp = speciesById(c.speciesId);
    const target = Math.min(100, c.level + levels);
    const res = addExp(c, totalExpFor(sp.growth, target) - c.exp);
    audio.sfxLevelUp();
    await this.dialog.show(`${displayName(c)} rocketed to Lv${c.level}!`);
    for (const nm of res.newMoves) {
      if (c.moves.some((m) => m.id === nm.moveId)) continue;
      const mv = moveById(nm.moveId);
      if (c.moves.length < 4) {
        c.moves.push({ id: nm.moveId, pp: mv.pp });
        await this.dialog.show(`${displayName(c)} learned ${mv.name}!`);
      } else {
        const items = [
          ...c.moves.map((m) => ({ label: moveById(m.id).name })),
          { label: `Skip ${mv.name}` },
        ];
        const menu = new ListMenu(items, { x: GAME_W - 230, y: 60, width: 220, title: `Forget which move for ${mv.name}?` });
        const pick = await menu.choose();
        if (pick !== null && pick < 4) {
          c.moves[pick] = { id: nm.moveId, pp: mv.pp };
          await this.dialog.show(`${displayName(c)} learned ${mv.name}!`);
        }
      }
    }
    const into = levelEvolution(c);
    if (into && (await this.confirmDialog(`${displayName(c)} can evolve! Evolve now?`))) {
      await this.runEvolutionSimple(c, into);
    }
  }

  private async cheatEvolve(): Promise<void> {
    const c = await this.pickPartyMember('Evolve which creature?');
    if (!c) return;
    const into = speciesById(c.speciesId).evolution?.into;
    if (!into) {
      await this.dialog.show(`${displayName(c)} has no further evolution.`);
      return;
    }
    await this.runEvolutionSimple(c, into);
  }

  private async cheatsMenu(): Promise<void> {
    const s = getState();
    while (true) {
      const noEnc = !!getFlag('cheat:noencounters');
      const menu = new ListMenu(
        [
          { label: 'Level Up +1' },
          { label: 'Level Up +5' },
          { label: 'Fast Evolve' },
          { label: 'Make Shiny ★' },
          { label: 'Full Heal Party', disabled: s.party.length === 0 },
          { label: 'Get ₽10,000' },
          { label: 'Ball & Potion Pack' },
          { label: `Wild Encounters: ${noEnc ? 'OFF' : 'ON'}` },
          { label: 'Back' },
        ],
        { x: GAME_W - 210, y: 14, width: 200, title: 'CHEATS' },
      );
      const pick = await menu.choose();
      if (pick === null || pick === 8) return;
      switch (pick) {
        case 0:
          await this.cheatLevelUp(1);
          break;
        case 1:
          await this.cheatLevelUp(5);
          break;
        case 2:
          await this.cheatEvolve();
          break;
        case 3: {
          const c = await this.pickPartyMember('Make which creature shiny?');
          if (c) {
            c.shiny = true;
            audio.sfxEvolve();
            await this.dialog.show(`${displayName(c)} now sparkles! ★`);
          }
          break;
        }
        case 4:
          healParty();
          audio.sfxHeal();
          await this.dialog.show('Your whole team was fully healed!');
          break;
        case 5:
          s.player.money += 10000;
          audio.sfxCatch();
          await this.dialog.show(`Cha-ching! You now have ₽${s.player.money}.`);
          break;
        case 6: {
          for (const [id, qty] of [['basicball', 10], ['greatball', 10], ['ultraball', 5], ['potion', 10], ['superpotion', 5]] as const) {
            if (ITEMS[id]) addToBag(id, qty);
          }
          audio.sfxCatch();
          await this.dialog.show('A generous pack of balls and potions was stuffed into your bag!');
          break;
        }
        case 7:
          setFlag('cheat:noencounters', !noEnc);
          audio.sfxMenuSelect();
          await this.dialog.show(noEnc ? 'Wild creatures will bother you again.' : 'The tall grass goes quiet. No more wild encounters.');
          break;
      }
    }
  }

  // ================================================================ misc

  private async trainerCard(): Promise<void> {
    const s = getState();
    const p = panel(60, 50, GAME_W - 120, GAME_H - 110, { fill: 'rgba(56,88,168,0.25)' });
    label(p, 20, 14, `TRAINER ${s.player.name}`);
    label(p, 20, 42, `Money     ₽${s.player.money}`, 'small');
    label(p, 20, 60, `Playtime  ${formatPlaytime(s.player.playtimeMs)}`, 'small');
    label(p, 20, 78, `Compendium  seen ${s.seen.length} · caught ${s.caught.length} / ${SPECIES_ORDER.length}`, 'small');
    label(p, 20, 104, 'BADGES', 'small gold');
    for (let i = 0; i < 8; i++) {
      const img = spriteSnapshot(`ui/badge${i}`);
      img.className = 'sprite';
      img.style.cssText += `left:${20 + i * 30}px;top:120px;width:24px;height:24px;`;
      if (!s.player.badges.includes(`badge${i + 1}`)) img.style.opacity = '0.18';
      p.appendChild(img);
    }
    label(p, (GAME_W - 120) / 2 - 110, GAME_H - 110 - 26, '— press confirm/cancel to close —', 'small dim');
    await waitDismiss();
    p.remove();
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
      const menu = new ListMenu(items, { x: 30, y: 14, width: 240, visibleRows: 13, title: `COMPENDIUM  ${s.caught.length}/${SPECIES_ORDER.length}` });
      const pick = await menu.choose();
      if (pick === null) return;
      const id = SPECIES_ORDER[pick];
      if (!s.seen.includes(id)) continue;
      const sp = speciesById(id);
      const p = panel(50, 40, GAME_W - 100, GAME_H - 90);
      const img = spriteSnapshot(creatureKey(id, 'front'));
      img.className = 'sprite';
      img.style.cssText += 'left:24px;top:40px;width:110px;height:110px;';
      p.appendChild(img);
      label(p, 150, 16, `#${sp.num.toString().padStart(3, '0')} ${sp.name}`);
      label(p, 150, 38, sp.types.map((t) => TYPE_NAMES[t]).join(' / '), 'small gold');
      label(p, 150, 58, s.caught.includes(id) ? 'CAUGHT' : 'SEEN', 'small green');
      const fl = label(p, 20, 158, wrapText(s.caught.includes(id) ? sp.flavor : '? ? ? — catch one to record its full entry.', 52).join('\n'), 'small');
      fl.style.whiteSpace = 'pre';
      await waitDismiss();
      p.remove();
    }
  }

  private async settingsMenu(): Promise<void> {
    const s = getState();
    while (true) {
      const items = [
        { label: 'Music Volume', rightLabel: `${Math.round(s.settings.musicVol * 100)}%` },
        { label: 'SFX Volume', rightLabel: `${Math.round(s.settings.sfxVol * 100)}%` },
        { label: 'Text Speed', rightLabel: ['Slow', 'Normal', 'Fast'][s.settings.textSpeed - 1] },
        { label: 'Chunk Distance', rightLabel: `${view.chunkDistance} (${view.chunkDistance * 16} tiles)` },
        { label: 'Simulation Distance', rightLabel: `${view.simDistance} (${view.simDistance * 16} tiles)` },
        { label: 'Done' },
      ];
      const menu = new ListMenu(items, { x: 110, y: 60, width: 260, title: 'SETTINGS  (confirm to cycle)' });
      const pick = await menu.choose();
      if (pick === null || pick === 5) return;
      if (pick === 3) {
        // wraps min→max; chunks stream in/out live next frame
        const lim = VIEW_LIMITS.chunkDistance;
        setViewSetting('chunkDistance', view.chunkDistance >= lim.max ? lim.min : view.chunkDistance + 1);
        audio.sfxMenuSelect();
        continue;
      }
      if (pick === 4) {
        const lim = VIEW_LIMITS.simDistance;
        setViewSetting('simDistance', view.simDistance >= lim.max ? lim.min : view.simDistance + 1);
        audio.sfxMenuSelect();
        continue;
      }
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
    const menu = new ListMenu(
      [{ label: 'Slot 1' }, { label: 'Slot 2' }, { label: 'Slot 3' }, { label: 'Cancel' }],
      { x: 150, y: 80, width: 180, title: 'Save to which slot?' },
    );
    const pick = await menu.choose();
    if (pick === null || pick === 3) return;
    s.rngSeed = gameRNG.getSeed();
    const ok = saveToSlot(['slot1', 'slot2', 'slot3'][pick] as 'slot1' | 'slot2' | 'slot3', s);
    audio.sfxHeal();
    await this.dialog.show(ok ? `Saved to Slot ${pick + 1}!\nRemember: clearing browser data erases saves.` : 'Save failed — storage may be unavailable.');
  }
}
