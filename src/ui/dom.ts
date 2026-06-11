/**
 * DOM UI toolkit — classic message windows, typewriter dialog boxes, and
 * list menus rendered as an HTML overlay above the 3D canvas. Keeps the
 * original 480×320 virtual layout, scaled to fill the viewport.
 */
import { getState, hasState } from '../engine/state';
import { audio } from '../audio/audio';
import { InputTap } from '../input/input';

export const GAME_W = 480;
export const GAME_H = 320;

let root: HTMLDivElement | null = null;

/** The scaled 480×320 overlay all UI elements live in. */
export function uiRoot(): HTMLDivElement {
  if (root) return root;
  root = document.createElement('div');
  root.id = 'ui';
  document.body.appendChild(root);
  const rescale = () => {
    const s = Math.min(window.innerWidth / GAME_W, window.innerHeight / GAME_H);
    root!.style.transform = `translate(-50%, -50%) scale(${s})`;
  };
  window.addEventListener('resize', rescale);
  document.addEventListener('fullscreenchange', rescale);
  rescale();
  return root;
}

export function el(tag: string, cls: string, parent?: HTMLElement): HTMLDivElement {
  const e = document.createElement(tag) as HTMLDivElement;
  e.className = cls;
  (parent ?? uiRoot()).appendChild(e);
  return e;
}

/** A bordered retro window panel at virtual coordinates. */
export function panel(x: number, y: number, w: number, h: number, opts: { fill?: string } = {}): HTMLDivElement {
  const p = el('div', 'win');
  p.style.left = `${x}px`;
  p.style.top = `${y}px`;
  p.style.width = `${w}px`;
  p.style.height = `${h}px`;
  if (opts.fill) p.style.background = opts.fill;
  return p;
}

export function label(parent: HTMLElement | null, x: number, y: number, text: string, cls = ''): HTMLDivElement {
  const t = el('div', `txt ${cls}`, parent ?? undefined);
  t.style.left = `${x}px`;
  t.style.top = `${y}px`;
  t.textContent = text;
  return t;
}

function textSpeedMs(): number {
  if (!hasState()) return 14;
  const s = getState().settings.textSpeed;
  return s === 1 ? 28 : s === 3 ? 6 : 14;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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

export function hpColor(frac: number): string {
  if (frac > 0.5) return '#48c858';
  if (frac > 0.2) return '#e8c030';
  return '#e04838';
}

/** Full-screen fade for travel/battle transitions. */
let fadeEl: HTMLDivElement | null = null;

export function fade(dir: 'in' | 'out', ms = 280): Promise<void> {
  if (!fadeEl) {
    fadeEl = el('div', 'fade', document.body);
    fadeEl.style.opacity = '0';
  }
  fadeEl.style.transition = `opacity ${ms}ms linear`;
  // force a style flush so the transition always plays
  void fadeEl.offsetWidth;
  fadeEl.style.opacity = dir === 'out' ? '1' : '0';
  return sleep(ms);
}

/** A classic bottom message box with typewriter text. */
export class DialogBox {
  private box: HTMLDivElement;
  private textEl: HTMLDivElement;
  private arrow: HTMLDivElement;

  constructor() {
    this.box = panel(4, GAME_H - 78, GAME_W - 8, 74);
    this.box.classList.add('dialog');
    this.textEl = label(this.box, 12, 8, '');
    this.textEl.style.whiteSpace = 'pre-wrap';
    this.textEl.style.width = `${GAME_W - 44}px`;
    this.arrow = label(this.box, GAME_W - 30, 52, '▼', 'gold blink');
    this.arrow.style.display = 'none';
    this.box.style.display = 'none';
  }

  get visible(): boolean {
    return this.box.style.display !== 'none';
  }

  /** Show text (auto-paged), resolve when the player has read everything. */
  async show(text: string, opts: { holdLastPage?: boolean; autoMs?: number } = {}): Promise<void> {
    this.box.style.display = 'block';
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
      this.arrow.style.display = 'none';
      this.textEl.textContent = '';
      let i = 0;
      let done = false;
      const speed = textSpeedMs();
      const timer = setInterval(() => {
        i += 1;
        this.textEl.textContent = page.slice(0, i);
        if (i % 3 === 0) audio.sfxMenuMove();
        if (i >= page.length) finish();
      }, speed);
      const tap = new InputTap({
        confirm: () => {
          if (!done) {
            this.textEl.textContent = page;
            finish();
          }
        },
      });
      const finish = () => {
        if (done) return;
        done = true;
        clearInterval(timer);
        tap.dispose();
        resolve();
      };
    });
  }

  private waitAdvance(autoMs?: number): Promise<void> {
    return new Promise((resolve) => {
      this.arrow.style.display = 'block';
      let done = false;
      const finish = (sound: boolean) => {
        if (done) return;
        done = true;
        if (sound) audio.sfxMenuSelect();
        this.arrow.style.display = 'none';
        tap.dispose();
        resolve();
      };
      const tap = new InputTap({ confirm: () => finish(true) });
      if (autoMs !== undefined) setTimeout(() => finish(false), autoMs);
    });
  }

  hide(): void {
    this.box.style.display = 'none';
    this.textEl.textContent = '';
  }

  destroy(): void {
    this.box.remove();
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
  sticky?: boolean;
  startIndex?: number;
  onHover?: (index: number) => void;
}

