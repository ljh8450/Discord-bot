const assert = require('node:assert/strict');
const test = require('node:test');

const {
  addKoreanSummaries,
  addKoreanSummariesWithFallback,
} = require('../src/enrichment/korean-summary');

const items = [
  { title: 'Agent update', summary: 'A new coding agent is available.', organization: 'Example' },
  { title: 'API update', summary: 'The API now supports a new model.', organization: 'Example' },
];

test('adds one Korean summary per item with a single GitHub Models request', async () => {
  let requests = 0;
  const result = await addKoreanSummaries(items, {
    token: 'test-token',
    fetchImpl: async (url, options) => {
      requests += 1;
      assert.equal(url, 'https://models.github.ai/inference/chat/completions');
      assert.equal(options.headers.authorization, 'Bearer test-token');
      const request = JSON.parse(options.body);
      assert.equal(request.messages[1].content.includes('Agent update'), true);
      return {
        ok: true,
        async json() {
          return {
            choices: [{ message: { content: JSON.stringify({ summaries: [
              { index: 0, summary: '새로운 코딩 에이전트를 사용할 수 있습니다.' },
              { index: 1, summary: 'API가 새로운 모델을 지원합니다.' },
            ] }) } }],
          };
        },
      };
    },
  });

  assert.equal(requests, 1);
  assert.equal(result[0].koreanSummary, '새로운 코딩 에이전트를 사용할 수 있습니다.');
  assert.equal(result[1].koreanSummary, 'API가 새로운 모델을 지원합니다.');
});

test('returns original items when model inference fails', async () => {
  let reported;
  const result = await addKoreanSummariesWithFallback(items, {
    token: 'test-token',
    fetchImpl: async () => ({ ok: false, status: 429 }),
    onError: (error) => { reported = error; },
  });

  assert.deepEqual(result, items);
  assert.match(reported.message, /HTTP 429/);
});

test('does not call the model when a token is unavailable', async () => {
  const result = await addKoreanSummaries(items, {
    fetchImpl: async () => { throw new Error('should not be called'); },
  });
  assert.equal(result, items);
});
