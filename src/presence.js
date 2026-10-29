// Keeps track of when the user was last active in any Claude Code session, and
// turns a return after time away into an absence for the engine. All times are
// milliseconds since 1970, as from Date.now().

import { readFileSync } from 'node:fs';
import { writeFileAtomic } from './store.js';

export function emptyPresence() {
  return { lastSeenAt: null, lastPromptAt: null, lastStopAt: null };
}

/**
 * The user did something: sent a prompt or opened a session. Returns the
 * updated presence and the absence that just ended (null on the first visit).
 */
export function userActive(presence, now, { prompted = false } = {}) {
  const absence =
    presence.lastSeenAt === null
      ? null
      : { leftAt: presence.lastSeenAt, returnedAt: now, agentRunMs: agentRun(presence) };
  const next = { ...presence, lastSeenAt: now };
  if (prompted) Object.assign(next, { lastPromptAt: now, lastStopAt: null });
  return { presence: next, absence };
}

/** The agent finished a turn: remember when, to measure how long it worked. */
export function agentStopped(presence, now) {
  return presence.lastPromptAt === null ? presence : { ...presence, lastStopAt: now };
}

// How long the agent worked on the user's last prompt before it stopped.
function agentRun({ lastPromptAt, lastStopAt }) {
  if (lastPromptAt === null || lastStopAt === null || lastStopAt < lastPromptAt) return 0;
  return lastStopAt - lastPromptAt;
}

const isTimeOrNull = (value) => value === null || Number.isFinite(value);

/** Loads presence. A missing or damaged file just means nothing is known yet. */
export function loadPresence(file) {
  try {
    const { lastSeenAt, lastPromptAt, lastStopAt } = JSON.parse(readFileSync(file, 'utf8'));
    if ([lastSeenAt, lastPromptAt, lastStopAt].every(isTimeOrNull)) return { lastSeenAt, lastPromptAt, lastStopAt };
  } catch {
    // Start fresh: only the garden itself must never reset.
  }
  return emptyPresence();
}

export function savePresence(file, presence) {
  writeFileAtomic(file, JSON.stringify(presence, null, 2) + '\n');
}
