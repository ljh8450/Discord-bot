const assert = require('node:assert/strict');
const test = require('node:test');

const { partitionLegacyState } = require('../src/store/state-partition');

test('partitions opportunities and their related state by content type', () => {
  const job = { id: 'job-1', type: 'JOB' };
  const content = { id: 'content-1', type: 'CONTENT' };
  const { radarState, briefState } = partitionLegacyState({
    opportunities: { [job.id]: job, [content.id]: content },
    deliveries: {
      'job-delivery': { opportunityId: job.id, status: 'SENT' },
      'content-delivery': { opportunityId: content.id, status: 'SENT' },
      'brief:orphan': { status: 'SENT' },
    },
    pending: {
      [job.id]: { reason: 'radar review' },
      [content.id]: { reason: 'brief review' },
    },
    feedback: [
      { opportunityId: job.id, value: 'useful' },
      { opportunityId: content.id, value: 'useful' },
    ],
  });

  assert.deepEqual(Object.keys(radarState.opportunities), [job.id]);
  assert.deepEqual(Object.keys(briefState.opportunities), [content.id]);
  assert.deepEqual(Object.keys(radarState.deliveries), ['job-delivery']);
  assert.deepEqual(
    Object.keys(briefState.deliveries),
    ['content-delivery', 'brief:orphan'],
  );
  assert.deepEqual(Object.keys(radarState.pending), [job.id]);
  assert.deepEqual(Object.keys(briefState.pending), [content.id]);
  assert.equal(radarState.feedback.length, 1);
  assert.equal(briefState.feedback.length, 1);
});