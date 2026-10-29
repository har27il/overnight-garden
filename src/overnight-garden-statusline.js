// Claude Code status line: one line showing what has grown. It only reads the
// garden, and shows its calm default line if the garden can't be read.

import { emptyGarden } from './engine.js';
import { gardenFile } from './paths.js';
import { statusLine } from './render.js';
import { loadGarden } from './store.js';

let garden;
try {
  garden = loadGarden(gardenFile());
} catch {
  garden = emptyGarden();
}
process.stdout.write(statusLine(garden) + '\n');
