import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emptyGarden, grow } from '../src/engine.js';
import { gardenDir, gardenFile } from '../src/paths.js';
import { statusLine } from '../src/render.js';
import { saveGarden } from '../src/store.js';

const SCRIPT = fileURLToPath(new URL('../src/overnight-garden-statusline.js', import.meta.url));
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MON_22H = Date.parse('2026-11-02T22:00:00Z');

const root = mkdtempSync(join(tmpdir(), 'overnight-garden-statusline-'));
after(() => rmSync(root, { recursive: true, force: true }));

let homes = 0;
const newHome = () => {
  const home = join(root, `home-${++homes}`);
  mkdirSync(home);
  return home;
};

// Runs the status line the way Claude Code does, with session details on stdin.
function show(home) {
  const result = spawnSync(process.execPath, [SCRIPT], {
    input: JSON.stringify({ session_id: 'test', model: { display_name: 'Test' } }),
    env: { ...process.env, HOME: home, USERPROFILE: home },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  return result.stdout;
}

const fullGarden = () =>
  [
    { leftAt: MON_22H, returnedAt: MON_22H + 9 * HOUR, agentRunMs: 45 * MINUTE },
    { leftAt: MON_22H + 2 * DAY, returnedAt: MON_22H + 2 * DAY + 9 * HOUR },
    { leftAt: MON_22H + 4 * DAY, returnedAt: MON_22H + 7 * DAY },
    { leftAt: MON_22H + 8 * DAY, returnedAt: MON_22H + 20 * DAY },
  ].reduce(grow, emptyGarden());

test('an empty garden shows a calm line, not a nudge', () => {
  assert.equal(statusLine(emptyGarden()), '🌱 Overnight Garden · grows while you rest');
});

test('the status line counts each kind of plant, in a fixed order', () => {
  assert.equal(statusLine(fullGarden()), '🌱 Overnight Garden · 🌷 2  🌳 1  🍀 1  🌻 1');
});

test('the status line script prints exactly one line from the garden file', () => {
  const home = newHome();
  saveGarden(gardenFile(home), fullGarden());
  assert.equal(show(home), '🌱 Overnight Garden · 🌷 2  🌳 1  🍀 1  🌻 1\n');
});

test('with no garden yet, the status line shows the calm line', () => {
  assert.equal(show(newHome()), '🌱 Overnight Garden · grows while you rest\n');
});

test('a damaged garden file never shows an error, only the calm line', () => {
  const home = newHome();
  mkdirSync(gardenDir(home), { recursive: true });
  writeFileSync(gardenFile(home), '{ damaged');
  assert.equal(show(home), '🌱 Overnight Garden · grows while you rest\n');
});

test('text added to the garden file never reaches the status line', () => {
  const home = newHome();
  const garden = grow(emptyGarden(), { leftAt: MON_22H, returnedAt: MON_22H + 9 * HOUR });
  const stray = String.fromCharCode(27) + ']0;stray title' + String.fromCharCode(7);
  const tampered = { ...garden, title: stray, plants: garden.plants.map((plant) => ({ ...plant, label: stray })) };
  mkdirSync(gardenDir(home), { recursive: true });
  writeFileSync(gardenFile(home), JSON.stringify(tampered));
  assert.equal(show(home), '🌱 Overnight Garden · 🌷 1\n');
});
