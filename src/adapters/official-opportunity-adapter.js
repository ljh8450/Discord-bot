const { attachCollectionStats } = require('./collection-stats');
const { hasDevelopmentOutput } = require('../domain/development-relevance');
const { requestOptions } = require('./platform-utils');

function cleanHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function metaContent(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.match(new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)`,
    'i',
  ))?.[1] || html.match(new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`,
    'i',
  ))?.[1] || null;
}

function jsonLdObjects(html) {
  return [...html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )].flatMap((match) => {
    try {
      const value = JSON.parse(match[1]);
      return Array.isArray(value) ? value : [value];
    } catch {
      return [];
    }
  });
}

function selectPreferredUrl(candidates, source) {
  const urls = candidates.filter(Boolean).map((value) => {
    try { return new URL(value, source.url).toString(); } catch { return null; }
  }).filter(Boolean);
  const preferredDomains = source.preferredDomains || [];
  return urls.find((url) => preferredDomains.some((domain) => (
    new URL(url).hostname === domain || new URL(url).hostname.endsWith(`.${domain}`)
  ))) || urls[0] || source.url;
}

function mapOfficialPage(html, source, page = {}, now = new Date()) {
  const schemas = jsonLdObjects(html);
  const event = schemas.find((item) => ['Event', 'Course'].includes(item?.['@type'])) || {};
  const title = page.title || event.name || metaContent(html, 'og:title')
    || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const closesAt = page.closesAt || event.endDate || source.closesAt || null;
  if (!title || (closesAt && new Date(closesAt) < now)) return null;
  const body = cleanHtml(html);
  const summary = page.summary || event.description || metaContent(html, 'og:description')
    || body.slice(0, 280);
  const url = selectPreferredUrl(
    [page.applicationUrl, event.url, page.url, source.url],
    { ...source, url: page.url || source.url },
  );
  const type = page.type || source.type || 'HACKATHON';
  const evidence = [page.url || source.url, url];
  return {
    type,
    sourceId: source.id,
    externalId: page.externalId || url,
    url,
    title: cleanHtml(title),
    organization: page.organization || source.organization || event.organizer?.name || '공식 주최 기관',
    status: 'OPEN',
    publishedAt: page.publishedAt || event.startDate || null,
    closesAt,
    locations: page.locations || [event.location?.name].filter(Boolean),
    eligibility: page.eligibility || ['지원 자격 상세 확인'],
    tags: [...new Set([...(source.tags || []), ...(page.tags || []), '공식 공지'])],
    summary: cleanHtml(summary).slice(0, 280),
    summaryEvidence: [...new Set(evidence)],
    attributes: {
      sourcePriority: source.priority,
      officialSource: true,
      developmentOutput: page.developmentOutput
        ?? hasDevelopmentOutput(title, summary, source.tags, page.tags),
      verifiedDevelopmentActivity: page.verifiedDevelopmentActivity === true,
      financialSupport: page.financialSupport === true,
    },
  };
}

async function collectFromOfficialOpportunities(source, fetchImpl = fetch) {
  const pages = source.pages?.length ? source.pages : [{ url: source.url }];
  const selectedPages = pages.slice(0, source.maxPages || 20);
  const output = [];
  let rejected = 0;
  for (const page of selectedPages) {
    const response = await fetchImpl(page.url, requestOptions());
    if (!response.ok) throw new Error(`${source.id}: HTTP ${response.status}`);
    const item = mapOfficialPage(await response.text(), source, page);
    if (item) output.push(item);
    else rejected += 1;
  }
  return attachCollectionStats(output, {
    pagesFetched: selectedPages.length,
    listingItems: selectedPages.length,
    detailRequests: selectedPages.length,
    mapped: output.length,
    rejected,
    stopReason: 'configured official pages exhausted',
  });
}

module.exports = {
  cleanHtml,
  collectFromOfficialOpportunities,
  jsonLdObjects,
  mapOfficialPage,
  selectPreferredUrl,
};
