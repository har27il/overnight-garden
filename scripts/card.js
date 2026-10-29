// Saves your garden card, a small web page of everything that has grown, and
// prints where it is: node scripts/card.js

import { pathToFileURL } from 'node:url';
import { emptyGarden } from '../src/engine.js';
import { cardFile, gardenFile } from '../src/paths.js';
import { cardHtml } from '../src/render.js';
import { loadGarden, writeFileAtomic } from '../src/store.js';

let garden;
try {
  garden = loadGarden(gardenFile());
} catch (err) {
  console.error(`The card shows an empty garden because the garden file couldn't be read. ${err.message}`);
  garden = emptyGarden();
}

const file = cardFile();
writeFileAtomic(file, cardHtml(garden));
console.log(`Your garden card: ${pathToFileURL(file).href}`);
