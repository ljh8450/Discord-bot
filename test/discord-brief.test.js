const assert = require('node:assert/strict');
const test = require('node:test');

const { buildDeveloperBrief } = require('../src/discord/brief');

test('prefers the Korean one-line summary and falls back to the source summary', () => {
  const payload = buildDeveloperBrief([
    {
      title: 'Agent update', canonicalUrl: 'https://example.com/agent',
      summary: 'An agent update.', koreanSummary: '코딩 에이전트가 새롭게 업데이트됐습니다.',
      organization: 'Example',
    },
    {
      title: 'API update', canonicalUrl: 'https://example.com/api',
      summary: 'The API was updated.', organization: 'Example',
    },
  ]);

  const description = payload.embeds[0].description;
  assert.match(description, /코딩 에이전트가 새롭게 업데이트됐습니다/);
  assert.match(description, /The API was updated/);
  assert.doesNotMatch(description, /An agent update/);
});
