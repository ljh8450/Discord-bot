const {
  extractJsonScript, hasDevelopmentOutput, inferType, isExternalEvent, isTechRelevant, requestOptions,
} = require('./platform-utils');
const { hasExplicitDevelopmentActivity } = require('../domain/development-relevance');
const { attachCollectionStats } = require('./collection-stats');
const TYPES = { contest: 'HACKATHON', education: 'EDUCATION', activity: 'EXTERNAL_ACTIVITY' };

function mapLinkareerDetail(html, source, listingUrl, type, now = new Date()) {
  const x = extractJsonScript(html, '__NEXT_DATA__')?.props?.pageProps?.data?.activityData?.activity;
  if (!x?.id || !x.title) return null;
  const closesAt = x.recruitCloseAt ? new Date(Number(x.recruitCloseAt)).toISOString() : null;
  if (closesAt && new Date(closesAt) < now) return null;
  const tags = [...(x.categories || []), ...(x.educationTypes || []), ...(x.skills || [])]
    .map((v) => typeof v === 'string' ? v : v?.name).filter(Boolean);
  const resolvedType = inferType([x.title, tags], type);
  const activityDetails = [
    x.description, x.content, x.detail, x.activityContent, x.recruitmentDetail,
    x.qualification, x.preferentialTreatment, x.mainActivity,
  ];
  if (!isTechRelevant(x.title, tags, x.organizationName, activityDetails)) return null;
  const url = x.homepageURL || listingUrl;
  const benefits = [x.additionalBenefit, ...(x.benefits || [])]
    .map((v) => typeof v === 'string' ? v : v?.name).filter(Boolean).join(' ');
  return {
    type: resolvedType, sourceId: source.id, externalId: String(x.id), url, title: x.title,
    organization: x.organizationName || '링커리어 등록 기관', status: 'OPEN', closesAt,
    publishedAt: x.createdAt ? new Date(Number(x.createdAt)).toISOString() : null,
    locations: [...(x.regions || []), ...(x.addresses || [])].map((v) => v?.name || v).filter(Boolean),
    eligibility: (x.targets || []).map((v) => v?.name || v).filter(Boolean), tags,
    summary: `${x.dateRepresentation || '모집 일정 상세 확인'} · ${benefits || '지원 내용은 원문 확인'}`,
    summaryEvidence: [...new Set([listingUrl, url])],
    attributes: {
      listingUrl, originalUrl: url, sourcePriority: source.priority,
      developmentOutput: resolvedType === 'HACKATHON'
        && hasDevelopmentOutput(x.title, tags, x.organizationName),
      verifiedDevelopmentActivity: resolvedType === 'EXTERNAL_ACTIVITY'
        && hasExplicitDevelopmentActivity(
          x.title, tags, x.organizationName, benefits, activityDetails,
        ),
      platformDeveloperEvent: resolvedType === 'EXTERNAL_ACTIVITY'
        && isExternalEvent(x.title, tags),
      immediateCategory: false,
      requiresBenefitReview: resolvedType === 'EDUCATION',
      freeOrFunded: /무료|지원/.test(`${x.cost || ''} ${benefits}`),
      trustedOrganizer: Boolean(x.organizationName), portfolioProject: /프로젝트|포트폴리오/.test(x.title),
    },
  };
}

async function collectFromLinkareer(source, fetchImpl = fetch) {
  const output = [];
  const detailCache = new Map();
  const cutoff = Date.now() - ((source.recentDays || 7) * 86_400_000);
  let pagesFetched = 0;
  let listingItems = 0;
  let detailRequests = 0;
  let rejected = 0;
  let duplicates = 0;
  let stopReason = 'routes exhausted';
  for (const route of source.routes || Object.keys(TYPES)) {
    const maxPages = source.maxPagesPerRoute || source.maxPages || 5;
    let routeItems = 0;
    for (let page = 1; page <= maxPages; page += 1) {
      const listUrl = `https://linkareer.com/list/${route}?page=${page}`;
      const response = await fetchImpl(listUrl, requestOptions());
      if (!response.ok) throw new Error(`${source.id}/${route}: HTTP ${response.status}`);
      pagesFetched += 1;
      const data = extractJsonScript(await response.text(), '__NEXT_DATA__');
      const urls = (data?.props?.pageProps?.activityItems || [])
        .map((x) => new URL(x.url, listUrl).toString())
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
        const html = detail.ok ? await detail.text() : '';
        detailCache.set(url, html);
        const raw = html
          ? extractJsonScript(html, '__NEXT_DATA__')?.props?.pageProps?.data?.activityData?.activity
          : null;
        return {
          publishedAt: raw?.createdAt ? Number(raw.createdAt) : null,
          item: html ? mapLinkareerDetail(html, source, url, TYPES[route]) : null,
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

module.exports = { collectFromLinkareer, mapLinkareerDetail };
