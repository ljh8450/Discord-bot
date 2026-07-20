const { cleanText } = require('./xml-utils');

function valueName(value) {
  if (value && typeof value === 'object') return cleanText(value.name);
  return cleanText(value);
}

function timestampIso(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapSaraminJob(job, source) {
  const position = job.position || {};
  const experience = position['experience-level'] || {};
  const closeType = job['close-type'] || {};
  const keyword = valueName(job.keyword);
  const tags = [
    valueName(position['job-mid-code']),
    valueName(position['job-code']),
    ...keyword.split(',').map((item) => cleanText(item)),
  ].filter(Boolean);
  const experienceName = valueName(experience);
  const jobType = valueName(position['job-type']);
  const education = valueName(position['required-education-level']);
  const closeCode = String(closeType.code || '');

  return {
    type: 'JOB', sourceId: source.id, externalId: String(job.id), url: job.url,
    title: cleanText(position.title),
    organization: valueName(job.company?.detail || job.company?.name),
    status: String(job.active) === '1' ? 'OPEN' : 'CLOSED',
    publishedAt: timestampIso(job['posting-timestamp']),
    closesAt: closeCode === '1' ? timestampIso(job['expiration-timestamp']) : null,
    locations: [valueName(position.location)].filter(Boolean),
    eligibility: [experienceName, jobType, education].filter(Boolean),
    tags,
    summary: keyword || `${valueName(position['job-code']) || '개발'} 직무 채용 공고`,
    summaryEvidence: [job.url],
    attributes: {
      careerMinYears: Number.isFinite(Number(experience.min)) ? Number(experience.min) : null,
      careerMaxYears: Number.isFinite(Number(experience.max)) ? Number(experience.max) : null,
      sourceTrust: 'AGGREGATOR_API',
    },
  };
}

async function collectFromSaraminCareers(source, fetchImpl = fetch, env = process.env) {
  const accessKey = source.accessKey || env[source.accessKeyEnv || 'SARAMIN_ACCESS_KEY'];
  if (!accessKey) throw new Error(`${source.id}: access key is not configured`);
  const url = new URL(source.url || 'https://oapi.saramin.co.kr/job-search');
  const parameters = {
    'access-key': accessKey,
    job_mid_cd: source.jobMidCode || '2',
    count: source.maxItems || 100,
    sort: source.sort || 'pd',
    fields: 'posting-date expiration-date',
    sr: source.excludeRecruiters === false ? undefined : 'directhire',
    loc_mcd: source.locationCodes,
  };
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  const response = await fetchImpl(url, {
    headers: { accept: 'application/json', 'user-agent': source.userAgent || 'OpportunityRadar/1.0' },
    signal: AbortSignal.timeout(source.timeoutMs || 20_000),
  });
  if (!response.ok) throw new Error(`${source.id}: HTTP ${response.status}`);
  const body = await response.json();
  if (body.result?.code) throw new Error(`${source.id}: API ${body.result.code} ${body.result.message || ''}`.trim());
  const jobs = body.jobs?.job;
  return (Array.isArray(jobs) ? jobs : jobs ? [jobs] : [])
    .map((job) => mapSaraminJob(job, source))
    .filter((job) => job.status === 'OPEN' && job.title && job.url);
}

module.exports = { collectFromSaraminCareers, mapSaraminJob };
