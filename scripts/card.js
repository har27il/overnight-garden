// Saves your garden card, a small web page of everything that has grown, and
// prints where it is: node scripts/card.js

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { PLANT_KINDS } from '../src/engine.js';
import { cardFile, gardenFile } from '../src/paths.js';
import { cardHtml } from '../src/render.js';
import { loadGarden, writeFileAtomic } from '../src/store.js';

let garden;
try {
  garden = loadGarden(gardenFile());
} catch (err) {
  // Keep whatever card you already have rather than replace it with an empty one.
  console.error(`Your garden card was not updated, because the garden file couldn't be read. ${err.message}`);
  process.exit(1);
}

// The watercolor paintings that come with the garden, made by tools/paint_plants.py.
const paintings = {};
for (const kind of PLANT_KINDS) {
  try {
    const png = readFileSync(new URL(`../assets/plants/${kind}.png`, import.meta.url));
    paintings[kind] = `data:image/png;base64,${png.toString('base64')}`;
  } catch (err) {
    // A missing painting just means the card shows the plant's emoji; say why for anything else.
    if (err.code !== 'ENOENT') console.error(`The ${kind} painting couldn't be read, so the card shows its emoji. ${err.message}`);
  }
}

const file = cardFile();
writeFileAtomic(file, cardHtml(garden, paintings));
console.log(`Your garden card: ${pathToFileURL(file).href}`);
