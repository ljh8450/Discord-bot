const assert = require('node:assert/strict');
const { mkdtemp, readFile, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  mirrorSession,
  safeFileName,
} = require('../.codex/hooks/mirror-session');

test('mirrors a Codex transcript into one file per session', async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'codex-mirror-'));
  const transcriptPath = path.join(temporaryRoot, 'source.jsonl');
  const logsDir = path.join(temporaryRoot, 'logs');
  const transcript = '{"type":"message","role":"user","content":"hello"}\n';
  await writeFile(transcriptPath, transcript, 'utf8');

  const result = await mirrorSession({
    session_id: 'session/123',
    transcript_path: transcriptPath,
  }, { logsDir });

  assert.equal(result.mirrored, true);
  assert.equal(
    await readFile(path.join(logsDir, 'session_123.jsonl'), 'utf8'),
    transcript,
  );
});

test('refreshes the mirror when the transcript grows', async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'codex-mirror-'));
  const transcriptPath = path.join(temporaryRoot, 'source.jsonl');
  const logsDir = path.join(temporaryRoot, 'logs');
  await writeFile(transcriptPath, 'first\n', 'utf8');

  const event = { session_id: 'session-1', transcript_path: transcriptPath };
  await mirrorSession(event, { logsDir });
  await writeFile(transcriptPath, 'first\nsecond\n', 'utf8');
  await mirrorSession(event, { logsDir });

  assert.equal(
    await readFile(path.join(logsDir, 'session-1.jsonl'), 'utf8'),
    'first\nsecond\n',
  );
});

test('skips events that do not expose a transcript', async () => {
  assert.deepEqual(await mirrorSession({ session_id: 'session-1' }), {
    mirrored: false,
    reason: 'transcript_path is unavailable',
  });
});

test('sanitizes session ids used as filenames', () => {
  assert.equal(safeFileName('../session:123'), '.._session_123');
});
