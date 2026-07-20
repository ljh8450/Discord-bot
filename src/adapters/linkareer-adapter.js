const {
  extractJsonScript, hasDevelopmentOutput, isTechRelevant, requestOptions,
} = require('./platform-utils');
const TYPES = { contest: 'HACKATHON', education: 'EDUCATION', activity: 'EXTERNAL_ACTIVITY' };

function mapLinkareerDetail(html, source, listingUrl, type, now = new Date()) {
  const x = extractJsonScript(html, '__NEXT_DATA__')?.props?.pageProps?.data?.activityData?.activity;
  if (!x?.id || !x.title) return null;
  const closesAt = x.recruitCloseAt ? new Date(Number(x.recruitCloseAt)).toISOString() : null;
  if (closesAt && new Date(closesAt) < now) return null;
  const tags = [...(x.categories || []), ...(x.educationTypes || []), ...(x.skills || [])]
    .map((v) => typeof v === 'string' ? v : v?.name).filter(Boolean);
  if (!isTechRelevant(x.title, tags, x.organizationName)) return null;
  const url = x.homepageURL || listingUrl;
  const benefits = [x.additionalBenefit, ...(x.benefits || [])]
    .map((v) => typeof v === 'string' ? v : v?.name).filter(Boolean).join(' ');
  return {
    type, sourceId: source.id, externalId: String(x.id), url, title: x.title,
    organization: x.organizationName || '링커리어 등록 기관', status: 'OPEN', closesAt,
    locations: [...(x.regions || []), ...(x.addresses || [])].map((v) => v?.name || v).filter(Boolean),
    eligibility: (x.targets || []).map((v) => v?.name || v).filter(Boolean), tags,
    summary: `${x.dateRepresentation || '모집 일정 상세 확인'} · ${benefits || '지원 내용은 원문 확인'}`,
    summaryEvidence: [...new Set([listingUrl, url])],
    attributes: {
      listingUrl, originalUrl: url, sourcePriority: source.priority,
      developmentOutput: type === 'HACKATHON'
        && hasDevelopmentOutput(x.title, tags, x.organizationName),
      immediateCategory: false,
      requiresBenefitReview: type === 'EDUCATION',
      freeOrFunded: /무료|지원/.test(`${x.cost || ''} ${benefits}`),
      trustedOrganizer: Boolean(x.organizationName), portfolioProject: /프로젝트|포트폴리오/.test(x.title),
    },
  };
}

async function collectFromLinkareer(source, fetchImpl = fetch) {
  const output = [];
  for (const route of source.routes || Object.keys(TYPES)) {
    const listUrl = `https://linkareer.com/list/${route}`;
    const response = await fetchImpl(listUrl, requestOptions());
    if (!response.ok) throw new Error(`${source.id}/${route}: HTTP ${response.status}`);
    const data = extractJsonScript(await response.text(), '__NEXT_DATA__');
    const urls = (data?.props?.pageProps?.activityItems || []).slice(0, source.maxItemsPerRoute || 20)
      .map((x) => new URL(x.url, listUrl).toString());
    const settled = await Promise.allSettled(urls.map(async (url) => {
      const detail = await fetchImpl(url, requestOptions());
      return detail.ok ? mapLinkareerDetail(await detail.text(), source, url, TYPES[route]) : null;
    }));
    output.push(...settled.filter((x) => x.status === 'fulfilled' && x.value).map((x) => x.value));
  }
  return output;
}

module.exports = { collectFromLinkareer, mapLinkareerDetail };
