const assert = require('node:assert/strict');
const test = require('node:test');

const { buildWebhookPayload } = require('../src/discord/notifier');
const { normalizeOpportunity } = require('../src/domain/opportunity');

test('builds a compact Discord message with action links', () => {
  const opportunity = normalizeOpportunity({
    type: 'JOB', sourceId: 'careers', externalId: '1', url: 'https://example.com/jobs/1',
    title: '신입 백엔드 개발자', organization: '예시테크', locations: ['서울'], eligibility: ['신입'],
    summary: '주문 플랫폼 개발 포지션', summaryEvidence: ['https://example.com/jobs/1'],
    closesAt: '2026-07-31T18:00:00+09:00',
  });
  const payload = buildWebhookPayload(opportunity, {
    timezone: 'Asia/Seoul', feedbackBaseUrl: 'https://feedback.example.com/callback',
  });
  assert.match(payload.embeds[0].title, /신입 채용/);
  assert.match(payload.embeds[0].description, /한 줄: 주문 플랫폼/);
  assert.deepEqual(payload.components[0].components.map(({ label }) => label), [
    '공고 보기', '관심 있어요', '지원했어요', '관련 없어요',
  ]);
});
