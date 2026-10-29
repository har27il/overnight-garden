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

// A usable time: a number of milliseconds within the range a Date can hold.
const isTime = (ms) => typeof ms === 'number' && !Number.isNaN(new Date(ms).getTime());

export function emptyGarden() {
  return { version: 1, plants: [] };
}

/**
 * The plants one absence grows: the biggest plant its length reached, plus a
 * golden flower if the agent had been working 10+ minutes when the user left.
 * @param {{leftAt: number, returnedAt: number, agentRunMs?: number}} absence
 *   Times are milliseconds since the epoch, as from Date.now().
 * @returns {string[]} e.g. ['tree', 'golden-flower'], or [] if nothing grows.
 */
export function plantsFor({ leftAt, returnedAt, agentRunMs = 0 }) {
  if (!isTime(leftAt) || !isTime(returnedAt)) return [];
  const away = returnedAt - leftAt;
  if (away < FLOWER_AFTER) return [];

  const plants = [away >= RARE_PLANT_AFTER ? 'rare-plant' : away >= TREE_AFTER ? 'tree' : 'flower'];
  if (Number.isFinite(agentRunMs) && agentRunMs >= GOLDEN_AGENT_RUN) plants.push('golden-flower');
  return plants;
}

/**
 * Returns a new garden with this absence's plants added. Plants are only ever
 * added: nothing wilts, resets or depends on a streak. An absence that overlaps
 * one already in the garden adds nothing, so a night recorded twice, or by two
 * open sessions, grows once.
 */
export function grow(garden, absence) {
  const kinds = plantsFor(absence);
  if (kinds.length === 0) return garden;

  const overlaps = (plant) =>
    Date.parse(plant.leftAt) < absence.returnedAt && absence.leftAt < Date.parse(plant.returnedAt);
  if (garden.plants.some(overlaps)) return garden;

  const leftAt = new Date(absence.leftAt).toISOString();
  const returnedAt = new Date(absence.returnedAt).toISOString();
  const grown = kinds.map((kind) => ({ kind, leftAt, returnedAt }));
  return { ...garden, plants: [...garden.plants, ...grown] };
}
