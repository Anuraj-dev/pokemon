/**
 * HudScene — always-on-top touch controls (D-pad, A/B, menu) shown on
 * touch devices. Feeds the shared `vpad` state read by all scenes.
 */
import Phaser from 'phaser';
import { vpad, GAME_W, GAME_H } from '../ui/ui';
import { hotSwapFileAssets } from '../render/assets';

export class HudScene extends Phaser.Scene {
  constructor() {
    super('hud');
  }

  create(): void {
    // This scene lives for the whole session, so it owns the background
    // asset hot-swap (BootScene stops before its delayed call would fire).
    this.time.delayedCall(100, () => hotSwapFileAssets(this));

    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouch) return;
    this.input.addPointer(2);

    const alpha = 0.35;
    const padCx = 56;
    const padCy = GAME_H - 60;
    const dirs: { d: 'up' | 'down' | 'left' | 'right'; dx: number; dy: number }[] = [
      { d: 'up', dx: 0, dy: -30 },
      { d: 'down', dx: 0, dy: 30 },
      { d: 'left', dx: -30, dy: 0 },
      { d: 'right', dx: 30, dy: 0 },
    ];
    for (const { d, dx, dy } of dirs) {
      const r = this.add.rectangle(padCx + dx, padCy + dy, 30, 30, 0xffffff, alpha).setInteractive();
      r.setDepth(5000);
      r.on('pointerdown', () => {
        vpad.dirs[d] = true;
        vpad.emitter.emit('dir', d);
        r.setAlpha(0.8);
      });
      const up = () => {
        vpad.dirs[d] = false;
        r.setAlpha(1);
      };
      r.on('pointerup', up);
      r.on('pointerout', up);
    }

    const a = this.add.circle(GAME_W - 36, GAME_H - 76, 20, 0xe04838, alpha + 0.15).setInteractive();
    this.add.text(GAME_W - 36, GAME_H - 76, 'A', { fontFamily: 'monospace', fontSize: '14px', color: '#fff' }).setOrigin(0.5).setDepth(5001);
    a.setDepth(5000);
    a.on('pointerdown', () => vpad.emitter.emit('a'));

    const b = this.add.circle(GAME_W - 78, GAME_H - 40, 20, 0x4868c0, alpha + 0.15).setInteractive();
    this.add.text(GAME_W - 78, GAME_H - 40, 'B', { fontFamily: 'monospace', fontSize: '14px', color: '#fff' }).setOrigin(0.5).setDepth(5001);
    b.setDepth(5000);
    b.on('pointerdown', () => {
      vpad.bHeld = true;
      vpad.emitter.emit('b');
    });
    b.on('pointerup', () => (vpad.bHeld = false));
    b.on('pointerout', () => (vpad.bHeld = false));

    const m = this.add.rectangle(GAME_W - 30, 16, 44, 18, 0xffffff, alpha).setInteractive();
    this.add.text(GAME_W - 30, 16, 'MENU', { fontFamily: 'monospace', fontSize: '9px', color: '#fff' }).setOrigin(0.5).setDepth(5001);
    m.setDepth(5000);
    m.on('pointerdown', () => vpad.emitter.emit('start'));
  }
}
