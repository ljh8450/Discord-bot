const { normalizeOpportunity } = require('../domain/opportunity');

const DEFAULT_TERMS = [
  'ai', 'llm', 'agent', 'copilot', 'developer', 'engineering', 'software', 'coding',
  'api', 'model', 'gemini', 'gpt', 'open source', 'github', '개발', '인공지능', '모델',
];

async function runBrief(options) {
  const {
    rawItems, store, notify, now = new Date(), maxItems = 6, lookbackHours = 72,
    terms = DEFAULT_TERMS,
  } = options;
  const state = await store.load();
  const cutoff = now.getTime() - (lookbackHours * 60 * 60 * 1000);
  const candidates = [];
  for (const raw of rawItems) {
    let item;
    try { item = normalizeOpportunity(raw, now); } catch { continue; }
    const publishedAt = new Date(item.publishedAt).getTime();
    if (!Number.isFinite(publishedAt) || publishedAt < cutoff || publishedAt > now.getTime()) continue;
    const text = `${item.title} ${item.summary} ${item.tags.join(' ')}`.toLowerCase();
    if (!terms.some((term) => text.includes(term.toLowerCase()))) continue;
    item.eventType = 'PUBLISHED';
    item.dedupeKey = `brief:${item.id}:${item.contentHash}`;
    state.opportunities[item.id] = { ...item, review: { status: 'APPROVED', reason: '브리프 기준 통과' } };
    if (state.deliveries[item.dedupeKey]?.status !== 'SENT') candidates.push(item);
  }
  const selected = candidates
    .sort((left, right) => new Date(right.publishedAt) - new Date(left.publishedAt))
    .slice(0, maxItems);
  if (!selected.length) {
    await store.save(state);
    return { discovered: candidates.length, selected: 0, sent: 0, failed: 0 };
  }
  let message;
  try {
    message = await notify(selected);
  } catch (error) {
    for (const item of selected) {
      state.deliveries[item.dedupeKey] = {
        status: 'FAILED', opportunityId: item.id, attemptedAt: now.toISOString(), error: error.message,
      };
    }
    await store.save(state);
    return { discovered: candidates.length, selected: selected.length, sent: 0, failed: selected.length };
  }
  for (const item of selected) {
    state.deliveries[item.dedupeKey] = {
      status: 'SENT', opportunityId: item.id, sentAt: now.toISOString(), messageId: message?.id || null,
    };
    state.opportunities[item.id].review.status = 'SENT';
  }
  await store.save(state);
  return { discovered: candidates.length, selected: selected.length, sent: selected.length, failed: 0 };
}

module.exports = { DEFAULT_TERMS, runBrief };
