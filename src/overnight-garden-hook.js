// Claude Code hook. Notes when you are active, and when you come back after time
// away it grows your garden. It prints nothing and always exits 0, so it can never
// add a prompt, an alert or extra context to your conversation.
//
//   node overnight-garden-hook.js prompt    (UserPromptSubmit)
//   node overnight-garden-hook.js session   (SessionStart)
//   node overnight-garden-hook.js stop      (Stop)

import { readFileSync } from 'node:fs';
import { gardenFile, presenceFile } from './paths.js';
import { agentStopped, loadPresence, savePresence, userActive } from './presence.js';
import { recordAbsence } from './store.js';

// The demo and tests set OVERNIGHT_GARDEN_NOW (milliseconds) to simulate the clock.
function now() {
  const simulated = Number(process.env.OVERNIGHT_GARDEN_NOW);
  return process.env.OVERNIGHT_GARDEN_NOW && Number.isFinite(simulated) ? simulated : Date.now();
}

// Claude Code sends the hook a JSON description of the event on stdin.
function readInput() {
  if (process.stdin.isTTY) return {};
  try {
    return JSON.parse(readFileSync(0, 'utf8')) ?? {};
  } catch {
    return {};
  }
}

function handle(event, input, at) {
  const file = presenceFile();
  const presence = loadPresence(file);
  if (event === 'stop') return savePresence(file, agentStopped(presence, at));
  if (event !== 'prompt' && event !== 'session') return;
  // Compaction can start a session while you're away, so it doesn't count as you being back.
  if (event === 'session' && input.source === 'compact') return;

  const { presence: next, absence } = userActive(presence, at, { prompted: event === 'prompt' });
  savePresence(file, next);
  if (absence) recordAbsence(gardenFile(), absence);
}

try {
  handle(process.argv[2], readInput(), now());
} catch {
  // Stay silent: a hook that fails quietly costs one night's plant at most.
}
