/**
 * CreditsScene — Hall of Fame and credits after defeating the Champion.
 */
import Phaser from 'phaser';
import { getState } from '../engine/state';
import { displayName } from '../engine/creature';
import { speciesById } from '../data/species';
import { creatureKey } from '../render/assets';
import { GAME_W, GAME_H, UI_FONT, UI_FONT_BIG, UI_FONT_SMALL, InputTap } from '../ui/ui';
import { audio } from '../audio/audio';
import { formatPlaytime } from '../engine/save';

export class CreditsScene extends Phaser.Scene {
  constructor() {
    super('credits');
  }

  create(): void {
    audio.playMusic('credits');
    const s = getState();
    const g = this.add.graphics();
    g.fillGradientStyle(0x101030, 0x101030, 0x282818, 0x282818, 1);
    g.fillRect(0, 0, GAME_W, GAME_H);

    this.add.text(GAME_W / 2, 36, 'HALL OF FAME', { ...UI_FONT_BIG, color: '#f0d048' }).setOrigin(0.5);
    this.add.text(GAME_W / 2, 62, `Champion ${s.player.name} · ${formatPlaytime(s.player.playtimeMs)} · ${s.caught.length} caught`, UI_FONT_SMALL).setOrigin(0.5);

    s.party.forEach((c, i) => {
      const x = 70 + (i % 3) * 130;
      const y = 120 + Math.floor(i / 3) * 95;
      const img = this.add.image(x, y, creatureKey(c.speciesId, 'front', c.shiny)).setScale(0.7).setAlpha(0);
      this.add.text(x, y + 40, `${displayName(c)} Lv${c.level}`, UI_FONT_SMALL).setOrigin(0.5).setAlpha(0.9);
      this.tweens.add({ targets: img, alpha: 1, scale: 0.8, delay: i * 350, duration: 500, ease: 'Back.easeOut' });
      void speciesById(c.speciesId);
    });

    const credits = this.add.text(GAME_W / 2, GAME_H + 20,
      'MONSTRA — Tales of Veridia\n\nA complete creature-collecting RPG\ngenerated as a single build.\n\nEvery sprite drawn procedurally.\nEvery note synthesized live.\n\nThank you for playing.\n\nThe world of Veridia is still out there —\nwild shinies, unfilled boxes,\nand one very humbled rival.\n\nPress confirm to return to your journey.',
      { ...UI_FONT, align: 'center' }).setOrigin(0.5, 0);
    this.tweens.add({ targets: credits, y: GAME_H - 280, duration: 16000, ease: 'Linear' });

    this.time.delayedCall(2500, () => {
      const tap = new InputTap(this, {
        confirm: () => {
          tap.dispose();
          audio.stopMusic();
          this.scene.start('overworld');
        },
      });
    });
  }
}
