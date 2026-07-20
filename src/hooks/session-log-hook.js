const { randomUUID } = require('node:crypto');
const { mkdir, appendFile } = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'password',
  'secret',
  'token',
]);

function sanitize(value, sensitiveKeys = DEFAULT_SENSITIVE_KEYS) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, sensitiveKeys));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sensitiveKeys.has(key.toLowerCase())
          ? '[REDACTED]'
          : sanitize(item, sensitiveKeys),
      ]),
    );
  }

  return value;
}

function safeFileName(sessionId) {
  return String(sessionId).replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Creates a hook that writes one JSONL file per chat session.
 *
 * Call onSessionStart once, onMessage for every message, and onSessionEnd
 * when the session closes. Calls for the same session are serialized so log
 * lines remain in event order.
 */
function createSessionLogHook(options = {}) {
  const logsDir = path.resolve(options.logsDir || path.join(process.cwd(), 'logs', 'sessions'));
  const now = options.now || (() => new Date());
  const queues = new Map();

  function enqueue(sessionId, event) {
    if (!sessionId) {
      return Promise.reject(new TypeError('sessionId is required'));
    }

    const id = safeFileName(sessionId);
    const filePath = path.join(logsDir, `${id}.jsonl`);
    const line = `${JSON.stringify(sanitize({
      timestamp: now().toISOString(),
      sessionId: String(sessionId),
      ...event,
    }))}\n`;

    const previous = queues.get(id) || Promise.resolve();
    const write = previous
      .catch(() => undefined)
      .then(async () => {
        await mkdir(logsDir, { recursive: true });
        await appendFile(filePath, line, 'utf8');
      });

    queues.set(id, write);
    write.finally(() => {
      if (queues.get(id) === write) queues.delete(id);
    });

    return write;
  }

  return {
    createSessionId: () => randomUUID(),

    onSessionStart(sessionId, metadata = {}) {
      return enqueue(sessionId, { type: 'session.started', metadata });
    },

    onMessage(sessionId, message) {
      return enqueue(sessionId, { type: 'message', message });
    },

    onSessionEnd(sessionId, metadata = {}) {
      return enqueue(sessionId, { type: 'session.ended', metadata });
    },

    async flush() {
      await Promise.allSettled([...queues.values()]);
    },
  };
}

module.exports = { createSessionLogHook, sanitize };
