// Adds Overnight Garden to Claude Code for you: node scripts/install.js
// Your settings are backed up first; node scripts/uninstall.js puts them back.

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { install } from '../src/settings.js';

const repoDir = dirname(dirname(fileURLToPath(import.meta.url)));

try {
  const result = install({ repoDir });
  const lines = [
    'Overnight Garden is installed.',
    result.backup
      ? `  Backed up your settings to ${result.backup}`
      : '  You had no Claude Code settings file yet, so there was nothing to back up.',
    `  Added 3 hooks and the status line to ${result.settings}`,
  ];
  if (result.replacedStatusLine) lines.push('  Your previous status line is saved and comes back when you uninstall.');
  lines.push('Restart Claude Code to see your garden. To remove it: node scripts/uninstall.js');
  console.log(lines.join('\n'));
} catch (err) {
  console.error(`Overnight Garden was not installed: ${err.message}`);
  process.exitCode = 1;
}
