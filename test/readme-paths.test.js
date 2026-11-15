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

test('a stranger can start from the README: every file it names is really in the repo', (t) => {
  const repoRoot = fileURLToPath(new URL('..', import.meta.url));
  const readme = readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  let listing;
  try {
    listing = execFileSync('git', ['ls-files', '-z'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    listing = '';
  }
  const tracked = new Set(listing.split('\0').filter((name) => name !== ''));
  if (!tracked.has('README.md')) {
    // A ZIP download, a machine without git, or a copy inside some other git folder.
    t.skip('not a git checkout of this repo, so there is no list of tracked files to compare with');
    return;
  }

  const isUrl = (name) => /^[a-z][a-z0-9+.-]*:/i.test(name);
  const named = new Set();
  const add = (name) => {
    const clean = name.replace(/^\.\//, '').split('#')[0];
    if (clean !== '' && !isUrl(clean)) named.add(clean);
  };

  // Links and images: the target is a file name, with or without an extension (like LICENSE).
  for (const match of readme.matchAll(/\]\(([^)\s]+)/g)) add(match[1]);
  for (const match of readme.matchAll(/src="([^"]+)"/g)) add(match[1]);

  // Code, both blocks and inline: every word that ends in a file extension, so commands
  // like `node scripts/install.js` are checked too.
  const code = [];
  const prose = readme.replace(/```[^\n]*\n([\s\S]*?)```/g, (_, body) => {
    code.push(body);
    return '';
  });
  for (const match of prose.matchAll(/`([^`\n]+)`/g)) code.push(match[1]);
  for (const word of code.join(' ').split(/\s+/)) {
    if (/\.[A-Za-z0-9]+$/.test(word)) add(word);
  }

  const names = [...named].filter((name) => !name.startsWith('~/') && !HOME_ONLY_NAMES.has(name));
  const missing = names.filter((name) => !tracked.has(name));

  assert.ok(names.length > 0, 'found no file names in the README, so the check would prove nothing');
  assert.deepEqual(missing, [], `README.md names files git doesn't track: ${missing.join(', ')}`);
});
