const { cleanText } = require('./xml-utils');

function dateTimeWithKst(value) {
  if (!value) return null;
  const text = String(value);
  if (/(?:Z|[+-]\d{2}:\d{2})$/i.test(text)) return text;
  return `${text}+09:00`;
}

function textBlocks(node, blocks = []) {
  if (!node || typeof node !== 'object') return blocks;
  if (node.type === 'paragraph' || node.type === 'listItem') {
    const text = [];
    (function visit(value) {
      if (!value || typeof value !== 'object') return;
      if (value.type === 'text' && value.text) text.push(value.text);
      for (const child of value.content || []) visit(child);
    }(node));
    const cleaned = cleanText(text.join(' '));
    if (cleaned) blocks.push(cleaned);
    return blocks;
  }
  for (const child of node.content || []) textBlocks(child, blocks);
  return blocks;
}

function validUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function mapZighangJob(job, source) {
  const id = String(job.id);
  const zighangUrl = `https://zighang.com/recruitment/${id}`;
  const directUrl = validUrl(job.redirectUrl) || zighangUrl;
  const careerMin = Number(job.careerMin);
  const careerMax = Number(job.careerMax);
  const contentBlocks = textBlocks(job.content);
  const eligibilityText = [
    job.title,
    job.summary,
    ...(job.employeeTypes || []),
    ...contentBlocks,
  ].join(' ');
  const hasExplicitEntryEvidence = /신입|인턴|intern|경력\s*무관/i.test(eligibilityText);
  const hasExperiencedOnlyEvidence = /경력직|경력자|경력\s*(?:최소\s*)?\d+\s*년\s*(?:이상|필수)/i
    .test(eligibilityText)
    && !/신입\s*[·/&,+및또는 ]+\s*경력|신입\/경력|신입\s*및\s*경력/i.test(eligibilityText);
  const inferredCareerMaxYears = source.inferredCareerMaxYears ?? 3;
  const hasTightEntryRange = Number.isFinite(careerMin)
    && careerMin === 0
    && Number.isFinite(careerMax)
    && careerMax <= inferredCareerMaxYears;
  const eligibility = [];
  if ((hasExplicitEntryEvidence || hasTightEntryRange) && !hasExperiencedOnlyEvidence) {
    eligibility.push('신입 지원 가능');
  }
  eligibility.push(...(job.employeeTypes || []), ...(job.educations || []));

  const tags = [
    ...(job.depthOnes || []),
    ...(job.depthTwos || []),
    ...(job.depthThrees || []),
    ...(job.keywords || []),
  ].map((value) => cleanText(String(value).replaceAll('_', '·'))).filter(Boolean);
  const summary = contentBlocks[0]
    || cleanText(job.summary)
    || `${cleanText(job.company?.name) || '기업'}의 ${cleanText(job.title)} 포지션`;

  return {
    type: 'JOB',
    sourceId: source.id,
    externalId: id,
    url: directUrl,
    title: cleanText(job.title),
    organization: cleanText(job.company?.name),
    status: job.status === 'ACTIVE' ? 'OPEN' : 'CLOSED',
    publishedAt: dateTimeWithKst(job.createdAt),
    closesAt: job.deadlineType === '상시채용' ? null : dateTimeWithKst(job.endDate),
    locations: (job.regions || []).map(cleanText).filter(Boolean),
    eligibility: [...new Set(eligibility.map(cleanText).filter(Boolean))],
    tags: [...new Set(tags)],
    summary: summary.slice(0, 220),
    summaryEvidence: [directUrl],
    attributes: {
      careerMinYears: Number.isFinite(careerMin) ? careerMin : null,
      careerMaxYears: Number.isFinite(careerMax) ? careerMax : null,
      affiliate: cleanText(job.affiliate),
      sourceListingUrl: zighangUrl,
      sourceTrust: 'AGGREGATOR_DETAIL',
    },
  };
}

async function fetchData(url, fetchImpl, source) {
  const response = await fetchImpl(url, {
    headers: {
      accept: 'application/json',
      origin: 'https://zighang.com',
      'user-agent': source.userAgent || 'OpportunityRadar/1.0',
    },
    signal: AbortSignal.timeout(source.timeoutMs || 20_000),
  });
  if (!response.ok) throw new Error(`${source.id}: HTTP ${response.status}`);
  const body = await response.json();
  if (body.success === false) {
    throw new Error(`${source.id}: API ${body.code || 'ERROR'} ${body.message || ''}`.trim());
  }
  return body.data;
}

async function collectFromZighangCareers(source, fetchImpl = fetch) {
  const maxItems = source.maxItems || 40;
  const listUrl = new URL(source.url || 'https://api.zighang.com/api/recruitments/v3');
  listUrl.searchParams.set('page', '0');
  listUrl.searchParams.set('size', String(maxItems));
  listUrl.searchParams.set('careerMin', String(source.careerMin ?? 0));
  listUrl.searchParams.set('careerMax', String(source.careerMax ?? 0));
  listUrl.searchParams.set('sortCondition', source.sortCondition || 'LATEST');
  listUrl.searchParams.set('orderCondition', source.orderCondition || 'DESC');
  for (const value of source.depthOnes || ['IT_개발', 'AI_데이터']) {
    listUrl.searchParams.append('depthOnes', value);
  }
  for (const value of source.regions || ['서울', '경기', '인천']) {
    listUrl.searchParams.append('regions', value);
  }

  const list = await fetchData(listUrl, fetchImpl, source);
  const summaries = (list?.content || []).slice(0, maxItems);
  const results = [];
  const batchSize = source.detailConcurrency || 5;
  const detailBaseUrl = source.detailBaseUrl || 'https://api.zighang.com/api/recruitments';
  for (let index = 0; index < summaries.length; index += batchSize) {
    const details = await Promise.all(summaries.slice(index, index + batchSize).map(async (summary) => {
      const detail = await fetchData(`${detailBaseUrl}/${summary.id}`, fetchImpl, source);
      return { ...summary, ...detail };
    }));
    results.push(...details.map((job) => mapZighangJob(job, source)));
  }
  return results.filter((job) => job.status === 'OPEN' && job.title && job.url);
}

module.exports = { collectFromZighangCareers, mapZighangJob };
