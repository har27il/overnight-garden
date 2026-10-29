// Takes Overnight Garden out of Claude Code: node scripts/uninstall.js
// Your garden itself is kept in ~/.claude/overnight-garden/.

import { uninstall } from '../src/settings.js';

const messages = {
  exactly: 'Your settings are back exactly as they were before installing.',
  'kept-your-changes':
    'The garden is out of your settings. You changed other settings since installing, so those changes were kept.',
  removed: 'The garden is out of your settings, and everything else in them was kept.',
  'nothing-to-remove': 'Overnight Garden was not in your settings, so nothing changed.',
};

try {
  const result = uninstall({});
  const lines = ['Overnight Garden is uninstalled.', `  ${messages[result.restored]}`];
  if (result.backup) lines.push(`  Your original settings are still saved at ${result.backup}`);
  lines.push('  Your garden is kept in ~/.claude/overnight-garden/. Restart Claude Code to finish.');
  console.log(lines.join('\n'));
} catch (err) {
  console.error(`Overnight Garden was not uninstalled: ${err.message}`);
  process.exitCode = 1;
}
