const assert = require('node:assert/strict');
const test = require('node:test');

const { runBrief, scoreContent, titleKey } = require('../src/pipeline/run-brief');

class MemoryStore {
  constructor() { this.state = { opportunities: {}, deliveries: {}, pending: {}, feedback: [] }; }
  async load() { return structuredClone(this.state); }
  async save(state) { this.state = structuredClone(state); }
}

test('bundles recent relevant official content only once', async () => {
  const store = new MemoryStore();
  const sent = [];
  const rawItems = [{
    type: 'CONTENT', sourceId: 'official', externalId: 'post-1',
    url: 'https://example.com/ai-agent', title: 'AI agent API update', organization: 'Official',
    status: 'OPEN', publishedAt: '2026-07-20T00:00:00Z', tags: ['AI'],
    summary: 'Developer API and coding agent improvements', summaryEvidence: ['https://example.com/ai-agent'],
  }];
  const notify = async (items) => { sent.push(items); return { id: 'brief-message' }; };
  const now = new Date('2026-07-20T12:00:00Z');
  const first = await runBrief({ rawItems, store, notify, now });
  const second = await runBrief({ rawItems, store, notify, now });
  assert.equal(first.sent, 1);
  assert.equal(second.sent, 0);
  assert.equal(sent.length, 1);
});

test('scores practical authoritative content above a generic update', () => {
  const now = new Date('2026-07-20T12:00:00Z');
  const base = {
    title: 'AI backend update', summary: 'Developer software update', tags: ['AI'],
    publishedAt: '2026-07-20T10:00:00Z', attributes: {},
  };
  const generic = scoreContent(base, now);
  const practical = scoreContent({
    ...base,
    title: 'AI backend production migration case study',
    summary: '실서비스 도입과 성능 최적화 사례',
    attributes: { authority: 3, practicalValue: 3 },
  }, now);
  assert.ok(practical.total > generic.total);
});

test('deduplicates equivalent AI and IT news video titles', () => {
  assert.equal(
    titleKey('AI뉴스 - Kimi K3와 개발 도구 업데이트'),
    titleKey('IT뉴스 - Kimi K3와 개발 도구 업데이트'),
  );
});

test('keeps one brief item when normalized titles match across different URLs', async () => {
  const store = new MemoryStore();
  let sent = [];
  const base = {
    type: 'CONTENT', sourceId: 'youtube', organization: 'Video', status: 'OPEN',
    publishedAt: '2026-07-20T10:00:00Z', tags: ['AI'], summary: 'AI 개발 뉴스',
    summaryEvidence: ['https://example.com/evidence'],
  };
  await runBrief({
    rawItems: [
      { ...base, externalId: 'a', url: 'https://example.com/a', title: 'AI뉴스 - Agent 업데이트' },
      { ...base, externalId: 'b', url: 'https://example.com/b', title: 'IT뉴스 - Agent 업데이트' },
    ],
    store,
    now: new Date('2026-07-20T12:00:00Z'),
    notify: async (items) => { sent = items; return {}; },
  });
  assert.equal(sent.length, 1);
});

test('balances the daily brief across sources', async () => {
  const store = new MemoryStore();
  const sent = [];
  const rawItems = Array.from({ length: 5 }, (_, index) => ({
    type: 'CONTENT', sourceId: index < 4 ? 'source-a' : 'source-b', externalId: `post-${index}`,
    url: `https://example.com/${index}`, title: `AI backend implementation ${index}`,
    organization: 'Tech Blog', status: 'OPEN', publishedAt: `2026-07-20T0${index}:00:00Z`,
    tags: ['AI'], summary: 'Production developer implementation case study',
    summaryEvidence: [`https://example.com/${index}`],
    attributes: { authority: 3, practicalValue: 3 },
  }));
  await runBrief({
    rawItems, store, now: new Date('2026-07-20T12:00:00Z'), maxItems: 4, maxPerSource: 2,
    notify: async (items) => { sent.push(...items); return { id: 'brief' }; },
  });
  assert.equal(sent.filter((item) => item.sourceId === 'source-a').length, 2);
  assert.equal(sent.filter((item) => item.sourceId === 'source-b').length, 1);
});
