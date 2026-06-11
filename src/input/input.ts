/**
 * Global input — held movement keys, action key events, and mouse orbit.
 * The 3D world reads `moveVector()` each frame; UI components subscribe to
 * discrete confirm/cancel/dir events exactly like the old window listeners.
 */

export type UiDir = 'up' | 'down' | 'left' | 'right';

interface UiHandlers {
  confirm?: () => void;
  cancel?: () => void;
  dir?: (d: UiDir) => void;
}

const held = new Set<string>();
const uiStack: UiHandlers[] = [];

/** Listeners fired only when no UI tap is active (overworld hotkeys). */
export const worldKeys = {
  onConfirm: null as (() => void) | null,
  onMenu: null as (() => void) | null,
  onFullscreen: null as (() => void) | null,
};

export function uiActive(): boolean {
  return uiStack.length > 0;
}

window.addEventListener('keydown', (e: KeyboardEvent) => {
  held.add(e.code);
  const top = uiStack[uiStack.length - 1];
  switch (e.code) {
    case 'KeyZ':
    case 'Space':
      e.preventDefault();
      if (top) top.confirm?.();
      else worldKeys.onConfirm?.();
      break;
    case 'Enter':
      // confirm inside UI; pause menu in the open world (classic mapping)
      e.preventDefault();
      if (top) top.confirm?.();
      else worldKeys.onMenu?.();
      break;
    case 'KeyX':
    case 'Escape':
    case 'Backspace':
      e.preventDefault();
      if (top) top.cancel?.();
      else worldKeys.onMenu?.();
      break;
    case 'ArrowUp':
    case 'KeyW':
      if (top) {
        e.preventDefault();
        top.dir?.('up');
      }
      break;
    case 'ArrowDown':
    case 'KeyS':
      if (top) {
        e.preventDefault();
        top.dir?.('down');
      }
      break;
    case 'ArrowLeft':
    case 'KeyA':
      if (top) {
        e.preventDefault();
        top.dir?.('left');
      }
      break;
    case 'ArrowRight':
    case 'KeyD':
      if (top) {
        e.preventDefault();
        top.dir?.('right');
      }
      break;
    case 'KeyF':
      worldKeys.onFullscreen?.();
      break;
  }
});

window.addEventListener('keyup', (e: KeyboardEvent) => held.delete(e.code));
window.addEventListener('blur', () => held.clear());

/**
 * Subscribe a UI layer to discrete input. The most recently created tap
 * wins (menus stack over dialogs). Dispose to restore the layer below.
 */
export class InputTap {
  private handlers: UiHandlers;
  private disposed = false;

  constructor(handlers: UiHandlers) {
    this.handlers = handlers;
    uiStack.push(handlers);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const i = uiStack.indexOf(this.handlers);
    if (i >= 0) uiStack.splice(i, 1);
  }
}

/** Camera-relative move intent: x = strafe, y = forward. Unit length max. */
export function moveInput(): { x: number; y: number } {
  let x = 0;
  let y = 0;
  if (held.has('KeyW') || held.has('ArrowUp')) y += 1;
  if (held.has('KeyS') || held.has('ArrowDown')) y -= 1;
  if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1;
  if (held.has('KeyD') || held.has('ArrowRight')) x += 1;
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  return { x, y };
}

export function runHeld(): boolean {
  return held.has('ShiftLeft') || held.has('ShiftRight');
}

// ----------------------------------------------------------- mouse orbit

/** Camera orbit state, mutated by mouse drag / wheel; read by the chase cam. */
export const orbit = {
  yaw: 0, // radians around the player; 0 = camera looks north (-z)
  pitch: 0.62,
  dist: 7.5,
};

let dragging = false;
let lastX = 0;
let lastY = 0;

export function bindPointer(canvas: HTMLCanvasElement): void {
  canvas.addEventListener('mousedown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => (dragging = false));
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    orbit.yaw -= (e.clientX - lastX) * 0.005;
    orbit.pitch = Math.min(1.35, Math.max(0.18, orbit.pitch + (e.clientY - lastY) * 0.004));
    lastX = e.clientX;
    lastY = e.clientY;
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      orbit.dist = Math.min(14, Math.max(3.5, orbit.dist + e.deltaY * 0.01));
    },
    { passive: false },
  );
}
