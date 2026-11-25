import { useSyncExternalStore } from 'react';
import { api } from './engine';
import {
  AXIS_OF_FACE, COLOR_NAMES, CORNER_FACES, CUBIES, EDGE_FACES, GAP,
  HOME_ORBIT, MOVE_RE, PEEK_OF_FACE, ROT_FACE, SCRAMBLE_TEMPO, SLICE_FACE, clampX, ease,
  faceVisible, tempoOf, wrap, type Kind, type Snap,
} from './cube';

export interface Group { label: string; tokens: string[]; caseName?: string; startSnap?: Snap }
export interface Plan { groups: Group[]; pos: number; total: number }
export type Stage = 'cross' | 'f2l' | 'oll' | 'pll' | 'done';
export type Method = 'cfop' | 'cfop2' | 'cfop2oll' | 'cfop2pll' | 'kociemba';
// Which halves of the last layer each CFOP takes in two looks
const LOOKS: Record<Method, { oll: number; pll: number }> = {
  cfop: { oll: 1, pll: 1 }, cfop2: { oll: 2, pll: 2 }, cfop2oll: { oll: 2, pll: 1 }, cfop2pll: { oll: 1, pll: 2 },
  kociemba: { oll: 1, pll: 1 },
};
export const METHOD_LABELS: Record<Method, string> = {
  cfop: 'CFOP', cfop2: 'CFOP 2-look', cfop2oll: 'CFOP 2-look OLL', cfop2pll: 'CFOP 2-look PLL', kociemba: 'Kociemba',
};
export type Look = 'all' | 'edges' | 'corners';  // Last Layer Pieces a Step Solves
interface Opts {
  turn: number; gap: number;
  dim: boolean; grey: boolean; card: boolean; cam: boolean; idle: boolean; rgb: boolean; modern: boolean;
  fixed: boolean;  // Seen From the Front Always, as a Cube Held in the Hands
}
export type OptKey = 'dim' | 'grey' | 'card' | 'cam' | 'idle' | 'rgb' | 'modern' | 'fixed';
interface Err { error?: string }

export const STAGE_NAMES: Record<Stage, string> = { cross: 'Cross', f2l: 'F2L', oll: 'OLL', pll: 'PLL', done: 'Solved' };
const ZOOM_MIN = 0.4, ZOOM_MAX = 2.2;  // User Zoom Over the Fitted Size
const QS = new URLSearchParams(location.search);
const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* Private Window */ } },
};
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// The simulator's state and every action on it, outside React
//
// Moves are animated by writing transforms straight onto the cubie elements, sixty
// times a second, which React re-rendering could not keep up with. Everything the
// panels show lives here too, and render() bumps a version that useSim subscribes
// to, so the components re-read it whenever the cube or the plan changes
class Sim {
  version = 0;
  private listeners = new Set<() => void>();
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getVersion = () => this.version;
  private notify() { this.version++; this.listeners.forEach(f => f()); }

  snap: Snap | null = null;
  online = false;
  statusText = 'Booting';
  opId = 'CUBE_0X' + Math.floor(Math.random() * 4096).toString(16).toUpperCase().padStart(3, '0');
  method: Method = 'cfop';
  tempo = 50;
  opts: Opts = { turn: 220, gap: 160, dim: true, grey: false, card: true, cam: false, idle: true, rgb: true, modern: true, fixed: false };
  plan: Plan | null = null;
  // The cube a plan was made for, kept once the plan has been played through, so another
  // cross can be tried from the same start. Any move made by hand forgets it
  private base: Snap | null = null;
  cross: number | null = null;       // Cross Colour to Plan On, Null for the Shortest
  crosses: number[] | null = null;   // Cross Length per Colour
  private crossKey = '';
  playing = false;
  busy = false;
  scrambleMoves: string[] = [];
  scramblePos = 0;
  frontAway = false;

