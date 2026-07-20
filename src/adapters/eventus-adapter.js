const { inferType, isTechRelevant, requestOptions } = require('./platform-utils');
const value = (x, key) => x?.[key]?.raw ?? null;

function mapEventusResult(x, source, now = new Date()) {
  const id = value(x, 'id'); const title = value(x, 'title');
  const subdomain = value(x, 'subdomain'); const closesAt = value(x, 'close_date');
  if (!id || !title || !subdomain || !closesAt || new Date(closesAt) < now
    || !isTechRelevant(title, value(x, 'category'), value(x, 'event_type'))) return null;
  const url = `https://event-us.kr/${subdomain}/event/${id}`; const type = inferType(title);
  return {
    type, sourceId: source.id, externalId: String(id), url, title, closesAt, status: 'OPEN',
    organization: value(x, 'fullname') || value(x, 'app_title') || '이벤터스 등록 기관',
    locations: [value(x, 'area'), value(x, 'area_detail'), value(x, 'place')].filter(Boolean),
    eligibility: ['참가 조건 상세 확인'],
    tags: [value(x, 'category'), value(x, 'event_type'), '개발자 행사'].filter(Boolean),
    summary: `${value(x, 'event_type') || '행사'} · ${value(x, 'area_detail') || '장소 상세 확인'}`,
    summaryEvidence: [url], attributes: { sourcePriority: source.priority,
      developmentOutput: type === 'HACKATHON', immediateCategory: type !== 'HACKATHON' },
  };
}

function searchData(html) {
  const value = html.match(/searchDataRaw: (\{.*\}),\s*banners:/s)?.[1];
  return value ? JSON.parse(value) : {};
}

async function collectFromEventus(source, fetchImpl = fetch) {
  const output = [];
  for (const url of [source.url]) {
    const response = await fetchImpl(url, requestOptions());
    if (!response.ok) throw new Error(`${source.id}: HTTP ${response.status}`);
    output.push(...(searchData(await response.text()).results || [])
      .map((x) => mapEventusResult(x, source)).filter(Boolean));
  }
  return output.slice(0, source.maxItems || 30);
}

module.exports = { collectFromEventus, mapEventusResult, searchData };
