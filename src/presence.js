// Keeps track of when the user was last active in any Claude Code session, and
// turns a return after time away into an absence for the engine. All times are
// milliseconds since 1970, as from Date.now().

import { readFileSync } from 'node:fs';
import { writeFileAtomic } from './store.js';

/** The Claude Code hook events the garden listens to, and the word each passes to the hook. */
export const HOOK_EVENTS = { UserPromptSubmit: 'prompt', Stop: 'stop', SessionStart: 'session' };

export function emptyPresence() {
  return { lastSeenAt: null, lastPromptAt: null, lastPromptSession: null, lastStopAt: null };
}

/**
 * Applies one hook event ('prompt', 'session' or 'stop') with the JSON Claude Code
 * sent. Returns the updated presence and the absence that just ended, if any.
 */
export function onHookEvent(presence, event, at, input = {}) {
  const session = typeof input?.session_id === 'string' ? input.session_id : null;
  if (event === 'prompt') return userActive(presence, at, { prompted: true, session });
  // Compaction can start a session while you're away, so it doesn't count as you being back.
  if (event === 'session' && input?.source !== 'compact') return userActive(presence, at, { session });
  if (event === 'stop') return { presence: agentStopped(presence, at, session), absence: null };
  return { presence, absence: null };
}

/**
 * The user did something: sent a prompt or opened a session. Returns the
 * updated presence and the absence that just ended (null on the first visit).
 */
export function userActive(presence, now, { prompted = false, session = null } = {}) {
  const absence =
    presence.lastSeenAt === null
      ? null
      : { leftAt: presence.lastSeenAt, returnedAt: now, agentRunMs: agentRun(presence) };
  const next = { ...presence, lastSeenAt: now };
  if (prompted) Object.assign(next, { lastPromptAt: now, lastPromptSession: session, lastStopAt: null });
  return { presence: next, absence };
}

/** The agent finished a turn. Only a turn in the window of your last prompt counts. */
export function agentStopped(presence, now, session = null) {
  if (presence.lastPromptAt === null || session !== presence.lastPromptSession) return presence;
  return { ...presence, lastStopAt: now };
}

// How long the agent worked on your last prompt. It counts only if the agent was
// still working after you were last here, so the work overlapped your time away.
function agentRun({ lastSeenAt, lastPromptAt, lastStopAt }) {
  if (lastPromptAt === null || lastStopAt === null || lastStopAt < lastSeenAt) return 0;
  return lastStopAt - lastPromptAt;
}

const isTimeOrNull = (value) => value === null || Number.isFinite(value);

/** Loads presence. A missing or damaged file just means nothing is known yet. */
export function loadPresence(file) {
  try {
    const { lastSeenAt, lastPromptAt, lastPromptSession = null, lastStopAt } = JSON.parse(readFileSync(file, 'utf8'));
    const sessionOk = lastPromptSession === null || typeof lastPromptSession === 'string';
    if (sessionOk && [lastSeenAt, lastPromptAt, lastStopAt].every(isTimeOrNull)) {
      return { lastSeenAt, lastPromptAt, lastPromptSession, lastStopAt };
    }
  } catch {
    // Start fresh: only the garden itself must never reset.
  }
  return emptyPresence();
}

export function savePresence(file, presence) {
  writeFileAtomic(file, JSON.stringify(presence, null, 2) + '\n');
}
