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
    rule: 'a bonus when the agent worked 10+ min before you left',
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

const cardDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const formatDate = (iso) => cardDate.format(new Date(iso));

/** The garden card: a small web page of every plant and when it grew. */
export function cardHtml(garden) {
  const plants = garden.plants.filter((plant) => Object.hasOwn(PLANT_LOOKS, plant.kind));
  const bed = plants
    .map((plant) => {
      const look = PLANT_LOOKS[plant.kind];
      return `<span class="plant" title="${look.one}, grew ${formatDate(plant.returnedAt)}">${look.emoji}</span>`;
    })
    .join('');
  const counts = tally({ plants }).map(([kind, count]) => {
    const look = PLANT_LOOKS[kind];
    return `${count} ${count === 1 ? look.one : look.many}`;
  });
  const since =
    plants.length > 0
      ? `Growing since ${formatDate(plants[0].returnedAt)} · latest ${formatDate(plants.at(-1).returnedAt)}`
      : 'Your first flower grows after a night away.';
  const legend = PLANT_KINDS.map((kind) => `<li>${PLANT_LOOKS[kind].emoji} ${PLANT_LOOKS[kind].one}: ${PLANT_LOOKS[kind].rule}</li>`);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Overnight Garden</title>
<style>
  :root { --paper: #f4efe4; --card: #fffdf8; --ink: #2d382d; --muted: #6a746a; --soil: #8a6a4f; --line: #e5dccb; }
  @media (prefers-color-scheme: dark) {
    :root { --paper: #151915; --card: #1e241e; --ink: #e7ede5; --muted: #9ca79c; --soil: #5b4737; --line: #2f382f; }
  }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--paper);
    color: var(--ink); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  .card { width: min(560px, calc(100vw - 32px)); box-sizing: border-box; background: var(--card);
    border: 1px solid var(--line); border-radius: 20px; padding: 28px 28px 22px; box-shadow: 0 12px 32px rgb(0 0 0 / 0.08); }
  h1 { margin: 0; font: 600 1.7rem/1.2 Georgia, "Times New Roman", serif; }
  .lede { margin: 4px 0 20px; color: var(--muted); }
  .bed { display: flex; flex-wrap: wrap; gap: 6px; align-items: flex-end; min-height: 56px; padding: 14px 12px 10px;
    border-bottom: 10px solid var(--soil); border-radius: 12px 12px 4px 4px; }
  .plant { font-size: 40px; line-height: 1; }
  .empty { color: var(--muted); }
  .tally { margin: 16px 0 2px; font-weight: 600; }
  .since { margin: 0; color: var(--muted); font-size: 0.92rem; }
  ul { margin: 18px 0 0; padding: 14px 0 0; border-top: 1px solid var(--line); list-style: none;
    display: grid; gap: 4px; color: var(--muted); font-size: 0.92rem; }
  footer { margin-top: 14px; color: var(--muted); font-size: 0.85rem; }
</style>
</head>
<body>
<main class="card">
  <h1>Overnight Garden</h1>
  <p class="lede">Everything here grew while you were away.</p>
  <div class="bed">${bed || '<span class="empty">Nothing yet.</span>'}</div>
  <p class="tally">${counts.join(' · ') || 'No plants yet'}</p>
  <p class="since">${since}</p>
  <ul>${legend.join('')}</ul>
  <footer>It never wilts, never resets and never counts streaks.</footer>
</main>
</body>
</html>
`;
}
