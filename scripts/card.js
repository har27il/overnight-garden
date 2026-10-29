// Saves your garden card, a small web page of everything that has grown, and
// prints where it is: node scripts/card.js

import { pathToFileURL } from 'node:url';
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

const file = cardFile();
writeFileAtomic(file, cardHtml(garden));
console.log(`Your garden card: ${pathToFileURL(file).href}`);
