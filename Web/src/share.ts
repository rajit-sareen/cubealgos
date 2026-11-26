import { COLOR_NAMES, MOVE_RE } from './cube';
import { sim, METHOD_LABELS, type Method } from './sim';
import { simMethod } from './timer/profile';
import { timer } from './timer/timer';

// Scrambles Into the Simulator
//
// Every way in, a timed solve, a pasted scramble or a shared link, ends here, so a
// scramble is read the same wherever it came from

export interface Solving { method?: Method; cross?: number | null }

// Moves of a scramble as written by hand or another timer, null if any token is not one
//
// Typographic primes and Rw style wide turns are what other sites and phones produce,
// so they are read as the plain ' and r
export function readScramble(text: string): string[] | null {
  const moves = text.replace(/[’′‘`]/g, "'").trim().split(/\s+/).filter(Boolean)
    .map(t => t.replace(/^([URFDLB])w/, (_, f: string) => f.toLowerCase()));
  return moves.length && moves.every(t => MOVE_RE.test(t)) ? moves : null;
}

// The profile's method and cross colour, the shortest cross for a neutral solver
export function profileSolving(): Solving {
  const cross = COLOR_NAMES.indexOf(timer.crossColor());
  return { method: simMethod(timer.profile), cross: cross < 0 ? null : cross };
}

export function openScramble(moves: string[], as: Solving = profileSolving()) {
  timer.open(null);
  if (location.hash.replace(/\?.*/, '') !== '#/sim') location.hash = '#/sim';
  sim.loadScramble(moves, as);
}

// A link that opens the scramble solved as it was seen, method and cross included
export function scrambleLink(moves: string[], as: Solving = {}) {
  const q = new URLSearchParams({ s: moves.join(' ') });
  if (as.method) q.set('m', as.method);
  if (as.cross != null) q.set('c', COLOR_NAMES[as.cross]);
  return `${location.origin}${location.pathname}#/sim?${q}`;
}

// What a link's hash asks for, null when it is no scramble link or the scramble is bad
export function readLink(hash: string): { moves: string[]; as: Solving } | null {
  const m = hash.match(/^#\/sim\?(.*)$/);
  if (!m) return null;
  const q = new URLSearchParams(m[1]);
  const moves = readScramble(q.get('s') ?? '');
  if (!moves) return null;
  const as: Solving = profileSolving();
  const method = q.get('m');
  if (method && method in METHOD_LABELS) as.method = method as Method;
  const cross = COLOR_NAMES.indexOf(q.get('c') ?? '');
  if (cross >= 0) as.cross = cross;
  return { moves, as };
}

// Opens a scramble link once and clears it from the address bar, so a reload or a new
// scramble afterwards is not taken back to it
export function followLink() {
  const link = readLink(location.hash);
  if (!link) return false;
  history.replaceState(null, '', '#/sim');
  openScramble(link.moves, link.as);
  return true;
}

// The clipboard needs a secure page, so elsewhere the text is offered to copy by hand
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt('Copy this link', text);
    return false;
  }
}
