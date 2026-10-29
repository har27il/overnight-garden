import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emptyGarden, grow } from '../src/engine.js';
import { loadGarden, recordAbsence, saveGarden } from '../src/store.js';

const HOUR = 60 * 60 * 1000;
const LEFT = Date.parse('2026-10-29T22:00:00Z');
const night = { leftAt: LEFT, returnedAt: LEFT + 9 * HOUR, agentRunMs: 12 * 60 * 1000 };

const root = mkdtempSync(join(tmpdir(), 'overnight-garden-test-'));
after(() => rmSync(root, { recursive: true, force: true }));

// A fresh, empty folder for each test.
const folder = (name) => join(root, name);

test('no garden file yet: starts with an empty garden', () => {
  assert.deepEqual(loadGarden(join(folder('fresh'), 'garden.json')), emptyGarden());
});

test('a saved garden loads back exactly the same', () => {
  const file = join(folder('roundtrip'), 'garden.json');
  const garden = grow(emptyGarden(), night);
  saveGarden(file, garden);
  assert.deepEqual(loadGarden(file), garden);
});

test('recording a night away saves its plants to the file, creating the folder if needed', () => {
  const file = join(folder('record'), 'nested', 'garden.json');
  recordAbsence(file, night);
  const kinds = loadGarden(file).plants.map((plant) => plant.kind);
  assert.deepEqual(kinds, ['flower', 'golden-flower']);
});

test('a damaged garden file is never wiped or overwritten', () => {
  const file = join(folder('damaged'), 'garden.json');
  saveGarden(file, emptyGarden());
  writeFileSync(file, '{ this is not a garden');
  const before = readFileSync(file);

  assert.throws(() => loadGarden(file), /damaged/);
  assert.throws(() => saveGarden(file, grow(emptyGarden(), night)), /damaged/);
  assert.throws(() => recordAbsence(file, night), /damaged/);
  assert.deepEqual(readFileSync(file), before);
});

test('a garden file with a blank or broken entry counts as damaged and is left untouched', () => {
  const cases = { blank: '{"version":1,"plants":[null]}', broken: '{"version":1,"plants":[{"kind":"flower"}]}' };
  for (const [name, text] of Object.entries(cases)) {
    const file = join(folder(`entry-${name}`), 'garden.json');
    saveGarden(file, emptyGarden());
    writeFileSync(file, text);

    assert.throws(() => loadGarden(file), /damaged/);
    assert.throws(() => recordAbsence(file, night), /damaged/);
    assert.equal(readFileSync(file, 'utf8'), text);
  }
});

test('a garden file saved by Notepad or PowerShell (with an invisible BOM marker) loads normally', () => {
  const file = join(folder('bom'), 'garden.json');
  recordAbsence(file, night);
  writeFileSync(file, '﻿' + readFileSync(file, 'utf8'));
  assert.deepEqual(loadGarden(file).plants.map((plant) => plant.kind), ['flower', 'golden-flower']);
});

test('saving an empty garden over a full one keeps every plant, so it can never reset', () => {
  const file = join(folder('noreset'), 'garden.json');
  recordAbsence(file, night);
  const before = readFileSync(file);

  saveGarden(file, emptyGarden());
  assert.deepEqual(readFileSync(file), before);
});

test('two sessions saving from out-of-date copies keep both of their plants', () => {
  const file = join(folder('race'), 'garden.json');
  const sessionA = loadGarden(file);
  const sessionB = loadGarden(file);

  saveGarden(file, grow(sessionA, night));
  saveGarden(file, grow(sessionB, { leftAt: LEFT + 100 * HOUR, returnedAt: LEFT + 150 * HOUR }));
  assert.deepEqual(loadGarden(file).plants.map((plant) => plant.kind), ['flower', 'golden-flower', 'tree']);
});

test('saving leaves no temporary files behind', () => {
  const dir = folder('tidy');
  const file = join(dir, 'garden.json');
  recordAbsence(file, night);
  recordAbsence(file, { leftAt: LEFT + 48 * HOUR, returnedAt: LEFT + 90 * HOUR });
  assert.deepEqual(readdirSync(dir), ['garden.json']);
});
