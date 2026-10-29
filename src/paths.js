// Where Overnight Garden keeps its files: one folder, ~/.claude/overnight-garden/,
// built from the home folder so it is never a shared temp folder. Every function
// takes an optional home folder; tests and the demo pass a throwaway one.

import { homedir } from 'node:os';
import { join } from 'node:path';

export const claudeDir = (home = homedir()) => join(home, '.claude');
export const settingsFile = (home) => join(claudeDir(home), 'settings.json');
export const gardenDir = (home) => join(claudeDir(home), 'overnight-garden');
export const gardenFile = (home) => join(gardenDir(home), 'garden.json');
export const presenceFile = (home) => join(gardenDir(home), 'presence.json');
export const cardFile = (home) => join(gardenDir(home), 'card.html');
export const backupFile = (home) => join(gardenDir(home), 'settings.backup.json');
export const backupNoteFile = (home) => join(gardenDir(home), 'settings.backup-note.json');
