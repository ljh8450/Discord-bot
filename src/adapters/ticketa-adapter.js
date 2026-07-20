const { inferType, isTechRelevant, requestOptions } = require('./platform-utils');

function mapTicketaEvent(x, source, now = new Date()) {
  const closesAt = x?.start_date || x?.end_date;
  if (!x?.id || x.status !== 'PUBLIC' || !closesAt || new Date(closesAt) < now
    || !isTechRelevant(x.title, x.organization_id)) return null;
  const url = `https://ticketa.co/event/${x.id}`;
  const type = inferType(x.title);
  return {
    type, sourceId: source.id, externalId: x.id, url, title: x.title,
    organization: x.organization_id || '티켓타코 등록 기관', status: 'OPEN', closesAt,
    locations: [x.venues?.province, x.venues?.district, x.venues?.place_name].filter(Boolean),
    eligibility: ['참가 조건 상세 확인'], tags: ['개발자 행사'],
    summary: `${x.venues?.place_name || '행사 장소 상세 확인'} · 행사 시작 전 신청`,
    summaryEvidence: [url], attributes: { sourcePriority: source.priority,
      developmentOutput: type === 'HACKATHON', immediateCategory: type !== 'HACKATHON' },
  };
}

async function collectFromTicketa(source, fetchImpl = fetch) {
  const response = await fetchImpl(source.url, requestOptions());
  if (!response.ok) throw new Error(`${source.id}: HTTP ${response.status}`);
  const data = await response.json();
  return (data.events || []).map((x) => mapTicketaEvent(x, source)).filter(Boolean)
    .slice(0, source.maxItems || 30);
}

module.exports = { collectFromTicketa, mapTicketaEvent };
