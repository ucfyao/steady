import type { PlanTrial } from '@steady/core';
import { describe, expect, it } from 'vitest';
import { practiceTip, summarisePractice } from '../src/game/practice.js';

// Expected values are counted by hand from the arrays below (Spec 004, practice result).
// "Too early" is a press under 100 ms (core's anticipation threshold, Spec 001).
const go = (index: number): PlanTrial => ({ index, digit: 5, isTarget: false, fontSize: 2 });
const three = (index: number): PlanTrial => ({ index, digit: 3, isTarget: true, fontSize: 2 });

// 6 trials: go, go, 3, go, 3, go
const trials = [go(0), go(1), three(2), go(3), three(4), go(5)];

describe('summarisePractice', () => {
  it('counts 3s held back, digits caught and presses that came too early', () => {
    //            go   go    3     go   3    go
    const rts = [350, null, 420, 99, null, 100];
    expect(summarisePractice(trials, rts)).toEqual({
      heldBack: 1, // the 3 at index 4
      targets: 2,
      caught: 2, // 350 and 100 (100 ms is not too early)
      digits: 4,
      tooEarly: 1, // 99 ms
      pressedOn3: 1,
      missed: 1, // index 1
    });
  });

  it('a perfect round', () => {
    const rts = [300, 300, null, 300, null, 300];
    expect(summarisePractice(trials, rts)).toMatchObject({
      heldBack: 2,
      caught: 4,
      tooEarly: 0,
      pressedOn3: 0,
      missed: 0,
    });
  });
});

describe('practiceTip', () => {
  const summary = (s: { pressedOn3?: number; missed?: number; tooEarly?: number }) => ({
    heldBack: 0,
    targets: 2,
    caught: 0,
    digits: 16,
    pressedOn3: 0,
    missed: 0,
    tooEarly: 0,
    ...s,
  });

  it('is about the most common slip', () => {
    expect(practiceTip(summary({ pressedOn3: 1 }))).toBe('pressed-3');
    expect(practiceTip(summary({ pressedOn3: 1, missed: 3 }))).toBe('missed');
    expect(practiceTip(summary({ missed: 1, tooEarly: 2 }))).toBe('too-early');
  });

  it('breaks ties in the order: pressed on a 3, missed, too early', () => {
    expect(practiceTip(summary({ pressedOn3: 2, missed: 2, tooEarly: 2 }))).toBe('pressed-3');
    expect(practiceTip(summary({ missed: 1, tooEarly: 1 }))).toBe('missed');
  });

  it('says so when there were no slips', () => {
    expect(practiceTip(summary({}))).toBe('clean');
  });
});
