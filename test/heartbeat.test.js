const test = require('node:test');
const assert = require('node:assert/strict');

const { pingHeartbeat, shouldRetry, validateHeartbeatUrl } = require('../src/monitoring/heartbeat');

test('skips heartbeat when no URL is configured', async () => {
  const result = await pingHeartbeat({ url: '' });
  assert.equal(result.status, 'SKIPPED');
});

test('accepts only HTTP heartbeat URLs', () => {
  assert.equal(validateHeartbeatUrl('https://example.com/ping').hostname, 'example.com');
  assert.throws(() => validateHeartbeatUrl('not-a-url'), /valid URL/);
  assert.throws(() => validateHeartbeatUrl('file:///tmp/ping'), /HTTP or HTTPS/);
});

test('reports a successful heartbeat', async () => {
  const requests = [];
  const result = await pingHeartbeat({
    url: 'https://example.com/ping',
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return { ok: true, status: 204 };
    },
  });
  assert.deepEqual(result, { status: 'OK', httpStatus: 204, attempts: 1 });
  assert.equal(requests[0].options.method, 'GET');
});

test('retries transient failures and then succeeds', async () => {
  let calls = 0;
  const result = await pingHeartbeat({
    url: 'https://example.com/ping', attempts: 3, sleep: async () => undefined,
    fetchImpl: async () => {
      calls += 1;
      return calls < 3 ? { ok: false, status: 503 } : { ok: true, status: 200 };
    },
  });
  assert.equal(result.attempts, 3);
  assert.equal(calls, 3);
});

test('does not retry a permanent HTTP 400 response', async () => {
  let calls = 0;
  await assert.rejects(() => pingHeartbeat({
    url: 'https://example.com/ping', attempts: 3, sleep: async () => undefined,
    fetchImpl: async () => {
      calls += 1;
      return { ok: false, status: 400 };
    },
  }), /HTTP 400/);
  assert.equal(calls, 1);
});

test('identifies retryable response codes', () => {
  assert.equal(shouldRetry(429), true);
  assert.equal(shouldRetry(500), true);
  assert.equal(shouldRetry(400), false);
});
