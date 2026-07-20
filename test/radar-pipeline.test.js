const assert = require('node:assert/strict');
const test = require('node:test');

const profile = require('../config/profile.json');
const { runRadar } = require('../src/pipeline/run-radar');

class MemoryStore {
  constructor() { this.state = { opportunities: {}, deliveries: {}, pending: {}, feedback: [] }; }
  async load() { return structuredClone(this.state); }
  async save(state) { this.state = structuredClone(state); }
}

const now = new Date('2026-07-20T00:00:00Z');
function rawJob(overrides = {}) {
  return {
    type: 'JOB', sourceId: 'official-careers', externalId: 'job-1',
    url: 'https://example.com/jobs/1', title: '신입 백엔드 개발자', organization: '예시테크',
    status: 'OPEN', locations: ['서울'], eligibility: ['신입'], tags: ['백엔드'],
    summary: '결제 API를 개발하는 포지션', summaryEvidence: ['https://example.com/jobs/1'],
    closesAt: '2026-08-01T18:00:00+09:00', ...overrides,
  };
}

test('sends a matching opportunity exactly once', async () => {
  const store = new MemoryStore();
  const sent = [];
  const notify = async (item) => { sent.push(item); return { id: 'message-1' }; };
  const first = await runRadar({ rawItems: [rawJob()], profile, store, notify, now });
  const second = await runRadar({ rawItems: [rawJob()], profile, store, notify, now });
  assert.equal(first.sent, 1);
  assert.equal(second.sent, 0);
  assert.equal(sent.length, 1);
  assert.equal(Object.values(store.state.opportunities)[0].review.status, 'SENT');
});

test('sends one UPDATED event when important content changes', async () => {
  const store = new MemoryStore();
  const sent = [];
  const notify = async (item) => { sent.push(item); return { id: `message-${sent.length}` }; };

  await runRadar({ rawItems: [rawJob()], profile, store, notify, now });
  const changed = rawJob({
    summary: '변경된 결제·정산 API를 개발하는 포지션',
    closesAt: '2026-08-05T18:00:00+09:00',
  });
  const update = await runRadar({ rawItems: [changed], profile, store, notify, now });
  const repeated = await runRadar({ rawItems: [changed], profile, store, notify, now });

  assert.equal(update.sent, 1);
  assert.equal(repeated.sent, 0);
  assert.equal(sent.length, 2);
  assert.equal(sent[1].eventType, 'UPDATED');
  assert.match(sent[1].dedupeKey, /^updated:/);
});

test('retries a Discord delivery that failed', async () => {
  const store = new MemoryStore();
  let attempts = 0;
  const notify = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('temporary failure');
    return { id: 'message-2' };
  };
  const failed = await runRadar({ rawItems: [rawJob()], profile, store, notify, now });
  assert.equal(Object.values(store.state.deliveries)[0].status, 'FAILED');
  const recovered = await runRadar({ rawItems: [rawJob()], profile, store, notify, now });
  assert.equal(failed.failed, 1);
  assert.equal(recovered.sent, 1);
  assert.equal(attempts, 2);
});

test('holds conditional education for one run before benefit review', async () => {
  const store = new MemoryStore();
  const sent = [];
  const education = {
    type: 'EDUCATION', sourceId: 'official-program', externalId: 'education-1',
    url: 'https://example.com/programs/1', title: '유료 개발 부트캠프', organization: '교육기관',
    status: 'OPEN', summary: '현직자 멘토링과 프로젝트를 제공하는 과정',
    summaryEvidence: ['https://example.com/programs/1'], closesAt: '2026-08-01T18:00:00+09:00',
    attributes: { freeOrFunded: true, industryMentoring: true, portfolioProject: true },
  };
  const notify = async (item) => { sent.push(item); return { id: 'message-3' }; };
  const first = await runRadar({ rawItems: [education], profile, store, notify, now });
  const second = await runRadar({ rawItems: [education], profile, store, notify, now });
  assert.equal(first.pending, 1);
  assert.equal(second.sent, 1);
  assert.equal(sent.length, 1);
});
