import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gardenDir, gardenFile } from '../src/paths.js';
import { loadGarden } from '../src/store.js';

const HOOK = fileURLToPath(new URL('../src/overnight-garden-hook.js', import.meta.url));
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const MON_22H = Date.parse('2026-11-02T22:00:00Z');

const root = mkdtempSync(join(tmpdir(), 'overnight-garden-hook-'));
after(() => rmSync(root, { recursive: true, force: true }));

// A throwaway home folder per test, so nothing ever touches the real ~/.claude.
let homes = 0;
const newHome = () => {
  const home = join(root, `home-${++homes}`);
  mkdirSync(home);
  return home;
};

// Runs the hook the way Claude Code does: JSON on stdin, with the clock set in milliseconds.
function fire(home, event, at, input = {}) {
  const result = spawnSync(process.execPath, [HOOK, event], {
    input: JSON.stringify({ session_id: 'test', hook_event_name: event, ...input }),
    env: { ...process.env, HOME: home, USERPROFILE: home, OVERNIGHT_GARDEN_NOW: String(at) },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `hook exited ${result.status}: ${result.stderr}`);
  assert.equal(result.stdout, '', 'a hook must print nothing');
  assert.equal(result.stderr, '', 'a hook must print nothing');
}

const kinds = (home) => loadGarden(gardenFile(home)).plants.map((plant) => plant.kind);

test('no alerts or prompts: every hook call prints nothing and exits 0, adding nothing to the conversation', () => {
  const home = newHome();
  fire(home, 'session', MON_22H - HOUR, { source: 'startup' });
  fire(home, 'prompt', MON_22H, { prompt: 'hello' });
  fire(home, 'stop', MON_22H + MINUTE);
  fire(home, 'session', MON_22H + 2 * MINUTE, { source: 'compact' });
});

test('times are in milliseconds: coming back after 9 hours grows a flower stamped with the exact times given', () => {
  const home = newHome();
  fire(home, 'prompt', MON_22H);
  fire(home, 'prompt', MON_22H + 9 * HOUR);
  assert.deepEqual(loadGarden(gardenFile(home)).plants, [
    { kind: 'flower', leftAt: new Date(MON_22H).toISOString(), returnedAt: new Date(MON_22H + 9 * HOUR).toISOString() },
  ]);
});

test('times are in milliseconds: a hook clock given in seconds grows nothing', () => {
  const home = newHome();
  const inSeconds = Math.floor(MON_22H / 1000);
  fire(home, 'prompt', inSeconds);
  fire(home, 'prompt', inSeconds + 9 * 60 * 60);
  fire(home, 'prompt', MON_22H + 9 * HOUR);
  assert.deepEqual(kinds(home), []);
});

test('an agent that worked 12 minutes before you left adds a golden flower', () => {
  const home = newHome();
  fire(home, 'prompt', MON_22H);
  fire(home, 'stop', MON_22H + 12 * MINUTE);
  fire(home, 'prompt', MON_22H + 9 * HOUR);
  assert.deepEqual(kinds(home), ['flower', 'golden-flower']);
});

test('an agent finishing in another window earns no golden flower', () => {
  const home = newHome();
  fire(home, 'prompt', MON_22H - HOUR, { session_id: 'window-a' });
  fire(home, 'prompt', MON_22H, { session_id: 'window-b' });
  fire(home, 'stop', MON_22H + 20 * MINUTE, { session_id: 'window-a' });
  fire(home, 'prompt', MON_22H + 9 * HOUR, { session_id: 'window-b' });
  assert.deepEqual(kinds(home), ['flower']);
});

test('an agent turn that finished before you were last here earns no golden flower', () => {
  const home = newHome();
  fire(home, 'prompt', MON_22H - 2 * HOUR);
  fire(home, 'stop', MON_22H - 90 * MINUTE);
  fire(home, 'session', MON_22H - HOUR, { source: 'startup' });
  fire(home, 'prompt', MON_22H + 8 * HOUR);
  assert.deepEqual(kinds(home), ['flower']);
});

test('opening Claude Code after a night away grows the flower straight away', () => {
  const home = newHome();
  fire(home, 'prompt', MON_22H);
  fire(home, 'session', MON_22H + 9 * HOUR, { source: 'startup' });
  assert.deepEqual(kinds(home), ['flower']);
});

test('a session started by compaction while you are away does not count as you coming back', () => {
  const home = newHome();
  fire(home, 'prompt', MON_22H);
  fire(home, 'session', MON_22H + 5 * HOUR, { source: 'compact' });
  fire(home, 'prompt', MON_22H + 9 * HOUR);
  assert.deepEqual(kinds(home), ['flower']);
});

test('short breaks grow nothing', () => {
  const home = newHome();
  fire(home, 'prompt', MON_22H);
  fire(home, 'prompt', MON_22H + 7 * HOUR);
  fire(home, 'prompt', MON_22H + 14 * HOUR);
  assert.deepEqual(kinds(home), []);
});

test('with a damaged garden file, the hook stays silent and leaves the file untouched', () => {
  const home = newHome();
  mkdirSync(gardenDir(home), { recursive: true });
  writeFileSync(gardenFile(home), '{ damaged');
  fire(home, 'prompt', MON_22H);
  fire(home, 'prompt', MON_22H + 9 * HOUR);
  assert.equal(readFileSync(gardenFile(home), 'utf8'), '{ damaged');
});

test('no alerts: with no input at all, the hook stays silent', () => {
  const home = newHome();
  const result = spawnSync(process.execPath, [HOOK, 'prompt'], {
    input: '',
    env: { ...process.env, HOME: home, USERPROFILE: home },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout + result.stderr, '');
});

test('the hook only writes inside ~/.claude/overnight-garden', () => {
  const home = newHome();
  fire(home, 'prompt', MON_22H);
  fire(home, 'prompt', MON_22H + 9 * HOUR);
  assert.deepEqual(readdirSync(home), ['.claude']);
  assert.deepEqual(readdirSync(join(home, '.claude')), ['overnight-garden']);
  assert.deepEqual(readdirSync(gardenDir(home)).sort(), ['garden.json', 'presence.json']);
});
