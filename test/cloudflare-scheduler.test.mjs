import assert from 'node:assert/strict';
import test from 'node:test';

import worker, { dispatchRadar } from '../cloudflare/radar-scheduler.mjs';

test('dispatches the main Opportunity Radar workflow with a GitHub token', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ workflow_run_id: 123 }), { status: 200 });
  };

  const result = await dispatchRadar({ GITHUB_TOKEN: 'test-token' });

  assert.match(request.url, /opportunity-radar\.yml\/dispatches$/);
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.authorization, 'Bearer test-token');
  assert.deepEqual(JSON.parse(request.options.body), { ref: 'main' });
  assert.equal(result.response.workflow_run_id, 123);
});

test('rejects an unauthenticated manual dispatch', async () => {
  const response = await worker.fetch(
    new Request('https://scheduler.example', { method: 'POST' }),
    { GITHUB_TOKEN: 'test-token', MANUAL_TRIGGER_SECRET: 'manual-secret' },
  );

  assert.equal(response.status, 401);
});

test('scheduled handler waits for the GitHub dispatch', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response(null, { status: 204 });
  let scheduledWork;

  worker.scheduled(
    { cron: '2,12,22,32,42,52 * * * *', scheduledTime: 1_753_000_000_000 },
    { GITHUB_TOKEN: 'test-token' },
    { waitUntil(promise) { scheduledWork = promise; } },
  );

  assert.ok(scheduledWork instanceof Promise);
  await scheduledWork;
});

test('dispatches the developer brief workflow on the morning and evening cron', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let requestedUrl;
  let requestOptions;
  globalThis.fetch = async (url, options) => {
    requestedUrl = url;
    requestOptions = options;
    return new Response(null, { status: 204 });
  };
  let scheduledWork;

  worker.scheduled(
    { cron: '5 0,9 * * *', scheduledTime: 1_753_000_000_000 },
    { GITHUB_TOKEN: 'test-token' },
    { waitUntil(promise) { scheduledWork = promise; } },
  );
  await scheduledWork;

  assert.match(requestedUrl, /opportunity-digest\.yml\/dispatches$/);
  assert.deepEqual(JSON.parse(requestOptions.body), {
    ref: 'main',
    inputs: { brief_only: true },
  });
});
