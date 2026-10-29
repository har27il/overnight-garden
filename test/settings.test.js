import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emptyGarden, grow } from '../src/engine.js';
import { backupFile, gardenFile, settingsFile } from '../src/paths.js';
import { gardenCommands, install, uninstall } from '../src/settings.js';
import { loadGarden, saveGarden } from '../src/store.js';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const root = mkdtempSync(join(tmpdir(), 'overnight-garden-settings-'));
after(() => rmSync(root, { recursive: true, force: true }));

// A safety net: even code that forgets its home folder lands in a throwaway one, never the real ~/.claude.
process.env.HOME = process.env.USERPROFILE = join(root, 'fallback-home');

let homes = 0;
const newHome = (settingsText) => {
  const home = join(root, `home-${++homes}`);
  mkdirSync(join(home, '.claude'), { recursive: true });
  if (settingsText !== undefined) writeFileSync(settingsFile(home), settingsText);
  return home;
};
const readSettings = (home) => JSON.parse(readFileSync(settingsFile(home), 'utf8'));

// Someone's real-looking settings: their own hooks and status line, 4-space indents, Windows line endings.
const THEIR_SETTINGS = JSON.stringify(
  {
    permissions: { allow: ['Bash(npm test)'] },
    hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo their-own-stop-hook' }] }] },
    statusLine: { type: 'command', command: 'echo their-own-status-line' },
  },
  null,
  4,
).replaceAll('\n', '\r\n');

test('installing backs up the settings first, then adds 3 hooks and the status line', () => {
  const home = newHome(THEIR_SETTINGS);
  const result = install({ home, repoDir: REPO });
  const commands = gardenCommands(REPO);

  assert.equal(readFileSync(backupFile(home), 'utf8'), THEIR_SETTINGS);
  assert.equal(result.backup, backupFile(home));
  const settings = readSettings(home);
  for (const [event, command] of Object.entries(commands.hooks)) {
    assert.ok(settings.hooks[event].some((group) => group.hooks[0].command === command), event);
  }
  assert.deepEqual(settings.statusLine, { type: 'command', command: commands.statusLine, padding: 0 });
});

test('existing settings and hooks are kept; their status line is put aside', () => {
  const home = newHome(THEIR_SETTINGS);
  const result = install({ home, repoDir: REPO });
  const settings = readSettings(home);

  assert.equal(result.replacedStatusLine, true);
  assert.deepEqual(settings.permissions, { allow: ['Bash(npm test)'] });
  assert.equal(settings.hooks.Stop[0].hooks[0].command, 'echo their-own-stop-hook');
  assert.equal(settings.hooks.Stop.length, 2);
});

test('uninstalling puts the settings back byte for byte, their status line included', () => {
  const home = newHome(THEIR_SETTINGS);
  install({ home, repoDir: REPO });
  const result = uninstall({ home });

  assert.equal(result.restored, 'exactly');
  assert.deepEqual(readFileSync(settingsFile(home)), Buffer.from(THEIR_SETTINGS));
  assert.equal(existsSync(backupFile(home)), false);
});

test('with no settings file before, uninstalling removes the one installing created', () => {
  const home = newHome();
  const result = install({ home, repoDir: REPO });
  assert.equal(result.backup, null);
  assert.equal(existsSync(settingsFile(home)), true);

  uninstall({ home });
  assert.equal(existsSync(settingsFile(home)), false);
});

test('installing twice adds nothing twice and keeps the first backup', () => {
  const home = newHome(THEIR_SETTINGS);
  install({ home, repoDir: REPO });
  const once = readFileSync(settingsFile(home), 'utf8');
  install({ home, repoDir: REPO });

  assert.equal(readFileSync(settingsFile(home), 'utf8'), once);
  assert.equal(readFileSync(backupFile(home), 'utf8'), THEIR_SETTINGS);
  uninstall({ home });
  assert.deepEqual(readFileSync(settingsFile(home)), Buffer.from(THEIR_SETTINGS));
});

test('a settings file that is not valid JSON is left untouched and nothing is installed', () => {
  const home = newHome('{ "permissions": ');
  assert.throws(() => install({ home, repoDir: REPO }), /isn't valid JSON, so nothing was changed/);
  assert.equal(readFileSync(settingsFile(home), 'utf8'), '{ "permissions": ');
  assert.equal(existsSync(backupFile(home)), false);
});

test('settings changed after installing are kept on uninstall, and so is the backup', () => {
  const home = newHome(THEIR_SETTINGS);
  install({ home, repoDir: REPO });
  const changed = readSettings(home);
  changed.permissions.allow.push('Bash(git status)');
  writeFileSync(settingsFile(home), JSON.stringify(changed));

  const result = uninstall({ home });
  const settings = readSettings(home);
  assert.equal(result.restored, 'kept-your-changes');
  assert.deepEqual(settings.permissions.allow, ['Bash(npm test)', 'Bash(git status)']);
  assert.deepEqual(settings.hooks, { Stop: [{ hooks: [{ type: 'command', command: 'echo their-own-stop-hook' }] }] });
  assert.deepEqual(settings.statusLine, { type: 'command', command: 'echo their-own-status-line' });
  assert.equal(readFileSync(backupFile(home), 'utf8'), THEIR_SETTINGS);
});

test('uninstalling keeps the garden', () => {
  const home = newHome(THEIR_SETTINGS);
  install({ home, repoDir: REPO });
  const garden = grow(emptyGarden(), { leftAt: Date.parse('2026-11-02T22:00:00Z'), returnedAt: Date.parse('2026-11-03T07:00:00Z') });
  saveGarden(gardenFile(home), garden);

  uninstall({ home });
  assert.deepEqual(loadGarden(gardenFile(home)), garden);
});

test('the installed commands run from a shell, as Claude Code runs them', () => {
  const home = newHome();
  install({ home, repoDir: REPO });
  const settings = readSettings(home);
  const env = { ...process.env, HOME: home, USERPROFILE: home };

  for (const [event, groups] of Object.entries(settings.hooks)) {
    const output = execSync(groups[0].hooks[0].command, { input: '{}', env, encoding: 'utf8' });
    assert.equal(output, '', event);
  }
  const line = execSync(settings.statusLine.command, { input: '{}', env, encoding: 'utf8' });
  assert.equal(line, '🌱 Overnight Garden · grows while you rest\n');
});

test('the install and uninstall scripts explain what they did, in a throwaway home', () => {
  const home = newHome(THEIR_SETTINGS);
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const run = (script) => spawnSync(process.execPath, [join(REPO, 'scripts', script)], { env, encoding: 'utf8' });

  const installed = run('install.js');
  assert.equal(installed.status, 0, installed.stderr);
  assert.match(installed.stdout, /Overnight Garden is installed\./);
  assert.match(installed.stdout, /Backed up your settings to /);
  assert.match(installed.stdout, /Your previous status line is saved/);

  const removed = run('uninstall.js');
  assert.equal(removed.status, 0, removed.stderr);
  assert.match(removed.stdout, /Your settings are back exactly as they were before installing\./);
  assert.deepEqual(readFileSync(settingsFile(home)), Buffer.from(THEIR_SETTINGS));
  assert.equal(existsSync(join(dirname(settingsFile(home)), 'overnight-garden')), true);
});
