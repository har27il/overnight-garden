import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { agentStopped, emptyPresence, loadPresence, savePresence, userActive } from '../src/presence.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const MON_22H = Date.parse('2026-11-02T22:00:00Z');

const root = mkdtempSync(join(tmpdir(), 'overnight-garden-presence-'));
after(() => rmSync(root, { recursive: true, force: true }));

test('the very first visit ends no absence', () => {
  assert.equal(userActive(emptyPresence(), MON_22H, { prompted: true }).absence, null);
});

test('coming back reports the time away, from your last activity to now', () => {
  const { presence } = userActive(emptyPresence(), MON_22H, { prompted: true });
  const { absence } = userActive(presence, MON_22H + 9 * HOUR, { prompted: true });
  assert.deepEqual(absence, { leftAt: MON_22H, returnedAt: MON_22H + 9 * HOUR, agentRunMs: 0 });
});

test("the agent's working time is measured from your last prompt to when it stopped", () => {
  let { presence } = userActive(emptyPresence(), MON_22H, { prompted: true });
  presence = agentStopped(presence, MON_22H + 45 * MINUTE);
  const { absence } = userActive(presence, MON_22H + 9 * HOUR, { prompted: true });
  assert.equal(absence.agentRunMs, 45 * MINUTE);
});

test('a new prompt starts a new agent turn, so an earlier stop no longer counts', () => {
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
  assert.deepEqual(presence, { lastSeenAt: MON_22H + HOUR, lastPromptAt: MON_22H, lastStopAt: MON_22H + 20 * MINUTE });
});

test('a stop with no prompt before it changes nothing', () => {
  const presence = emptyPresence();
  assert.equal(agentStopped(presence, MON_22H), presence);
});

test('presence saves and loads back in milliseconds', () => {
  const file = join(root, 'roundtrip', 'presence.json');
  const presence = { lastSeenAt: MON_22H, lastPromptAt: MON_22H, lastStopAt: MON_22H + MINUTE };
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
