import { beforeEach, describe, expect, it } from 'vitest';
import { api } from '../src/engine';
import { COLOR_NAMES, MOVE_RE, type Snap } from '../src/cube';

interface Plan { rotation: string; steps: { label: string; case: string; moves: string[] }[] }
const SCRAMBLES = [
  "B2 U' F2 R2 U' B2 R2 D' R2 D B D' B L U2 F' D' L2 U' L",
  "L2 B2 U' R2 B2 U R2 U F D L B' D2 F2 U' L D' R2 L' F'",
  "R2 U2 F2 D' R2 D' F2 B2 D' B2 L2 U F U2 R B R' D B D' L",
];
const apply = (seq: string) => api<Snap & { error?: string }>('apply', { seq });
beforeEach(() => api('reset'));

describe('cfop', () => {
  // Rotated holds too, since a colour is a sticker and not a face of the current frame
  for (const look of [1, 2]) for (const hold of ['', 'x2 y', "z'"])
    it(`solves on every cross colour, ${look}-look, held ${hold || 'as scrambled'}`, async () => {
      for (const scramble of SCRAMBLES) for (let color = 0; color < 6; color++) {
        await api('reset');
        await apply(scramble + ' ' + hold);
        const { lengths } = await api<{ lengths: number[] }>('crosses');
        const plan = await api<Plan>('cfop', { color, look });
        expect(plan.steps[0].label).toBe(COLOR_NAMES[color] + ' cross');
        expect(plan.steps[0].moves).toHaveLength(lengths[color]);

        let s = await apply(plan.rotation + ' ' + plan.steps[0].moves.join(' '));
        expect(s.cross).toBe(true);
        expect(s.faces[3]).toBe(color);
        const held = s.hold;
        for (const step of plan.steps.slice(1)) {
          for (const t of step.moves) expect(t).toMatch(MOVE_RE);
          s = await apply(step.moves.join(' '));
          expect(s.hold).toBe(held);
        }
        expect(s.solved).toBe(true);
      }
    });

  it('takes the shortest cross when no colour is asked for', async () => {
    for (const scramble of SCRAMBLES) {
      await api('reset');
      await apply(scramble);
      const { lengths } = await api<{ lengths: number[] }>('crosses');
      const plan = await api<Plan>('cfop');
      expect(plan.steps[0].moves).toHaveLength(Math.min(...lengths));
    }
  });

  it('names its last layer steps by look', async () => {
    await apply(SCRAMBLES[0]);
    const labels = async (look: number) =>
      (await api<Plan>('cfop', { look })).steps.map(s => s.label).filter(l => !/cross|pair/.test(l));
    expect(await labels(1)).toEqual(['OLL', 'PLL']);
    expect(await labels(2)).toEqual(['OLL edges', 'OLL corners', 'PLL corners', 'PLL edges']);
  });

  it('rejects a colour that does not exist', async () => {
    expect(await api('cfop', { color: 6 })).toHaveProperty('error');
  });
});

describe('apply', () => {
  it('turns M and r the way solvers write them', async () => {
    const u = await apply("M2 U M U2 M' U M2");
    expect(u.hold).toBe('');
    expect(u.cp).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(u.oll).toBe(true);
    await api('reset');
    const t = await apply("r U R' U' r' F R F'");
    expect([t.f2l, t.oll, t.eo.some(Boolean)]).toEqual([true, false, false]);
  });

  it('rejects an unknown token and leaves the cube alone', async () => {
    const before = await apply('R U');
    expect(await apply('F Q')).toHaveProperty('error');
    expect(await api('state')).toEqual(before);
  });
});

it('kociemba solves', async () => {
  await apply(SCRAMBLES[0]);
  const { moves } = await api<{ moves: string[] }>('kociemba');
  expect((await apply(moves.join(' '))).solved).toBe(true);
});

it('analyze reports all six crosses without touching the session', async () => {
  const before = await apply('R U F');
  const a = await api<{ crosses: { color: string; moves: string[] }[] }>('analyze', { scramble: SCRAMBLES[0] });
  expect(a.crosses.map(c => c.color)).toEqual(COLOR_NAMES);
  expect(await api('state')).toEqual(before);
});
