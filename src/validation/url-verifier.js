const URL_VERDICTS = Object.freeze({
  VALID: 'VALID',
  UNVERIFIABLE: 'UNVERIFIABLE',
  INVALID: 'INVALID',
});

function isWantedUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === 'wanted.co.kr' || hostname.endsWith('.wanted.co.kr');
  } catch {
    return false;
  }
}

function classifyResponse(url, response) {
  const finalUrl = response.url || url;
  if (response.ok) {
    return {
      ok: true,
      verdict: URL_VERDICTS.VALID,
      status: response.status,
      finalUrl,
    };
  }
  if ([403, 429].includes(response.status) && isWantedUrl(finalUrl)) {
    return {
      ok: false,
      verdict: URL_VERDICTS.UNVERIFIABLE,
      reason: 'BOT_PROTECTION',
      status: response.status,
      finalUrl,
    };
  }
  return {
    ok: false,
    verdict: URL_VERDICTS.INVALID,
    status: response.status,
    finalUrl,
  };
}

async function verifyUrl(url, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs || 15_000;
  const headers = { 'user-agent': options.userAgent || 'OpportunityRadar/1.0' };
  let response = await fetchImpl(url, {
    method: 'HEAD', headers, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs),
  });
  if ([403, 405].includes(response.status)) {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: { ...headers, range: 'bytes=0-1023' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
  }
  return classifyResponse(url, response);
}

module.exports = {
  URL_VERDICTS,
  classifyResponse,
  isWantedUrl,
  verifyUrl,
};
