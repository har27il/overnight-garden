// Adds Overnight Garden to Claude Code's settings and takes it out again. The
// settings file is backed up before the garden is added, and uninstalling puts it
// back byte for byte, unless something else in it changed in the meantime.

import { copyFileSync, existsSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { backupFile, backupNoteFile, settingsFile } from './paths.js';
import { HOOK_EVENTS } from './presence.js';
import { decode, writeFileAtomic } from './store.js';

const HOOK_SCRIPT = 'overnight-garden-hook.js';
const STATUS_SCRIPT = 'overnight-garden-statusline.js';

const isOurs = (command) =>
  typeof command === 'string' && (command.includes(HOOK_SCRIPT) || command.includes(STATUS_SCRIPT));
const isOurHook = (hook) => isOurs(hook?.command);

/** The commands Claude Code will run, pointing at this copy of Overnight Garden. */
export function gardenCommands(repoDir) {
  const run = (script) => `node "${join(repoDir, 'src', script).replaceAll('\\', '/')}"`;
  const hooks = Object.entries(HOOK_EVENTS).map(([event, arg]) => [event, `${run(HOOK_SCRIPT)} ${arg}`]);
  return { hooks: Object.fromEntries(hooks), statusLine: run(STATUS_SCRIPT) };
}

/** True if the settings already contain any Overnight Garden hook or status line. */
export function hasGarden(settings) {
  const groups = Object.values(settings.hooks ?? {}).flat();
  return isOurs(settings.statusLine?.command) || groups.some((group) => group?.hooks?.some?.(isOurHook));
}

/** Settings with the garden's three hooks and status line added. Everything else is kept. */
export function addGarden(settings, commands) {
  const next = removeGarden(settings, settings);
  next.hooks ??= {};
  for (const [event, command] of Object.entries(commands.hooks)) {
    next.hooks[event] = [...(next.hooks[event] ?? []), { hooks: [{ type: 'command', command }] }];
  }
  next.statusLine = { type: 'command', command: commands.statusLine, padding: 0 };
  return next;
}

/**
 * Settings with every Overnight Garden hook and status line taken out. `original`
 * is the settings from before installing: it decides whether emptied sections are
 * dropped and which status line comes back.
 */
export function removeGarden(settings, original = {}) {
  const next = structuredClone(settings);
  for (const [event, groups] of Object.entries(next.hooks ?? {})) {
    if (!Array.isArray(groups)) continue;
    const kept = groups
      .filter((group) => !(group?.hooks?.length > 0 && group.hooks.every?.(isOurHook)))
      .map((group) =>
        group?.hooks?.some?.(isOurHook) ? { ...group, hooks: group.hooks.filter((hook) => !isOurHook(hook)) } : group,
      );
    if (kept.length === 0 && !Array.isArray(original.hooks?.[event])) delete next.hooks[event];
    else next.hooks[event] = kept;
  }
  if (next.hooks && Object.keys(next.hooks).length === 0 && original.hooks === undefined) delete next.hooks;

  if (isOurs(next.statusLine?.command)) {
    if (original.statusLine !== undefined && !isOurs(original.statusLine?.command)) {
      next.statusLine = structuredClone(original.statusLine);
    } else {
      delete next.statusLine;
    }
  }
  return next;
}

function parseSettings(bytes, file) {
  let settings;
  try {
    settings = JSON.parse(decode(bytes));
  } catch {
    // Falls through to the error below.
  }
  if (settings === null || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new Error(`${file} isn't valid JSON, so nothing was changed.`);
  }
  return settings;
}

const writeSettings = (file, settings) => writeFileAtomic(file, JSON.stringify(settings, null, 2) + '\n');

// settings.json can be a link (say, into a dotfiles folder): read and write the
// file it points to, so the link itself is kept.
const realFile = (file) => (existsSync(file) ? realpathSync(file) : file);

/** Backs up ~/.claude/settings.json, then adds the garden to it. */
export function install({ home, repoDir }) {
  const file = realFile(settingsFile(home));
  const existed = existsSync(file);
  const current = existed ? parseSettings(readFileSync(file), file) : {};

  // Keep the backup from the first install; make a fresh one when the garden isn't in the settings.
  if (!hasGarden(current) || !existsSync(backupNoteFile(home))) {
    writeFileAtomic(backupNoteFile(home), JSON.stringify({ existed }) + '\n');
    if (existed) copyFileSync(file, backupFile(home));
    else rmSync(backupFile(home), { force: true });
  }

  const replacedStatusLine = current.statusLine !== undefined && !isOurs(current.statusLine?.command);
  writeSettings(file, addGarden(current, gardenCommands(repoDir)));
  return { settings: settingsFile(home), backup: existed ? backupFile(home) : null, replacedStatusLine };
}

/** Takes the garden out of the settings; the garden itself is kept. */
export function uninstall({ home }) {
  const file = realFile(settingsFile(home));
  const note = existsSync(backupNoteFile(home)) ? JSON.parse(readFileSync(backupNoteFile(home), 'utf8')) : null;
  const backupBytes = note?.existed && existsSync(backupFile(home)) ? readFileSync(backupFile(home)) : null;
  const original = backupBytes ? parseSettings(backupBytes, backupFile(home)) : {};
  const current = existsSync(file) ? parseSettings(readFileSync(file), file) : {};
  const cleaned = removeGarden(current, original);

  if (note && isDeepStrictEqual(cleaned, original)) {
    // Nothing else changed since installing: put the original back exactly.
    if (backupBytes) writeFileAtomic(file, backupBytes);
    else rmSync(file, { force: true });
    rmSync(backupFile(home), { force: true });
    rmSync(backupNoteFile(home), { force: true });
    return { settings: settingsFile(home), restored: 'exactly' };
  }

  if (!isDeepStrictEqual(cleaned, current)) writeSettings(file, cleaned);
  const restored = !hasGarden(current) ? 'nothing-to-remove' : note ? 'kept-your-changes' : 'removed';
  return { settings: settingsFile(home), restored, backup: backupBytes ? backupFile(home) : null };
}
