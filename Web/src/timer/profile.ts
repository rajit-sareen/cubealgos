import type { CrossColor } from './timer';
import type { Method as SimMethod } from '../sim';

export type Method = 'beginner' | 'cfop' | 'roux';
export type Look = '2-look' | 'full';

export interface Profile {
  method: Method;
  oll: Look;                 // CFOP Only
  pll: Look;                 // CFOP Only
  cross: CrossColor | null;  // Null Until the Solver Picks One
}

export const DEFAULT_PROFILE: Profile = { method: 'cfop', oll: '2-look', pll: '2-look', cross: null };

// Each method's four stages, so a split session always taps three times whatever the
// method and old solves keep lining up with new ones
export const METHOD_STAGES: Record<Method, readonly string[]> = {
  beginner: ['Cross', 'Corners', 'Edges', 'Last layer'],
  cfop: ['Cross', 'F2L', 'OLL', 'PLL'],
  roux: ['First block', 'Second block', 'CMLL', 'LSE'],
};

// Methods That Start From a Cross
export const HAS_CROSS: Record<Method, boolean> = { beginner: true, cfop: true, roux: false };

export const METHOD_NAMES: Record<Method, string> = { beginner: 'Beginner', cfop: 'CFOP', roux: 'Roux' };

// The Usual Path, One Rung per Set of Algs Learned
export interface Level { n: number; name: string; detail: string; profile: Pick<Profile, 'method' | 'oll' | 'pll'> }
export const LEVELS: Level[] = [
  { n: 1, name: 'Beginner', detail: 'Layer by layer',
    profile: { method: 'beginner', oll: '2-look', pll: '2-look' } },
  { n: 2, name: 'CFOP 2-look', detail: '2-look OLL and PLL, 16 algs',
    profile: { method: 'cfop', oll: '2-look', pll: '2-look' } },
  { n: 3, name: 'CFOP full PLL', detail: '2-look OLL, all 21 PLLs',
    profile: { method: 'cfop', oll: '2-look', pll: 'full' } },
  { n: 4, name: 'CFOP full', detail: 'Full OLL and PLL, 78 algs',
    profile: { method: 'cfop', oll: 'full', pll: 'full' } },
];

// Roux sits off the CFOP ladder, so it has no level number
export function levelOf(p: Profile): Level | null {
  if (p.method === 'roux') return null;
  return LEVELS.find(l => l.profile.method === p.method
    && (p.method === 'beginner' || (l.profile.oll === p.oll && l.profile.pll === p.pll))) ?? null;
}

// The simulator's solve nearest the profile, for analysing its solves
//
// The beginner method has no solver of its own, and its last layer is learnt as 2-look
// first, so it comes closest. Roux has none either, and keeps whatever the simulator has
export function simMethod(p: Profile): SimMethod | undefined {
  if (p.method === 'roux') return undefined;
  if (p.method === 'beginner') return 'cfop2';
  const oll = p.oll === '2-look', pll = p.pll === '2-look';
  return oll && pll ? 'cfop2' : oll ? 'cfop2oll' : pll ? 'cfop2pll' : 'cfop';
}

// Full OLL with 2-look PLL, saved by an earlier build, has no rung, so it is spelt out
export function profileName(p: Profile) {
  return levelOf(p)?.name ?? (p.method === 'cfop' ? `CFOP ${p.oll} OLL, ${p.pll} PLL` : METHOD_NAMES[p.method]);
}
