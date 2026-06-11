/**
 * BootScene — generates all procedural textures, then heads to the title.
 * Background-loads any real PNG assets afterwards (hot-swap contract).
 */
import Phaser from 'phaser';
import { registerAllTextures } from '../render/assets';
import { audio } from '../audio/audio';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    registerAllTextures(this);
    // Unlock audio on the first user gesture anywhere.
    const unlock = () => audio.unlock();
    this.input.on('pointerdown', unlock);
    window.addEventListener('keydown', unlock, { once: false });

    this.scene.launch('hud');
    this.scene.start('title');
  }
}
