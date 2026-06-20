/**
 * Move FX — a particle/projectile animation vocabulary and one recipe per
 * move, so every move in the game looks distinct in the 3D arena.
 * Primitives are cheap sprite emissions (soft orbs, rocks, leaves, bolts,
 * slashes, rings, glyphs…) sequenced by per-move recipes; Battle3D drives
 * the camera/lunge/impact framing around them.
 */
import * as THREE from 'three';
import { TYPE_COLORS } from '../data/types';
import { moveById } from '../data/moves';

// ----------------------------------------------------------- shape canvas

type Shape = 'orb' | 'rock' | 'leaf' | 'star' | 'ring' | 'slash' | 'bolt' | 'drop';

const shapeCache = new Map<Shape, THREE.CanvasTexture>();

function shapeTexture(shape: Shape): THREE.CanvasTexture {
  const got = shapeCache.get(shape);
  if (got) return got;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  switch (shape) {
    case 'orb': {
      const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.55, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      break;
    }
    case 'rock':
      ctx.beginPath();
      ctx.moveTo(14, 44);
      ctx.lineTo(8, 26);
      ctx.lineTo(24, 12);
      ctx.lineTo(48, 16);
      ctx.lineTo(56, 36);
      ctx.lineTo(40, 52);
      ctx.closePath();
      ctx.fill();
      break;
    case 'leaf':
      ctx.beginPath();
      ctx.ellipse(32, 32, 26, 11, Math.PI / 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.clearRect(30, 30, 3, 3);
      break;
    case 'star': {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 === 0 ? 28 : 9;
        const a = (i / 8) * Math.PI * 2;
        ctx[i === 0 ? 'moveTo' : 'lineTo'](32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'ring':
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(32, 32, 24, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'slash':
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(32, 70, 52, -Math.PI * 0.82, -Math.PI * 0.18);
      ctx.stroke();
      break;
    case 'bolt':
      ctx.beginPath();
      ctx.moveTo(38, 2);
      ctx.lineTo(18, 34);
      ctx.lineTo(30, 34);
      ctx.lineTo(22, 62);
      ctx.lineTo(48, 26);
      ctx.lineTo(34, 26);
      ctx.lineTo(44, 2);
      ctx.closePath();
      ctx.fill();
      break;
    case 'drop':
      ctx.beginPath();
      ctx.moveTo(32, 6);
      ctx.quadraticCurveTo(50, 36, 32, 54);
      ctx.quadraticCurveTo(14, 36, 32, 6);
      ctx.fill();
      break;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  shapeCache.set(shape, tex);
  return tex;
}

function glyphTexture(symbol: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.font = 'bold 44px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#000';
  ctx.strokeText(symbol, 32, 34);
  ctx.fillStyle = '#fff';
  ctx.fillText(symbol, 32, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ----------------------------------------------------------- recipe model

type At = 'self' | 'foe';

export type FxStep =
  /** thrown shapes from attacker to defender (volleys stagger) */
  | { fx: 'projectile'; shape?: Shape; count?: number; size?: number; arc?: number; ms?: number; color?: number; spread?: number }
  /** a line of light filling in from attacker to defender */
  | { fx: 'beam'; color?: number; size?: number; ms?: number }
  /** radial burst of shapes at a combatant */
  | { fx: 'nova'; at: At; shape?: Shape; count?: number; radius?: number; ms?: number; color?: number; up?: boolean }
  /** expanding ground ring */
  | { fx: 'ringwave'; at: At; color?: number; radius?: number; ms?: number }
  /** crossing slash arcs over the target */
  | { fx: 'slash'; at?: At; count?: number; color?: number }
  /** particles rising (or sinking) around a combatant */
  | { fx: 'aura'; at: At; color?: number; ms?: number; down?: boolean; shape?: Shape }
  /** slow translucent drifting puffs */
  | { fx: 'mist'; at: At; color?: number; ms?: number }
  /** shapes raining down over the target */
  | { fx: 'rain'; at: At; shape?: Shape; count?: number; color?: number; ms?: number }
  /** rocks erupting from the ground under the target */
  | { fx: 'debris'; at: At; color?: number }
  /** shapes orbiting a combatant */
  | { fx: 'orbit'; at: At; shape?: Shape; count?: number; color?: number; ms?: number }
  /** floating symbol (Z, ⬆, ⬇, ☠ …) */
  | { fx: 'glyph'; at: At; symbol: string; color?: number }
  /** tint the combatant's sprite briefly */
  | { fx: 'flash'; at: At; color?: number }
  /** camera shake */
  | { fx: 'shake'; ms?: number }
  | { fx: 'wait'; ms: number };

export interface MoveRecipe {
  /** physical contact dash toward the defender */
  lunge?: boolean;
  steps: FxStep[];
}

/** What the FX layer needs from the battle scene. */
export interface FxStage {
  scene: THREE.Scene;
  attacker: THREE.Vector3; // ground position of the attacking side
  defender: THREE.Vector3;
  shake(seconds: number): void;
  tintSprite(at: At, color: number): Promise<void>;
}

function tween(ms: number, fn: (k: number) => void): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      fn(k);
      if (k < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ----------------------------------------------------------- the player

export class MoveFxPlayer {
  private stage: FxStage;

  constructor(stage: FxStage) {
    this.stage = stage;
  }

  /** Recipe for a move id — every move has one; safety net derives one. */
  recipeFor(moveId: string): MoveRecipe {
    const r = RECIPES[moveId];
    if (r) return r;
    const mv = moveById(moveId);
    return mv.category === 'physical'
      ? { lunge: true, steps: [{ fx: 'slash' }] }
      : mv.category === 'special'
        ? { steps: [{ fx: 'projectile' }] }
        : { steps: [{ fx: 'aura', at: 'self' }] };
  }

  async play(moveId: string, fallbackColor: number): Promise<void> {
    const recipe = this.recipeFor(moveId);
    for (const step of recipe.steps) {
      await this.step(step, fallbackColor);
    }
  }

  private at(which: At): THREE.Vector3 {
    return which === 'self' ? this.stage.attacker : this.stage.defender;
  }

  private spawn(shape: Shape, color: number, size: number): { s: THREE.Sprite; m: THREE.SpriteMaterial } {
    const m = new THREE.SpriteMaterial({ map: shapeTexture(shape), color, depthWrite: false, transparent: true });
    const s = new THREE.Sprite(m);
    s.scale.setScalar(size);
    this.stage.scene.add(s);
    return { s, m };
  }

  private async step(step: FxStep, fallback: number): Promise<void> {
    const color = ('color' in step ? step.color : undefined) ?? fallback;
    switch (step.fx) {
      case 'projectile': {
        const { shape = 'orb', count = 1, size = 0.4, arc = 0.8, ms = 260, spread = 0.25 } = step;
        const from = this.stage.attacker.clone().setY(1.2);
        const to = this.stage.defender.clone().setY(1.1);
        for (let i = 0; i < count; i++) {
          const { s, m } = this.spawn(shape, color, size);
          const jx = (Math.random() - 0.5) * spread * 2;
          const jy = (Math.random() - 0.5) * spread;
          const last = i === count - 1;
          const p = tween(ms, (k) => {
            s.position.lerpVectors(from, to, k);
            s.position.y += Math.sin(k * Math.PI) * arc + jy * k;
            s.position.x += jx * Math.sin(k * Math.PI);
            m.rotation = k * 5;
            m.opacity = k > 0.85 ? (1 - k) / 0.15 : 1;
          }).then(() => {
            this.stage.scene.remove(s);
            m.dispose();
          });
          if (last) await p;
          else await sleep(70);
        }
        break;
      }
      case 'beam': {
        const { size = 0.5, ms = 380 } = step;
        const from = this.stage.attacker.clone().setY(1.3);
        const to = this.stage.defender.clone().setY(1.1);
        const N = 14;
        const bits: { s: THREE.Sprite; m: THREE.SpriteMaterial }[] = [];
        for (let i = 0; i < N; i++) bits.push(this.spawn('orb', color, size * (0.8 + Math.random() * 0.5)));
        await tween(ms, (k) => {
          bits.forEach((b, i) => {
            const f = i / (N - 1);
            const vis = k * 1.3 >= f;
            b.s.visible = vis;
            if (!vis) return;
            b.s.position.lerpVectors(from, to, f);
            b.s.position.y += Math.sin(f * 9 + k * 14) * 0.07;
            b.m.opacity = Math.min(1, (k * 1.3 - f) * 4) * (1 - k * 0.55);
          });
        });
        for (const b of bits) {
          this.stage.scene.remove(b.s);
          b.m.dispose();
        }
        break;
      }
      case 'nova': {
        const { at, shape = 'orb', count = 12, radius = 1.5, ms = 360, up = false } = step;
        const c0 = this.at(at).clone().setY(1.0);
        const bits = Array.from({ length: count }, () => this.spawn(shape, color, 0.3));
        await tween(ms, (k) => {
          bits.forEach((b, i) => {
            const a = (Math.PI * 2 * i) / count;
            b.s.position.set(
              c0.x + Math.cos(a) * k * radius,
              c0.y + (up ? k * radius * 0.8 : Math.sin(a * 2) * 0.25 * k),
              c0.z + Math.sin(a) * k * radius,
            );
            b.m.rotation = a + k * 3;
            b.m.opacity = 1 - k;
          });
        });
        for (const b of bits) {
          this.stage.scene.remove(b.s);
          b.m.dispose();
        }
        break;
      }
      case 'ringwave': {
        const { at, radius = 2.2, ms = 420 } = step;
        const { s, m } = this.spawn('ring', color, 0.5);
        const c0 = this.at(at).clone().setY(0.18);
        s.position.copy(c0);
        await tween(ms, (k) => {
          s.scale.setScalar(0.5 + k * radius * 2);
          m.opacity = 1 - k;
        });
        this.stage.scene.remove(s);
        m.dispose();
        break;
      }
      case 'slash': {
        const { at = 'foe', count = 1 } = step;
        const c0 = this.at(at).clone().setY(1.2);
        for (let i = 0; i < count; i++) {
          const { s, m } = this.spawn('slash', color, 1.4);
          s.position.copy(c0);
          m.rotation = (i % 2 === 0 ? -0.5 : Math.PI * 0.6) + (Math.random() - 0.5) * 0.4;
          await tween(170, (k) => {
            s.scale.setScalar(0.8 + k * 1.2);
            m.opacity = 1 - k * k;
          });
          this.stage.scene.remove(s);
          m.dispose();
        }
        break;
      }
      case 'aura': {
        const { at, ms = 480, down = false, shape = 'orb' } = step;
        const c0 = this.at(at);
        const bits = Array.from({ length: 10 }, () => this.spawn(shape, color, 0.22));
        const seeds = bits.map(() => ({ a: Math.random() * Math.PI * 2, r: 0.4 + Math.random() * 0.5, o: Math.random() }));
        await tween(ms, (k) => {
          bits.forEach((b, i) => {
            const sd = seeds[i];
            const y = down ? 1.9 - ((k + sd.o) % 1) * 1.7 : 0.2 + ((k + sd.o) % 1) * 1.9;
            b.s.position.set(c0.x + Math.cos(sd.a) * sd.r, y, c0.z + Math.sin(sd.a) * sd.r);
            b.m.opacity = Math.sin(((k + sd.o) % 1) * Math.PI) * (1 - k * 0.4);
          });
        });
        for (const b of bits) {
          this.stage.scene.remove(b.s);
          b.m.dispose();
        }
        break;
      }
      case 'mist': {
        const { at, ms = 600 } = step;
        const c0 = this.at(at);
        const bits = Array.from({ length: 7 }, () => this.spawn('orb', color, 1.1 + Math.random()));
        const seeds = bits.map(() => ({ x: (Math.random() - 0.5) * 2.4, y: 0.5 + Math.random() * 1.2, z: (Math.random() - 0.5) * 1.6, v: 0.3 + Math.random() * 0.4 }));
        await tween(ms, (k) => {
          bits.forEach((b, i) => {
            const sd = seeds[i];
            b.s.position.set(c0.x + sd.x + k * sd.v, sd.y + k * 0.3, c0.z + sd.z);
            b.m.opacity = Math.sin(k * Math.PI) * 0.4;
          });
        });
        for (const b of bits) {
          this.stage.scene.remove(b.s);
          b.m.dispose();
        }
        break;
      }
      case 'rain': {
        const { at, shape = 'drop', count = 8, ms = 520 } = step;
        const c0 = this.at(at);
        const bits = Array.from({ length: count }, () => this.spawn(shape, color, 0.3));
        const seeds = bits.map(() => ({ x: (Math.random() - 0.5) * 2.2, z: (Math.random() - 0.5) * 1.6, o: Math.random() * 0.6 }));
        await tween(ms, (k) => {
          bits.forEach((b, i) => {
            const sd = seeds[i];
            const f = Math.max(0, Math.min(1, (k - sd.o) / 0.4));
            b.s.visible = f > 0 && f < 1;
            b.s.position.set(c0.x + sd.x, 2.6 - f * 2.5, c0.z + sd.z);
            b.m.opacity = 1 - f * 0.5;
          });
        });
        for (const b of bits) {
          this.stage.scene.remove(b.s);
          b.m.dispose();
        }
        break;
      }
      case 'debris': {
        const { at } = step;
        const c0 = this.at(at);
        const bits = Array.from({ length: 8 }, () => this.spawn('rock', color, 0.3 + Math.random() * 0.25));
        const seeds = bits.map(() => ({ x: (Math.random() - 0.5) * 1.8, z: (Math.random() - 0.5) * 1.2, h: 1 + Math.random() * 1.2 }));
        await tween(450, (k) => {
          bits.forEach((b, i) => {
            const sd = seeds[i];
            b.s.position.set(c0.x + sd.x, Math.sin(k * Math.PI) * sd.h + 0.1, c0.z + sd.z);
            b.m.rotation = k * 6;
            b.m.opacity = 1 - k * k;
          });
        });
        for (const b of bits) {
          this.stage.scene.remove(b.s);
          b.m.dispose();
        }
        break;
      }
      case 'orbit': {
        const { at, shape = 'orb', count = 6, ms = 520 } = step;
        const c0 = this.at(at);
        const bits = Array.from({ length: count }, () => this.spawn(shape, color, 0.3));
        await tween(ms, (k) => {
          bits.forEach((b, i) => {
            const a = (Math.PI * 2 * i) / count + k * Math.PI * 3;
            b.s.position.set(c0.x + Math.cos(a) * 1.1, 0.6 + k * 1.2, c0.z + Math.sin(a) * 1.1);
            b.m.opacity = Math.sin(k * Math.PI);
          });
        });
        for (const b of bits) {
          this.stage.scene.remove(b.s);
          b.m.dispose();
        }
        break;
      }
      case 'glyph': {
        const { at, symbol } = step;
        const tex = glyphTexture(symbol);
        const m = new THREE.SpriteMaterial({ map: tex, color, depthWrite: false, transparent: true });
        const s = new THREE.Sprite(m);
        s.scale.setScalar(0.6);
        const c0 = this.at(at);
        await tween(620, (k) => {
          s.position.set(c0.x + 0.35, 1.8 + k * 0.7, c0.z);
          m.opacity = k < 0.7 ? 1 : (1 - k) / 0.3;
        });
        this.stage.scene.remove(s);
        m.dispose();
        tex.dispose();
        break;
      }
      case 'flash':
        await this.stage.tintSprite(step.at, color);
        break;
      case 'shake':
        this.stage.shake((step.ms ?? 250) / 1000);
        break;
      case 'wait':
        await sleep(step.ms);
        break;
    }
  }
}

// ----------------------------------------------------------- recipes (69)

const C = {
  fire: 0xf07030,
  paleFire: 0xb070f0,
  water: 0x5890e0,
  ice: 0x98d8e8,
  grass: 0x60c050,
  spore: 0xa8e060,
  volt: 0xf8d030,
  earth: 0xc0985a,
  sand: 0xe0c890,
  stone: 0x9898a8,
  wind: 0xd8e8f0,
  shadow: 0x7048a8,
  void: 0x382858,
  light: 0xf8e8a0,
  pink: 0xf8a8d0,
  white: 0xffffff,
  buff: 0xf8d048,
  debuff: 0x70a0e8,
  poison: 0xa040a0,
} as const;

export const RECIPES: Record<string, MoveRecipe> = {
  // ------------------------------------------------------------ inferno
  ember: { steps: [{ fx: 'projectile', shape: 'orb', count: 2, size: 0.32, color: C.fire }] },
  flamefang: { lunge: true, steps: [{ fx: 'slash', count: 2, color: C.fire }, { fx: 'flash', at: 'foe', color: C.fire }] },
  scorch: { steps: [{ fx: 'beam', color: C.fire, size: 0.55 }, { fx: 'nova', at: 'foe', color: C.fire, count: 10 }] },
  blazerush: { lunge: true, steps: [{ fx: 'aura', at: 'self', color: C.fire, ms: 320 }, { fx: 'nova', at: 'foe', color: C.fire, count: 8, radius: 1.2 }] },
  infernova: {
    steps: [
      { fx: 'aura', at: 'self', color: C.fire, ms: 360 },
      { fx: 'ringwave', at: 'foe', color: C.fire, radius: 2.6 },
      { fx: 'nova', at: 'foe', color: C.fire, count: 18, radius: 2.4, ms: 480 },
      { fx: 'shake', ms: 350 },
    ],
  },
  willowisp: { steps: [{ fx: 'projectile', shape: 'orb', count: 3, size: 0.36, ms: 420, arc: 1.3, color: C.paleFire }, { fx: 'flash', at: 'foe', color: C.paleFire }] },
  sunbathe: { steps: [{ fx: 'rain', at: 'self', shape: 'star', color: C.light, count: 6 }, { fx: 'glyph', at: 'self', symbol: '↑', color: C.buff }] },
  detonate: {
    steps: [
      { fx: 'aura', at: 'self', color: C.fire, ms: 300 },
      { fx: 'flash', at: 'self', color: C.fire },
      { fx: 'nova', at: 'self', color: C.fire, count: 20, radius: 3.0, ms: 520 },
      { fx: 'ringwave', at: 'self', color: C.light, radius: 3.2 },
      { fx: 'shake', ms: 420 },
    ],
  },

  // ------------------------------------------------------------ aqua
  splashjet: { steps: [{ fx: 'projectile', shape: 'drop', count: 3, size: 0.34, arc: 0.3, ms: 200, color: C.water }] },
  aquafang: { lunge: true, steps: [{ fx: 'slash', count: 2, color: C.water }, { fx: 'nova', at: 'foe', shape: 'drop', count: 7, radius: 0.9, color: C.water }] },
  ripcurrent: { steps: [{ fx: 'beam', color: C.water, size: 0.6 }, { fx: 'mist', at: 'foe', color: C.water, ms: 420 }] },
  tidalsmash: { lunge: true, steps: [{ fx: 'ringwave', at: 'foe', color: C.water, radius: 2.4 }, { fx: 'rain', at: 'foe', color: C.water, count: 10 }] },
  maelstrom: {
    steps: [
      { fx: 'orbit', at: 'foe', shape: 'drop', count: 10, color: C.water, ms: 620 },
      { fx: 'ringwave', at: 'foe', color: C.water, radius: 2.8 },
      { fx: 'shake', ms: 300 },
    ],
  },
  mistveil: { steps: [{ fx: 'mist', at: 'self', color: 0xc8e0f0, ms: 700 }, { fx: 'glyph', at: 'self', symbol: '≋', color: C.water }] },
  bubblebind: { steps: [{ fx: 'projectile', shape: 'ring', count: 5, size: 0.3, ms: 380, arc: 0.5, spread: 0.5, color: C.water }] },
  rest: { steps: [{ fx: 'mist', at: 'self', color: 0xd0d8f0, ms: 420 }, { fx: 'glyph', at: 'self', symbol: 'Z', color: C.white }, { fx: 'glyph', at: 'self', symbol: 'z', color: C.white }] },
  frostbite: { steps: [{ fx: 'projectile', shape: 'star', count: 2, size: 0.4, color: C.ice, ms: 300 }, { fx: 'flash', at: 'foe', color: C.ice }] },

  // ------------------------------------------------------------ verdant
  vinewhip: { steps: [{ fx: 'slash', count: 2, color: C.grass }] },
  leafblade: { lunge: true, steps: [{ fx: 'slash', count: 2, color: C.grass }, { fx: 'nova', at: 'foe', shape: 'leaf', count: 8, radius: 1.0, color: C.grass }] },
  sporeburst: { steps: [{ fx: 'projectile', shape: 'orb', count: 1, size: 0.5, color: C.spore }, { fx: 'nova', at: 'foe', count: 14, color: C.spore, radius: 1.6 }] },
  solarlance: { steps: [{ fx: 'aura', at: 'self', color: C.light, ms: 380 }, { fx: 'beam', color: 0xc8e858, size: 0.7, ms: 300 }] },
  leechseed: { steps: [{ fx: 'projectile', shape: 'orb', count: 1, size: 0.26, arc: 1.5, color: 0x806030 }, { fx: 'aura', at: 'foe', color: C.grass, down: true, ms: 380 }, { fx: 'aura', at: 'self', color: C.grass, ms: 300 }] },
  sleepspore: { steps: [{ fx: 'rain', at: 'foe', shape: 'orb', count: 10, color: C.spore }, { fx: 'glyph', at: 'foe', symbol: 'Z', color: C.white }] },
  synthesis: { steps: [{ fx: 'rain', at: 'self', shape: 'star', count: 6, color: C.light }, { fx: 'aura', at: 'self', color: C.grass, ms: 420 }, { fx: 'flash', at: 'self', color: C.grass }] },
  thornvolley: { steps: [{ fx: 'projectile', shape: 'star', count: 4, size: 0.28, ms: 200, arc: 0.4, spread: 0.5, color: C.grass }] },

  // ------------------------------------------------------------ volt
  sparkshot: { steps: [{ fx: 'projectile', shape: 'bolt', count: 2, size: 0.4, arc: 0.3, ms: 180, color: C.volt }] },
  voltclaw: { lunge: true, steps: [{ fx: 'slash', count: 2, color: C.volt }, { fx: 'flash', at: 'foe', color: C.volt }] },
  thunderlance: { steps: [{ fx: 'beam', color: C.volt, size: 0.5, ms: 300 }, { fx: 'rain', at: 'foe', shape: 'bolt', count: 5, color: C.volt, ms: 380 }] },
  stormcall: { steps: [{ fx: 'mist', at: 'foe', color: 0x687090, ms: 380 }, { fx: 'rain', at: 'foe', shape: 'bolt', count: 9, color: C.volt, ms: 560 }, { fx: 'shake', ms: 250 }] },
  staticfield: { steps: [{ fx: 'nova', at: 'self', shape: 'bolt', count: 10, radius: 1.8, color: C.volt }, { fx: 'glyph', at: 'foe', symbol: '⚡', color: C.volt }] },
  overclock: { steps: [{ fx: 'orbit', at: 'self', shape: 'bolt', count: 8, color: C.volt, ms: 560 }, { fx: 'glyph', at: 'self', symbol: '↑', color: C.buff }] },
  zapcannon: { steps: [{ fx: 'aura', at: 'self', color: C.volt, ms: 320 }, { fx: 'projectile', shape: 'orb', count: 1, size: 0.8, ms: 420, arc: 0.2, color: C.volt }, { fx: 'ringwave', at: 'foe', color: C.volt, radius: 1.8 }] },

  // ------------------------------------------------------------ terra
  rocktoss: { steps: [{ fx: 'projectile', shape: 'rock', count: 1, size: 0.5, arc: 1.4, color: C.stone }] },
  mudshot: { steps: [{ fx: 'projectile', shape: 'orb', count: 3, size: 0.36, arc: 0.4, ms: 220, color: C.earth }] },
  stoneedge: { steps: [{ fx: 'debris', at: 'foe', color: C.stone }, { fx: 'nova', at: 'foe', shape: 'rock', count: 6, radius: 1.2, up: true, color: C.stone }] },
  quake: { steps: [{ fx: 'shake', ms: 500 }, { fx: 'ringwave', at: 'self', color: C.earth, radius: 3.2, ms: 520 }, { fx: 'debris', at: 'foe', color: C.earth }] },
  sandveil: { steps: [{ fx: 'mist', at: 'self', color: C.sand, ms: 650 }, { fx: 'orbit', at: 'self', count: 6, color: C.sand, ms: 420 }] },
  bulwark: { steps: [{ fx: 'ringwave', at: 'self', color: C.stone, radius: 1.4, ms: 300 }, { fx: 'orbit', at: 'self', shape: 'rock', count: 6, color: C.stone, ms: 480 }, { fx: 'glyph', at: 'self', symbol: '↑', color: C.buff }] },
  landslide: { steps: [{ fx: 'rain', at: 'foe', shape: 'rock', count: 9, color: C.earth, ms: 520 }, { fx: 'shake', ms: 280 }] },
  tackle: { lunge: true, steps: [{ fx: 'ringwave', at: 'foe', color: C.white, radius: 0.9, ms: 240 }] },
  growl: { steps: [{ fx: 'ringwave', at: 'self', color: C.white, radius: 2.6, ms: 480 }, { fx: 'glyph', at: 'foe', symbol: '↓', color: C.debuff }] },
  focus: { steps: [{ fx: 'aura', at: 'self', color: 0xf09048, ms: 520 }, { fx: 'glyph', at: 'self', symbol: '↑', color: C.buff }] },
  crushgrip: { lunge: true, steps: [{ fx: 'ringwave', at: 'foe', color: C.earth, radius: 1.4, ms: 280 }, { fx: 'flash', at: 'foe', color: C.earth }] },

  // ------------------------------------------------------------ gale
  gustcut: { steps: [{ fx: 'projectile', shape: 'ring', count: 2, size: 0.5, arc: 0.2, ms: 220, color: C.wind }] },
  wingstrike: { lunge: true, steps: [{ fx: 'slash', count: 2, color: C.wind }] },
  skydance: { steps: [{ fx: 'orbit', at: 'self', shape: 'star', count: 7, color: C.wind, ms: 600 }, { fx: 'glyph', at: 'self', symbol: '↑', color: C.buff }] },
  tempest: { steps: [{ fx: 'orbit', at: 'foe', count: 12, color: C.wind, ms: 600 }, { fx: 'mist', at: 'foe', color: C.wind, ms: 400 }, { fx: 'shake', ms: 280 }] },
  divebomb: { lunge: true, steps: [{ fx: 'aura', at: 'self', color: C.wind, ms: 260 }, { fx: 'ringwave', at: 'foe', color: C.wind, radius: 2.0 }] },
  'tailwind-rush': { lunge: true, steps: [{ fx: 'aura', at: 'self', color: C.wind, ms: 220 }, { fx: 'slash', count: 1, color: C.wind }] },
  razorgale: { steps: [{ fx: 'projectile', shape: 'star', count: 3, size: 0.34, arc: 0.25, ms: 190, spread: 0.45, color: C.wind }] },
  scratch: { lunge: true, steps: [{ fx: 'slash', count: 1, color: C.white }] },
  quickstrike: { lunge: true, steps: [{ fx: 'slash', count: 1, color: C.wind }, { fx: 'flash', at: 'foe', color: C.white }] },

  // ------------------------------------------------------------ umbra
  shadowsnap: { lunge: true, steps: [{ fx: 'flash', at: 'foe', color: C.shadow }, { fx: 'slash', count: 1, color: C.shadow }] },
  nightshade: { steps: [{ fx: 'beam', color: C.shadow, size: 0.55 }, { fx: 'mist', at: 'foe', color: C.void, ms: 380 }] },
  umbralclaw: { lunge: true, steps: [{ fx: 'slash', count: 3, color: C.shadow }] },
  voidpulse: { steps: [{ fx: 'ringwave', at: 'foe', color: C.void, radius: 1.6, ms: 320 }, { fx: 'ringwave', at: 'foe', color: C.shadow, radius: 2.4, ms: 380 }, { fx: 'aura', at: 'foe', color: C.void, down: true, ms: 320 }] },
  eclipse: {
    steps: [
      { fx: 'mist', at: 'foe', color: C.void, ms: 420 },
      { fx: 'nova', at: 'foe', color: C.shadow, count: 16, radius: 2.4, ms: 480 },
      { fx: 'flash', at: 'foe', color: C.void },
      { fx: 'shake', ms: 350 },
    ],
  },
  dreadgaze: { steps: [{ fx: 'glyph', at: 'self', symbol: '◉', color: C.shadow }, { fx: 'ringwave', at: 'foe', color: C.shadow, radius: 1.6 }, { fx: 'glyph', at: 'foe', symbol: '↓', color: C.debuff }] },
  shadowsneak: { lunge: true, steps: [{ fx: 'mist', at: 'self', color: C.void, ms: 240 }, { fx: 'slash', count: 1, color: C.shadow }] },
  leer: { steps: [{ fx: 'glyph', at: 'self', symbol: '◣', color: C.white }, { fx: 'glyph', at: 'foe', symbol: '↓', color: C.debuff }] },
  toxin: { steps: [{ fx: 'projectile', shape: 'drop', count: 3, size: 0.34, arc: 1.0, ms: 340, color: C.poison }, { fx: 'glyph', at: 'foe', symbol: '☠', color: C.poison }] },

  // ------------------------------------------------------------ lumina
  glimmer: { steps: [{ fx: 'projectile', shape: 'star', count: 2, size: 0.36, color: C.pink, ms: 280 }, { fx: 'nova', at: 'foe', shape: 'star', count: 6, radius: 0.9, color: C.light }] },
  radiantbeam: { steps: [{ fx: 'aura', at: 'self', color: C.light, ms: 240 }, { fx: 'beam', color: C.light, size: 0.75, ms: 420 }] },
  purifyinglight: { steps: [{ fx: 'rain', at: 'self', shape: 'star', count: 8, color: C.light }, { fx: 'flash', at: 'self', color: C.white }, { fx: 'glyph', at: 'self', symbol: '+', color: 0x68e080 }] },
  dazzle: { steps: [{ fx: 'nova', at: 'foe', shape: 'star', count: 12, radius: 1.6, color: C.pink }, { fx: 'glyph', at: 'foe', symbol: '↓', color: C.debuff }] },
  novaflare: {
    steps: [
      { fx: 'aura', at: 'self', color: C.light, ms: 360 },
      { fx: 'nova', at: 'foe', shape: 'star', count: 18, radius: 2.6, ms: 500, color: C.light },
      { fx: 'ringwave', at: 'foe', color: C.white, radius: 3.0 },
      { fx: 'shake', ms: 320 },
    ],
  },
  halostrike: { lunge: true, steps: [{ fx: 'ringwave', at: 'foe', color: C.light, radius: 1.6, ms: 300 }, { fx: 'slash', count: 1, color: C.light }] },
  luminance: { steps: [{ fx: 'orbit', at: 'self', shape: 'star', count: 8, color: C.light, ms: 560 }, { fx: 'glyph', at: 'self', symbol: '↑', color: C.buff }] },
  protect: { steps: [{ fx: 'ringwave', at: 'self', color: 0x80d8e8, radius: 1.2, ms: 280 }, { fx: 'orbit', at: 'self', shape: 'ring', count: 5, color: 0x80d8e8, ms: 460 }] },
};

/** default tint for a move with no explicit colors */
export function moveTint(moveId: string): number {
  const mv = moveById(moveId);
  return TYPE_COLORS[mv.type] ?? 0xffffff;
}
