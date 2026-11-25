import { beforeEach, describe, expect, it } from 'vitest';
import { COLOR_NAMES, CUBIES, EDGE_FACES, GAP, cubieColors, type Snap } from '../src/cube';
import { sim } from '../src/sim';

const SCRAMBLE = "B2 U' F2 R2 U' B2 R2 D' R2 D B D' B L U2 F' D' L2 U' L".split(' ');
const cube = (s: Snap | null) => [s!.cp, s!.co, s!.ep, s!.eo, s!.hold];
const settle = () => sim.run(() => {});   // Everything Queued So Far Has Run
const labels = () => sim.plan!.groups.map(g => g.label);
const load = async () => { sim.loadScramble(SCRAMBLE); await settle(); };
const steps = async (n: number) => { for (let i = 0; i < n; i++) await sim.run(sim.step); };

await sim.boot();
beforeEach(async () => {
  sim.escape();
  await settle();
  sim.setTempo(100);
  sim.opts.cam = false;   // No Viewport to Turn
  sim.method = 'cfop';
  sim.cross = null;
  await sim.run(sim.reset);
});

describe('loadScramble', () => {
  it('puts the scramble on the cube with a solution ready', async () => {
    await load();
    expect(sim.scrambleMoves).toEqual(SCRAMBLE);
    expect(sim.plan).toMatchObject({ pos: 0 });
    expect(sim.statusText).toBe('Solution ready');
    expect(sim.crosses).toHaveLength(6);
  });

  it('keeps 2-look but leaves Kociemba, which has no crosses', async () => {
    sim.method = 'cfop2';
    await load();
    expect(sim.method).toBe('cfop2');
    sim.method = 'kociemba';
    await load();
    expect(sim.method).toBe('cfop');
  });

  it('replaces whatever was loaded, even mid-play', async () => {
    await load();
    sim.run(sim.play);
    sim.loadScramble(['R', 'U', 'F']);
    await settle();
    expect(sim.playing).toBe(false);
    expect(sim.scrambleMoves).toEqual(['R', 'U', 'F']);
    expect(sim.plan).toMatchObject({ pos: 0 });
  });

  it('reports a scramble it cannot read', async () => {
    sim.loadScramble(['R', 'Q7']);
    await settle();
    expect(sim.statusText).toContain('Q7');
    expect(sim.plan).toBeNull();
  });
});

describe('pickCross', () => {
  it('plans on the colour picked, and the shortest again on null', async () => {
    await load();
    const shortest = labels()[0];
    for (const [color, name] of [[0, 'white'], [5, 'blue'], [1, 'red']] as const) {
      sim.pickCross(color);
      await settle();
      expect(labels()[0]).toBe(name + ' cross');
    }
    sim.pickCross(null);
    await settle();
    expect(labels()[0]).toBe(shortest);
  });

  it('goes back to the scramble from partway through and from the end', async () => {
    await load();
    const start = cube(sim.snap), crosses = sim.crosses;
    await steps(9);
    expect(cube(sim.snap)).not.toEqual(start);
    sim.pickCross(3);
    await settle();
    expect(cube(sim.snap)).toEqual(start);
    expect(sim.crosses).toEqual(crosses);

    await sim.run(sim.applyAll);
    expect(sim.snap!.solved).toBe(true);
    sim.pickCross(4);
    await settle();
    expect(cube(sim.snap)).toEqual(start);
    expect(labels()[0]).toBe('orange cross');
  });

  it('lands on the last of several quick picks', async () => {
    await load();
    for (const c of [0, 1, 2, 5]) sim.pickCross(c);
    await settle();
    expect(labels()[0]).toBe('blue cross');
  });

  it('plans from a cube turned by hand, not from the old scramble', async () => {
    await load();
    await sim.run(() => sim.applyTokens(['R', 'x']));
    const turned = cube(sim.snap);
    expect(sim.plan).toBeNull();
    sim.pickCross(2);
    await settle();
    expect(cube(sim.snap)).toEqual(turned);
    expect(labels()[0]).toBe('green cross');
  });
});

