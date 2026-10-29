import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { awayOf, chapters, describeAbsence, isUserActivity } from '../scripts/demo-timeline.js';

const DEMO = fileURLToPath(new URL('../scripts/demo.js', import.meta.url));
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const events = chapters.flatMap((chapter) => chapter.events);
const byName = Object.fromEntries(chapters.map((chapter) => [chapter.name, chapter]));

test('every time in the demo is whole milliseconds since 1970, not seconds', () => {
  for (const event of events) {
    assert.ok(Number.isInteger(event.at), `${event.hook} at ${event.at}`);
    assert.ok(event.at > 1e12 && event.at < 1e13, `${event.at} doesn't look like milliseconds`);
    assert.equal(Date.parse(new Date(event.at).toISOString()), event.at);
  }
});

test("each chapter's time away, in milliseconds, matches its story", () => {
  const away = (name) => {
    const { leftAt, returnedAt } = awayOf(byName[name]);
    return returnedAt - leftAt;
  };
  assert.equal(away('weekday night'), 9 * HOUR);
  assert.equal(away('lunch break'), 1 * HOUR);
  assert.equal(away('weekend'), 63 * HOUR);
  assert.equal(away('long agent handoff'), 9 * HOUR);
  assert.equal(awayOf(byName['long agent handoff']).agentRunMs, 45 * MINUTE);
  assert.ok(away('a year left alone') >= 365 * DAY);
});

test('the demo describes each absence in plain words', () => {
  assert.equal(describeAbsence(byName['weekday night']), 'away 9 hours (Thu 22:00 → Fri 07:00)');
  assert.equal(describeAbsence(byName['lunch break']), 'away 1 hour (Fri 12:00 → Fri 13:00)');
  assert.equal(describeAbsence(byName['weekend']), 'away 63 hours (Fri 18:00 → Mon 09:00)');
  assert.equal(
    describeAbsence(byName['long agent handoff']),
    'away 9 hours (Mon 23:00 → Tue 08:00), the agent worked 45 minutes first',
  );
  assert.equal(describeAbsence(byName['a year left alone']), 'away 365 days (10 Nov 2026 → 11 Nov 2027)');
});

test('outside the absences the demo is about, activity is never 8 hours apart', () => {
  const returns = new Set(chapters.map((chapter) => chapter.events.at(-1)));
  const activity = events.filter(isUserActivity);
  for (let i = 1; i < activity.length; i++) {
    assert.ok(activity[i].at > activity[i - 1].at, 'events are in time order');
    if (!returns.has(activity[i])) assert.ok(activity[i].at - activity[i - 1].at < 8 * HOUR, `gap before ${activity[i].at}`);
  }
});

test('the demo runs end to end and every line it prints says PASS', () => {
  const result = spawnSync(process.execPath, [DEMO], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.stderr, '');
  const lines = result.stdout.trimEnd().split('\n');
  assert.ok(lines.length >= 10, result.stdout);
  for (const line of lines) assert.match(line, /^PASS /);
  assert.match(lines.at(-1), /^PASS all \d+ checks passed; throwaway home removed$/);
});
