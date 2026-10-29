// Loads and saves the garden file. A garden is only ever added to, so saving
// refuses to overwrite a file it can't read and keeps every plant already in it.

import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { PLANT_KINDS, addPlants, emptyGarden, grow } from './engine.js';

// A time exactly as the garden writes it, e.g. 2026-10-29T22:00:00.000Z.
const isGardenTime = (value) =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
const isPlant = (plant) =>
  PLANT_KINDS.includes(plant?.kind) && isGardenTime(plant.leftAt) && isGardenTime(plant.returnedAt);

// Notepad and PowerShell can start a file with an invisible byte-order mark
// (U+FEFF), and PowerShell 5.1 saves as UTF-16 by default.
function decode(bytes) {
  const text = bytes[0] === 0xff && bytes[1] === 0xfe ? bytes.toString('utf16le', 2) : bytes.toString('utf8');
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function loadGarden(file) {
  let bytes;
  try {
    bytes = readFileSync(file);
  } catch (err) {
    if (err.code === 'ENOENT') return emptyGarden();
    throw err;
  }

  let garden = null;
  try {
    garden = JSON.parse(decode(bytes));
  } catch {
    // Falls through to the damaged-file error below.
  }
  if (!Array.isArray(garden?.plants) || !garden.plants.every(isPlant)) {
    throw new Error(`Garden file ${file} is damaged; leaving it untouched.`);
  }
  return garden;
}

/** Adds a garden's plants to the file and returns the garden as saved. */
export function saveGarden(file, garden) {
  if (!garden.plants.every(isPlant)) {
    throw new Error(`Refusing to save an invalid plant to ${file}; nothing was written.`);
  }
  const onDisk = loadGarden(file); // Throws, writing nothing, if the file is damaged.
  // Keep every plant already on disk, including ones another session just added.
  const merged = addPlants(onDisk, garden.plants);
  if (merged !== onDisk) writeGarden(file, merged);
  return merged;
}

/** Adds one absence's plants to the garden file and returns the garden as saved. */
export function recordAbsence(file, absence) {
  return saveGarden(file, grow(emptyGarden(), absence));
}

// Writes a temporary file, then swaps it in, so a crash can't leave half a garden.
function writeGarden(file, garden) {
  mkdirSync(dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  try {
    writeFileSync(temp, JSON.stringify(garden, null, 2) + '\n');
    renameSync(temp, file);
  } finally {
    rmSync(temp, { force: true });
  }
}
