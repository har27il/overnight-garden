// Turns a garden into what people see. Only known plant types, and text written
// here, are ever shown: never raw text from the garden file.

import { PLANT_KINDS } from './engine.js';

export const PLANT_LOOKS = {
  flower: { emoji: '🌷', one: 'flower', many: 'flowers', rule: '8+ hours away' },
  tree: { emoji: '🌳', one: 'tree', many: 'trees', rule: '40+ hours away' },
  'rare-plant': { emoji: '🍀', one: 'rare plant', many: 'rare plants', rule: '5+ days away' },
  'golden-flower': {
    emoji: '🌻',
    one: 'golden flower',
    many: 'golden flowers',
    rule: 'a bonus when the agent worked 10+ minutes before you left',
  },
};

// [kind, count] for each known kind that has grown, in a fixed order.
function tally(garden) {
  return PLANT_KINDS.map((kind) => [kind, garden.plants.filter((plant) => plant.kind === kind).length]).filter(
    ([, count]) => count > 0,
  );
}

/** The one line Claude Code shows in its status bar. */
export function statusLine(garden) {
  const grown = tally(garden).map(([kind, count]) => `${PLANT_LOOKS[kind].emoji} ${count}`);
  return grown.length === 0
    ? '🌱 Overnight Garden · grows while you rest'
    : `🌱 Overnight Garden · ${grown.join('  ')}`;
}
