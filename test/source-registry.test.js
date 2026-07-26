const assert = require('node:assert/strict');
const test = require('node:test');

const { mergeSourceDefinitions } = require('../src/config/source-registry');

test('overrides a built-in source by id while preserving adapter defaults', () => {
  const merged = mergeSourceDefinitions(
    [{
      id: 'news', kind: 'rss', enabled: true, priority: 50,
      tags: ['default'], options: { retries: 3 },
    }],
    [{ id: 'news', enabled: false, priority: 90, tags: ['configured'] }],
  );

  assert.deepEqual(merged, [{
    id: 'news',
    kind: 'rss',
    enabled: false,
    priority: 90,
    tags: ['configured'],
    options: { retries: 3 },
  }]);
});

test('appends a configured source that is not built in', () => {
  const merged = mergeSourceDefinitions(
    [{ id: 'built-in', kind: 'rss', enabled: true }],
    [{ id: 'custom', kind: 'json', enabled: false, url: 'https://example.com/feed' }],
  );

  assert.deepEqual(merged.map((source) => source.id), ['built-in', 'custom']);
});

test('rejects duplicate source ids within the same definition layer', () => {
  assert.throws(
    () => mergeSourceDefinitions([
      { id: 'duplicate', kind: 'rss' },
      { id: 'duplicate', kind: 'youtube' },
    ]),
    /duplicate source id in built-in sources: duplicate/,
  );
  assert.throws(
    () => mergeSourceDefinitions([], [
      { id: 'duplicate', kind: 'rss' },
      { id: 'duplicate', kind: 'youtube' },
    ]),
    /duplicate source id in configured sources: duplicate/,
  );
});

test('requires new configured sources to provide an adapter kind', () => {
  assert.throws(
    () => mergeSourceDefinitions([], [{ id: 'missing-kind', enabled: true }]),
    /source kind is required: missing-kind/,
  );
});
