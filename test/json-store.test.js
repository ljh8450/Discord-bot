const assert = require('node:assert/strict');
const { mkdtemp } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { JsonStore } = require('../src/store/json-store');

test('persists state atomically across repeated saves', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'radar-state-'));
  const store = new JsonStore(path.join(directory, 'state.json'));
  const initial = await store.load();
  initial.deliveries.first = { status: 'FAILED' };
  await store.save(initial);

  const next = await store.load();
  next.deliveries.first.status = 'SENT';
  await store.save(next);

  assert.equal((await store.load()).deliveries.first.status, 'SENT');
});
