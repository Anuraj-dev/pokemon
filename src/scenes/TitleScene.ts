/**
 * TitleScene — animated title with New Game / Continue and save-slot picker.
 */
import Phaser from 'phaser';
import { GAME_W, GAME_H, ListMenu, UI_FONT, UI_FONT_SMALL, fade, DialogBox } from '../ui/ui';
import { audio } from '../audio/audio';
import { SLOTS, slotSummary, loadFromSlot, anySaveExists, formatPlaytime, type SlotId } from '../engine/save';
import { newGameState, setState } from '../engine/state';
import { creatureKey } from '../render/assets';
import { SPECIES_ORDER } from '../data/species';
import { gameRNG } from '../core/rng';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  create(): void {
    audio.playMusic('title');
    const g = this.add.graphics();
    g.fillGradientStyle(0x182848, 0x182848, 0x080812, 0x080812, 1);
    g.fillRect(0, 0, GAME_W, GAME_H);

    // Drifting creature silhouettes for atmosphere.
    for (let i = 0; i < 6; i++) {
      const id = SPECIES_ORDER[gameRNG.int(0, SPECIES_ORDER.length - 1)];
      const img = this.add.image(gameRNG.int(30, GAME_W - 30), gameRNG.int(40, GAME_H - 80), creatureKey(id, 'front'));
      img.setAlpha(0.12).setScale(0.8).setTint(0x8090c0);
      this.tweens.add({
        targets: img,
        y: img.y - gameRNG.int(8, 20),
        duration: gameRNG.int(2200, 4000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    const title = this.add.text(GAME_W / 2, 78, 'MONSTRA', {
      fontFamily: '"Courier New", monospace',
      fontSize: '52px',
      color: '#f0d048',
      stroke: '#403008',
      strokeThickness: 6,
      resolution: 2,
    }).setOrigin(0.5);
    this.add.text(GAME_W / 2, 116, '— Tales of Veridia —', { ...UI_FONT, color: '#a8c0e8' }).setOrigin(0.5);
    this.tweens.add({ targets: title, scale: 1.04, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.add.text(GAME_W / 2, GAME_H - 14, 'Z/Enter: confirm   X/Esc: back   Arrows/WASD: move   Shift: run', UI_FONT_SMALL).setOrigin(0.5);

    void this.mainMenu();
  }

  private async mainMenu(): Promise<void> {
    const hasSaves = anySaveExists();
    const items = [
      { label: 'New Game' },
      { label: 'Continue', disabled: !hasSaves },
    ];
    const menu = new ListMenu(this, items, {
      x: GAME_W / 2 - 80,
      y: 168,
      width: 160,
      startIndex: hasSaves ? 1 : 0,
    });
    const pick = await menu.choose();
    if (pick === 0) {
      await this.newGame();
    } else if (pick === 1) {
      await this.continueMenu();
    } else {
      void this.mainMenu();
    }
  }

  private async newGame(): Promise<void> {
    const dialog = new DialogBox(this);
    await dialog.show('Welcome to the world of Monstra!\nA note on saving: your adventure is stored in this browser. Clearing browser data will erase your saves.');
    dialog.destroy();
    let name = '';
    try {
      name = window.prompt('What is your name, trainer?', 'Ari')?.trim().slice(0, 10) ?? '';
    } catch {
      name = '';
    }
    setState(newGameState(name || 'Ari'));
    await fade(this, 'out');
    audio.stopMusic();
    this.scene.start('overworld');
  }

  private async continueMenu(): Promise<void> {
    const items = SLOTS.map((slot) => {
      const s = slotSummary(slot);
      if (!s) return { label: `${slotLabel(slot)} — empty`, disabled: true };
      return {
        label: `${slotLabel(slot)} — ${s.playerName}`,
        rightLabel: `☆${s.badges} ${formatPlaytime(s.playtimeMs)}`,
      };
    });
    const menu = new ListMenu(this, items, {
      x: GAME_W / 2 - 130,
      y: 162,
      width: 260,
      title: 'Load which save?',
    });
    const pick = await menu.choose();
    if (pick === null) {
      void this.mainMenu();
      return;
    }
    const state = loadFromSlot(SLOTS[pick]);
    if (!state) {
      void this.mainMenu();
      return;
    }
    gameRNG.setSeed(state.rngSeed);
    setState(state);
    await fade(this, 'out');
    audio.stopMusic();
    this.scene.start('overworld');
  }
}

function slotLabel(slot: SlotId): string {
  return slot === 'auto' ? 'Autosave' : `Slot ${slot.slice(-1)}`;
}
