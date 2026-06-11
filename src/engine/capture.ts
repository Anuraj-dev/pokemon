/**
 * capture — Gen-3 style catch-rate math (normative per PRD). Pure.
 */
import type { RNG } from '../core/rng';
import type { NonVolatileStatus } from '../data/moves';

export function statusBonus(status: NonVolatileStatus | null): number {
  if (status === 'sleep' || status === 'freeze') return 2.0;
  if (status === 'poison' || status === 'burn' || status === 'paralysis') return 1.5;
  return 1.0;
}

/** The catch value `a`. a >= 255 means guaranteed catch. */
export function catchValue(
  maxHp: number,
  curHp: number,
  catchRate: number,
  ballBonus: number,
  status: NonVolatileStatus | null,
): number {
  const a = Math.floor(((3 * maxHp - 2 * curHp) * catchRate * ballBonus) / (3 * maxHp)) * statusBonus(status);
  return Math.floor(a);
}

/** Shake threshold `b` from the catch value. */
export function shakeThreshold(a: number): number {
  if (a >= 255) return 65536;
  const inner = Math.floor(16711680 / Math.max(1, a));
  return Math.floor(1048560 / Math.floor(Math.sqrt(Math.floor(Math.sqrt(inner)))));
}

export interface CaptureResult {
  caught: boolean;
  shakes: number; // 0..4 (4 = caught; 3 shakes shown then catch confirm)
}

export function attemptCapture(
  rng: RNG,
  maxHp: number,
  curHp: number,
  catchRate: number,
  ballBonus: number,
  status: NonVolatileStatus | null,
  master = false,
): CaptureResult {
  if (master) return { caught: true, shakes: 4 };
  const a = catchValue(maxHp, curHp, catchRate, ballBonus, status);
  if (a >= 255) return { caught: true, shakes: 4 };
  const b = shakeThreshold(a);
  let shakes = 0;
  for (let i = 0; i < 4; i++) {
    if (rng.int(0, 65535) < b) shakes++;
    else break;
  }
  return { caught: shakes === 4, shakes };
}
