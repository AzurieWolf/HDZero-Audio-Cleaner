const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { moveOriginalVideo } = require('../file-organization');

test('moves a source video into a sibling Original folder', async (context) => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'hdzero-original-test-'));
  context.after(() => fs.promises.rm(directory, { recursive: true, force: true }));
  const source = path.join(directory, 'flight.mp4');
  await fs.promises.writeFile(source, 'source');

  const moved = await moveOriginalVideo(source);

  assert.equal(moved, path.join(directory, 'Original', 'flight.mp4'));
  assert.equal(await fs.promises.readFile(moved, 'utf8'), 'source');
  assert.equal(fs.existsSync(source), false);
});

test('adds a numbered suffix instead of overwriting an archived original', async (context) => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'hdzero-original-test-'));
  context.after(() => fs.promises.rm(directory, { recursive: true, force: true }));
  const originalDirectory = path.join(directory, 'Original');
  const source = path.join(directory, 'flight.mp4');
  await fs.promises.mkdir(originalDirectory);
  await fs.promises.writeFile(path.join(originalDirectory, 'flight.mp4'), 'existing');
  await fs.promises.writeFile(source, 'new');

  const moved = await moveOriginalVideo(source);

  assert.equal(moved, path.join(originalDirectory, 'flight-2.mp4'));
  assert.equal(await fs.promises.readFile(path.join(originalDirectory, 'flight.mp4'), 'utf8'), 'existing');
  assert.equal(await fs.promises.readFile(moved, 'utf8'), 'new');
});

test('leaves a video in place when it is already inside an Original folder', async (context) => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'hdzero-original-test-'));
  context.after(() => fs.promises.rm(directory, { recursive: true, force: true }));
  const originalDirectory = path.join(directory, 'Original');
  const source = path.join(originalDirectory, 'flight.mp4');
  await fs.promises.mkdir(originalDirectory);
  await fs.promises.writeFile(source, 'source');

  const moved = await moveOriginalVideo(source);

  assert.equal(moved, source);
  assert.equal(await fs.promises.readFile(source, 'utf8'), 'source');
});
