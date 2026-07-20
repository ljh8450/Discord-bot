const { cleanText } = require('./xml-utils');

function firstUsefulLine(value, fallback) {
  const line = String(value || '').split(/\r?\n/)
    .map((item) => item.replace(/^[\s•·*-]+/, '').trim()).find(Boolean);
  return cleanText(line || fallback).slice(0, 220);
}

function inferTags(job) {
  const text = [job.position, job.detail?.main_tasks, job.detail?.requirements]
    .join(' ').toLowerCase();
  const rules = [
    ['백엔드', /backend|back-end|서버|백엔드/],
    ['프론트엔드', /frontend|front-end|프론트엔드/],
    ['풀스택', /fullstack|full-stack|풀스택/],
    ['AI Engineer', /ai engineer|머신러닝|machine learning|llm|rag|인공지능/],
    ['FDE', /field.?deployment|fde/],
  ];
  return rules.filter(([, pattern]) => pattern.test(text)).map(([tag]) => tag);
}

function mapWantedJob(job, source) {
  const id = String(job.id);
  const url = `https://www.wanted.co.kr/wd/${id}`;
  const annualFrom = Number(job.annual_from);
  const eligibility = [];
  if (Number.isFinite(annualFrom) && annualFrom === 0) eligibility.push('신입 지원 가능');
  if (/인턴|intern/i.test(`${job.position || ''} ${job.detail?.requirements || ''}`)) {
    eligibility.push('인턴');
  }
  const address = job.address || {};
  const dueTime = job.due_time ? new Date(job.due_time) : null;
  return {
    type: 'JOB', sourceId: source.id, externalId: id, url,
    title: cleanText(job.position),
    organization: cleanText(job.company?.name),
    status: job.status === 'active' && job.hidden !== true ? 'OPEN' : 'CLOSED',
    publishedAt: job.confirm_time || null,
    closesAt: dueTime && !Number.isNaN(dueTime.getTime()) ? dueTime.toISOString() : null,
    locations: [address.location, address.district, address.full_location]
      .map(cleanText).filter(Boolean),
    eligibility,
    tags: inferTags(job),
    summary: firstUsefulLine(
      job.detail?.main_tasks,
      `${job.company?.name || '기업'}의 ${job.position} 포지션`,
    ),
    summaryEvidence: [url],
    attributes: {
      careerMinYears: Number.isFinite(annualFrom) ? annualFrom : null,
      careerMaxYears: Number.isFinite(Number(job.annual_to)) ? Number(job.annual_to) : null,
      sourceTrust: 'AGGREGATOR_DETAIL',
    },
  };
}

async function fetchJson(url, fetchImpl, source) {
  const response = await fetchImpl(url, {
    headers: { accept: 'application/json', 'user-agent': source.userAgent || 'OpportunityRadar/1.0' },
    signal: AbortSignal.timeout(source.timeoutMs || 20_000),
  });
  if (!response.ok) throw new Error(`${source.id}: HTTP ${response.status}`);
  return response.json();
}

async function collectFromWantedCareers(source, fetchImpl = fetch) {
  const listUrl = new URL(source.url || 'https://www.wanted.co.kr/api/v4/jobs');
  const maxItems = source.maxItems || 40;
  for (const [key, value] of Object.entries({
    country: source.country || 'kr',
    tag_type_ids: source.tagTypeId || '518',
    job_sort: 'job.latest_order',
    years: source.years ?? 0,
    locations: 'all',
    limit: maxItems,
    offset: 0,
  })) listUrl.searchParams.set(key, String(value));

  const body = await fetchJson(listUrl, fetchImpl, source);
  const summaries = (body.data || [])
    .filter((item) => item.status === 'active' && item.hidden !== true).slice(0, maxItems);
  const results = [];
  const batchSize = source.detailConcurrency || 5;
  for (let index = 0; index < summaries.length; index += batchSize) {
    const details = await Promise.all(summaries.slice(index, index + batchSize).map(async (summary) => {
      const detail = await fetchJson(
        `https://www.wanted.co.kr/api/v4/jobs/${summary.id}`, fetchImpl, source,
      );
      return { ...summary, ...(detail.job || {}) };
    }));
    results.push(...details.map((job) => mapWantedJob(job, source)));
  }
  return results;
}

module.exports = { collectFromWantedCareers, mapWantedJob };
