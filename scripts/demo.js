// The Overnight Garden demo. It installs into a throwaway home folder, then plays
// five stretches of life through the real hooks, engine and status line, run the
// way Claude Code runs them: the commands from settings.json, in a shell, with
// JSON on stdin. Only the clock is simulated: each hook is told the time through
// OVERNIGHT_GARDEN_NOW, in milliseconds. Every line it prints is a check.
//
//   node scripts/demo.js          (or ./demo.sh)
//   node scripts/demo.js --keep   keep the throwaway home folder to look around

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { backupFile, gardenFile, settingsFile } from '../src/paths.js';
import { PLANT_LOOKS } from '../src/render.js';
import { loadGarden } from '../src/store.js';
import { chapters, describeAbsence } from './demo-timeline.js';

const repoDir = dirname(dirname(fileURLToPath(import.meta.url)));
const keep = process.argv.includes('--keep');
const home = mkdtempSync(join(tmpdir(), 'overnight-garden-demo-'));
const env = { ...process.env, HOME: home, USERPROFILE: home };
const THEIR_SETTINGS = JSON.stringify({ permissions: { allow: ['Bash(npm test)'] } }, null, 2) + '\n';
const HOOK_EVENTS = ['UserPromptSubmit', 'Stop', 'SessionStart'];

let checks = 0;
function check(ok, text) {
  if (!ok) throw new Error(text);
  checks += 1;
  console.log(`PASS ${text}`);
}

// Runs a command in a shell with JSON on stdin, as Claude Code does.
function run(command, input = {}, extraEnv = {}) {
  const result = spawnSync(command, {
    shell: true,
    input: JSON.stringify(input),
    env: { ...env, ...extraEnv },
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(`"${command}" exited ${result.status}: ${result.stderr.trim()}`);
  return result;
}

const nameOf = (kind) => `${PLANT_LOOKS[kind].emoji} ${PLANT_LOOKS[kind].one}`;

try {
  mkdirSync(join(home, '.claude'), { recursive: true });
  writeFileSync(settingsFile(home), THEIR_SETTINGS);

  run(`node "${join(repoDir, 'scripts', 'install.js')}"`);
  const settings = JSON.parse(readFileSync(settingsFile(home), 'utf8'));
  const hookCommand = (event) =>
    settings.hooks?.[event]
      ?.flatMap((group) => group.hooks)
      .find((hook) => hook.command.includes('overnight-garden-hook.js'))?.command;
  check(
    readFileSync(backupFile(home), 'utf8') === THEIR_SETTINGS &&
      HOOK_EVENTS.every(hookCommand) &&
      settings.statusLine?.command?.includes('overnight-garden-statusline.js') &&
      isDeepStrictEqual(settings.permissions, { allow: ['Bash(npm test)'] }),
    'install: settings backed up first, then 3 hooks and the status line added; your own settings kept',
  );

  let hookCalls = 0;
  let printed = '';
  let earlier = [];
  let neverLost = true;
  for (const chapter of chapters) {
    for (const event of chapter.events) {
      const input = { session_id: 'demo', hook_event_name: event.hook, ...event.input };
      if (event.hook === 'UserPromptSubmit') input.prompt = 'demo prompt';
      const result = run(hookCommand(event.hook), input, { OVERNIGHT_GARDEN_NOW: String(event.at) });
      hookCalls += 1;
      printed += result.stdout + result.stderr;
    }
    const plants = loadGarden(gardenFile(home)).plants;
    const grown = plants.slice(earlier.length).map((plant) => plant.kind);
    neverLost &&= isDeepStrictEqual(plants.slice(0, earlier.length), earlier);
    const outcome = grown.length > 0 ? `grew ${grown.map(nameOf).join(' + ')}` : 'nothing grew, and nothing was lost';
    const expected = chapter.grows.length > 0 ? chapter.grows.map(nameOf).join(' + ') : 'nothing';
    const matches = isDeepStrictEqual(grown, chapter.grows);
    check(matches, `${chapter.name}: ${describeAbsence(chapter)} → ${outcome}${matches ? '' : ` (expected ${expected})`}`);
    earlier = plants;
  }

  check(
    neverLost && earlier.length === 5,
    'never wilts or resets: after a year away, all 5 plants are still there, in the order they grew',
  );
  check(
    printed === '',
    `no alerts: all ${hookCalls} hook calls printed nothing and exited 0, so nothing was added to the conversation`,
  );

  const line = run(settings.statusLine.command, { session_id: 'demo' }).stdout.trimEnd();
  check(line === '🌱 Overnight Garden · 🌷 2  🌳 1  🍀 1  🌻 1', `status line shows: ${line}`);

  run(`node "${join(repoDir, 'scripts', 'uninstall.js')}"`);
  check(
    readFileSync(settingsFile(home), 'utf8') === THEIR_SETTINGS && loadGarden(gardenFile(home)).plants.length === 5,
    'uninstall: settings are byte-for-byte what they were before install, and the garden is kept',
  );

  if (!keep) rmSync(home, { recursive: true, force: true });
  console.log(`PASS all ${checks} checks passed; ${keep ? `throwaway home kept at ${home}` : 'throwaway home removed'}`);
} catch (err) {
  console.log(`FAIL ${err.message}`);
  if (!keep) rmSync(home, { recursive: true, force: true });
  process.exitCode = 1;
}
