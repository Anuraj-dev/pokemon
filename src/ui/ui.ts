/**
 * Shared UI toolkit — classic message windows, typewriter dialog boxes,
 * list menus, and async input helpers. Used by every scene.
 */
import Phaser from 'phaser';
import { getState, hasState } from '../engine/state';
import { audio } from '../audio/audio';

export const GAME_W = 480;
export const GAME_H = 320;

export const UI_FONT = {
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '13px',
  color: '#f8f8f8',
  resolution: 2,
} as const;

export const UI_FONT_SMALL = { ...UI_FONT, fontSize: '11px' } as const;
export const UI_FONT_BIG = { ...UI_FONT, fontSize: '17px' } as const;

/** Global virtual-pad state, written by the HUD scene on touch devices. */
export const vpad = {
  dirs: { up: false, down: false, left: false, right: false },
  bHeld: false,
  emitter: new Phaser.Events.EventEmitter(), // 'a' | 'b' | 'start'
};

export function drawWindow(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, opts: { fill?: number; alpha?: number } = {}): void {
  g.fillStyle(0x101828, opts.alpha ?? 0.94);
  g.fillRoundedRect(x, y, w, h, 6);
  g.lineStyle(2, 0xf0f0f8, 1);
  g.strokeRoundedRect(x + 1, y + 1, w - 2, h - 2, 6);
  g.lineStyle(1, 0x6878a8, 1);
  g.strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, 5);
  if (opts.fill !== undefined) {
    g.fillStyle(opts.fill, 0.18);
    g.fillRoundedRect(x + 3, y + 3, w - 6, h - 6, 5);
  }
}

function textSpeedMs(): number {
  if (!hasState()) return 14;
  const s = getState().settings.textSpeed;
  return s === 1 ? 28 : s === 3 ? 6 : 14;
}

/** Wrap text to a character width, respecting explicit newlines. */
export function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      if (line.length === 0) line = word;
      else if (line.length + 1 + word.length <= width) line += ' ' + word;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

interface KeyHandlers {
  confirm?: () => void;
  cancel?: () => void;
  dir?: (d: 'up' | 'down' | 'left' | 'right') => void;
}

/**
 * Listen for confirm/cancel/direction inputs (keyboard + virtual pad)
 * until disposed. Each UI component creates one while active.
 */
export class InputTap {
  private keyHandler: (e: KeyboardEvent) => void;
  private vpadA: () => void;
  private vpadB: () => void;
  private vpadDir: (d: 'up' | 'down' | 'left' | 'right') => void;
  private disposed = false;

  constructor(scene: Phaser.Scene, handlers: KeyHandlers) {
    this.keyHandler = (e: KeyboardEvent) => {
      if (this.disposed) return;
      switch (e.code) {
        case 'KeyZ':
        case 'Enter':
        case 'Space':
          e.preventDefault();
          handlers.confirm?.();
          break;
        case 'KeyX':
        case 'Escape':
        case 'Backspace':
          e.preventDefault();
          handlers.cancel?.();
          break;
        case 'ArrowUp':
        case 'KeyW':
          e.preventDefault();
          handlers.dir?.('up');
          break;
        case 'ArrowDown':
        case 'KeyS':
          e.preventDefault();
          handlers.dir?.('down');
          break;
        case 'ArrowLeft':
        case 'KeyA':
          e.preventDefault();
          handlers.dir?.('left');
          break;
        case 'ArrowRight':
        case 'KeyD':
          e.preventDefault();
          handlers.dir?.('right');
          break;
      }
    };
    window.addEventListener('keydown', this.keyHandler);
    this.vpadA = () => !this.disposed && handlers.confirm?.();
    this.vpadB = () => !this.disposed && handlers.cancel?.();
    this.vpadDir = (d) => !this.disposed && handlers.dir?.(d);
    vpad.emitter.on('a', this.vpadA);
    vpad.emitter.on('b', this.vpadB);
    vpad.emitter.on('dir', this.vpadDir);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.dispose());
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('keydown', this.keyHandler);
    vpad.emitter.off('a', this.vpadA);
    vpad.emitter.off('b', this.vpadB);
    vpad.emitter.off('dir', this.vpadDir);
  }
}

/** A classic bottom message box with typewriter text. */
export class DialogBox {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private textObj: Phaser.GameObjects.Text;
  private arrow: Phaser.GameObjects.Text;
  private depth: number;

