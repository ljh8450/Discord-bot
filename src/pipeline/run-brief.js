const { normalizeOpportunity } = require('../domain/opportunity');

const DEFAULT_TERMS = [
  'ai', 'llm', 'agent', 'copilot', 'developer', 'engineering', 'software', 'coding',
  'api', 'model', 'gemini', 'gpt', 'open source', 'github', 'mcp', 'backend', 'frontend',
  '개발', '인공지능', '모델', '백엔드', '프론트엔드', '오픈소스', '클라우드', '보안',
];

const PRACTICAL_TERMS = [
  '구현', '사례', '도입', '운영', '마이그레이션', '성능', '최적화', '아키텍처', '장애',
  '튜토리얼', '회고', '분석', 'implementation', 'production', 'migration', 'performance',
  'architecture', 'incident', 'tutorial', 'benchmark',
];

function titleKey(value) {
  return String(value || '').toLowerCase()
    .replace(/^\s*(?:\[[^\]]+\]\s*)?(?:ai|it)\s*뉴스\s*[-:·]?\s*/i, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function scoreContent(item, now, terms = DEFAULT_TERMS) {
  const text = `${item.title} ${item.summary} ${item.tags.join(' ')}`.toLowerCase();
  const relevance = Math.min(4, terms.filter((term) => text.includes(term.toLowerCase())).length);
  const practicalMatches = PRACTICAL_TERMS.filter((term) => text.includes(term.toLowerCase())).length;
  const practicalValue = Math.min(
    3,
    Math.max(Number(item.attributes.practicalValue) || 0, practicalMatches),
  );
  const ageHours = (now.getTime() - new Date(item.publishedAt).getTime()) / 3_600_000;
  const freshness = ageHours <= 24 ? 3 : ageHours <= 48 ? 2 : 1;
  const authority = Math.max(0, Math.min(3, Number(item.attributes.authority) || 1));
  const community = Math.min(3, Math.floor((Number(item.attributes.communityPoints) || 0) / 10));
  const novelty = 2;
  return {
    total: relevance + practicalValue + freshness + authority + novelty + community,
    relevance, practicalValue, freshness, authority, novelty, community,
  };
}

async function runBrief(options) {
  const {
    rawItems, store, notify, now = new Date(), maxItems = 6, lookbackHours = 72,
    maxPerSource = 2, terms = DEFAULT_TERMS,
  } = options;
  const state = await store.load();
  const cutoff = now.getTime() - (lookbackHours * 60 * 60 * 1000);
  const candidatesByKey = new Map();
  const candidateUrls = new Set();
  const candidateTitles = new Set();
  const previouslySent = new Set(Object.values(state.opportunities)
    .filter((item) => item.type === 'CONTENT' && item.review?.status === 'SENT')
    .flatMap((item) => [item.canonicalUrl, titleKey(item.title)]).filter(Boolean));
  for (const raw of rawItems) {
    let item;
    try { item = normalizeOpportunity(raw, now); } catch { continue; }
    const publishedAt = new Date(item.publishedAt).getTime();
    if (!Number.isFinite(publishedAt) || publishedAt < cutoff || publishedAt > now.getTime()) continue;
    const text = `${item.title} ${item.summary} ${item.tags.join(' ')}`.toLowerCase();
    if (!terms.some((term) => text.includes(term.toLowerCase()))) continue;
    if (previouslySent.has(item.canonicalUrl) || previouslySent.has(titleKey(item.title))) continue;
    item.eventType = 'PUBLISHED';
    item.dedupeKey = `brief:${item.id}:${item.contentHash}`;
    const score = scoreContent(item, now, terms);
    item.attributes = { ...item.attributes, contentScore: score.total, contentScoreBreakdown: score };
    state.opportunities[item.id] = { ...item, review: { status: 'APPROVED', reason: '브리프 기준 통과' } };
    if (state.deliveries[item.dedupeKey]?.status === 'SENT') continue;
    const normalizedTitle = titleKey(item.title);
    if (candidateUrls.has(item.canonicalUrl) || candidateTitles.has(normalizedTitle)) continue;
    const key = normalizedTitle || item.canonicalUrl;
    candidatesByKey.set(key, item);
    candidateUrls.add(item.canonicalUrl);
    candidateTitles.add(normalizedTitle);
  }
  const candidates = [...candidatesByKey.values()].sort((left, right) => (
    right.attributes.contentScore - left.attributes.contentScore
      || new Date(right.publishedAt) - new Date(left.publishedAt)
  ));
  const sourceCounts = new Map();
  const selected = [];
  for (const item of candidates) {
    const count = sourceCounts.get(item.sourceId) || 0;
    if (count >= maxPerSource) continue;
    selected.push(item);
    sourceCounts.set(item.sourceId, count + 1);
    if (selected.length >= maxItems) break;
  }
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

module.exports = { DEFAULT_TERMS, PRACTICAL_TERMS, runBrief, scoreContent, titleKey };