const ROW_H = 18;

/** A vertical list menu. Resolves selected index, or null when cancelled. */
export class ListMenu {
  private opts: MenuOptions;
  private items: MenuItem[];
  private box: HTMLDivElement;
  private rows: HTMLDivElement[] = [];
  private rightRows: HTMLDivElement[] = [];
  private cursor: HTMLDivElement;
  index = 0;
  private scroll = 0;
  private tap: InputTap | null = null;

  constructor(items: MenuItem[], opts: MenuOptions) {
    this.items = items;
    this.opts = opts;
    this.index = Math.min(opts.startIndex ?? 0, items.length - 1);
    const titleH = opts.title ? 18 : 0;
    const h = this.visibleRows * ROW_H + 16 + titleH;
    this.box = panel(opts.x, opts.y, opts.width, h);
    if (opts.title) label(this.box, 10, 5, opts.title, 'small gold');
    for (let r = 0; r < this.visibleRows; r++) {
      const row = label(this.box, 22, 7 + titleH + r * ROW_H, '');
      const right = label(this.box, 0, 7 + titleH + r * ROW_H, '', 'small right');
      right.style.left = 'auto';
      right.style.right = '10px';
      this.rows.push(row);
      this.rightRows.push(right);
    }
    this.cursor = label(this.box, 8, 7 + titleH, '►', 'gold');
    this.refresh();
  }

  private get visibleRows(): number {
    return Math.min(this.opts.visibleRows ?? this.items.length, this.items.length);
  }

  private refresh(): void {
    if (this.index < this.scroll) this.scroll = this.index;
    if (this.index >= this.scroll + this.visibleRows) this.scroll = this.index - this.visibleRows + 1;
    for (let r = 0; r < this.visibleRows; r++) {
      const item = this.items[this.scroll + r];
      this.rows[r].textContent = item ? item.label : '';
      this.rows[r].style.color = item?.disabled ? '#8890a8' : '#f8f8f8';
      this.rightRows[r].textContent = item?.rightLabel ?? '';
    }
    const titleH = this.opts.title ? 18 : 0;
    this.cursor.style.top = `${7 + titleH + (this.index - this.scroll) * ROW_H}px`;
    this.opts.onHover?.(this.index);
  }

  /** Run the menu until a choice or cancel. */
  choose(): Promise<number | null> {
    return new Promise((resolve) => {
      this.tap = new InputTap({
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
    this.box.remove();
  }
}

/** Simple async yes/no choice. */
export async function confirmMenu(title?: string): Promise<boolean> {
  const menu = new ListMenu([{ label: 'Yes' }, { label: 'No' }], {
    x: GAME_W - 130,
    y: GAME_H - 160,
    width: 120,
    title,
  });
  const r = await menu.choose();
  return r === 0;
}

/** Block until confirm or cancel is pressed (info panels). */
export function waitDismiss(): Promise<void> {
  return new Promise((resolve) => {
    const tap = new InputTap({
      confirm: () => {
        tap.dispose();
        resolve();
      },
      cancel: () => {
        tap.dispose();
        resolve();
      },
    });
  });
}