  constructor(scene: Phaser.Scene, depth = 1000) {
    this.scene = scene;
    this.depth = depth;
    const g = scene.add.graphics();
    drawWindow(g, 4, GAME_H - 78, GAME_W - 8, 74);
    this.textObj = scene.add.text(16, GAME_H - 66, '', { ...UI_FONT, wordWrap: { width: GAME_W - 40 } });
    this.arrow = scene.add.text(GAME_W - 26, GAME_H - 22, '▼', { ...UI_FONT_SMALL, color: '#f0d048' });
    this.arrow.setVisible(false);
    this.container = scene.add.container(0, 0, [g, this.textObj, this.arrow]);
    this.container.setDepth(depth);
    this.container.setVisible(false);
    this.container.setScrollFactor(0);
  }

  get visible(): boolean {
    return this.container.visible;
  }

  /** Show text (auto-paged), resolve when the player has read everything. */
  async show(text: string, opts: { holdLastPage?: boolean; autoMs?: number } = {}): Promise<void> {
    this.container.setVisible(true);
    const lines = wrapText(text, 52);
    const pages: string[] = [];
    for (let i = 0; i < lines.length; i += 3) pages.push(lines.slice(i, i + 3).join('\n'));
    for (let p = 0; p < pages.length; p++) {
      await this.typePage(pages[p]);
      const last = p === pages.length - 1;
      if (!last || !opts.holdLastPage) {
        await this.waitAdvance(opts.autoMs);
      }
    }
    if (!opts.holdLastPage) this.hide();
  }

  private typePage(page: string): Promise<void> {
    return new Promise((resolve) => {
      this.arrow.setVisible(false);
      this.textObj.setText('');
      let i = 0;
      let done = false;
      const speed = textSpeedMs();
      const timer = this.scene.time.addEvent({
        delay: speed,
        loop: true,
        callback: () => {
          i += 1;
          this.textObj.setText(page.slice(0, i));
          if (i % 3 === 0) audio.sfxMenuMove();
          if (i >= page.length) finish();
        },
      });
      const tap = new InputTap(this.scene, {
        confirm: () => {
          if (!done) {
            this.textObj.setText(page);
            finish();
          }
        },
      });
      const finish = () => {
        if (done) return;
        done = true;
        timer.remove();
        tap.dispose();
        resolve();
      };
    });
  }

  private waitAdvance(autoMs?: number): Promise<void> {
    return new Promise((resolve) => {
      this.arrow.setVisible(true);
      this.scene.tweens.add({ targets: this.arrow, y: '+=3', duration: 280, yoyo: true, repeat: -1 });
      let done = false;
      const finish = (sound: boolean) => {
        if (done) return;
        done = true;
        if (sound) audio.sfxMenuSelect();
        this.scene.tweens.killTweensOf(this.arrow);
        this.arrow.setY(GAME_H - 22);
        this.arrow.setVisible(false);
        tap.dispose();
        resolve();
      };
      const tap = new InputTap(this.scene, { confirm: () => finish(true) });
      if (autoMs !== undefined) this.scene.time.delayedCall(autoMs, () => finish(false));
    });
  }

  hide(): void {
    this.container.setVisible(false);
    this.textObj.setText('');
  }

  destroy(): void {
    this.container.destroy();
  }
}

export interface MenuItem {
  label: string;
  rightLabel?: string;
  disabled?: boolean;
}

export interface MenuOptions {
  x: number;
  y: number;
  width: number;
  visibleRows?: number;
  title?: string;
  depth?: number;
  /** keep the menu rendered after selection (caller destroys) */
  sticky?: boolean;
  startIndex?: number;
  onHover?: (index: number) => void;
}

/** A vertical list menu. Resolves selected index, or null when cancelled. */
export class ListMenu {
  private scene: Phaser.Scene;
  private opts: MenuOptions;
  private items: MenuItem[];
  private container!: Phaser.GameObjects.Container;
  private rows: Phaser.GameObjects.Text[] = [];
  private rightRows: Phaser.GameObjects.Text[] = [];
  private cursor!: Phaser.GameObjects.Text;
  index = 0;
  private scroll = 0;
  private tap: InputTap | null = null;

  constructor(scene: Phaser.Scene, items: MenuItem[], opts: MenuOptions) {
    this.scene = scene;
    this.items = items;
    this.opts = opts;
    this.index = Math.min(opts.startIndex ?? 0, items.length - 1);
    this.build();
  }

