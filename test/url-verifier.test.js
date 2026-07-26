const assert = require('node:assert/strict');
const test = require('node:test');

const {
  URL_VERDICTS,
  classifyResponse,
  verifyUrl,
} = require('../src/validation/url-verifier');

test('classifies a successful response as valid', () => {
  assert.deepEqual(
    classifyResponse('https://example.com/jobs/1', {
      ok: true,
      status: 200,
      url: 'https://example.com/jobs/1',
    }),
    {
      ok: true,
      verdict: URL_VERDICTS.VALID,
      status: 200,
      finalUrl: 'https://example.com/jobs/1',
    },
  );
});

test('classifies Wanted bot protection as unverifiable', () => {
  const result = classifyResponse('https://www.wanted.co.kr/wd/376954', {
    ok: false,
    status: 403,
    url: 'https://www.wanted.co.kr/wd/376954',
  });

  assert.equal(result.verdict, URL_VERDICTS.UNVERIFIABLE);
  assert.equal(result.reason, 'BOT_PROTECTION');
});

test('keeps a regular missing page invalid', () => {
  const result = classifyResponse('https://example.com/jobs/missing', {
    ok: false,
    status: 404,
    url: 'https://example.com/jobs/missing',
  });

  assert.equal(result.verdict, URL_VERDICTS.INVALID);
});

test('retries a Wanted HEAD rejection with GET before classifying it', async () => {
  const methods = [];
  const result = await verifyUrl('https://www.wanted.co.kr/wd/376954', {
    fetchImpl: async (_url, options) => {
      methods.push(options.method);
      return {
        ok: false,
        status: 403,
        url: 'https://www.wanted.co.kr/wd/376954',
      };
    },
  });

  assert.deepEqual(methods, ['HEAD', 'GET']);
  assert.equal(result.verdict, URL_VERDICTS.UNVERIFIABLE);
});
