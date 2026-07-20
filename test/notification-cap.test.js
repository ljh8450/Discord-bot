const assert = require('node:assert/strict');
const test = require('node:test');

const profile = require('../config/profile.json');
const { runRadar } = require('../src/pipeline/run-radar');

class MemoryStore {
  constructor() { this.state = { opportunities: {}, deliveries: {}, pending: {}, feedback: [] }; }
  async load() { return structuredClone(this.state); }
  async save(state) { this.state = structuredClone(state); }
}

function education(id) {
  return {
    type: 'EDUCATION', sourceId: 'education-source', externalId: id,
    url: `https://example.com/education/${id}`, title: `개발 멘토링 ${id}`,
    organization: '예시 기관', status: 'OPEN', closesAt: '2026-08-20T23:59:59+09:00',
    locations: ['서울'], eligibility: [], tags: ['개발'], summary: '개발 멘토링 프로그램',
    summaryEvidence: [`https://example.com/education/${id}`],
    attributes: { immediateCategory: true },
  };
}

test('enforces a user-facing per-category cap below the global cap', async () => {
  const sent = [];
  const report = await runRadar({
    rawItems: [education('1'), education('2')], profile, store: new MemoryStore(),
    now: new Date('2026-07-20T00:00:00Z'), maxNotifications: 10,
    maxNotificationsByType: { EDUCATION: 1 },
    notify: async (item) => { sent.push(item.externalId); return { id: item.externalId }; },
  });

  assert.deepEqual(sent, ['1']);
  assert.equal(report.sentByType.EDUCATION, 1);
  assert.equal(report.deferredByType.EDUCATION, 1);
});
