// Loads and saves the garden file. A garden is only ever added to, so saving
// refuses to overwrite a file it can't read or to replace it with fewer plants.

import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { emptyGarden, grow } from './engine.js';

export function loadGarden(file) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return emptyGarden();
    throw err;
  }

  let garden = null;
  try {
    garden = JSON.parse(text);
  } catch {
    // Falls through to the damaged-file error below.
  }
  if (!Array.isArray(garden?.plants)) {
    throw new Error(`Garden file ${file} is damaged; leaving it untouched.`);
  }
  return garden;
}

export function saveGarden(file, garden) {
  const onDisk = loadGarden(file); // Throws, writing nothing, if the file is damaged.
  if (garden.plants.length < onDisk.plants.length) {
    throw new Error(`Refusing to save fewer plants over ${file}; plants are never removed.`);
  }

  // Write a temporary file, then swap it in, so a crash can't leave half a garden.
  mkdirSync(dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  try {
    writeFileSync(temp, JSON.stringify(garden, null, 2) + '\n');
    renameSync(temp, file);
  } finally {
    rmSync(temp, { force: true });
  }
}

/** Adds one absence's plants to the garden file and returns the garden. */
export function recordAbsence(file, absence) {
  const before = loadGarden(file);
  const after = grow(before, absence);
  if (after !== before) saveGarden(file, after);
  return after;
}
