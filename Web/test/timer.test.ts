import { describe, expect, it } from 'vitest';
import type { Analysis, Solve } from '../src/timer/db';
import { DNF, averageOf, fmt, fmtSolve, result, sessionStats, stageTimes } from '../src/timer/stats';
import { crossLook, stageSummary } from '../src/timer/insights';
import { LEVELS, levelOf, profileName } from '../src/timer/profile';
import { timer } from '../src/timer/timer';

const solve = (time: number, more: Partial<Solve> = {}): Solve =>
  ({ id: String(Math.random()), session: 's', time, penalty: 'ok', scramble: 'R U', date: 0, ...more });

describe('stats', () => {
  it('formats times truncated to the hundredth', () => {
    expect(fmt(12349)).toBe('12.34');
    expect(fmt(59999)).toBe('59.99');
    expect(fmt(60000)).toBe('1:00.00');
    expect(fmt(DNF)).toBe('DNF');
    expect(fmt(null)).toBe('-');
  });

  it('adds the +2 and fails the DNF', () => {
    expect(result(solve(10000, { penalty: '+2' }))).toBe(12000);
    expect(fmtSolve(solve(10000, { penalty: '+2' }))).toBe('12.00+');
    expect(result(solve(10000, { penalty: 'dnf' }))).toBe(DNF);
  });

  it('averages as the WCA does', () => {
    expect(averageOf([1, 2, 3, 4], 5)).toBeNull();
    expect(averageOf([10, 1, 2, 3, 100], 5)).toBe(5);
    expect(averageOf([10, 1, 2, 3, DNF], 5)).toBe(5);
    expect(averageOf([10, 1, 2, DNF, DNF], 5)).toBe(DNF);
    expect(averageOf([1, 2, 6], 3)).toBe(3);
    expect(averageOf([...Array(5).fill(1), ...Array(90).fill(3), ...Array(5).fill(DNF)], 100)).toBe(3);
  });

  it('rolls averages over the latest solves', () => {
    const s = sessionStats([5, 4, 3, 2, 1, 9].map(t => solve(t * 1000)));
    expect(s.ao5.map(x => x == null)).toEqual([true, true, true, true, false, false]);
    expect([s.current.ao5, s.bestAo5, s.bestSingle]).toEqual([3000, 3000, 1000]);
    expect(sessionStats([]).current.single).toBeNull();
  });

  it('turns split marks into stage times, one method at a time', () => {
    const cfop = solve(10000, { splits: [2000, 7000, 8500] });
    const roux = solve(8000, { splits: [1000, 2000, 3000], method: 'roux' });
    expect(stageTimes(cfop)).toEqual([2000, 5000, 1500, 1500]);
    expect(stageTimes(solve(10000))).toBeNull();
    expect(stageSummary([cfop, roux])).toMatchObject({ n: 1, avg: [2000, 5000, 1500, 1500] });
  });
});

it('compares crosses by colour', () => {
  const lengths = { white: 6, red: 5, green: 4, yellow: 3, orange: 7, blue: 6 };
  const a = { crosses: Object.entries(lengths).map(([color, n]) => ({ color, rotation: '', moves: Array(n).fill('R') })) } as Analysis;
  expect(crossLook(a, 'white')).toMatchObject({ pref: 6, dual: 3, best: 3, bestColor: 'yellow' });
  expect(crossLook(a, 'neutral')).toMatchObject({ pref: 3, prefColor: 'yellow' });
});

it('names every profile level, and Roux outside them', () => {
  for (const l of LEVELS) expect(levelOf({ ...l.profile, cross: null })).toBe(l);
  expect(levelOf({ method: 'roux', oll: 'full', pll: 'full', cross: null })).toBeNull();
  expect(profileName({ method: 'cfop', oll: 'full', pll: '2-look', cross: null })).toBe('CFOP full OLL, 2-look PLL');
});

describe('timer', () => {
  const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
  const time = async () => {
    timer.down('Space'); timer.up('Space');
    await wait(20);
    timer.down('Space'); timer.up('Space');
    await expect.poll(() => timer.scramble).not.toBe('');
  };

  it('times, analyses, exports and reimports a solve', async () => {
    await timer.boot();
    timer.setSetting('holdMs', 0);
    const scramble = timer.scramble || (await expect.poll(() => timer.scramble).not.toBe(''), timer.scramble);
    await time();
    expect(timer.solves).toHaveLength(1);
    expect(timer.solves[0].scramble).toBe(scramble);
    expect(timer.solves[0].time).toBeGreaterThan(10);
    expect(timer.scramble).not.toBe(scramble);

    const id = timer.solves[0].id;
    expect((await timer.analysis(id))!.crosses).toHaveLength(6);
    expect(timer.solves[0].analysis).toBeDefined();

    const file = await timer.exportAll();
    expect(file).not.toContain('analysis');
    await timer.importJson(file);
    expect(timer.solves).toHaveLength(1);
    await timer.deleteSolve(id);
    expect(timer.solves).toHaveLength(0);
    expect(await timer.importJson(file)).toBe(1);
    expect(timer.solves[0].id).toBe(id);
    await expect(timer.importJson('{}')).rejects.toThrow();
  });

  it('marks the stages, then stops', async () => {
    timer.setSetting('splits', true);
    timer.down('Space'); timer.up('Space');
    for (let i = 0; i < 3; i++) {
      timer.down('KeyJ'); timer.up('KeyJ');
      expect(timer.phase).toBe('running');
    }
    timer.down('KeyJ');
    expect(timer.phase).toBe('idle');
    expect(timer.last()!.splits).toHaveLength(3);
    expect(timer.last()!.method).toBe('cfop');
  });
});