describe('camera', () => {
  // A move on a face out of sight turns the camera to it only with auto camera on and the
  // view not fixed
  it('follows hidden faces only when asked to', async () => {
    const peeks = async (cam: boolean, fixed: boolean) => {
      Object.assign(sim.opts, { cam, fixed });
      sim.orbit = { x: -28, y: -38 };
      sim.cam.target = null;
      await sim.run(sim.reset);
      await sim.run(() => sim.applyTokens(['B', 'R', 'U', 'F']));
      await sim.run(sim.planSolution);
      while (sim.plan && sim.nextToken()![0] !== 'B' && sim.nextToken()![0] !== 'L') await sim.run(sim.step);
      sim.run(sim.step);
      await Promise.resolve();
      const moved = sim.cam.target != null;
      await settle();
      return moved;
    };
    expect(await peeks(true, false)).toBe(true);
    expect(await peeks(false, false)).toBe(false);
    expect(await peeks(true, true)).toBe(false);
    sim.opts.fixed = false;
  });
});

describe('setMethod', () => {
  it('takes on the same scramble with the new method', async () => {
    await load();
    const start = cube(sim.snap);
    sim.setMethod('cfop2');
    await settle();
    expect(labels().at(-1)).toBe('PLL edges');
    sim.setMethod('kociemba');
    await settle();
    expect(labels()).toEqual(['Kociemba']);
    sim.setMethod('cfop');
    await settle();
    expect(labels().at(-1)).toBe('PLL');
    expect(cube(sim.snap)).toEqual(start);
  });

  it('goes back to the scramble from partway through and from the end', async () => {
    await load();
    const start = cube(sim.snap);
    await steps(12);
    sim.setMethod('cfop2');
    await settle();
    expect(cube(sim.snap)).toEqual(start);
    expect(sim.plan).toMatchObject({ pos: 0 });

    await sim.run(sim.applyAll);
    expect(sim.snap!.solved).toBe(true);
    sim.setMethod('kociemba');
    await settle();
    expect(cube(sim.snap)).toEqual(start);
    expect(labels()).toEqual(['Kociemba']);
  });

  it('keeps the cross colour between the two CFOPs', async () => {
    await load();
    sim.pickCross(1);
    await settle();
    sim.setMethod('cfop2');
    await settle();
    expect(labels()[0]).toBe('red cross');
  });

  it('never leaves the old method\'s plan up after a quick switch', async () => {
    await load();
    sim.setMethod('kociemba');
    sim.setMethod('cfop2');
    await settle();
    expect(labels().at(-1)).toBe('PLL edges');
  });

  it('stops a solve that is playing', async () => {
    await load();
    const start = cube(sim.snap);
    sim.opts.gap = 5;
    sim.run(sim.play);
    await new Promise(r => setTimeout(r, 40));
    expect(sim.playing).toBe(true);
    sim.setMethod('cfop2');
    await settle();
    expect(sim.playing).toBe(false);
    expect(cube(sim.snap)).toEqual(start);
  });

  it('plans nothing when there was no plan', async () => {
    await sim.run(() => sim.applyTokens(SCRAMBLE));
    sim.setMethod('cfop2');
    await settle();
    expect(sim.plan).toBeNull();
    expect(sim.crosses).toHaveLength(6);
  });

  it('shows cross lengths for a plan first made with Kociemba', async () => {
    sim.setMethod('kociemba');
    await sim.run(() => sim.applyTokens(SCRAMBLE));
    await sim.run(sim.planSolution);
    sim.setMethod('cfop');
    await settle();
    expect(sim.crosses).toEqual([6, 5, 4, 7, 5, 6]);
  });
});

