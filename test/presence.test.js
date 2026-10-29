import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { agentStopped, emptyPresence, loadPresence, onHookEvent, savePresence, userActive } from '../src/presence.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const MON_22H = Date.parse('2026-11-02T22:00:00Z');

const root = mkdtempSync(join(tmpdir(), 'overnight-garden-presence-'));
after(() => rmSync(root, { recursive: true, force: true }));

test('your first visit grows nothing, because there was no time away yet', () => {
  assert.equal(userActive(emptyPresence(), MON_22H, { prompted: true }).absence, null);
});

test('time away runs from your last activity to when you come back', () => {
  const { presence } = userActive(emptyPresence(), MON_22H, { prompted: true });
  const { absence } = userActive(presence, MON_22H + 9 * HOUR, { prompted: true });
  assert.deepEqual(absence, { leftAt: MON_22H, returnedAt: MON_22H + 9 * HOUR, agentRunMs: 0 });
});

test("golden flower: the agent's work is measured from your last prompt to when it stopped", () => {
  let { presence } = userActive(emptyPresence(), MON_22H, { prompted: true });
  presence = agentStopped(presence, MON_22H + 45 * MINUTE);
  const { absence } = userActive(presence, MON_22H + 9 * HOUR, { prompted: true });
  assert.equal(absence.agentRunMs, 45 * MINUTE);
});

test('golden flower: a new prompt starts a new agent turn, so an earlier one no longer counts', () => {
  let { presence } = userActive(emptyPresence(), MON_22H, { prompted: true });
  presence = agentStopped(presence, MON_22H + 45 * MINUTE);
  presence = userActive(presence, MON_22H + HOUR, { prompted: true }).presence;
  const { absence } = userActive(presence, MON_22H + 10 * HOUR, { prompted: true });
  assert.equal(absence.agentRunMs, 0);
});

test('opening a session marks you as here without starting an agent turn', () => {
  let { presence } = userActive(emptyPresence(), MON_22H, { prompted: true });
  presence = agentStopped(presence, MON_22H + 20 * MINUTE);
  presence = userActive(presence, MON_22H + HOUR).presence;
  assert.deepEqual(presence, {
    lastSeenAt: MON_22H + HOUR,
    lastPromptAt: MON_22H,
    lastPromptSession: null,
    lastStopAt: MON_22H + 20 * MINUTE,
  });
});

test('golden flower: an agent finishing in another window is not credited to your last prompt', () => {
  let { presence } = userActive(emptyPresence(), MON_22H - HOUR, { prompted: true, session: 'window-a' });
  presence = userActive(presence, MON_22H, { prompted: true, session: 'window-b' }).presence;
  presence = agentStopped(presence, MON_22H + 20 * MINUTE, 'window-a');
  const { absence } = userActive(presence, MON_22H + 9 * HOUR, { prompted: true, session: 'window-b' });
  assert.equal(absence.agentRunMs, 0);
});

test('golden flower: an agent turn that finished before you were last here does not count', () => {
  let { presence } = userActive(emptyPresence(), MON_22H - 2 * HOUR, { prompted: true });
  presence = agentStopped(presence, MON_22H - 90 * MINUTE);
  presence = userActive(presence, MON_22H - HOUR).presence;
  const { absence } = userActive(presence, MON_22H + 9 * HOUR, { prompted: true });
  assert.equal(absence.agentRunMs, 0);
});

test('compaction starting a session while you are away is not you coming back', () => {
  const { presence } = onHookEvent(emptyPresence(), 'prompt', MON_22H, { session_id: 'a' });
  const compacted = onHookEvent(presence, 'session', MON_22H + HOUR, { session_id: 'a', source: 'compact' });
  assert.equal(compacted.presence, presence);
  assert.equal(compacted.absence, null);
});

test('golden flower: an agent stop with no prompt before it changes nothing', () => {
  const presence = emptyPresence();
  assert.equal(agentStopped(presence, MON_22H), presence);
});

test('times are in milliseconds: when you were last here is saved and loaded back exactly', () => {
  const file = join(root, 'roundtrip', 'presence.json');
  const presence = { lastSeenAt: MON_22H, lastPromptAt: MON_22H, lastPromptSession: 'abc', lastStopAt: MON_22H + MINUTE };
  savePresence(file, presence);
  assert.deepEqual(loadPresence(file), presence);
});

test('a missing or damaged presence file just means nothing is known yet', () => {
  assert.deepEqual(loadPresence(join(root, 'missing', 'presence.json')), emptyPresence());
  for (const text of ['{ not json', 'null', '{"lastSeenAt":"yesterday"}']) {
    const file = join(root, 'damaged.json');
    writeFileSync(file, text);
    assert.deepEqual(loadPresence(file), emptyPresence(), text);
  }
});
