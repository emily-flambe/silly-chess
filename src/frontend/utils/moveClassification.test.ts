import { describe, it, expect } from 'vitest';
import { winPercent, evalToWinPercent, classifyMove } from './moveClassification';

describe('winPercent', () => {
  it('returns 50% for equal position (0 cp)', () => {
    expect(winPercent(0)).toBeCloseTo(50, 1);
  });

  it('returns > 50% for positive eval (white advantage)', () => {
    expect(winPercent(100)).toBeGreaterThan(50);
  });

  it('returns < 50% for negative eval (black advantage)', () => {
    expect(winPercent(-100)).toBeLessThan(50);
  });

  it('is symmetric: winPercent(x) + winPercent(-x) ≈ 100', () => {
    for (const cp of [50, 100, 200, 500]) {
      expect(winPercent(cp) + winPercent(-cp)).toBeCloseTo(100, 5);
    }
  });

  it('approaches 100% for very large positive eval', () => {
    expect(winPercent(1000)).toBeGreaterThan(95);
  });

  it('approaches 0% for very large negative eval', () => {
    expect(winPercent(-1000)).toBeLessThan(5);
  });

  it('+100cp gives roughly 60-70% win (sanity check against Lichess)', () => {
    const wp = winPercent(100);
    expect(wp).toBeGreaterThan(55);
    expect(wp).toBeLessThan(70);
  });
});

describe('evalToWinPercent', () => {
  it('delegates to winPercent for numeric eval', () => {
    expect(evalToWinPercent(0)).toBeCloseTo(50, 1);
    expect(evalToWinPercent(200)).toBeGreaterThan(60);
  });

  it('returns 100 for positive mate (white mates)', () => {
    expect(evalToWinPercent('M3')).toBe(100);
  });

  it('returns 0 for negative mate (black mates)', () => {
    expect(evalToWinPercent('-M5')).toBe(0);
  });
});

describe('classifyMove', () => {
  it('best: drop < 2', () => {
    expect(classifyMove(60, 59)).toBe('best');
    expect(classifyMove(50, 50)).toBe('best');
  });

  it('excellent: 2 ≤ drop < 5', () => {
    expect(classifyMove(60, 58)).toBe('excellent');
    expect(classifyMove(60, 55.1)).toBe('excellent');
  });

  it('good: 5 ≤ drop < 10', () => {
    expect(classifyMove(60, 55)).toBe('good');
    expect(classifyMove(60, 50.1)).toBe('good');
  });

  it('inaccuracy: 10 ≤ drop < 20', () => {
    expect(classifyMove(60, 50)).toBe('inaccuracy');
    expect(classifyMove(70, 50.1)).toBe('inaccuracy');
  });

  it('mistake: 20 ≤ drop < 30', () => {
    expect(classifyMove(60, 40)).toBe('mistake');
    expect(classifyMove(70, 50.1)).toBe('inaccuracy');
  });

  it('blunder: drop ≥ 30', () => {
    expect(classifyMove(80, 50)).toBe('blunder');
    expect(classifyMove(80, 10)).toBe('blunder');
  });

  it('negative drop (improving position) is best', () => {
    // If win% goes up, drop is negative → always "best"
    expect(classifyMove(40, 60)).toBe('best');
  });
});