  private get visibleRows(): number {
    return Math.min(this.opts.visibleRows ?? this.items.length, this.items.length);
  }

  private build(): void {
    const { x, y, width } = this.opts;
    const rowH = 18;
    const titleH = this.opts.title ? 18 : 0;
    const h = this.visibleRows * rowH + 16 + titleH;
    const g = this.scene.add.graphics();
    drawWindow(g, x, y, width, h);
    const children: Phaser.GameObjects.GameObject[] = [g];
    if (this.opts.title) {
      const t = this.scene.add.text(x + 12, y + 7, this.opts.title, { ...UI_FONT_SMALL, color: '#f0d048' });
      children.push(t);
    }
    for (let r = 0; r < this.visibleRows; r++) {
      const row = this.scene.add.text(x + 24, y + 9 + titleH + r * rowH, '', UI_FONT);
      const right = this.scene.add.text(x + width - 12, y + 9 + titleH + r * rowH, '', UI_FONT_SMALL).setOrigin(1, 0);
      this.rows.push(row);
      this.rightRows.push(right);
      children.push(row, right);
    }
    this.cursor = this.scene.add.text(x + 10, y + 9 + titleH, '►', { ...UI_FONT, color: '#f0d048' });
    children.push(this.cursor);
    this.container = this.scene.add.container(0, 0, children);
    this.container.setDepth(this.opts.depth ?? 1200);
    this.container.setScrollFactor(0);
    this.refresh();
  }

  private refresh(): void {
    if (this.index < this.scroll) this.scroll = this.index;
    if (this.index >= this.scroll + this.visibleRows) this.scroll = this.index - this.visibleRows + 1;
    for (let r = 0; r < this.visibleRows; r++) {
      const item = this.items[this.scroll + r];
      this.rows[r].setText(item ? item.label : '');
      this.rows[r].setColor(item?.disabled ? '#8890a8' : '#f8f8f8');
      this.rightRows[r].setText(item?.rightLabel ?? '');
    }
    const rowH = 18;
    const titleH = this.opts.title ? 18 : 0;
    this.cursor.setY(this.opts.y + 9 + titleH + (this.index - this.scroll) * rowH);
    this.opts.onHover?.(this.index);
  }

  /** Run the menu until a choice or cancel. */
  choose(): Promise<number | null> {
    return new Promise((resolve) => {
      this.tap = new InputTap(this.scene, {
        dir: (d) => {
          if (d === 'up') this.move(-1);
          else if (d === 'down') this.move(1);
        },
        confirm: () => {
          const item = this.items[this.index];
          if (!item || item.disabled) {
            audio.sfxBump();
            return;
          }
          audio.sfxMenuSelect();
          this.finish();
          resolve(this.index);
        },
        cancel: () => {
          audio.sfxMenuCancel();
          this.finish();
          resolve(null);
        },
      });
    });
  }

  private move(delta: number): void {
    const n = this.items.length;
    this.index = (this.index + delta + n) % n;
    audio.sfxMenuMove();
    this.refresh();
  }

  private finish(): void {
    this.tap?.dispose();
    this.tap = null;
    if (!this.opts.sticky) this.destroy();
  }

  destroy(): void {
    this.tap?.dispose();
    this.container.destroy();
  }
}

/** Simple async yes/no choice. */
export async function confirmMenu(scene: Phaser.Scene, title?: string): Promise<boolean> {
  const menu = new ListMenu(scene, [{ label: 'Yes' }, { label: 'No' }], {
    x: GAME_W - 130,
    y: GAME_H - 160,
    width: 120,
    title,
    depth: 1500,
  });
  const r = await menu.choose();
  return r === 0;
}

/** Fade helper. */
export function fade(scene: Phaser.Scene, dir: 'in' | 'out', ms = 280): Promise<void> {
  return new Promise((resolve) => {
    const cam = scene.cameras.main;
    if (dir === 'out') cam.fadeOut(ms, 8, 8, 16);
    else cam.fadeIn(ms, 8, 8, 16);
    cam.once(dir === 'out' ? Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE : Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => resolve());
  });
}

export function sleep(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((resolve) => scene.time.delayedCall(ms, resolve));
}

/** HP bar color by fraction. */
export function hpColor(frac: number): number {
  if (frac > 0.5) return 0x48c858;
  if (frac > 0.2) return 0xe8c030;
  return 0xe04838;
}
