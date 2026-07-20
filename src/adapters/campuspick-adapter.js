const { extractJsonScript, isTechRelevant, requestOptions } = require('./platform-utils');

function mapCampuspickDetail(html, source, listingUrl, type, now = new Date()) {
  const x = extractJsonScript(html, '__INITIAL_STATE__')?.activity;
  if (!x?.id || !x.title) return null;
  const closesAt = x.end_date ? new Date(x.end_date).toISOString() : null;
  if ((closesAt && new Date(closesAt) < now) || !isTechRelevant(x.title, x.description, x.company)) return null;
  const url = x.website || listingUrl;
  return {
    type, sourceId: source.id, externalId: String(x.id), url, title: x.title,
    organization: x.company || '캠퍼스픽 등록 기관', status: 'OPEN', closesAt,
    locations: [x.region, x.online_type].filter(Boolean), eligibility: ['지원 자격 상세 확인'],
    tags: [type === 'HACKATHON' ? '공모전' : '대외활동', '개발'],
    summary: String(x.description || '모집 내용은 원문 확인').replace(/<[^>]*>/g, ' ').slice(0, 280),
    summaryEvidence: [...new Set([listingUrl, url])],
    attributes: { listingUrl, originalUrl: url, sourcePriority: source.priority,
      developmentOutput: type === 'HACKATHON', immediateCategory: type !== 'HACKATHON',
      financialSupport: Boolean(x.prize_top || x.prize_total || x.prize_benefit) },
  };
}

async function collectFromCampuspick(source, fetchImpl = fetch) {
  const output = [];
  for (const route of source.routes || ['contest', 'activity']) {
    const listUrl = `https://www.campuspick.com/${route}`;
    const response = await fetchImpl(listUrl, requestOptions());
    if (!response.ok) throw new Error(`${source.id}/${route}: HTTP ${response.status}`);
    const html = await response.text();
    const lists = [...html.matchAll(/<script[^>]+type=.application\/ld\+json.[^>]*>([\s\S]*?)<\/script>/gi)]
      .map((m) => { try { return JSON.parse(m[1]); } catch { return {}; } });
    const urls = lists.flatMap((x) => x.itemListElement || []).map((x) => x.url || x.item?.url)
      .filter(Boolean).slice(0, source.maxItemsPerRoute || 20);
    const settled = await Promise.allSettled(urls.map(async (url) => {
      const detail = await fetchImpl(url, requestOptions());
      return detail.ok ? mapCampuspickDetail(await detail.text(), source, url,
        route === 'contest' ? 'HACKATHON' : 'EXTERNAL_ACTIVITY') : null;
    }));
    output.push(...settled.filter((x) => x.status === 'fulfilled' && x.value).map((x) => x.value));
  }
  return output;
}

module.exports = { collectFromCampuspick, mapCampuspickDetail };