// Through F2L the cross and the pairs placed or being placed are bright and nothing
// else, whichever way F2L has turned the cube, matched by colour as a solver sees them
it('highlights the pair being placed and those before it', async () => {
  const key = (colors: number[]) => [...colors].sort().join();
  let checked = 0;
  for (let color = 0; color < 6; color++) {
    sim.cross = color;
    await load();
    const pairs = new Set<string>();   // Edge Colours of Each Pair Bright
    while (sim.plan) {
      const { g } = sim.groupAt(sim.plan.pos);
      const s: Snap = sim.snap!;
      if (g.label.endsWith(' pair') && g.startSnap) {
        const down = g.startSnap.faces[3];
        if (!pairs.size)
          g.startSnap.pairs.forEach((home, k) => { if (home) pairs.add(key(EDGE_FACES[8 + k].map(f => g.startSnap!.faces[f]))); });
        pairs.add(key(g.label.split(' ').slice(0, 2).map(c => COLOR_NAMES.indexOf(c))));
        const set = sim.stagePieces();
        s.ep.forEach((p, i) => expect(set.has('e' + p)).toBe(s.edges[i].includes(down) || pairs.has(key(s.edges[i]))));
        s.cp.forEach((p, i) => expect(set.has('c' + p)).toBe(s.corners[i].includes(down)
          && pairs.has(key(s.corners[i].filter(c => c !== down)))));
        checked++;
      }
      await sim.run(sim.step);
    }
    expect(sim.snap!.solved).toBe(true);
  }
  expect(checked).toBeGreaterThan(100);
});

// The pieces kept bright are the last layer's all through an alg, though an M or r turn
// renumbers every piece partway
it('highlights the last layer through wide and slice algs', async () => {
  for (const method of ['cfop', 'cfop2'] as const) for (let color = 0; color < 6; color++) {
    sim.method = method;
    sim.cross = color;
    await load();
    while (sim.plan) {
      const { g } = sim.groupAt(sim.plan.pos);
      if (/OLL|PLL/.test(g.label) && g.startSnap) {
        const up = g.startSnap.faces[0], set = sim.stagePieces(), s: Snap = sim.snap!;
        s.cp.forEach((p, i) => expect(set.has('c' + p)).toBe(s.corners[i].includes(up)));
        s.ep.forEach((p, i) => expect(set.has('e' + p)).toBe(s.edges[i].includes(up)));
      }
      await sim.run(sim.step);
    }
    expect(sim.snap!.solved).toBe(true);
  }
});

// The turn drawn has to end where the engine says the cube now is, or every move ends in
// a jump. Each cubie's last rotation, done to its stickers, is checked against the
// engine's next snapshot
describe('animation', () => {
  const NORMALS = [[0, -1, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0], [-1, 0, 0], [0, 0, -1]];
  const turn = (axis: string, deg: number, [x, y, z]: number[]) => {
    const a = deg * Math.PI / 180, c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a));
    return axis === 'X' ? [x, y * c - z * s, y * s + z * c]
         : axis === 'Y' ? [x * c + z * s, y, z * c - x * s] : [x * c - y * s, x * s + y * c, z];
  };
  const facets = (s: Snap, turned: Record<number, [string, number]> = {}) => CUBIES.flatMap(({ kind, idx, pos }, i) =>
    cubieColors(s, kind, idx).flatMap((c, f) => {
      if (c == null) return [];
      let p = [pos[0], -pos[1], pos[2]], n = NORMALS[f];
      if (turned[i]) { p = turn(...turned[i], p); n = turn(...turned[i], n); }
      return [[...p, ...n, c].map(v => v + 0).join()];
    })).sort();

  for (const turns of ['URFDLB', 'urfdlb', 'MES', 'xyz'])
    it(`lands where the engine says, ${turns}`, async () => {
      await sim.run(() => sim.applyTokens(SCRAMBLE));
      sim.setTempo(97);
      for (const tok of [...turns].flatMap(t => [t, t + "'", t + '2'])) {
        const last: Record<number, [string, number]> = {};
        CUBIES.forEach((_, i) => sim.setCubieEl(i, { style: { set transform(v: string) {
          const m = v.match(/^rotate([XYZ])\((-?[\d.]+)deg\)/);
          if (m) last[i] = [m[1], +m[2]];
          else expect(v).toContain(`${CUBIES[i].pos[0] * GAP}px`);
        } } } as HTMLDivElement));
        const before = sim.snap!;
        await sim.run(() => sim.applyTokens([tok]));
        expect(Object.keys(last).length, tok).toBeGreaterThan(7);
        expect(facets(before, last), tok).toEqual(facets(sim.snap!));
      }
      CUBIES.forEach((_, i) => sim.setCubieEl(i, null));
    });
});
