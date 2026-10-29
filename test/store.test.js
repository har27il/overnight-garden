import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs, { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

test('recording a night away reads the file once and hands back exactly what it saved', (t) => {
  const file = join(folder('one-read'), 'garden.json');
  recordAbsence(file, { leftAt: LEFT + 100 * HOUR, returnedAt: LEFT + 150 * HOUR });

  const reads = t.mock.method(fs, 'readFileSync');
  syncBuiltinESMExports(); // Points store.js's readFileSync import at the spy.
  let returned;
  try {
    returned = recordAbsence(file, night);
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }

  assert.equal(reads.mock.calls.filter((call) => call.arguments[0] === file).length, 1);
  assert.deepEqual(returned, loadGarden(file));
});

test('saving waits and retries when Windows briefly holds the file, so the night is not lost', (t) => {
  const file = join(folder('busy'), 'garden.json');
  const realRename = fs.renameSync;
  let refusals = 2;
  t.mock.method(fs, 'renameSync', (from, to) => {
    if (refusals-- > 0) throw Object.assign(new Error('EPERM: operation not permitted, rename'), { code: 'EPERM' });
    return realRename(from, to);
  });
  syncBuiltinESMExports(); // Points store.js's renameSync import at the stand-in.
  try {
    recordAbsence(file, night);
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }

  assert.deepEqual(loadGarden(file).plants.map((plant) => plant.kind), ['flower', 'golden-flower']);
});

test('a damaged garden file is never wiped or overwritten', () => {
  const file = join(folder('damaged'), 'garden.json');
  mkdirSync(dirname(file), { recursive: true });
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
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);

    assert.throws(() => loadGarden(file), /damaged/);
    assert.throws(() => recordAbsence(file, night), /damaged/);
    assert.equal(readFileSync(file, 'utf8'), text);
  }
});

test('a garden file with an unknown plant type or a made-up date counts as damaged', () => {
  const time = '2026-10-29T22:00:00.000Z';
  const cases = {
    'unknown-kind': { kind: 'flowr', leftAt: time, returnedAt: time },
    'made-up-date': { kind: 'flower', leftAt: '1', returnedAt: time },
  };
  for (const [name, plant] of Object.entries(cases)) {
    const file = join(folder(name), 'garden.json');
    const text = JSON.stringify({ version: 1, plants: [plant] });
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);

    assert.throws(() => loadGarden(file), /damaged/, name);
    assert.equal(readFileSync(file, 'utf8'), text);
  }
});

test('loading keeps only the fields the garden knows about, so stray text never travels on', () => {
  const file = join(folder('extra-fields'), 'garden.json');
  recordAbsence(file, night);
  const garden = JSON.parse(readFileSync(file, 'utf8'));
  const stray = String.fromCharCode(27) + ']0;not part of the garden' + String.fromCharCode(7);
  garden.title = stray;
  garden.plants[0].label = stray;
  writeFileSync(file, JSON.stringify(garden));

  assert.deepEqual(loadGarden(file), { version: 1, plants: grow(emptyGarden(), night).plants });
});

test('a garden file saved by Notepad or PowerShell (with an invisible BOM marker) loads normally', () => {
  const file = join(folder('bom'), 'garden.json');
  recordAbsence(file, night);
  writeFileSync(file, String.fromCharCode(0xfeff) + readFileSync(file, 'utf8'));
  assert.deepEqual(loadGarden(file).plants.map((plant) => plant.kind), ['flower', 'golden-flower']);
});

test('a garden file saved by PowerShell 5.1 (UTF-16 format) loads normally', () => {
  const file = join(folder('utf16'), 'garden.json');
  recordAbsence(file, night);
  const text = readFileSync(file, 'utf8');
  writeFileSync(file, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]));
  assert.deepEqual(loadGarden(file).plants.map((plant) => plant.kind), ['flower', 'golden-flower']);
});

test('the code contains no invisible characters an editor could silently strip', () => {
  const repo = fileURLToPath(new URL('..', import.meta.url));
  const invisible = [0x200b, 0x200c, 0x200d, 0x2060, 0xfeff];
  for (const dir of ['src', 'test', 'scripts', 'tools']) {
    for (const name of readdirSync(join(repo, dir))) {
      const text = readFileSync(join(repo, dir, name), 'utf8');
      const found = [...text].filter((char) => invisible.includes(char.codePointAt(0)));
      assert.equal(found.length, 0, `${dir}/${name} contains ${found.length} invisible character(s)`);
    }
  }
});

test('saving an empty garden over a full one keeps every plant, so it can never reset', () => {
  const file = join(folder('noreset'), 'garden.json');
  recordAbsence(file, night);
  const before = readFileSync(file);

  saveGarden(file, emptyGarden());
  assert.deepEqual(readFileSync(file), before);
});

test('saving a garden with an invalid plant is refused, leaving the file untouched', () => {
  const file = join(folder('bad-save'), 'garden.json');
  recordAbsence(file, night);
  const before = readFileSync(file);
  const numericTimes = { kind: 'flower', leftAt: LEFT + 48 * HOUR, returnedAt: LEFT + 60 * HOUR };

  assert.throws(() => saveGarden(file, { version: 1, plants: [numericTimes] }), /invalid/);
  assert.deepEqual(readFileSync(file), before);
});

test('saving plants that are already in the garden leaves the file alone', (t) => {
  const file = join(folder('no-op'), 'garden.json');
  const garden = recordAbsence(file, night);

  const renames = t.mock.method(fs, 'renameSync');
  syncBuiltinESMExports(); // Points store.js's renameSync import at the spy.
  try {
    saveGarden(file, garden);
    recordAbsence(file, night);
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }

  assert.equal(renames.mock.callCount(), 0);
});

test('two sessions saving from out-of-date copies keep both of their plants', () => {
  const file = join(folder('race'), 'garden.json');
  const sessionA = loadGarden(file);
  const sessionB = loadGarden(file);

  saveGarden(file, grow(sessionA, night));
  saveGarden(file, grow(sessionB, { leftAt: LEFT + 100 * HOUR, returnedAt: LEFT + 150 * HOUR }));
  assert.deepEqual(loadGarden(file).plants.map((plant) => plant.kind), ['flower', 'golden-flower', 'tree']);
});

test('two windows saving the same night at the same moment count it once', () => {
  const file = join(folder('same-night'), 'garden.json');
  const windowA = loadGarden(file);
  const windowB = loadGarden(file);

  saveGarden(file, grow(windowA, night));
  saveGarden(file, grow(windowB, { ...night, leftAt: LEFT + 5 * 60 * 1000 }));
  assert.deepEqual(loadGarden(file).plants.map((plant) => plant.kind), ['flower', 'golden-flower']);
});

test('saving leaves no temporary files behind', () => {
  const dir = folder('tidy');
  const file = join(dir, 'garden.json');
  recordAbsence(file, night);
  recordAbsence(file, { leftAt: LEFT + 48 * HOUR, returnedAt: LEFT + 90 * HOUR });
  assert.deepEqual(readdirSync(dir), ['garden.json']);
});
