import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { emptyGarden, grow } from '../src/engine.js';
import { cardFile, gardenDir, gardenFile } from '../src/paths.js';
import { cardHtml } from '../src/render.js';
import { saveGarden } from '../src/store.js';

const SCRIPT = fileURLToPath(new URL('../scripts/card.js', import.meta.url));
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const FRI_7H = Date.parse('2026-11-06T07:00:00Z');

const root = mkdtempSync(join(tmpdir(), 'overnight-garden-card-'));
after(() => rmSync(root, { recursive: true, force: true }));

let homes = 0;
const newHome = () => {
  const home = join(root, `home-${++homes}`);
  mkdirSync(home);
  return home;
};

const garden = () =>
  [
    { leftAt: FRI_7H - 9 * HOUR, returnedAt: FRI_7H },
    { leftAt: FRI_7H + 11 * HOUR, returnedAt: FRI_7H + 3 * DAY + 2 * HOUR },
    { leftAt: FRI_7H + 4 * DAY, returnedAt: FRI_7H + 4 * DAY + 9 * HOUR, agentRunMs: 45 * MINUTE },
  ].reduce(grow, emptyGarden());

const plantCount = (html) => (html.match(/class="plant"/g) ?? []).length;

test('the card shows one plant for each plant grown, and when each one grew', () => {
  const html = cardHtml(garden());
  assert.equal(plantCount(html), 4);
  assert.match(html, /<span class="plant" title="flower, grew \d{1,2} Nov 2026">🌷<\/span>/);
  assert.match(html, /<span class="plant" title="golden flower, grew \d{1,2} Nov 2026">🌻<\/span>/);
  assert.match(html, /2 flowers · 1 tree · 1 golden flower/);
  assert.match(html, /Growing since \d{1,2} Nov 2026 · latest \d{1,2} Nov 2026/);
});

test('an empty garden gets a gentle card, not a nudge', () => {
  const html = cardHtml(emptyGarden());
  assert.equal(plantCount(html), 0);
  assert.match(html, /Nothing yet\./);
  assert.match(html, /Your first flower grows after a night away\./);
});

test('the card never shows raw text from the garden file', () => {
  const tampered = garden();
  tampered.title = '<script>alert("title")</script>';
  tampered.plants[0].label = '<img src=x onerror=alert(1)>';
  tampered.plants.push({ kind: '<b>weed</b>', leftAt: tampered.plants[0].leftAt, returnedAt: tampered.plants[0].returnedAt });

  const html = cardHtml(tampered);
  assert.equal(plantCount(html), 4);
  for (const stray of ['<script>', 'alert', 'onerror', 'weed']) assert.ok(!html.includes(stray), stray);
});

// Stand-in paintings: tiny but valid PNG data URIs, one per plant type.
const PAINTINGS = {
  flower: 'data:image/png;base64,Rmxvd2Vy',
  tree: 'data:image/png;base64,VHJlZQ==',
  'rare-plant': 'data:image/png;base64,UmFyZQ==',
  'golden-flower': 'data:image/png;base64,R29sZGVu',
};
const count = (text, part) => text.split(part).length - 1;

test('with paintings, each plant is shown as its watercolor, and each painting is stored once', () => {
  const html = cardHtml(garden(), PAINTINGS);
  assert.equal(plantCount(html), 4);
  assert.equal(count(html, '<span class="plant" data-plant="flower" role="img"'), 2);
  assert.equal(count(html, '<span class="plant" data-plant="tree" role="img"'), 1);
  assert.match(html, /aria-label="golden flower, grew \d{1,2} Nov 2026"/);
  for (const uri of Object.values(PAINTINGS)) assert.equal(count(html, uri), 1, uri);
  assert.ok(!html.includes('🌷'), 'no emoji when every plant has a painting');
});

test('paintings are only used for known plant types, and only if they are PNG images', () => {
  const html = cardHtml(garden(), {
    flower: 'javascript:alert(1)',
    tree: 'data:image/png;base64,AAAA");background:red;("',
    weed: 'data:image/png;base64,V2VlZA==',
  });
  assert.equal(plantCount(html), 4);
  for (const stray of ['javascript', 'background:red', 'weed', 'V2VlZA', 'data:image']) assert.ok(!html.includes(stray), stray);
  assert.match(html, /<span class="plant" title="flower, grew \d{1,2} Nov 2026">🌷<\/span>/);
});

test('the watercolor paintings that come with the garden are real 256x256 PNG images', () => {
  for (const kind of ['flower', 'tree', 'rare-plant', 'golden-flower']) {
    const png = readFileSync(new URL(`../assets/plants/${kind}.png`, import.meta.url));
    assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], `${kind} is a PNG`);
    assert.equal(png.readUInt32BE(16), 256, `${kind} width`);
    assert.equal(png.readUInt32BE(20), 256, `${kind} height`);
    assert.equal(png[25], 6, `${kind} has a transparent background (RGBA)`);
  }
});

test('the card script saves the card in ~/.claude/overnight-garden and prints where it is', () => {
  const home = newHome();
  saveGarden(gardenFile(home), garden());
  const result = spawnSync(process.execPath, [SCRIPT], {
    env: { ...process.env, HOME: home, USERPROFILE: home },
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `Your garden card: ${pathToFileURL(cardFile(home)).href}\n`);
  assert.equal(plantCount(readFileSync(cardFile(home), 'utf8')), 4);
});

test('the card script paints the card with the watercolors that come with the garden', () => {
  const home = newHome();
  saveGarden(gardenFile(home), garden());
  const result = spawnSync(process.execPath, [SCRIPT], { env: { ...process.env, HOME: home, USERPROFILE: home } });
  assert.equal(result.status, 0);

  const html = readFileSync(cardFile(home), 'utf8');
  assert.equal(count(html, 'url("data:image/png;base64,'), 4, 'one painting per plant type');
  assert.equal(count(html, '<span class="plant" data-plant='), 4);
});

test('with a damaged garden file, the card script says why and keeps the card you already had', () => {
  const home = newHome();
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  saveGarden(gardenFile(home), garden());
  assert.equal(spawnSync(process.execPath, [SCRIPT], { env }).status, 0);
  mkdirSync(gardenDir(home), { recursive: true });
  writeFileSync(gardenFile(home), '{ damaged');

  const result = spawnSync(process.execPath, [SCRIPT], { env, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /couldn't be read/);
  assert.equal(plantCount(readFileSync(cardFile(home), 'utf8')), 4);
  assert.equal(readFileSync(gardenFile(home), 'utf8'), '{ damaged');
});
