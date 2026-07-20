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
  return { ok: response.ok, status: response.status, finalUrl: response.url || url };
}

module.exports = { verifyUrl };
