// The five stretches of life the demo plays out, in UTC. Every time is in
// milliseconds since 1970, which is what the hooks and the engine expect.

import { emptyPresence, HOOK_EVENTS, onHookEvent } from '../src/presence.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const prompt = (iso) => ({ hook: 'UserPromptSubmit', at: Date.parse(iso) });
const stop = (iso) => ({ hook: 'Stop', at: Date.parse(iso) });
const session = (iso, source) => ({ hook: 'SessionStart', at: Date.parse(iso), input: { source } });

// Each chapter ends with the user coming back. Activity between chapters stays
// under 8 hours apart, so only the absence each chapter is about can grow anything.
export const chapters = [
  {
    name: 'weekday night',
    events: [
      session('2026-11-05T09:00:00Z', 'startup'), // Thursday, the first day with the garden
      prompt('2026-11-05T15:00:00Z'),
      prompt('2026-11-05T22:00:00Z'),
      stop('2026-11-05T22:03:00Z'),
      prompt('2026-11-06T07:00:00Z'),
    ],
    grows: ['flower'],
  },
  {
    name: 'lunch break',
    events: [prompt('2026-11-06T12:00:00Z'), stop('2026-11-06T12:02:00Z'), prompt('2026-11-06T13:00:00Z')],
    grows: [],
  },
  {
    name: 'weekend',
    events: [prompt('2026-11-06T18:00:00Z'), stop('2026-11-06T18:05:00Z'), prompt('2026-11-09T09:00:00Z')],
    grows: ['tree'],
  },
  {
    name: 'long agent handoff',
    events: [
      prompt('2026-11-09T16:00:00Z'),
      prompt('2026-11-09T23:00:00Z'), // hands the agent a big task, then goes to bed
      session('2026-11-09T23:30:00Z', 'compact'), // the agent's context is compacted mid-task
      stop('2026-11-09T23:45:00Z'), // the agent finishes 45 minutes after the handoff
      prompt('2026-11-10T08:00:00Z'),
    ],
    grows: ['flower', 'golden-flower'],
  },
  {
    name: 'a year left alone',
    events: [prompt('2026-11-10T14:00:00Z'), stop('2026-11-10T14:02:00Z'), session('2027-11-11T09:00:00Z', 'startup')],
    grows: ['rare-plant'],
  },
];

/** The absence a chapter ends with, worked out by the real presence code, in milliseconds. */
export function awayOf(chapter) {
  let presence = emptyPresence();
  let absence = null;
  for (const event of chapter.events) {
    const input = { session_id: 'demo', ...event.input };
    ({ presence, absence } = onHookEvent(presence, HOOK_EVENTS[event.hook], event.at, input));
  }
  return absence;
}

const weekdayTime = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'UTC',
});
const fullDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** A chapter's absence in words, e.g. "away 9 hours (Thu 22:00 → Fri 07:00)". */
export function describeAbsence(chapter) {
  const { leftAt, returnedAt, agentRunMs } = awayOf(chapter);
  const away = returnedAt - leftAt;
  const long = away >= 5 * DAY;
  const span = long ? plural(Math.floor(away / DAY), 'day') : plural(Math.round(away / HOUR), 'hour');
  const format = long ? fullDate : weekdayTime;
  let text = `away ${span} (${format.format(leftAt)} → ${format.format(returnedAt)})`;
  if (agentRunMs >= 10 * MINUTE) text += `, the agent worked ${plural(Math.round(agentRunMs / MINUTE), 'minute')} first`;
  return text;
}
