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

test('growing adds the plants to the garden, stamped with when you left and came back', () => {
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

test('a garden left alone for a year keeps every plant', () => {
  const lastYear = grow(emptyGarden(), away(40 * HOUR));
  const yearLater = LEFT + 365 * DAY;
  const garden = grow(lastYear, { leftAt: yearLater, returnedAt: yearLater + 9 * HOUR });
  assert.deepEqual(garden.plants.map((plant) => plant.kind), ['tree', 'flower']);
  assert.deepEqual(garden.plants[0], lastYear.plants[0]);
});

test('a short absence leaves the garden exactly as it was', () => {
  const garden = grow(emptyGarden(), away(40 * HOUR));
  assert.equal(grow(garden, { leftAt: LEFT + 50 * HOUR, returnedAt: LEFT + 51 * HOUR }), garden);
});

test('growing never changes the garden it was given', () => {
  const garden = grow(emptyGarden(), away(9 * HOUR));
  const snapshot = structuredClone(garden);
  grow(garden, { leftAt: LEFT + DAY, returnedAt: LEFT + 3 * DAY });
  assert.deepEqual(garden, snapshot);
});
