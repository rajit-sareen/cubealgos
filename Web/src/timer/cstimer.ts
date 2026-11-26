import type { Penalty, Session, Solve } from './db';

// A csTimer export, read into sessions and solves
//
// The file holds session1, session2 and so on, each a list of
// [[penalty, ms, phase ends...], scramble, comment, unix seconds], sometimes itself JSON
// as a string, with the session names and puzzle types in properties.sessionData, JSON
// as a string. A penalty of 2000 is a +2 and -1 a DNF, the time never including it
//
// A multi-phase solve lists where each phase ended, the last first, so its first entry is
// the whole time. Four phases are the four stages split here and become the solve's
// splits; any other count has no stages to match and is left out
//
// Only 3x3 face turn scrambles can be timed and analysed here, so a session of any other
// puzzle is skipped whole: one whose type, in its options, is not a 3x3 one, or that
// holds a scramble of anything but face turns. A 2x2 scramble is face turns too, so
// the type is the only way to tell it. Ids come from csTimer's own numbering, so a file
// imported twice adds nothing the second time

const FACE_TURNS = /^([URFDLB][2']?\s+)*[URFDLB][2']?$/;

export function isCsTimer(data: unknown): boolean {
  return !!data && typeof data === 'object' && Object.keys(data).some(k => /^session\d+$/.test(k));
}

export function readCsTimer(data: Record<string, unknown>) {
  let names: Record<string, { name?: unknown; opt?: { scrType?: unknown } }> = {};
  try {
    const raw = (data.properties as { sessionData?: unknown } | undefined)?.sessionData;
    names = typeof raw === 'string' ? JSON.parse(raw) : (raw as typeof names) ?? {};
  } catch { /* Names Are a Nicety */ }

  const sessions: Session[] = [], solves: Solve[] = [];
  let skipped = 0;
  for (const key of Object.keys(data).filter(k => /^session\d+$/.test(k))) {
    const n = key.slice(7);
    let rows = data[key];
    if (typeof rows === 'string') try { rows = JSON.parse(rows); } catch { continue; }
    if (!Array.isArray(rows) || !rows.length) continue;
    const id = 'cstimer-' + n;
    const read: Solve[] = [];
    for (const [i, row] of rows.entries()) {
      if (!Array.isArray(row) || !Array.isArray(row[0])) continue;
      const [times, scramble, , seconds] = row as [number[], string, unknown, number];
      const [pen, ms, ...ends] = times;
      if (typeof ms !== 'number' || typeof scramble !== 'string') continue;
      const penalty: Penalty = pen === -1 ? 'dnf' : pen === 2000 ? '+2' : 'ok';
      const date = typeof seconds === 'number' ? seconds * 1000 : 0;
      const solve: Solve = { id: `${id}-${i}-${date}`, session: id, time: ms, penalty, scramble: scramble.trim(), date };
      if (ends.length === 3 && ends.every(x => typeof x === 'number')) solve.splits = ends.reverse();
      read.push(solve);
    }
    if (!read.length) continue;
    const type = names[n]?.opt?.scrType;
    const cube = type == null || (typeof type === 'string' && type.startsWith('333'));
    if (!cube || !read.every(s => FACE_TURNS.test(s.scramble))) { skipped++; continue; }
    const name = names[n]?.name;
    sessions.push({ id, name: `${name ?? 'Session ' + n} (csTimer)`, created: Math.min(...read.map(s => s.date)) });
    solves.push(...read);
  }
  return { sessions, solves, skipped };
}
