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

test('sends an equivalent job from multiple sources only on its first discovery', async () => {
  const store = new MemoryStore();
  const sent = [];
  const notify = async (item) => {
    sent.push(item.sourceId);
    return { id: `message-${sent.length}` };
  };
  const official = rawJob();
  const aggregator = rawJob({
    sourceId: 'zighang-entry-developers',
    externalId: 'zighang-job-1',
    url: 'https://aggregator.example/recruitment/1',
  });

  const report = await runRadar({
    rawItems: [official, aggregator], profile, store, notify, now,
  });

  assert.equal(report.sent, 1);
  assert.equal(report.duplicates, 1);
  assert.deepEqual(sent, ['official-careers']);
  const duplicate = Object.values(store.state.opportunities)
    .find((item) => item.sourceId === 'zighang-entry-developers');
  assert.equal(duplicate.review.status, 'SENT');
  assert.match(duplicate.review.reason, /동일 채용공고/);
  assert.equal(store.state.deliveries[duplicate.dedupeKey].suppressedDuplicate, true);
});

test('does not resend an opportunity when important content changes', async () => {
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

  assert.equal(update.sent, 0);
  assert.equal(repeated.sent, 0);
  assert.equal(sent.length, 1);
  assert.equal(Object.values(store.state.opportunities)[0].summary, changed.summary);
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

test('refreshes lastSeenAt and closes an item after repeated source absence', async () => {
  const store = new MemoryStore();
  const notify = async () => ({ id: 'message' });
  await runRadar({ rawItems: [rawJob()], profile, store, notify, now });
  const later = new Date('2026-07-20T01:00:00Z');
  await runRadar({ rawItems: [rawJob()], profile, store, notify, now: later });
  let [item] = Object.values(store.state.opportunities);
  assert.equal(item.lastSeenAt, later.toISOString());

  for (let index = 0; index < 3; index += 1) {
    await runRadar({
      rawItems: [], profile, store, notify, now: later,
      checkedSourceIds: ['official-careers'], missingThreshold: 3,
    });
  }
  [item] = Object.values(store.state.opportunities);
  assert.equal(item.status, 'CLOSED');
  assert.equal(item.lifecycle.closeReason, '공식 출처에서 연속 미확인');
});

test('does not send an approved opportunity when its source URL is unavailable', async () => {
  const store = new MemoryStore();
  let sent = 0;
  const report = await runRadar({
    rawItems: [rawJob()], profile, store, now,
    notify: async () => { sent += 1; },
    verifyOpportunityUrl: async () => ({ ok: false, status: 404 }),
  });
  assert.equal(sent, 0);
  assert.equal(report.rejected, 1);
  assert.match(Object.values(store.state.opportunities)[0].review.reason, /HTTP 404/);
});

test('does not send deadline reminders after the first notification', async () => {
  const store = new MemoryStore();
  const sent = [];
  const notify = async (item) => {
    sent.push({ eventType: item.eventType, deadlineStage: item.deadlineStage });
    return { id: `message-${sent.length}` };
  };
  const job = rawJob({ closesAt: '2026-07-23T18:00:00+09:00' });

  await runRadar({
    rawItems: [job], profile, store, notify,
    now: new Date('2026-07-19T00:00:00Z'),
  });
  const d3 = await runRadar({ rawItems: [job], profile, store, notify, now });
  const d1 = await runRadar({
    rawItems: [job], profile, store, notify,
    now: new Date('2026-07-22T00:00:00Z'),
  });
  const sameDay = await runRadar({
    rawItems: [job], profile, store, notify,
    now: new Date('2026-07-23T00:00:00Z'),
  });

  assert.equal(d3.sent, 0);
  assert.equal(d1.sent, 0);
  assert.equal(sameDay.sent, 0);
  assert.deepEqual(sent.map((item) => item.deadlineStage), [undefined]);
});

test('defers notifications beyond the per-run limit and sends them next run', async () => {
  const store = new MemoryStore();
  const sent = [];
  const notify = async (item) => {
    sent.push(item.externalId);
    return { id: `message-${sent.length}` };
  };
  const jobs = [
    rawJob({ externalId: 'job-1' }),
    rawJob({ externalId: 'job-2', url: 'https://example.com/jobs/2' }),
  ];
  const limited = await runRadar({
    rawItems: jobs, profile, store, notify, now, maxNotifications: 1,
  });
  const next = await runRadar({
    rawItems: jobs, profile, store, notify, now, maxNotifications: 1,
  });

  assert.equal(limited.sent, 1);
  assert.equal(limited.deferred, 1);
  assert.equal(next.sent, 1);
  assert.deepEqual(sent, ['job-1', 'job-2']);
});
