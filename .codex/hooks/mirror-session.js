const { copyFile, mkdir, stat } = require('node:fs/promises');
const path = require('node:path');

function safeFileName(value) {
  return String(value || 'unknown-session')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 160) || 'unknown-session';
}

async function mirrorSession(event, options = {}) {
  const transcriptPath = event && event.transcript_path;
  if (!transcriptPath) {
    return { mirrored: false, reason: 'transcript_path is unavailable' };
  }

  const sourcePath = path.resolve(String(transcriptPath));
  const sourceStat = await stat(sourcePath);
  if (!sourceStat.isFile()) {
    return { mirrored: false, reason: 'transcript_path is not a file' };
  }

  const repositoryRoot = path.resolve(__dirname, '..', '..');
  const logsDir = path.resolve(
    options.logsDir
      || process.env.CODEX_SESSION_LOG_DIR
      || path.join(repositoryRoot, 'logs', 'codex-sessions'),
  );
  const sessionId = safeFileName(event.session_id);
  const destinationPath = path.join(logsDir, `${sessionId}.jsonl`);

  await mkdir(logsDir, { recursive: true });
  await copyFile(sourcePath, destinationPath);

  return {
    mirrored: true,
    sourcePath,
    destinationPath,
    bytes: sourceStat.size,
  };
}

async function readStandardInput() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  try {
    const input = await readStandardInput();
    const event = JSON.parse(input);
    await mirrorSession(event);
  } catch (error) {
    // Session logging must never prevent Codex from continuing.
    process.stderr.write(`mirror-session: ${error.name}: ${error.message}\n`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { mirrorSession, safeFileName };
