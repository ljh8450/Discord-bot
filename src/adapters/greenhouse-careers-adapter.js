const { cleanText } = require('./xml-utils');

function includesAny(value, terms) {
  const text = cleanText(value).toLowerCase();
  return (terms || []).some((term) => text.includes(String(term).toLowerCase()));
}

function inferRoleTags(title) {
  const rules = [
    ['백엔드', /backend|back-end|server/i],
    ['프론트엔드', /frontend|front-end/i],
    ['풀스택', /fullstack|full-stack/i],
    ['AI Engineer', /ai|machine learning|ml engineer|data scientist/i],
  ];
  return rules.filter(([, pattern]) => pattern.test(title)).map(([tag]) => tag);
}

function mapGreenhouseJob(job, source) {
  const location = cleanText(job.location?.name);
  const title = cleanText(job.title);
  return {
    type: 'JOB', sourceId: source.id, externalId: String(job.id), url: job.absolute_url,
    title, organization: source.organization, status: 'OPEN',
    publishedAt: job.updated_at || null, closesAt: null,
    locations: [location].filter(Boolean),
    eligibility: [source.entryLabel || '신입 지원 가능'],
    tags: inferRoleTags(title),
    summary: `${source.organization}의 ${title} 포지션`,
    summaryEvidence: [job.absolute_url],
    attributes: { sourceTrust: 'OFFICIAL_CAREERS' },
  };
}

async function collectFromGreenhouseCareers(source, fetchImpl = fetch) {
  const response = await fetchImpl(source.url, {
    headers: { accept: 'application/json', 'user-agent': source.userAgent || 'OpportunityRadar/1.0' },
    signal: AbortSignal.timeout(source.timeoutMs || 30_000),
  });
  if (!response.ok) throw new Error(`${source.id}: HTTP ${response.status}`);
  const body = await response.json();
  const locationPattern = source.locationPattern ? new RegExp(source.locationPattern, 'i') : null;
  return (body.jobs || [])
    .filter((job) => !locationPattern || locationPattern.test(job.location?.name || ''))
    .filter((job) => includesAny(job.title, source.roleTerms))
    .filter((job) => includesAny(job.title, source.entryLevelTerms))
    .slice(0, source.maxItems || 40)
    .map((job) => mapGreenhouseJob(job, source));
}

module.exports = { collectFromGreenhouseCareers, mapGreenhouseJob };
