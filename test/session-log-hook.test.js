const assert = require('node:assert/strict');
const { mkdtemp, readFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createSessionLogHook } = require('../src/hooks/session-log-hook');

test('writes ordered, redacted events to one file per session', async () => {
  const logsDir = await mkdtemp(path.join(os.tmpdir(), 'session-log-'));
  const hook = createSessionLogHook({
    logsDir,
    now: () => new Date('2026-07-20T00:00:00.000Z'),
  });

  await Promise.all([
    hook.onSessionStart('channel/123', { token: 'do-not-log' }),
    hook.onMessage('channel/123', { role: 'user', content: 'hello' }),
    hook.onSessionEnd('channel/123', { reason: 'idle' }),
  ]);

  const text = await readFile(path.join(logsDir, 'channel_123.jsonl'), 'utf8');
  const events = text.trim().split('\n').map(JSON.parse);

  assert.deepEqual(events.map(({ type }) => type), [
    'session.started',
    'message',
    'session.ended',
  ]);
  assert.equal(events[0].metadata.token, '[REDACTED]');
  assert.equal(events[1].message.content, 'hello');
});
