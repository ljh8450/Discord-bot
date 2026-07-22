const { cleanText } = require('./xml-utils');

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchWithRetry(url, fetchImpl, source) {
  const attempts = source.retryAttempts || 3;
  const baseDelayMs = source.retryDelayMs ?? 500;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: { 'user-agent': 'Mozilla/5.0 OpportunityRadar/1.0' },
        signal: AbortSignal.timeout(source.timeoutMs || 20_000),
      });
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}`);
      if (!RETRYABLE_STATUSES.has(response.status)) throw lastError;
    } catch (error) {
      lastError = error;
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        // A fresh timeout signal is created for the next attempt.
      } else if (!/^HTTP (429|5\d\d)$/.test(error.message)) {
        throw error;
      }
    }
    if (attempt < attempts && baseDelayMs > 0) await delay(baseDelayMs * attempt);
  }
  throw new Error(`${source.id}: ${lastError?.message || 'request failed'} after ${attempts} attempts`);
}

function parseEventPage(html, source, url, now = new Date()) {
  const match = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  let event;
  try { event = JSON.parse(match[1]); } catch { return null; }
  if (event['@type'] !== 'Event' || !event.name || !event.startDate) return null;
  const endsAt = new Date(event.endDate || event.startDate);
  if (Number.isNaN(endsAt.getTime()) || endsAt < now) return null;
  const address = event.location?.address || {};
  const location = address.addressLocality || address.addressRegion || event.location?.name || '온라인';
  return {
    type: 'HACKATHON',
    sourceId: source.id, externalId: url, url, title: cleanText(event.name),
    organization: event.organizer?.name || 'Google Developer Groups', status: 'OPEN',
    closesAt: event.startDate, locations: [cleanText(location)], eligibility: ['참가 자격 상세 확인'],
    tags: ['개발자 행사', '커뮤니티', /AI|Gemini|LLM/i.test(event.description || '') ? 'AI' : '개발'],
    summary: cleanText(event.description).slice(0, 280) || 'Google Developer Groups 공식 개발자 행사',
    summaryEvidence: [url],
    attributes: {
      developmentOutput: /hackathon|해커톤|hands-on|워크숍/i.test(`${event.name} ${event.description}`),
      platformDeveloperEvent: true, eventStartsAt: event.startDate,
    },
  };
}

async function collectFromGdgEvents(source, fetchImpl = fetch) {
  const eventUrls = new Set();
  const chapters = await Promise.allSettled(source.urls.map(async (chapterUrl) => {
    const response = await fetchWithRetry(chapterUrl, fetchImpl, source);
    return response.text();
  }));
  const successfulChapters = chapters.filter((result) => result.status === 'fulfilled');
  if (!successfulChapters.length) {
    const reason = chapters.find((result) => result.status === 'rejected')?.reason;
    throw reason || new Error(`${source.id}: every chapter request failed`);
  }
  for (const result of successfulChapters) {
    const html = result.value;
    for (const match of html.matchAll(/href=["'](https:\/\/gdg\.community\.dev\/events\/details\/[^"'?#]+\/?)/gi)) {
      eventUrls.add(match[1]);
    }
  }
  const urls = [...eventUrls].slice(0, source.maxItems || 20);
  const settled = await Promise.allSettled(urls.map(async (url) => {
    const response = await fetchWithRetry(url, fetchImpl, source);
    return parseEventPage(await response.text(), source, url);
  }));
  return settled.flatMap((result) => (
    result.status === 'fulfilled' && result.value ? [result.value] : []
  ));
}

module.exports = { collectFromGdgEvents, fetchWithRetry, parseEventPage };
