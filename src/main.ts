/**
 * Monstra — entrypoint. A complete browser creature-collector RPG with
 * procedural art and audio. See README.md for the asset hot-swap contract.
 */
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { OverworldScene } from './scenes/OverworldScene';
import { BattleScene } from './scenes/BattleScene';
import { MenuScene } from './scenes/MenuScene';
import { CreditsScene } from './scenes/CreditsScene';
import { HudScene } from './scenes/HudScene';
import { GAME_W, GAME_H } from './ui/ui';
import { getState, hasState } from './engine/state';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#08080f',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, TitleScene, OverworldScene, BattleScene, MenuScene, CreditsScene, HudScene],
});

// Debug/automation handle (used by the smoke test; harmless in production).
declare global {
  interface Window {
    __monstra: { game: Phaser.Game; getState: typeof getState; hasState: typeof hasState };
  }
}
window.__monstra = { game, getState, hasState };
