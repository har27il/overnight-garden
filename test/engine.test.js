import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyGarden, grow, plantsFor } from '../src/engine.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const LEFT = Date.parse('2026-10-29T22:00:00Z');

// One absence that started at LEFT and lasted `ms`.
const away = (ms, agentRunMs = 0) => ({ leftAt: LEFT, returnedAt: LEFT + ms, agentRunMs });

test('away under 8 hours: nothing grows', () => {
  assert.deepEqual(plantsFor(away(8 * HOUR - 1)), []);
});

test('away exactly 8 hours: a flower', () => {
  assert.deepEqual(plantsFor(away(8 * HOUR)), ['flower']);
});

test('away 9 hours after a 12-minute agent run: a flower plus a golden flower', () => {
  assert.deepEqual(plantsFor(away(9 * HOUR, 12 * MINUTE)), ['flower', 'golden-flower']);
});

test('away exactly 8 hours after exactly a 10-minute agent run: a flower plus a golden flower', () => {
  assert.deepEqual(plantsFor(away(8 * HOUR, 10 * MINUTE)), ['flower', 'golden-flower']);
});

test('away 9 hours after a 9-minute agent run: just a flower', () => {
  assert.deepEqual(plantsFor(away(9 * HOUR, 9 * MINUTE)), ['flower']);
});

test('away 40 hours: a tree', () => {
  assert.deepEqual(plantsFor(away(40 * HOUR)), ['tree']);
});

test('away 40 hours after a 12-minute agent run: a tree plus a golden flower', () => {
  assert.deepEqual(plantsFor(away(40 * HOUR, 12 * MINUTE)), ['tree', 'golden-flower']);
});

test('away 5 days: a rare plant', () => {
  assert.deepEqual(plantsFor(away(5 * DAY)), ['rare-plant']);
});

test('away 5 days after a 12-minute agent run: a rare plant plus a golden flower', () => {
  assert.deepEqual(plantsFor(away(5 * DAY, 12 * MINUTE)), ['rare-plant', 'golden-flower']);
});

test('one absence grows only its biggest plant, not a stack of smaller ones', () => {
  assert.deepEqual(plantsFor(away(40 * HOUR - 1)), ['flower']);
  assert.deepEqual(plantsFor(away(5 * DAY - 1)), ['tree']);
  assert.deepEqual(plantsFor(away(30 * DAY)), ['rare-plant']);
});

test('a long agent run with under 8 hours away: nothing grows', () => {
  assert.deepEqual(plantsFor(away(7 * HOUR, 60 * MINUTE)), []);
});

test('clock says you came back before you left: nothing grows, nothing breaks', () => {
  assert.deepEqual(plantsFor(away(-9 * HOUR, 12 * MINUTE)), []);
  assert.deepEqual(plantsFor({ leftAt: NaN, returnedAt: LEFT }), []);
  assert.equal(grow(emptyGarden(), { leftAt: undefined, returnedAt: LEFT }).plants.length, 0);
});

test('impossible times beyond the calendar grow nothing and break nothing', () => {
  const farFuture = 1e16; // Past the last date JavaScript can represent.
  assert.deepEqual(plantsFor({ leftAt: farFuture, returnedAt: farFuture + 9 * HOUR }), []);
  assert.equal(grow(emptyGarden(), { leftAt: farFuture, returnedAt: farFuture + 9 * HOUR }).plants.length, 0);
});

test('times are in milliseconds: times given in seconds grow nothing', () => {
  const leftInSeconds = Math.floor(LEFT / 1000);
  assert.deepEqual(plantsFor({ leftAt: leftInSeconds, returnedAt: LEFT + 9 * HOUR }), []);
  assert.deepEqual(plantsFor({ leftAt: leftInSeconds, returnedAt: leftInSeconds + 9 * 60 * 60 }), []);
});

test('no absence given at all: nothing grows, nothing breaks', () => {
  assert.deepEqual(plantsFor(), []);
  const garden = emptyGarden();
  assert.equal(grow(garden), garden);
});

test('null instead of an absence: nothing grows, nothing breaks', () => {
  assert.deepEqual(plantsFor(null), []);
  const garden = emptyGarden();
  assert.equal(grow(garden, null), garden);
});

test('each plant remembers when you left and when you came back', () => {
  const garden = grow(emptyGarden(), away(9 * HOUR, 12 * MINUTE));
  assert.deepEqual(garden.plants, [
    { kind: 'flower', leftAt: '2026-10-29T22:00:00.000Z', returnedAt: '2026-10-30T07:00:00.000Z' },
    { kind: 'golden-flower', leftAt: '2026-10-29T22:00:00.000Z', returnedAt: '2026-10-30T07:00:00.000Z' },
  ]);
});

test('the same absence recorded twice still grows its plants only once', () => {
  const once = grow(emptyGarden(), away(9 * HOUR, 12 * MINUTE));
  const twice = grow(once, away(9 * HOUR, 12 * MINUTE));
  assert.equal(twice.plants.length, 2);
});

test('two Claude Code windows open on the same night grow its plants only once', () => {
  const firstWindow = grow(emptyGarden(), away(9 * HOUR, 12 * MINUTE));
  const secondWindow = grow(firstWindow, {
    leftAt: LEFT + 5 * MINUTE,
    returnedAt: LEFT + 9 * HOUR,
    agentRunMs: 12 * MINUTE,
  });
  assert.deepEqual(secondWindow.plants.map((plant) => plant.kind), ['flower', 'golden-flower']);
});

test('on the same night, a golden flower earned only by the second window still grows', () => {
  const firstWindow = grow(emptyGarden(), away(9 * HOUR));
  const secondWindow = grow(firstWindow, {
    leftAt: LEFT + 5 * MINUTE,
    returnedAt: LEFT + 9 * HOUR,
    agentRunMs: 12 * MINUTE,
  });
  assert.deepEqual(secondWindow.plants.map((plant) => plant.kind), ['flower', 'golden-flower']);
});

test('one bad clock reading never stops later nights from growing', () => {
  const glitch = grow(emptyGarden(), { leftAt: LEFT, returnedAt: Date.parse('2031-01-01T00:00:00Z') });
  const nextNight = grow(glitch, { leftAt: LEFT + DAY, returnedAt: LEFT + DAY + 9 * HOUR });
  assert.deepEqual(nextNight.plants.map((plant) => plant.kind), ['rare-plant', 'flower']);
});

test('never wilts: a garden left alone for a year keeps every plant', () => {
  const lastYear = grow(emptyGarden(), away(40 * HOUR));
  const yearLater = LEFT + 365 * DAY;
  const garden = grow(lastYear, { leftAt: yearLater, returnedAt: yearLater + 9 * HOUR });
  assert.deepEqual(garden.plants.map((plant) => plant.kind), ['tree', 'flower']);
  assert.deepEqual(garden.plants[0], lastYear.plants[0]);
});

test('short breaks change nothing: the garden stays exactly as it was', () => {
  const garden = grow(emptyGarden(), away(40 * HOUR));
  assert.equal(grow(garden, { leftAt: LEFT + 50 * HOUR, returnedAt: LEFT + 51 * HOUR }), garden);
});

test('never resets: growing new plants leaves every earlier plant untouched', () => {
  const garden = grow(emptyGarden(), away(9 * HOUR));
  const snapshot = structuredClone(garden);
  grow(garden, { leftAt: LEFT + DAY, returnedAt: LEFT + 3 * DAY });
  assert.deepEqual(garden, snapshot);
});
