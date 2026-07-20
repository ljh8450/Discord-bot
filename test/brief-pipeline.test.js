const assert = require('node:assert/strict');
const test = require('node:test');

const { runBrief } = require('../src/pipeline/run-brief');

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
