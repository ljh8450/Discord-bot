const { decodeHtml } = require('./naver-careers-adapter');

function firstSentence(value, maxLength = 120) {
  const text = decodeHtml(value);
  if (!text) return '';
  const sentence = text.split(/(?<=[.!?다요])\s/)[0];
  return sentence.length <= maxLength ? sentence : `${sentence.slice(0, maxLength - 1)}…`;
}

function entryEligibility(job) {
  const text = decodeHtml([
    job.jobOfferTitle,
    job.employeeTypeName,
    job.qualification,
  ].filter(Boolean).join(' '));
  const matches = text.match(/신입|인턴|어시스턴트|경력\s*무관|entry.?level|intern/gi);
  return matches && matches.length ? [...new Set(matches)] : ['경력'];
}

function mapKakaoJob(job, source) {
  const detailUrl = `https://careers.kakao.com/jobs/${job.realId}`;
  const role = decodeHtml(job.jobTypeName || '테크');
  const summary = firstSentence(job.workContentDesc)
    || firstSentence(job.introduction)
    || `${role} 직군의 ${decodeHtml(job.employeeTypeName || '채용')} 공고`;
  return {
    type: 'JOB',
    sourceId: source.id,
    externalId: String(job.realId || job.jobOfferId),
    url: detailUrl,
    title: decodeHtml(job.jobOfferTitle),
    organization: decodeHtml(job.companyName || source.organization || '카카오'),
    status: job.closeFlag ? 'CLOSED' : 'OPEN',
    publishedAt: job.regDate ? `${job.regDate}+09:00` : null,
    closesAt: job.endDate ? `${job.endDate.slice(0, 10)}T23:59:59+09:00` : null,
    locations: [decodeHtml(job.locationName)].filter(Boolean).concat(source.locations || []),
    eligibility: entryEligibility(job),
    tags: [role, ...((job.skillSetList || []).map((item) => decodeHtml(item.commonName || item.skillSetName)))],
    summary,
    summaryEvidence: [detailUrl],
    attributes: { employeeType: decodeHtml(job.employeeTypeName) },
  };
}

async function collectFromKakaoCareers(source, fetchImpl = fetch) {
  const items = [];
  let page = 1;
  let totalPages = 1;
  do {
    const url = new URL(source.url);
    url.searchParams.set('part', source.part || 'TECHNOLOGY');
    url.searchParams.set('page', String(page));
    const response = await fetchImpl(url, {
      headers: { accept: 'application/json', 'user-agent': 'developer-opportunity-radar/0.1' },
      signal: AbortSignal.timeout(source.timeoutMs || 20_000),
    });
    if (!response.ok) throw new Error(`${source.id}: HTTP ${response.status}`);
    const body = await response.json();
    items.push(...(body.jobList || []).map((job) => mapKakaoJob(job, source)));
    totalPages = Math.min(Number(body.totalPage) || 1, source.maxPages || 10);
    page += 1;
  } while (page <= totalPages);
  return items;
}

module.exports = { collectFromKakaoCareers, mapKakaoJob };
