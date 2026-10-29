// Decides what grows from one stretch of time away.
// The engine never reads the clock: callers pass every time in, so tests and
// the demo can simulate a night away using these exact rules.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const FLOWER_AFTER = 8 * HOUR;
export const TREE_AFTER = 40 * HOUR;
export const RARE_PLANT_AFTER = 5 * DAY;
export const GOLDEN_AGENT_RUN = 10 * MINUTE;

export const PLANT_KINDS = ['flower', 'tree', 'rare-plant', 'golden-flower'];

// Times before 3 March 1973 (1e11 ms) are treated as mistakes: a time given in
// seconds instead of milliseconds is about 1.8e9 today, far below it.
const EARLIEST_TIME = 1e11;

// A usable time: milliseconds since 1970, after EARLIEST_TIME, within the range a Date can hold.
const isTime = (ms) => typeof ms === 'number' && ms >= EARLIEST_TIME && !Number.isNaN(new Date(ms).getTime());

export function emptyGarden() {
  return { version: 1, plants: [] };
}

/**
 * The plants one absence grows: the biggest plant its length reached, plus a
 * golden flower if the agent had been working 10+ minutes when the user left.
 * @param {{leftAt: number, returnedAt: number, agentRunMs?: number}} [absence]
 *   Times are milliseconds since the epoch, as from Date.now().
 * @returns {string[]} e.g. ['tree', 'golden-flower'], or [] if nothing grows.
 */
export function plantsFor(absence) {
  const { leftAt, returnedAt, agentRunMs = 0 } = absence ?? {};
  if (!isTime(leftAt) || !isTime(returnedAt)) return [];
  const away = returnedAt - leftAt;
  if (away < FLOWER_AFTER) return [];

  const plants = [away >= RARE_PLANT_AFTER ? 'rare-plant' : away >= TREE_AFTER ? 'tree' : 'flower'];
  if (Number.isFinite(agentRunMs) && agentRunMs >= GOLDEN_AGENT_RUN) plants.push('golden-flower');
  return plants;
}

/**
 * Returns a new garden with this absence's plants added. Plants are only ever
 * added: nothing wilts, resets or depends on a streak.
 */
export function grow(garden, absence) {
  const kinds = plantsFor(absence);
  if (kinds.length === 0) return garden;

  const leftAt = new Date(absence.leftAt).toISOString();
  const returnedAt = new Date(absence.returnedAt).toISOString();
  return addPlants(garden, kinds.map((kind) => ({ kind, leftAt, returnedAt })));
}

const isGolden = (plant) => plant.kind === 'golden-flower';

// A kept plant covers a new one when it ended during the new one's stretch.
// Nights are recorded as the user comes back, so a plant ending after a newer
// one can only come from a wrong clock, and it never blocks later nights.
const covers = (kept, plant) => {
  const keptEnd = Date.parse(kept.returnedAt);
  return Date.parse(plant.leftAt) < keptEnd && keptEnd <= Date.parse(plant.returnedAt);
};

/**
 * Adds plants under the same-night rule: a stretch of time holds at most one
 * plant and one golden flower, so a night recorded twice, or by two open
 * sessions, grows once. Never removes anything.
 */
export function addPlants(garden, plants) {
  const kept = [...garden.plants];
  for (const plant of plants) {
    const taken = kept.some((other) => isGolden(other) === isGolden(plant) && covers(other, plant));
    if (!taken) kept.push(plant);
  }
  return kept.length === garden.plants.length ? garden : { ...garden, plants: kept };
}
