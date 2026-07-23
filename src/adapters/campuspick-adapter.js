const {
  extractJsonScript, hasDevelopmentOutput, inferType, isExternalEvent, isTechRelevant, requestOptions,
} = require('./platform-utils');
const { hasExplicitDevelopmentActivity } = require('../domain/development-relevance');
const { attachCollectionStats } = require('./collection-stats');

function mapCampuspickDetail(html, source, listingUrl, type, now = new Date()) {
  const x = extractJsonScript(html, '__INITIAL_STATE__')?.activity;
  if (!x?.id || !x.title) return null;
  const closesAt = x.end_date ? new Date(x.end_date).toISOString() : null;
  if ((closesAt && new Date(closesAt) < now) || !isTechRelevant(x.title, x.description, x.company)) return null;
  const url = x.website || listingUrl;
  const resolvedType = inferType([x.title, x.description], type);
  return {
    type: resolvedType, sourceId: source.id, externalId: String(x.id), url, title: x.title,
    organization: x.company || '캠퍼스픽 등록 기관', status: 'OPEN', closesAt,
    publishedAt: x.created_at ? new Date(`${x.created_at.replace(' ', 'T')}+09:00`).toISOString() : null,
    locations: [x.region, x.online_type].filter(Boolean), eligibility: ['지원 자격 상세 확인'],
    tags: [resolvedType === 'HACKATHON' ? '공모전' : '대외활동', '개발'],
    summary: String(x.description || '모집 내용은 원문 확인').replace(/<[^>]*>/g, ' ').slice(0, 280),
    summaryEvidence: [...new Set([listingUrl, url])],
    attributes: { listingUrl, originalUrl: url, sourcePriority: source.priority,
      developmentOutput: resolvedType === 'HACKATHON'
        && hasDevelopmentOutput(x.title, x.description, x.company),
      verifiedDevelopmentActivity: resolvedType === 'EXTERNAL_ACTIVITY'
        && hasExplicitDevelopmentActivity(x.title, x.description, x.company),
      platformDeveloperEvent: resolvedType === 'EXTERNAL_ACTIVITY'
        && isExternalEvent(x.title, x.description),
      immediateCategory: false,
      financialSupport: Boolean(x.prize_top || x.prize_total || x.prize_benefit) },
  };
}

async function collectFromCampuspick(source, fetchImpl = fetch) {
  const output = [];
  const detailCache = new Map();
  const cutoff = Date.now() - ((source.recentDays || 7) * 86_400_000);
  let pagesFetched = 0;
  let listingItems = 0;
  let detailRequests = 0;
  let rejected = 0;
  let duplicates = 0;
  let stopReason = 'routes exhausted';
  for (const route of source.routes || ['contest', 'activity']) {
    const maxPages = source.maxPagesPerRoute || source.maxPages || 5;
    let routeItems = 0;
    for (let page = 1; page <= maxPages; page += 1) {
      const listUrl = `https://www.campuspick.com/${route}?page=${page}`;
      const response = await fetchImpl(listUrl, requestOptions());
      if (!response.ok) throw new Error(`${source.id}/${route}: HTTP ${response.status}`);
      pagesFetched += 1;
      const html = await response.text();
      const lists = [...html.matchAll(
        /<script[^>]+type=.application\/ld\+json.[^>]*>([\s\S]*?)<\/script>/gi,
      )].map((m) => { try { return JSON.parse(m[1]); } catch { return {}; } });
      const urls = lists.flatMap((x) => x.itemListElement || []).map((x) => x.url || x.item?.url)
        .filter(Boolean)
        .filter((url) => {
          if (detailCache.has(url)) {
            duplicates += 1;
            return false;
          }
          return true;
        });
      if (!urls.length) break;
      listingItems += urls.length;
      const settled = await Promise.allSettled(urls.map(async (url) => {
        detailRequests += 1;
        const detail = await fetchImpl(url, requestOptions());
        const detailHtml = detail.ok ? await detail.text() : '';
        detailCache.set(url, detailHtml);
        const raw = detailHtml
          ? extractJsonScript(detailHtml, '__INITIAL_STATE__')?.activity
          : null;
        return {
          publishedAt: raw?.created_at ? Date.parse(`${raw.created_at.replace(' ', 'T')}+09:00`) : null,
          item: detailHtml ? mapCampuspickDetail(
            detailHtml,
            source,
            url,
            route === 'contest' ? 'HACKATHON' : 'EXTERNAL_ACTIVITY',
          ) : null,
        };
      }));
      const details = settled.filter((x) => x.status === 'fulfilled').map((x) => x.value);
      const mapped = details.filter((x) => x.item).map((x) => x.item);
      rejected += details.length - mapped.length;
      output.push(...mapped);
      routeItems += mapped.length;
      const dates = details.map((x) => x.publishedAt).filter(Number.isFinite);
      if (dates.length && dates.every((value) => value < cutoff)) {
        stopReason = `${route}: older than ${source.recentDays || 7} days`;
        break;
      }
      if (routeItems >= (source.maxItemsPerRoute || 100)) {
        stopReason = `${route}: maxItemsPerRoute reached`;
        break;
      }
    }
  }
  return attachCollectionStats(output, {
    pagesFetched,
    listingItems,
    detailRequests,
    mapped: output.length,
    rejected,
    duplicates,
    stopReason,
  });
}

module.exports = { collectFromCampuspick, mapCampuspickDetail };