  // Viewport Elements, Set While It Is Mounted
  private cubieEls: (HTMLDivElement | null)[] = [];
  private sceneEl: HTMLDivElement | null = null;
  private cubeEl: HTMLDivElement | null = null;
  private fitZoom = 1;
  zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(store.get('zoom') || 1) || 1));

  status(text: string) { this.statusText = text; this.notify(); }

  // Camera
  //
  // One loop owns the orbit: a drag sets it directly and leaves a velocity behind,
  // which decays into a stop; a target, set when the next move's face is hidden,
  // eases the view round the short way; and after a while untouched the cube drifts
  // and bobs on its own until something happens
  //
  // The ease runs on elapsed time, not frames, and its time constant follows the turn
  // time, so at fast tempos the camera keeps up instead of holding the solve back
  orbit = { ...HOME_ORBIT };
  cam = { vx: 0, vy: 0, target: null as { x: number; y: number } | null,
          drag: null as { x: number; y: number; t: number } | null,
          moved: false, lastInput: 0, bob: 0, last: 0 };
  private camTau() { return Math.max(70, Math.min(360, this.opts.turn * 1.6 + 40)); }  // Ease Time Constant, ms
  private lastOrbit = '';

  private applyOrbit() {
    const key = this.orbit.x.toFixed(2) + ',' + this.orbit.y.toFixed(2);
    if (key === this.lastOrbit) return;
    this.lastOrbit = key;
    if (this.cubeEl) this.cubeEl.style.transform = `rotateX(${this.orbit.x}deg) rotateY(${this.orbit.y}deg)`;
    const away = !this.visible('F');
    if (away !== this.frontAway) { this.frontAway = away; this.notify(); }
  }
  private camLoop = (now: number) => {
    const { cam, orbit } = this;
    const dt = Math.min(100, now - (cam.last || now));
    cam.last = now;
    if (!cam.drag) {
      if (cam.target) {
        const dx = cam.target.x - orbit.x, dy = wrap(cam.target.y - orbit.y);
        const k = 1 - Math.exp(-dt / this.camTau());
        orbit.x += dx * k; orbit.y += dy * k;
        if (Math.abs(dx) < .5 && Math.abs(dy) < .5) { orbit.x = cam.target.x; orbit.y = cam.target.y; cam.target = null; }
      } else {
        orbit.y += cam.vy; orbit.x = clampX(orbit.x + cam.vx);
        cam.vx *= .94; cam.vy *= .94;
        if (Math.abs(cam.vx) < .03) cam.vx = 0;
        if (Math.abs(cam.vy) < .03) cam.vy = 0;
        const idle = this.opts.idle && !this.opts.fixed && !this.playing && !this.busy && now - cam.lastInput > 2500;
        if (idle) {
          orbit.y += .05;
          orbit.x += (Math.sin(now / 3100) * 8 - 24 - orbit.x) * .004;
          cam.bob += (Math.sin(now / 1500) * 7 - cam.bob) * .05;
        } else cam.bob *= .95;
        this.applyScale();
      }
      orbit.y = wrap(orbit.y);
      this.applyOrbit();
    }
    this.raf = requestAnimationFrame(this.camLoop);
  };
  private raf = 0;
  private applyScale() {
    if (this.sceneEl) this.sceneEl.style.transform = `scale(${this.fitZoom * this.zoom}) translateY(${this.cam.bob.toFixed(2)}px)`;
  }
  setZoom(z: number) {
    this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
    store.set('zoom', this.zoom.toFixed(3));
    this.applyScale();
    this.notify();
  }
  visible(letter: string) { return faceVisible(this.orbit, letter); }
  private nearOrbit(t: { x: number; y: number }) {
    return Math.abs(t.x - this.orbit.x) < 4 && Math.abs(wrap(t.y - this.orbit.y)) < 4;
  }
  // Done once the face has come into view, the camera settles the rest of the way
  // while the move plays
  private waitCam(ms: number, face: string) {
    return new Promise<void>(res => {
      const t0 = performance.now();
      const tick = () => (!this.cam.target || this.visible(face) || performance.now() - t0 > ms)
        ? res() : requestAnimationFrame(tick);
      tick();
    });
  }
  viewReset() { this.cam.target = { ...HOME_ORBIT }; this.cam.vx = this.cam.vy = 0; }

  // Viewport Mount: Elements, Camera Loop, Drag and Resize
  setCubieEl(i: number, el: HTMLDivElement | null) { this.cubieEls[i] = el; }
  mountView(viewport: HTMLElement, scene: HTMLDivElement, cube: HTMLDivElement) {
    this.sceneEl = scene; this.cubeEl = cube; this.lastOrbit = '';
    this.placeAll();
    const fit = () => {
      const w = viewport.clientWidth, h = viewport.clientHeight;
      this.fitZoom = Math.max(.5, Math.min(1.6, Math.min(w, h * .82) / 480));
      this.applyScale();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(viewport);
    this.raf = requestAnimationFrame(this.camLoop);

    // Drag orbits directly; the velocity of the last frames carries on after release
    const { cam, orbit } = this;
    const start = (x: number, y: number) => {
      cam.drag = { x, y, t: performance.now() }; cam.moved = false; cam.vx = cam.vy = 0;
      cam.target = null; cam.lastInput = performance.now();
    };
    const move = (x: number, y: number) => {
      if (!cam.drag) return;
      const now = performance.now(), dt = Math.max(1, now - cam.drag.t);
      const dy = (x - cam.drag.x) * .4, dx = -(y - cam.drag.y) * .4;
      orbit.y = wrap(orbit.y + dy); orbit.x = clampX(orbit.x + dx);
      cam.vy = cam.vy * .5 + (dy / dt) * 16 * .5; cam.vx = cam.vx * .5 + (dx / dt) * 16 * .5;
      if (Math.abs(x - cam.drag.x) + Math.abs(y - cam.drag.y) > 2) cam.moved = true;
      cam.drag.x = x; cam.drag.y = y; cam.drag.t = now; cam.lastInput = now;
      this.applyOrbit();
    };
    const end = () => {
      if (!cam.drag) return;
      if (performance.now() - cam.drag.t > 80) cam.vx = cam.vy = 0;
      cam.drag = null; cam.lastInput = performance.now();
      // A Fixed View Lets the Cube Be Looked Round, Then Goes Back to the Front
      if (this.opts.fixed) this.viewReset();
    };
    // Presses on the viewport's own buttons are clicks, not drags
    const onButton = (e: Event) => !!(e.target as Element).closest('button');
    const md = (e: MouseEvent) => { if (!onButton(e)) start(e.clientX, e.clientY); };
    const mm = (e: MouseEvent) => move(e.clientX, e.clientY);
    // Two fingers pinch to zoom instead of orbiting
    let pinch: { d: number; z: number } | null = null;
    const span = (e: TouchEvent) => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    const ts = (e: TouchEvent) => {
      if (onButton(e)) return;
      if (e.touches.length === 2) { pinch = { d: span(e), z: this.zoom }; cam.drag = null; return; }
      start(e.touches[0].clientX, e.touches[0].clientY);
    };
    const tm = (e: TouchEvent) => {
      if (pinch && e.touches.length === 2) { this.setZoom(pinch.z * span(e) / pinch.d); return; }
      move(e.touches[0].clientX, e.touches[0].clientY);
    };
    const te = (e: TouchEvent) => { if (e.touches.length < 2) pinch = null; end(); };
    const wheel = (e: WheelEvent) => { e.preventDefault(); this.setZoom(this.zoom * Math.exp(-e.deltaY * 0.0015)); };
    viewport.addEventListener('mousedown', md);
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', end);
    viewport.addEventListener('touchstart', ts, { passive: true });
    viewport.addEventListener('touchmove', tm, { passive: true });
    viewport.addEventListener('touchend', te);
    viewport.addEventListener('wheel', wheel, { passive: false });
    return () => {
      cancelAnimationFrame(this.raf);
      ro.disconnect();
      viewport.removeEventListener('mousedown', md);
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', end);
      viewport.removeEventListener('touchstart', ts);
      viewport.removeEventListener('touchmove', tm);
      viewport.removeEventListener('touchend', te);
      viewport.removeEventListener('wheel', wheel);
      this.sceneEl = this.cubeEl = null;
    };
  }

  private baseTransform(pos: number[]) { return `translate3d(${pos[0]*GAP}px, ${-pos[1]*GAP}px, ${pos[2]*GAP}px)`; }
  private placeAll() {
    CUBIES.forEach((c, i) => { const el = this.cubieEls[i]; if (el) el.style.transform = this.baseTransform(c.pos); });
  }

  // Readouts and step tracking re-derive from snap and plan, so every change to either
  // goes through here
  render() {
    if (!this.snap) return;
    this.captureStart();
    if (!this.busy && !this.playing)
      this.statusText = this.plan ? (this.plan.pos ? 'Paused' : 'Solution ready')
                      : this.snap.solved ? 'Solved' : 'Scrambled';
    this.notify();
  }

  stageOf(s: Snap): Stage {
    if (s.solved) return 'done';
    if (!s.cross) return 'cross';
    if (!s.f2l) return 'f2l';
    if (!s.oll) return 'oll';
    return 'pll';
  }
  // While a sequence is loaded the stage is the group being followed, since a pair
  // algorithm can break the cross for a few moves and the live state would flip back
  currentStage(): Stage {
    if (this.plan) {
      const l = this.groupAt(this.plan.pos).g.label.toLowerCase();
      const st = l.includes('cross') ? 'cross' : l.includes('pair') ? 'f2l' : l.includes('oll') ? 'oll' : l.includes('pll') ? 'pll' : null;
      if (st) return st;
    }
    return this.stageOf(this.snap!);
  }

  // The cube as each step found it, taken on a render at the step's first move while
  // nothing is in flight; applyTokens renders mid-step with the position not yet
  // advanced, and a capture there would record the state one move late
  private captureStart() {
    if (!this.plan || this.busy) return;
    const { g } = this.groupAt(this.plan.pos);
    if (this.plan.pos === this.groupStart(g)) g.startSnap = this.snap!;
  }

  // Only while a solution is being followed, and only the pieces its current step moves
  // A pair counts as done if it was home when the step began or an earlier step put it
  // in: algs lift finished pairs out and put them back, and a turn merged into the next
  // pair can leave one a turn short, so the live flags would grey them out on the way
  stagePieces() {
    const set = new Set<string>();
    if (!this.isCfop() || !this.following() || !this.plan) return set;
    const cur = this.currentStage();
    const add = (kind: Kind, piece: number) => set.add(kind + piece);
    if (cur === 'cross') [4,5,6,7].forEach(p => add('e', p));
    if (cur === 'f2l') {
      const { g } = this.groupAt(this.plan.pos);
      const from = g.startSnap;
      [4,5,6,7].forEach(p => add('e', this.pieceNow('e', p, from)));
      const down = COLOR_NAMES.indexOf(this.plan.groups[0].label.split(' ')[0]);
      const pair = (label: string) => {
        const [a, b] = label.split(' ').map(c => COLOR_NAMES.indexOf(c));
        add('e', this.pieceWith('e', [a, b]));
        add('c', this.pieceWith('c', [a, b, down]));
      };
      const named = (l: string) => /^\w+ \w+ pair$/.test(l);
      if (named(g.label)) pair(g.label);
      else if (from) [0,1,2,3].filter(k => !from.pairs[k]).forEach(k => {
        add('c', this.pieceNow('c', 4 + k, from)); add('e', this.pieceNow('e', 8 + k, from));
      });
      for (const h of this.plan.groups.slice(0, this.plan.groups.indexOf(g))) if (named(h.label)) pair(h.label);
      if (from) [0,1,2,3].filter(k => from.pairs[k]).forEach(k => {
        add('c', this.pieceNow('c', 4 + k, from)); add('e', this.pieceNow('e', 8 + k, from));
      });
    }
    if (cur === 'oll' || cur === 'pll') {
      const { g } = this.groupAt(this.plan.pos);
      [0,1,2,3].forEach(k => {
        add('c', this.pieceNow('c', k, g.startSnap));
        add('e', this.pieceNow('e', k, g.startSnap));
      });
    }
    return set;
  }

  // Pieces are numbered by where they belong in the current frame, and a wide or slice
  // turn changes the frame partway through an alg. This is the number now of a piece
  // numbered in the frame its step started in, matched by its colours
  private pieceNow(kind: 'c' | 'e', piece: number, from: Snap | undefined) {
    if (!from) return piece;
    const FACES = kind === 'c' ? CORNER_FACES : EDGE_FACES;
    const colors = (s: Snap, p: number) => FACES[p].map(f => s.faces[f]).sort().join();
    const want = colors(from, piece);
    return FACES.findIndex((_, p) => colors(this.snap!, p) === want);
  }

  // The piece, numbered in the current frame, that carries these colours
  private pieceWith(kind: 'c' | 'e', colors: number[]) {
    const FACES = kind === 'c' ? CORNER_FACES : EDGE_FACES;
    const want = [...colors].sort().join();
    return FACES.findIndex(f => f.map(x => this.snap!.faces[x]).sort().join() === want);
  }

  groupStart(g: Group) {
    let n = 0;
    for (const h of this.plan!.groups) { if (h === g) return n; n += h.tokens.length; }
    return n;
  }
  groupAt(pos: number) {
    const gs = this.plan!.groups;
    let n = 0;
    for (const g of gs) { if (pos < n + g.tokens.length) return { g, i: pos - n }; n += g.tokens.length; }
    return { g: gs[gs.length - 1], i: 0 };
  }
  // The OLL or PLL step under way, for the case card
  caseStep() {
    if (!this.plan || !this.opts.card) return null;
    const { g } = this.groupAt(this.plan.pos);
    const kind = g.label.startsWith('OLL') ? 'oll' as const : g.label.startsWith('PLL') ? 'pll' as const : null;
    if (!kind || !g.startSnap) return null;
    const look: Look = g.label.endsWith('edges') ? 'edges' : g.label.endsWith('corners') ? 'corners' : 'all';
    return { g, kind, look, i: this.plan.pos - this.groupStart(g) };
  }
  planTokens() { return this.plan ? this.plan.groups.flatMap(g => g.tokens) : []; }
  nextToken() { return this.plan && this.plan.pos < this.plan.total ? this.planTokens()[this.plan.pos] : null; }
  following() { return !!this.plan && (this.playing || this.plan.pos > 0); }

  private animateTurn(tok: string) {
    if (this.opts.turn <= 0) return Promise.resolve();
    const isRot = 'xyz'.includes(tok[0]);
    const slice = SLICE_FACE[tok[0]];
    const face = isRot ? ROT_FACE[tok[0]] : slice ?? tok[0].toUpperCase();
    const wide = !isRot && !slice && tok[0] !== face;
    const [axis, css, sign] = AXIS_OF_FACE[face];
    const turns = tok.endsWith('2') ? 2 : 1, dir = tok.endsWith("'") ? -1 : 1;
    const side = 'URF'.includes(face) ? 1 : -1;
    const angle = 90 * turns * dir * sign;
    const layer = CUBIES.map((c, i) => ({ c, el: this.cubieEls[i] }))
      .filter(({ c, el }) => el && (isRot || (slice ? c.pos[axis] === 0 : wide ? c.pos[axis] !== -side : c.pos[axis] === side)));
    const dur = this.opts.turn * (turns === 2 ? 1.5 : 1);
    return new Promise<void>(res => {
      const t0 = performance.now();
      const frame = (now: number) => {
        const t = Math.min(1, (now - t0) / dur), a = angle * ease(t);
        for (const { c, el } of layer) el!.style.transform = `rotate${css}(${a}deg) ` + this.baseTransform(c.pos);
        if (t < 1) requestAnimationFrame(frame); else res();
      };
      requestAnimationFrame(frame);
    });
  }

  // Actions run one after another, so a burst of key presses or clicks lands every
  // move in order instead of dropping the ones that arrive mid-animation
  private queue: { fn: () => Promise<unknown> | unknown; res: () => void }[] = [];
  pumping = false;
  run(fn: () => Promise<unknown> | unknown) {
    if (this.queue.length > 16) return Promise.resolve();
    return new Promise<void>(res => { this.queue.push({ fn, res }); if (!this.pumping) this.pump(); });
  }
  private async pump() {
    this.pumping = true;
    while (this.queue.length) {
      const { fn, res } = this.queue.shift()!;
      try { await fn(); } catch (e) { this.status('Error: ' + (e instanceof Error ? e.message : e)); }
      res();
    }
    this.pumping = false;
    this.refreshCrosses();
  }

  // Moves made by hand invalidate a plan, since it was computed for the state before them
  async applyTokens(tokens: string[], { keepPlan = false, onEach = null as null | (() => void) } = {}) {
    if (this.busy || !tokens.length) return false;
    const bad = tokens.find(t => !MOVE_RE.test(t));
    if (bad) { this.status('Unknown move ' + bad); return false; }
    this.busy = true;
    try {
      if (!keepPlan) this.plan = this.base = null;
      if (this.opts.turn > 0) {
        for (const t of tokens) {
          const [res] = await Promise.all([api<Snap & Err>('apply', { seq: t }), this.animateTurn(t)]);
          if (res.error) { this.status(res.error); this.placeAll(); return false; }
          this.snap = res; this.placeAll(); this.render();
          if (onEach) onEach();
        }
      } else {
        const res = await api<Snap & Err>('apply', { seq: tokens.join(' ') });
        if (res.error) { this.status(res.error); return false; }
        this.snap = res; this.render();
      }
      return true;
    } finally { this.busy = false; }
  }

  private setPlan(groups: Group[]) {
    const gs = groups.filter(g => g.tokens.length);
    this.plan = gs.length ? { groups: gs, pos: 0, total: gs.reduce((n, g) => n + g.tokens.length, 0) } : null;
    this.base = this.plan ? this.snap : null;
    this.render();
  }
  step = async () => {
    const t = this.nextToken(); if (!t) return false;
    if (this.opts.cam && !this.opts.fixed && !this.cam.drag) {
      const face = 'xyzMES'.includes(t[0]) ? null : t[0].toUpperCase();
      const want = face && (PEEK_OF_FACE[face] || HOME_ORBIT);
      if (face && want && !this.visible(face) && !this.nearOrbit(want)) {
        this.cam.target = { ...want };
        await this.waitCam(Math.min(1200, this.opts.turn * 3), face);
      }
    }
    if (!await this.applyTokens([t], { keepPlan: true })) return false;
    if (!this.plan) return false;  // Cleared While the Move Was in Flight
    this.plan.pos++;
    if (this.plan.pos >= this.plan.total) {
      this.plan = null;
    }
    this.render();
    return true;
  };
  back = async () => {
    if (this.busy || this.playing) return;
    if (!this.plan) return this.undo();
    if (this.plan.pos === 0) return;
    const res = await api<Snap>('undo');
    if (!this.plan) return;
    this.snap = res; this.plan.pos--; this.render();
  };
  play = async () => {
    if (this.playing) { this.playing = false; return; }
    this.playing = true; this.status('Solving'); this.render();
    while (this.playing && this.nextToken()) {
      if (!await this.step()) break;
      if (this.opts.gap && this.nextToken()) await sleep(this.opts.gap);
    }
    this.playing = false; this.render();
  };
  applyAll = async () => {
    if (!this.plan) return;
    const rest = this.planTokens().slice(this.plan.pos), saveTurn = this.opts.turn;
    this.opts.turn = 0;
    const ok = await this.applyTokens(rest, { keepPlan: true });
    this.opts.turn = saveTurn;
    if (ok) {
      this.plan = null;
      this.render();
    }
  };

  private fail(res: Err) { if (res.error) { this.status(res.error); return true; } return false; }
  kociemba = async () => {
    this.status('Searching');
    const r = await api<Err & { moves: string[] }>('kociemba'); if (this.fail(r)) return;
    this.setPlan([{ label: 'Kociemba', tokens: r.moves }]);
    return r.moves.length;
  };

  // Whole solve with the chosen method; CFOP folds the rotation into its first step
  private planning = 0;  // Searches and Rewinds Under Way
  planSolution = async () => {
    if (this.busy || this.playing) return false;
    if (this.snap!.solved) return false;
    this.planning++;
    try { return await this.search(); } finally { this.planning--; }
  };
  private async search() {
    if (this.opts.cam && !this.visible('F')) this.cam.target = { ...HOME_ORBIT };
    if (this.method === 'kociemba') return (await this.kociemba()) != null;
    this.status('Searching');
    const r = await api<Err & { rotation: string; steps: { label: string; case: string; moves: string[] }[] }>('cfop', { color: this.cross ?? -1, ...LOOKS[this.method] });
    if (this.fail(r)) return false;
    const rot = r.rotation ? r.rotation.split(' ') : [];
    this.setPlan(r.steps.map((s, i) => ({ label: s.label, tokens: i === 0 ? [...rot, ...s.moves] : s.moves, caseName: s.case })));
    return true;
  }
  playSolution = async () => {
    if (this.busy || this.playing) return;
    if (!await this.planSolution()) return;
    await this.play();
  };

  // Cross lengths for the cube a pick would plan from, which stays put while a plan plays
  private async refreshCrosses() {
    const s = this.snap;
    if (!s || this.base || !this.isCfop()) return;
    const key = s.solved ? '' : JSON.stringify([s.cp, s.co, s.ep, s.eo, s.hold]);
    if (key === this.crossKey) return;
    this.crossKey = key;
    this.crosses = null;
    this.notify();
    if (!key) return;
    const r = await api<Err & { lengths: number[] }>('crosses');
    if (key !== this.crossKey || r.error) return;
    this.crosses = r.lengths;
    this.notify();
  }

  // Goes back to the cube the current plan started from, if there is one, and plans it
  // again
  //
  // The lengths are asked for at the start since the plan to come holds them still, and a
  // Kociemba plan never asked
  private replan() {
    this.playing = false; this.notify();
    if (!this.snap) return;
    this.run(async () => {
      this.planning++;
      try {
        const start = this.base;
        this.plan = this.base = null;
        while (start && this.snap!.history > start.history) this.snap = await api<Snap>('undo');
        this.render();
        this.refreshCrosses();
        await this.planSolution();
      } finally { this.planning--; }
    });
  }
  pickCross(color: number | null) { this.cross = color; this.replan(); }

  // A timer solve's scramble, put on the cube at once and planned, ready to play
  // as given, or with the CFOP in use and its cross picker, Kociemba having none
  loadScramble(moves: string[], as: { method?: Method; cross?: number | null } = {}) {
    this.escape();
    this.method = as.method ?? (this.isCfop() ? this.method : 'cfop');
    if (as.cross !== undefined) this.cross = as.cross;
    this.run(async () => {
      const r = await api<Snap & Err>('reset'); if (this.fail(r)) return;
      this.snap = r;
      this.scrambleMoves = []; this.scramblePos = 0;
      const turn = this.opts.turn;
      this.opts.turn = 0;
      const ok = await this.applyTokens(moves);
      this.opts.turn = turn;
      if (!ok) return;
      this.scrambleMoves = moves; this.scramblePos = moves.length;
      this.refreshCrosses();
      await this.planSolution();
    });
  }

  // A scramble is fetched and then played out as real moves on a reset cube
  scramble = async () => {
    if (this.busy || this.playing) return;
    this.status('Scrambling');
    const r = await api<Err & { moves: string[] }>('wca'); if (this.fail(r)) return;
    this.snap = await api<Snap>('reset'); this.plan = this.base = null;
    this.scrambleMoves = r.moves; this.scramblePos = 0; this.render();
    const save = { turn: this.opts.turn, gap: this.opts.gap };
    Object.assign(this.opts, this.opts.turn ? SCRAMBLE_TEMPO : { turn: 0, gap: 0 });
    await this.applyTokens(r.moves, { onEach: () => { this.scramblePos++; this.notify(); } });
    Object.assign(this.opts, save);
    this.scramblePos = this.scrambleMoves.length; this.render();
  };
  reset = async () => {
    if (this.busy || this.playing) return;
    this.snap = await api<Snap>('reset'); this.plan = this.base = null; this.scrambleMoves = [];
    this.render();
  };
  undo = async () => {
    if (this.busy || this.playing) return;
    this.plan = this.base = null; this.snap = await api<Snap>('undo'); this.render();
  };

  // Space: scramble a solved cube, load the sequence for a scrambled one, then play
  // or pause it; the arrows step through it one move at a time
  impulse = () => {
    if (!this.snap) return;
    if (this.playing) { this.play(); return; }
    if (this.pumping) return;
    this.run(() => this.plan ? this.play() : this.snap!.solved ? this.scramble() : this.planSolution());
  };
  manual = (tokens: string[]) => { if (!this.playing && this.snap) this.run(() => this.applyTokens(tokens)); };
  escape() {
    this.plan = this.base = null; this.playing = false;
    this.queue.splice(0).forEach(q => q.res());
    this.render();
    this.refreshCrosses();
  }

  isCfop() { return this.method !== 'kociemba'; }
  // With a plan made, or on its way, the new method takes on the same cube from its start,
  // so two methods can be compared on one scramble. Otherwise there is nothing to redo
  setMethod(m: Method) {
    if (m === this.method) return;
    this.method = m;
    if (this.base || this.planning) return this.replan();
    this.render();
    this.refreshCrosses();
  }
  setOpt(key: OptKey, on: boolean) {
    this.opts[key] = on; store.set(key, on ? '1' : '0');
    if (key === 'fixed' && on) this.viewReset();
    this.notify();
  }
  setTempo(v: number) {
    v = Math.max(0, Math.min(100, Math.round(v)));
    const t = tempoOf(v); this.opts.turn = t.turn; this.opts.gap = t.gap; this.tempo = v;
    store.set('tempo', String(v)); this.notify();
  }

  // Keyboard: face letters turn (Shift for prime), x y z rotate, Space drives the solve,
  // arrows step, Escape drops the plan
  bindKeys() {
    // A clicked button or dropdown must not keep focus, or the next Space would click it
    // again
    const click = (e: MouseEvent) => { const b = (e.target as HTMLElement).closest<HTMLElement>('button, summary'); if (b) b.blur(); };
    const key = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'SUMMARY' || e.metaKey || e.ctrlKey || e.altKey) return;
      this.cam.lastInput = performance.now();
      const k = e.key.toLowerCase();
      if (k.length === 1 && 'urfdlb'.includes(k)) { this.manual([k.toUpperCase() + (e.shiftKey ? "'" : '')]); e.preventDefault(); }
      else if (k.length === 1 && 'xyz'.includes(k)) { this.manual([k + (e.shiftKey ? "'" : '')]); e.preventDefault(); }
      else if (e.key === ' ') { this.impulse(); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { if (this.plan && !this.playing) this.run(this.step); e.preventDefault(); }
      else if (e.key === 'ArrowLeft' || e.key === 'Backspace') { if (!this.playing) this.run(this.back); e.preventDefault(); }
      else if (e.key === 'Escape') this.escape();
    };
    document.addEventListener('click', click);
    window.addEventListener('keydown', key);
    return () => { document.removeEventListener('click', click); window.removeEventListener('keydown', key); };
  }

  private booted = false;
  async boot() {
    if (this.booted) return;
    this.booted = true;
    const tempo = store.get('tempo');
    this.setTempo(tempo != null && tempo !== '' && !isNaN(+tempo) && +tempo <= 100 ? +tempo : 50);
    for (const k of ['dim', 'card', 'idle', 'rgb', 'modern'] as const) if (store.get(k) === '0') this.opts[k] = false;
    for (const k of ['grey', 'cam', 'fixed'] as const) this.opts[k] = store.get(k) === '1';
    const method = QS.get('method');
    if (method && method in LOOKS) this.method = method as Method;
    if (QS.get('orbit')) { const [x, y] = QS.get('orbit')!.split(',').map(Number); this.orbit = { x, y }; }
    this.status('Loading engine');
    const s = await api<Snap & Err>('state');
    if (s.error) { this.status('Offline'); return; }
    this.snap = s; this.online = true; this.render();
  }
}

export const sim = new Sim();

// Re-renders the calling component on every sim change and hands back the sim to read
export function useSim() {
  useSyncExternalStore(sim.subscribe, sim.getVersion);
  return sim;
}
