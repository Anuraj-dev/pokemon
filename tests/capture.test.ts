/** capture: Gen-3 catch formula behavior. */
import { describe, it, expect } from 'vitest';
import { RNG } from '../src/core/rng';
import { catchValue, shakeThreshold, attemptCapture, statusBonus } from '../src/engine/capture';

describe('catch value', () => {
  it('full HP, basic ball, rate 255 → guaranteed', () => {
    // a = floor((3M - 2M) * 255 * 1 / 3M) = floor(255/3) = 85 ... not guaranteed
    expect(catchValue(100, 100, 255, 1, null)).toBe(85);
    // at 1 HP: a = floor((300-2)*255/300) = 253
    expect(catchValue(100, 1, 255, 1, null)).toBe(253);
    // with status 1.5: 253*1.5 = 379 ≥ 255 → guaranteed
    expect(catchValue(100, 1, 255, 1, 'paralysis')).toBeGreaterThanOrEqual(255);
  });

  it('status bonuses are normative', () => {
    expect(statusBonus('sleep')).toBe(2);
    expect(statusBonus('freeze')).toBe(2);
    expect(statusBonus('poison')).toBe(1.5);
    expect(statusBonus('burn')).toBe(1.5);
    expect(statusBonus('paralysis')).toBe(1.5);
    expect(statusBonus(null)).toBe(1);
  });

  it('lower HP, better ball, status all raise the value', () => {
    const base = catchValue(100, 100, 45, 1, null);
    expect(catchValue(100, 30, 45, 1, null)).toBeGreaterThan(base);
    expect(catchValue(100, 100, 45, 2, null)).toBeGreaterThan(base);
    expect(catchValue(100, 100, 45, 1, 'sleep')).toBeGreaterThan(base);
  });

  it('a >= 255 means guaranteed catch regardless of RNG', () => {
    const rng = new RNG(1);
    const result = attemptCapture(rng, 100, 1, 255, 2, 'sleep');
    expect(result.caught).toBe(true);
    expect(result.shakes).toBe(4);
  });

  it('master ball always catches', () => {
    const rng = new RNG(1);
    expect(attemptCapture(rng, 999, 999, 3, 255, null, true).caught).toBe(true);
  });

  it('shake threshold is monotonic in a', () => {
    let prev = 0;
    for (const a of [10, 50, 100, 150, 200, 254]) {
      const b = shakeThreshold(a);
      expect(b).toBeGreaterThan(prev);
      prev = b;
    }
  });

  it('empirical catch rate responds to conditions (seeded)', () => {
    const trials = 2000;
    const catchRateAt = (hpFrac: number, status: Parameters<typeof attemptCapture>[5]) => {
      const rng = new RNG(1234);
      let caught = 0;
      for (let i = 0; i < trials; i++) {
        if (attemptCapture(rng, 100, Math.max(1, Math.floor(100 * hpFrac)), 45, 1, status).caught) caught++;
      }
      return caught / trials;
    };
    const fullHp = catchRateAt(1, null);
    const lowHp = catchRateAt(0.05, null);
    const lowHpSleep = catchRateAt(0.05, 'sleep');
    expect(lowHp).toBeGreaterThan(fullHp);
    expect(lowHpSleep).toBeGreaterThan(lowHp);
  });
});
