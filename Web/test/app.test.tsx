import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { App } from '../src/App';
import { sim } from '../src/sim';
import { timer } from '../src/timer/timer';

// The whole page over the real engine, driven by clicks and keys
let root: Root;
const $ = (sel: string) => document.querySelector<HTMLElement>(sel);
const text = (sel: string) => $(sel)?.textContent ?? '';
const button = (label: string, within = 'body') => {
  const b = [...document.querySelectorAll<HTMLButtonElement>(within + ' button')].find(x => x.textContent!.startsWith(label));
  if (!b) throw new Error(`No button ${label}`);
  return b;
};
const key = (type: 'keydown' | 'keyup', code: string, k: string) =>
  window.dispatchEvent(new KeyboardEvent(type, { code, key: k, bubbles: true }));
const go = async (hash: string, shows: string) => {
  location.hash = hash;
  await vi.waitFor(() => expect($(shows)).not.toBeNull());
};
const choose = (value: string) => {
  const select = $('#left select') as HTMLSelectElement;
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
};

beforeAll(async () => {
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot($('#root')!);
  root.render(<App />);
  await vi.waitFor(() => { expect(sim.online).toBe(true); expect(timer.scramble).not.toBe(''); });
  sim.setTempo(100);
  timer.setSetting('holdMs', 0);
});
afterAll(() => root.unmount());

it('times a solve from the keyboard', async () => {
  for (const type of ['keydown', 'keyup', 'keydown', 'keyup'] as const) key(type, 'Space', ' ');
  await vi.waitFor(() => expect(document.querySelectorAll('table.solves tbody tr')).toHaveLength(1));
});

it('opens a solve and analyzes it in the simulator', async () => {
  $('table.solves tbody tr')!.click();
  await vi.waitFor(() => expect(document.querySelectorAll('.xrow')).toHaveLength(6));
  const scramble = text('.scr').split(' ');
  const lengths = [...document.querySelectorAll('.xval')].map(x => x.textContent);

  button('Analyze solve').click();
  await vi.waitFor(() => expect($('#seq .g')).not.toBeNull());
  expect(location.hash).toBe('#/sim');
  expect($('.modal')).toBeNull();
  expect(sim.scrambleMoves).toEqual(scramble);
  expect([...document.querySelectorAll('.crosses button:not(.any) b')].map(x => x.textContent)).toEqual(lengths);
});

it('changes cross and method on the same scramble', async () => {
  for (const color of ['white', 'orange']) {
    button(color, '.crosses').click();
    await vi.waitFor(() => expect(text('#seq .g')).toContain(color + ' cross'));
  }
  const scramble = text('#scrambleTokens');
  button('All', '#right').click();
  await vi.waitFor(() => expect(text('#left .val')).toBe('Solved'));
  choose('cfop2');
  await vi.waitFor(() => expect(text('#seq')).toContain('orange cross'));
  expect(text('#left .val')).toBe('Solution ready');
  choose('kociemba');
  await vi.waitFor(() => expect(text('#seq')).toContain('Kociemba'));
  expect($('.crosses')).toBeNull();
  expect(text('#scrambleTokens')).toBe(scramble);
});

it('drives the solve with Space after the moves dropdown is clicked', async () => {
  choose('cfop');
  await vi.waitFor(() => expect(text('#seq')).toContain('cross'));
  const summary = $('#left summary')!;
  summary.focus();
  summary.click();
  expect(document.activeElement).not.toBe(summary);
  key('keydown', 'Space', ' ');
  await vi.waitFor(() => expect(text('#left .val')).toBe('Solved'));
});

it('opens every page', async () => {
  await go('#/stats', '#main.stats');
  await go('#/profile', '[aria-current=page][href="#/profile"]');
  await go('#/sim', '#viewport');
  await go('#/', '#main.timer');
});
