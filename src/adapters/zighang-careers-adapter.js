const { cleanText } = require('./xml-utils');
const { attachCollectionStats } = require('./collection-stats');

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

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

async function fetchData(url, fetchImpl, source, attempts = source.retryAttempts || 3) {
  const baseDelayMs = source.retryDelayMs ?? 500;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: {
          accept: 'application/json',
          origin: 'https://zighang.com',
          'user-agent': source.userAgent || 'OpportunityRadar/1.0',
        },
        signal: AbortSignal.timeout(source.timeoutMs || 20_000),
      });
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`);
        if (!RETRYABLE_STATUSES.has(response.status)) throw lastError;
      } else {
        const body = await response.json();
        if (body.success === false) {
          throw new Error(`API ${body.code || 'ERROR'} ${body.message || ''}`.trim());
        }
        return body.data;
      }
    } catch (error) {
      lastError = error;
      if (/^(?:HTTP 4\d\d|API )/.test(error.message)
        && !/^HTTP 429$/.test(error.message)) throw error;
    }
    if (attempt < attempts && baseDelayMs > 0) await delay(baseDelayMs * attempt);
  }
  throw new Error(`${source.id}: ${lastError?.message || 'request failed'} after ${attempts} attempts`);
}

async function collectDetails(summaries, workerCount, loadDetail) {
  const results = new Array(summaries.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < summaries.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = { status: 'fulfilled', value: await loadDetail(summaries[index]) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(workerCount, summaries.length) }, () => worker()),
  );
  return results;
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
  if (!summaries.length) return attachCollectionStats([], { stopReason: 'empty listing' });
  const concurrency = Math.max(1, source.detailConcurrency || 5);
  const detailBaseUrl = source.detailBaseUrl || 'https://api.zighang.com/api/recruitments';
  const settled = await collectDetails(summaries, concurrency, async (summary) => {
    const detail = await fetchData(
      `${detailBaseUrl}/${summary.id}`,
      fetchImpl,
      source,
      source.detailRetryAttempts || 2,
    );
    return { ...summary, ...detail };
  });
  const fulfilled = settled.filter((result) => result.status === 'fulfilled');
  if (!fulfilled.length) {
    const firstFailure = settled.find((result) => result.status === 'rejected')?.reason;
    throw new Error(
      `${source.id}: all ${summaries.length} detail requests failed`
      + (firstFailure ? `; first error: ${firstFailure.message}` : ''),
    );
  }
  const results = fulfilled
    .map((result) => mapZighangJob(result.value, source))
    .filter((job) => job.status === 'OPEN' && job.title && job.url);
  const failedDetailRequests = settled.length - fulfilled.length;
  return attachCollectionStats(results, {
    pagesFetched: 1,
    listingItems: summaries.length,
    detailRequests: summaries.length,
    failedDetailRequests,
    rejected: fulfilled.length - results.length,
    stopReason: failedDetailRequests ? 'partial detail failures' : 'listing exhausted',
  });
}

module.exports = { collectFromZighangCareers, mapZighangJob };
