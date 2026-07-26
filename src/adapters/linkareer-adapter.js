const {
  extractJsonScript, hasDevelopmentOutput, inferType, isExternalEvent, isTechRelevant, requestOptions,
} = require('./platform-utils');
const {
  hasExplicitDevelopmentActivity,
  isAiAxFocused,
} = require('../domain/development-relevance');
const { attachCollectionStats } = require('./collection-stats');
const TYPES = { contest: 'HACKATHON', education: 'EDUCATION', activity: 'EXTERNAL_ACTIVITY' };
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchWithRetry(url, source, fetchImpl) {
  const attempts = source.retryAttempts || 3;
  const baseDelayMs = source.retryDelayMs ?? 500;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, requestOptions(source.timeoutMs || 30_000));
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}`);
      if (!RETRYABLE_STATUSES.has(response.status)) throw lastError;
    } catch (error) {
      lastError = error;
      if (/^HTTP \d+$/.test(error.message) && !RETRYABLE_STATUSES.has(
        Number(error.message.slice(5)),
      )) throw error;
    }
    if (attempt < attempts && baseDelayMs > 0) await delay(baseDelayMs * attempt);
  }
  throw new Error(`${lastError?.message || 'request failed'} after ${attempts} attempts`);
}

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
  const url = x.homepageURL || x.applyDetail || listingUrl;
  const benefits = [x.additionalBenefit, ...(x.benefits || [])]
    .map((v) => typeof v === 'string' ? v : v?.name).filter(Boolean).join(' ');
  const evidenceText = [
    x.title, tags, x.organizationName, benefits, activityDetails,
  ].flat(Infinity).filter(Boolean).join(' ');
  const freeOrFunded = Number(x.cost) === 0
    || /무료|전액\s*지원|국비|교육비\s*지원|참가비\s*지원/i.test(evidenceText);
  const hiringConnection = /일\s*경험|ojt|인턴|채용\s*(?:연계|우대)|취업\s*(?:연계|지원)/i
    .test(evidenceText);
  const industryMentoring = /현직자|실무자|기업\s*멘토|멘토링|코드\s*리뷰/i.test(evidenceText);
  const portfolioProject = /프로젝트|포트폴리오|mvp|프로토타입|서비스\s*(?:개발|구현)/i
    .test(evidenceText);
  const reasonableTimeCommitment = /(?:[1-8]\s*주|단기)/i.test(evidenceText);
  const activityDurationDays = Number.isFinite(Number(x.activityStartAt))
    && Number.isFinite(Number(x.activityEndAt))
    ? (Number(x.activityEndAt) - Number(x.activityStartAt)) / 86_400_000
    : null;
  const compactSchedule = reasonableTimeCommitment
    || (activityDurationDays !== null && activityDurationDays > 0 && activityDurationDays <= 56);
  const aiAxRelated = isAiAxFocused(evidenceText);
  const explicitDevelopment = hasExplicitDevelopmentActivity(evidenceText);
  const developerTrack = /백엔드|프론트엔드|풀스택|소프트웨어|프로그래밍|코딩|데이터\s*엔지니어|컴퓨터\s*공학|devops|개발자/i
    .test(evidenceText);
  const focusedAiDevelopment = !aiAxRelated || (
    resolvedType === 'HACKATHON'
      ? explicitDevelopment
        || (/해커톤|경진대회|hackathon/i.test(evidenceText) && developerTrack)
      : resolvedType === 'EXTERNAL_ACTIVITY'
        ? explicitDevelopment
        : resolvedType === 'EDUCATION'
          && compactSchedule
          && freeOrFunded
          && (hiringConnection || portfolioProject || industryMentoring)
          && developerTrack
  );
  const summaryParts = [
    freeOrFunded ? '무료·지원' : null,
    hiringConnection ? '일경험·취업 연계' : null,
    portfolioProject ? '프로젝트·포트폴리오' : null,
    benefits || null,
  ].filter(Boolean);
  return {
    type: resolvedType, sourceId: source.id, externalId: String(x.id), url, title: x.title,
    organization: x.organizationName || '링커리어 등록 기관', status: 'OPEN', closesAt,
    publishedAt: x.createdAt ? new Date(Number(x.createdAt)).toISOString() : null,
    locations: [...(x.regions || []), ...(x.addresses || [])].map((v) => v?.name || v).filter(Boolean),
    eligibility: (x.targets || []).map((v) => v?.name || v).filter(Boolean), tags,
    summary: summaryParts.length
      ? summaryParts.join(' · ')
      : `${x.dateRepresentation || '모집 일정 상세 확인'} · 지원 내용은 원문 확인`,
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
      freeOrFunded,
      trustedOrganizer: Boolean(x.organizationName),
      portfolioProject,
      hiringConnection,
      industryMentoring,
      reasonableTimeCommitment: compactSchedule,
      aiAxRelated,
      focusedAiDevelopment,
      sponsoredListing: x.isSponsored === true,
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
  let failedDetailRequests = 0;
  let rejected = 0;
  let duplicates = 0;
  let stopReason = 'routes exhausted';
  for (const route of source.routes || Object.keys(TYPES)) {
    const regularMaxPages = source.maxPagesPerRoute || source.maxPages || 5;
    const discoveryMaxPages = Math.max(
      regularMaxPages,
      source.discoveryMaxPagesPerRoute || regularMaxPages,
    );
    const deepDiscoveryEnabled = discoveryMaxPages > regularMaxPages;
    let routeItems = 0;
    for (let page = 1; page <= discoveryMaxPages; page += 1) {
      const listUrl = `https://linkareer.com/list/${route}?page=${page}`;
      let response;
      try {
        response = await fetchWithRetry(listUrl, source, fetchImpl);
      } catch (error) {
        throw new Error(`${source.id}/${route}: ${error.message}`);
      }
      pagesFetched += 1;
      const data = extractJsonScript(await response.text(), '__NEXT_DATA__');
      const listingEntries = data?.props?.pageProps?.activityItems || [];
      if (!listingEntries.length) break;
      listingItems += listingEntries.length;
      const candidates = page <= regularMaxPages
        ? listingEntries
        : listingEntries.filter((entry) => isTechRelevant(entry.name, entry.title));
      const urls = candidates
        .map((x) => new URL(x.url, listUrl).toString())
        .filter((url) => {
          if (detailCache.has(url)) {
            duplicates += 1;
            return false;
          }
          return true;
        });
      if (!urls.length) continue;
      const settled = await Promise.allSettled(urls.map(async (url) => {
        detailRequests += 1;
        const detail = await fetchWithRetry(url, source, fetchImpl);
        const html = await detail.text();
        detailCache.set(url, html);
        const raw = html
          ? extractJsonScript(html, '__NEXT_DATA__')?.props?.pageProps?.data?.activityData?.activity
          : null;
        return {
          publishedAt: raw?.createdAt ? Number(raw.createdAt) : null,
          item: html ? mapLinkareerDetail(html, source, url, TYPES[route]) : null,
        };
      }));
      failedDetailRequests += settled.filter((x) => x.status === 'rejected').length;
      const details = settled.filter((x) => x.status === 'fulfilled').map((x) => x.value);
      const mapped = details.filter((x) => x.item).map((x) => x.item);
      rejected += details.length - mapped.length;
      output.push(...mapped);
      routeItems += mapped.length;
      const dates = details.map((x) => x.publishedAt).filter(Number.isFinite);
      if (!deepDiscoveryEnabled && dates.length && dates.every((value) => value < cutoff)) {
        stopReason = `${route}: older than ${source.recentDays || 7} days`;
        break;
      }
      if (!deepDiscoveryEnabled && routeItems >= (source.maxItemsPerRoute || 100)) {
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
    failedDetailRequests,
    duplicates,
    stopReason,
  });
}

module.exports = { collectFromLinkareer, mapLinkareerDetail };
