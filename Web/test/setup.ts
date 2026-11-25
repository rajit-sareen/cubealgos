import { readFileSync } from 'node:fs';
import createEngine from '../src/engine/engine.mjs';

// The real engine, loaded once per test file
//
// The build is for browsers and workers, so it would fetch its wasm, which Node cannot do
// from a file. Emscripten takes an instantiated module instead
type Instantiate = (imports: WebAssembly.Imports, done: (i: WebAssembly.Instance) => void) => void;
const create = createEngine as unknown as (o: { instantiateWasm: Instantiate }) => ReturnType<typeof createEngine>;
const wasm = readFileSync('src/engine/engine.wasm');
const engine = await create({
  instantiateWasm: (imports, done) => { WebAssembly.instantiate(wasm, imports).then(r => done(r.instance)); },
});
engine._engine_init();
const call = engine.cwrap('engine_call', 'string', ['string', 'string']) as (cmd: string, q: string) => string;

// The worker's side of engine.ts, answering in arrival order as the real one does
class EngineWorker {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  postMessage({ id, cmd, params }: { id: number; cmd: string; params: string }) {
    const result = JSON.parse(call(cmd, params));
    queueMicrotask(() => this.onmessage?.({ data: { id, result } }));
  }
}

// What jsdom Leaves Out
//
// It has animation frames, but on a clock about a second behind performance.now(), so a
// turn timed by one and drawn by the other would sit still until the clocks met
Object.assign(globalThis, {
  Worker: EngineWorker,
  ResizeObserver: class { observe() {} disconnect() {} },
  requestAnimationFrame: (frame: FrameRequestCallback) => setTimeout(() => frame(performance.now()), 4),
  cancelAnimationFrame: (id: number) => clearTimeout(id),
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
});
Element.prototype.scrollIntoView = () => {};
