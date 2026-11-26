import { describe, expect, it } from 'vitest';
import { readLink, readScramble, scrambleLink } from '../src/share';

describe('readScramble', () => {
  it('reads scrambles as other sites and phones write them', () => {
    expect(readScramble("  R U2\tF’  D′ Rw Rw2 Uw' M ")).toEqual(['R', 'U2', "F'", "D'", 'r', 'r2', "u'", 'M']);
  });

  it('refuses anything that is not a turn', () => {
    for (const bad of ['', '   ', 'R U Q', 'R3', 'hello', '1. R U']) expect(readScramble(bad)).toBeNull();
  });
});

describe('links', () => {
  it('carry the scramble, method and cross there and back', () => {
    const moves = ['R', "U'", 'F2', 'r', 'M2'];
    const link = scrambleLink(moves, { method: 'cfop2oll', cross: 5 });
    expect(link).toMatch(/#\/sim\?s=R\+U%27\+F2\+r\+M2&m=cfop2oll&c=blue$/);
    expect(readLink(link.slice(link.indexOf('#')))).toEqual({ moves, as: { method: 'cfop2oll', cross: 5 } });
  });

  it('fall back to the profile for what they leave out or get wrong', () => {
    const link = readLink('#/sim?s=R+U&m=nonsense&c=purple');
    expect(link!.moves).toEqual(['R', 'U']);
    expect(link!.as).toEqual({ method: 'cfop2', cross: null });
  });

  it('are only scramble links when they hold a scramble', () => {
    for (const hash of ['#/sim', '#/stats?s=R', '#/sim?m=cfop', '#/sim?s=R+Q', '']) expect(readLink(hash)).toBeNull();
  });
});
