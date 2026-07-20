const assert = require('node:assert/strict');
const test = require('node:test');

const profile = require('../config/profile.json');
const { balanceByType, runRadar } = require('../src/pipeline/run-radar');

class MemoryStore {
  constructor() { this.state = { opportunities: {}, deliveries: {}, pending: {}, feedback: [] }; }
  async load() { return structuredClone(this.state); }
  async save(state) { this.state = structuredClone(state); }
}

function raw(type, id, overrides = {}) {
  return {
    type, sourceId: `source-${type}`, externalId: id,
    url: `https://example.com/${type}/${id}`, title: `${type} ${id}`,
    organization: '예시 기관', status: 'OPEN', closesAt: '2026-08-20T23:59:59+09:00',
    locations: ['서울'], eligibility: [], tags: ['개발'],
    summary: '개발 결과물을 만드는 프로그램',
    summaryEvidence: [`https://example.com/${type}/${id}`],
    attributes: {}, ...overrides,
  };
}

test('round-robins scarce categories ahead of an education backlog', () => {
  const ordered = balanceByType([
    raw('EDUCATION', 'e1'), raw('EDUCATION', 'e2'), raw('EDUCATION', 'e3'),
    raw('HACKATHON', 'h1'), raw('HACKATHON', 'h2'),
    raw('JOB', 'j1'), raw('EXTERNAL_ACTIVITY', 'a1'),
  ]);
  assert.deepEqual(ordered.map((item) => item.externalId), ['h1', 'j1', 'a1', 'e1', 'h2', 'e2', 'e3']);
});

test('gives each approved category one notification before education repeats', async () => {
  const store = new MemoryStore();
  const sent = [];
  const items = [
    raw('EDUCATION', 'e1', { attributes: { immediateCategory: true } }),
    raw('EDUCATION', 'e2', { attributes: { immediateCategory: true } }),
    raw('HACKATHON', 'h1', { attributes: { developmentOutput: true } }),
    raw('EXTERNAL_ACTIVITY', 'a1', { attributes: { immediateCategory: true } }),
    raw('JOB', 'j1', {
      title: '신입 백엔드 개발자', organization: '카카오',
      locations: ['서울'], eligibility: ['신입'], tags: ['백엔드'],
      summary: '서비스 API를 개발하는 직무',
    }),
  ];
  const report = await runRadar({
    rawItems: items, profile, store, now: new Date('2026-07-20T00:00:00Z'),
    maxNotifications: 4,
    notify: async (item) => { sent.push(item.type); return { id: String(sent.length) }; },
  });

  assert.deepEqual(sent, ['HACKATHON', 'JOB', 'EXTERNAL_ACTIVITY', 'EDUCATION']);
  assert.deepEqual(report.sentByType, {
    HACKATHON: 1, JOB: 1, EXTERNAL_ACTIVITY: 1, EDUCATION: 1,
  });
  assert.equal(report.deferredByType.EDUCATION, 1);
});
