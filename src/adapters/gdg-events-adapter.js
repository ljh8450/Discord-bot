const { cleanText } = require('./xml-utils');

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
    type: /hackathon|해커톤/i.test(event.name) ? 'HACKATHON' : 'EXTERNAL_ACTIVITY',
    sourceId: source.id, externalId: url, url, title: cleanText(event.name),
    organization: event.organizer?.name || 'Google Developer Groups', status: 'OPEN',
    closesAt: event.startDate, locations: [cleanText(location)], eligibility: ['참가 자격 상세 확인'],
    tags: ['개발자 행사', '커뮤니티', /AI|Gemini|LLM/i.test(event.description || '') ? 'AI' : '개발'],
    summary: cleanText(event.description).slice(0, 280) || 'Google Developer Groups 공식 개발자 행사',
    summaryEvidence: [url],
    attributes: {
      developmentOutput: /hackathon|해커톤|hands-on|워크숍/i.test(`${event.name} ${event.description}`),
      immediateCategory: true, eventStartsAt: event.startDate,
    },
  };
}

async function collectFromGdgEvents(source, fetchImpl = fetch) {
  const eventUrls = new Set();
  for (const chapterUrl of source.urls) {
    const response = await fetchImpl(chapterUrl, {
      headers: { 'user-agent': 'Mozilla/5.0 OpportunityRadar/1.0' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`${source.id}: HTTP ${response.status}`);
    const html = await response.text();
    for (const match of html.matchAll(/href=["'](https:\/\/gdg\.community\.dev\/events\/details\/[^"'?#]+\/?)/gi)) {
      eventUrls.add(match[1]);
    }
  }
  const urls = [...eventUrls].slice(0, source.maxItems || 20);
  const settled = await Promise.allSettled(urls.map(async (url) => {
    const response = await fetchImpl(url, {
      headers: { 'user-agent': 'Mozilla/5.0 OpportunityRadar/1.0' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseEventPage(await response.text(), source, url);
  }));
  return settled.flatMap((result) => (
    result.status === 'fulfilled' && result.value ? [result.value] : []
  ));
}

module.exports = { collectFromGdgEvents, parseEventPage };
