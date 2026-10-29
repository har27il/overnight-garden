// The five stretches of life the demo plays out, in UTC. Every time is in
// milliseconds since 1970, which is what the hooks and the engine expect.

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

/** True for events that mean the user is here: a prompt, or opening a session. */
export const isUserActivity = (event) =>
  event.hook === 'UserPromptSubmit' || (event.hook === 'SessionStart' && event.input?.source !== 'compact');

/** The absence a chapter ends with: from the last activity to the return, in milliseconds. */
export function awayOf(chapter) {
  const returned = chapter.events.at(-1);
  const left = chapter.events.slice(0, -1).filter(isUserActivity).at(-1);
  const stopped = chapter.events.filter((event) => event.hook === 'Stop' && event.at >= left.at).at(-1);
  const agentRunMs = left.hook === 'UserPromptSubmit' && stopped ? stopped.at - left.at : 0;
  return { leftAt: left.at, returnedAt: returned.at, agentRunMs };
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
