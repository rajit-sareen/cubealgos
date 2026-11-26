import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { copyText, openScramble, readScramble, scrambleLink } from '../share';
import { COLOR_NAMES, COLOR_VARS, PATTERN_VARS, pad3, tempoOf } from '../cube';
import { METHOD_LABELS, STAGE_NAMES, sim, useSim, type Method, type OptKey } from '../sim';
import { Viewport } from '../components/Viewport';

// The 3D simulator: scramble, plan a CFOP, 2-look CFOP or Kociemba solve, and play it move by move
export function SimPage() {
  useEffect(() => sim.bindKeys(), []);
  return <>
    <ScrambleBar />
    <main id="main">
      <LeftPanel />
      <Viewport />
      <RightPanel />
    </main>
  </>;
}

// The scramble on the cube, with a box to solve one of your own and a link to share it
function ScrambleBar() {
  const s = useSim();
  const playing = s.scramblePos < s.scrambleMoves.length;
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const flash = (msg: string) => { setNote(msg); setTimeout(() => setNote(''), 1500); };
  const enter = () => {
    const moves = readScramble(text);
    if (!moves) return flash('Not a scramble');
    openScramble(moves, { method: sim.isCfop() ? sim.method : undefined, cross: sim.cross });
    setTyping(false); setText('');
  };
  const share = async () => {
    if (await copyText(scrambleLink(s.scrambleMoves, { method: s.method, cross: s.cross }))) flash('Link copied');
  };
  return (
    <div id="scrambleBar">
      <span className="lbl">Scramble</span>
      {typing ? (
        <form className="enter" onSubmit={e => { e.preventDefault(); enter(); }}>
          <input autoFocus value={text} onChange={e => setText(e.target.value)} aria-label="Scramble to solve"
                 placeholder="Paste or type a scramble, then Enter" onKeyDown={e => { if (e.key === 'Escape') setTyping(false); }} />
        </form>
      ) : (
        <span id="scrambleTokens">
          {!s.scrambleMoves.length ? '---' : <>
            {s.scrambleMoves.map((t, i) => <span key={i} className={'tok' + (playing && i < s.scramblePos ? ' done' : '')}>{t}</span>)}
            <span className="n">{s.scrambleMoves.length} moves</span>
          </>}
        </span>
      )}
      <span className="sbtns">
        {note && <span className="note-inline">{note}</span>}
        {typing
          ? <><button onClick={enter}>Solve</button><button onClick={() => setTyping(false)}>Cancel</button></>
          : <button onClick={() => setTyping(true)} title="Solve a scramble of your own">Enter scramble</button>}
        <button onClick={share} disabled={!s.scrambleMoves.length || playing}>Share</button>
      </span>
    </div>
  );
}

function LeftPanel() {
  const s = useSim();
  const t = tempoOf(s.tempo);
  return (
    <aside id="left">
      <div className="blk">
        <div className="lbl">Status</div>
        <div className="val big">{s.statusText}</div>
      </div>
      <div className="blk">
        <div className="lbl">Method</div>
        <select value={s.method} onChange={e => sim.setMethod(e.target.value as Method)} aria-label="Method">
          {Object.entries(METHOD_LABELS).map(([m, name]) => <option key={m} value={m}>{name}</option>)}
        </select>
      </div>
      {s.isCfop() && <CrossPicker />}
      <div className="blk">
        <div className="lbl">Tempo</div>
        <div className="tempo-read"><b>{t.name}</b><span>{t.turn ? `${t.turn} ms / move` : 'no animation'}</span></div>
        <div className="slider">
          <input type="range" min={0} max={100} step={1} value={s.tempo} aria-label="Tempo"
                 onChange={e => sim.setTempo(+e.target.value)} />
          <div className="ticks"><span>Learn</span><span>Slow</span><span>Normal</span><span>Fast</span><span>Instant</span></div>
        </div>
      </div>
      <div className="blk">
        <details>
          <summary>Moves</summary>
          <div className="keys">
            {[...'URFDLB'].flatMap(f => ['', "'", '2'].map(suf => (
              <button key={f + suf} onClick={() => sim.manual([f + suf])}>{f + suf}</button>
            )))}
          </div>
          <div className="keys rot">
            {[...'xyz'].flatMap(r => ['', "'", '2'].map(suf => (
              <button key={r + suf} onClick={() => sim.manual([r + suf])}>{r + suf}</button>
            )))}
          </div>
        </details>
      </div>
    </aside>
  );
}

// Opposite Colours Side by Side
const CROSS_ORDER = ['white', 'yellow', 'green', 'blue', 'red', 'orange'].map(c => COLOR_NAMES.indexOf(c));

