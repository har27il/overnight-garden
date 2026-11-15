// Checks that every file the README names is a file git tracks, with the same letter case.
// Skipped on purpose: "~/" paths (the user's home folder, never in git) and the four names
// garden.json, presence.json, settings.json, card.html (they live on the user's machine, not in the repo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOME_ONLY_NAMES = new Set(['garden.json', 'presence.json', 'settings.json', 'card.html']);

test('a stranger can start from the README: every file it names is really in the repo', () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const readme = readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  const tracked = new Set(
    execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8' })
      .split('\0')
      .filter((name) => name !== ''),
  );

  const isUrlOrAnchor = (target) => /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#');
  const named = new Set();
  const addTarget = (target) => {
    if (isUrlOrAnchor(target)) return;
    named.add(target.includes('#') ? target.slice(0, target.indexOf('#')) : target);
  };

  for (const match of readme.matchAll(/\]\(([^)\s]+)/g)) addTarget(match[1]);
  for (const match of readme.matchAll(/src="([^"]+)"/g)) addTarget(match[1]);
  for (const match of readme.matchAll(/`([^`\s]+)`/g)) {
    if (/\.[A-Za-z0-9]+$/.test(match[1])) named.add(match[1]);
  }

  const names = [...named].filter((name) => !name.startsWith('~/') && !HOME_ONLY_NAMES.has(name));
  const missing = names.filter((name) => !tracked.has(name));

  assert.ok(names.length > 0, 'found no file names in the README, so the check would prove nothing');
  assert.deepEqual(missing, [], `README.md names files git doesn't track: ${missing.join(', ')}`);
});
