const assert = require('node:assert/strict');
const test = require('node:test');

const { buildOpportunityDigest } = require('../src/discord/digest');

test('bundles opportunities as one linked summary line per item', () => {
  const payload = buildOpportunityDigest([
    {
      title: '신입 백엔드 개발자',
      canonicalUrl: 'https://example.com/jobs/1',
      summary: '결제 API를 개발하는 포지션',
      eligibility: ['신입'],
      locations: ['서울'],
      closesAt: '2026-07-31T18:00:00+09:00',
    },
    {
      title: 'AI Engineer 인턴',
      canonicalUrl: 'https://example.com/jobs/2',
      summary: 'LLM 평가 파이프라인을 개발하는 인턴',
      eligibility: ['인턴'],
      locations: ['경기'],
      closesAt: null,
    },
  ], { timezone: 'Asia/Seoul' });

  assert.equal(payload.embeds.length, 1);
  assert.match(payload.embeds[0].title, /2건/);
  assert.match(payload.embeds[0].description, /\[신입 백엔드 개발자\]\(https:\/\/example.com\/jobs\/1\) — 결제 API/);
  assert.match(payload.embeds[0].description, /\[AI Engineer 인턴\]\(https:\/\/example.com\/jobs\/2\) — LLM 평가/);
  assert.equal(payload.embeds[0].description.split('\n').length, 2);
});