// Cross colour to solve on, with the moves its optimal cross takes from here
function CrossPicker() {
  const s = useSim();
  const best = s.crosses ? Math.min(...s.crosses) : null;
  return (
    <div className="blk">
      <div className="lbl">Cross</div>
      <div className="crosses">
        <button className={'any' + (s.cross == null ? ' on' : '')} aria-pressed={s.cross == null} disabled={!s.snap}
                onClick={() => sim.pickCross(null)}>Shortest<b>{best ?? ''}</b></button>
        {CROSS_ORDER.map(c => (
          <button key={c} className={s.cross === c ? 'on' : ''} aria-pressed={s.cross === c} disabled={!s.snap}
                  onClick={() => sim.pickCross(c)}>
            <i className="sw" style={{ '--c': COLOR_VARS[c], '--p': PATTERN_VARS[c] } as CSSProperties} />
            {COLOR_NAMES[c]}<b>{s.crosses?.[c] ?? ''}</b>
          </button>
        ))}
      </div>
    </div>
  );
}

function RightPanel() {
  const s = useSim();
  const { plan, snap, playing } = s;
  const cur = snap ? s.currentStage() : null;
  const nt = s.nextToken();
  const step = !snap ? '---' : s.isCfop()
    ? (cur === 'f2l' ? `F2L ${snap.pairs.filter(Boolean).length}/4` : STAGE_NAMES[cur!])
    : (snap.solved ? 'Solved' : '---');
  const mode = !snap ? 'Loading' : playing ? 'Pause' : plan ? (plan.pos ? 'Resume' : 'Play') : snap.solved ? 'Scramble' : 'Solve';
  return (
    <aside id="right">
      <div className="blk">
        <div className="lbl">Moves</div>
        <div className="val huge">{plan ? <>{pad3(plan.pos)}<small>/{pad3(plan.total)}</small></> : pad3(0)}</div>
      </div>
      <div className="blk">
        <div className="lbl">Next</div>
        <div className={'val huge' + (nt && 'xyz'.includes(nt[0]) ? ' rot' : '')} id="stNext">{nt || '---'}</div>
      </div>
      <div className="blk">
        <div className="lbl">Step</div>
        <div className="val">{step}</div>
      </div>
      <div className="blk grow">
        <div className="lbl">Sequence</div>
        <Sequence />
      </div>
      <div className="blk">
        <details>
          <summary>Options</summary>
          <div className="opts">
            <Toggle k="dim">Highlight step</Toggle>
            <Toggle k="grey">Grey, not fade</Toggle>
            <Toggle k="card">Case card</Toggle>
            <Toggle k="fixed">Fixed view</Toggle>
            <Toggle k="cam" off={s.opts.fixed}>Auto camera</Toggle>
            <Toggle k="idle" off={s.opts.fixed}>Idle drift</Toggle>
            <Toggle k="rgb">Colours</Toggle>
            <Toggle k="modern">Modern look</Toggle>
          </div>
        </details>
      </div>
      <div className="blk">
        <button id="inputCtl" disabled={!snap} onClick={() => sim.impulse()}>{mode}</button>
        <div className="row ctl" style={{ marginTop: 8 }}>
          <button title="Left arrow" disabled={!plan || playing || plan.pos === 0} onClick={() => { if (!sim.playing) sim.run(sim.back); }}>&larr;</button>
          <button title="Right arrow" disabled={!plan || playing} onClick={() => { if (sim.plan && !sim.playing) sim.run(sim.step); }}>&rarr;</button>
          <button disabled={!plan} onClick={() => { if (sim.plan) sim.impulse(); }}>{playing ? 'Pause' : 'Play'}</button>
          <button title="Apply the rest at once" disabled={!plan || playing} onClick={() => { if (!sim.playing) sim.run(sim.applyAll); }}>All</button>
        </div>
      </div>
    </aside>
  );
}

// off greys out an option another one overrides, keeping its setting for when it is back
function Toggle({ k, off = false, children }: { k: OptKey; off?: boolean; children: string }) {
  const s = useSim();
  return <button className={'tg' + (s.opts[k] && !off ? ' on' : '')} aria-pressed={s.opts[k] && !off} disabled={off}
                 onClick={() => sim.setOpt(k, !s.opts[k])}>{children}</button>;
}

// The sequence is bare notation: group labels and tokens, the next one inverted
function Sequence() {
  const s = useSim();
  const ref = useRef<HTMLDivElement>(null);
  const plan = s.plan;
  useLayoutEffect(() => { ref.current?.querySelector('.tok.next')?.scrollIntoView({ block: 'nearest' }); });
  if (!plan) return <div id="seq"><span id="seqEmpty">---</span></div>;
  let n = 0;
  return (
    <div id="seq" ref={ref}>
      {plan.groups.map((g, gi) => {
        const start = n;
        n += g.tokens.length;
        const state = plan.pos >= start + g.tokens.length ? 'done' : plan.pos >= start ? 'cur' : 'todo';
        return (
          <div key={gi} className={'g ' + state}>
            <div className="gl">{pad3(gi + 1).slice(1)} {g.label}</div>
            {g.tokens.map((t, j) => (
              <span key={j} className={'tok' + (start + j < plan.pos ? ' done' : start + j === plan.pos ? ' next' : '')}>{t}</span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
