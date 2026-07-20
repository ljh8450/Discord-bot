const RETRYABLE_STATUS_CODES = new Set([408, 425, 429]);

function validateHeartbeatUrl(value) {
  if (!value) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('RADAR_HEARTBEAT_URL is not a valid URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('RADAR_HEARTBEAT_URL must use HTTP or HTTPS');
  }
  return url;
}

function shouldRetry(status) {
  return RETRYABLE_STATUS_CODES.has(status) || status >= 500;
}

async function pingHeartbeat(options = {}) {
  const url = validateHeartbeatUrl(options.url);
  if (!url) return { status: 'SKIPPED', reason: 'RADAR_HEARTBEAT_URL is not configured' };

  const fetchImpl = options.fetchImpl || fetch;
  const attempts = Math.max(1, options.attempts || 3);
  const timeoutMs = options.timeoutMs || 10_000;
  const sleep = options.sleep || ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: { 'user-agent': 'discord-bot-radar-heartbeat' },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) return { status: 'OK', httpStatus: response.status, attempts: attempt };
      lastError = new Error(`heartbeat endpoint returned HTTP ${response.status}`);
      if (!shouldRetry(response.status) || attempt === attempts) break;
    } catch (error) {
      lastError = new Error(`heartbeat request failed: ${error.message}`);
      if (attempt === attempts) break;
    }
    await sleep(250 * (2 ** (attempt - 1)));
  }
  throw lastError;
}

module.exports = { pingHeartbeat, shouldRetry, validateHeartbeatUrl };
