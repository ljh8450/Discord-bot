const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createEmptyState,
  hydrateState,
} = require('../src/store/state-contract');

test('creates the current snapshot state shape without enabling deferred features', () => {
  assert.deepEqual(createEmptyState(), {
    opportunities: {},
    deliveries: {},
    pending: {},
    feedback: [],
  });
});

test('hydrates older state files with missing current collections', () => {
  const state = hydrateState({
    opportunities: { one: { id: 'one' } },
    deliveries: {},
  });

  assert.deepEqual(state.pending, {});
  assert.deepEqual(state.feedback, []);
  assert.equal(state.opportunities.one.id, 'one');
});

test('rejects malformed state collections instead of silently replacing them', () => {
  assert.throws(
    () => hydrateState({ opportunities: [], deliveries: {}, pending: {}, feedback: [] }),
    /state.opportunities must be an object/,
  );
});
