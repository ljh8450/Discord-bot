const {
  hasDevelopmentOutput, inferType, isExternalEvent, isTechRelevant, requestOptions,
} = require('./platform-utils');
const { attachCollectionStats } = require('./collection-stats');
const value = (x, key) => x?.[key]?.raw ?? null;

const EVENTUS_BOOSTS = {
  complate_score: {
    type: 'functional', function: 'linear', operation: 'add', factor: 0.3,
  },
  popular_score: {
    type: 'functional', function: 'linear', operation: 'add', factor: 0.2,
  },
  click_score: {
    type: 'functional', function: 'logarithmic', operation: 'add', factor: 0.1,
  },
  submit_score: {
    type: 'functional', function: 'logarithmic', operation: 'add', factor: 1,
  },
  correction_value: {
    type: 'functional', function: 'linear', operation: 'add', factor: 1,
  },
  date: {
    type: 'proximity', function: 'linear', center: 'now', factor: 0,
  },
};

function mapEventusResult(x, source, now = new Date()) {
  const id = value(x, 'id'); const title = value(x, 'title');
  const subdomain = value(x, 'subdomain');
  const closesAt = value(x, 'register_due_date') || value(x, 'close_date');
  if (!id || !title || !subdomain || !closesAt || new Date(closesAt) < now
    || !isTechRelevant(
      title, value(x, 'description'), value(x, 'tags'),
      value(x, 'category'), value(x, 'event_type'),
    )) return null;
  const url = `https://event-us.kr/${subdomain}/event/${id}`;
  const developmentOutput = hasDevelopmentOutput(
    title, value(x, 'description'), value(x, 'tags'),
    value(x, 'category'), value(x, 'event_type'),
  );
  const eventText = [title, value(x, 'category'), value(x, 'event_type')];
  const type = inferType(eventText, 'HACKATHON');
  if (type === 'HACKATHON' && !developmentOutput) return null;
  return {
    type, sourceId: source.id, externalId: String(id), url, title, closesAt,
    status: 'OPEN',
    publishedAt: value(x, 'date'),
    organization: value(x, 'fullname') || value(x, 'app_title') || '이벤터스 등록 기관',
    locations: [value(x, 'area'), value(x, 'area_detail'), value(x, 'place')].filter(Boolean),
    eligibility: ['참가 조건 상세 확인'],
    tags: [
      value(x, 'category'), value(x, 'event_type'), ...(value(x, 'tags') || []), '개발자 행사',
    ].filter(Boolean),
    summary: String(value(x, 'description')
      || `${value(x, 'event_type') || '행사'} · ${value(x, 'area_detail') || '장소 상세 확인'}`)
      .replace(/<[^>]*>/g, ' ').slice(0, 280),
    summaryEvidence: [url], attributes: { sourcePriority: source.priority,
      developmentOutput, platformDeveloperEvent: isExternalEvent(eventText) },
  };
}

function searchData(html) {
  const value = html.match(/searchDataRaw: (\{.*\}),\s*banners:/s)?.[1];
  return value ? JSON.parse(value) : {};
}

function eventusSearchRequest({
  category,
  keyword = '',
  page = 1,
  pageSize = 12,
  now = new Date(),
}) {
  const all = [
    { state: 'Start' },
    { disclosure_status: 'open' },
    { is_ignore: 'false' },
    { register_due_date: { from: now.toISOString() } },
  ];
  if (category) all.push({ category: [category] });
  return {
    query: keyword,
    page: { current: page, size: pageSize },
    filters: { all },
    boosts: EVENTUS_BOOSTS,
    sort: [{ date: 'desc' }, { id: 'desc' }],
  };
}

async function searchEventus(source, search, fetchImpl, now = new Date()) {
  const response = await fetchImpl(
    source.apiUrl || 'https://api.event-us.kr/api/v1/engine/search',
    {
      ...requestOptions(),
      method: 'POST',
      headers: {
        ...requestOptions().headers,
        'content-type': 'application/json',
      },
      body: JSON.stringify(eventusSearchRequest({ ...search, now })),
    },
  );
  if (!response.ok) throw new Error(`${source.id}: search HTTP ${response.status}`);
  return response.json();
}

async function collectFromEventus(source, fetchImpl = fetch) {
  const output = [];
  const seen = new Set();
  const plans = [
    ...(source.categories || []).map((category) => ({ category })),
    ...(source.keywords || []).map((keyword) => ({ keyword })),
  ];
  if (!plans.length) plans.push({});
  let pagesFetched = 0;
  let listingItems = 0;
  let rejected = 0;
  let duplicates = 0;
  for (const plan of plans) {
    const maxPages = plan.keyword
      ? (source.maxKeywordPages || 2)
      : (source.maxPagesPerCategory || source.maxPages || 3);
    for (let page = 1; page <= maxPages; page += 1) {
      const data = await searchEventus(source, {
        ...plan,
        page,
        pageSize: source.pageSize || 12,
      }, fetchImpl);
      pagesFetched += 1;
      const results = data.results || [];
      listingItems += results.length;
      for (const raw of results) {
        const id = String(value(raw, 'id') || '');
        if (seen.has(id)) {
          duplicates += 1;
          continue;
        }
        seen.add(id);
        const item = mapEventusResult(raw, source);
        if (item) output.push(item);
        else rejected += 1;
      }
      const totalPages = data.meta?.page?.total_pages || 1;
      if (!results.length || page >= totalPages) break;
    }
  }
  const limited = output.slice(0, source.maxItems || 100);
  return attachCollectionStats(limited, {
    pagesFetched,
    listingItems,
    mapped: limited.length,
    rejected,
    duplicates,
    stopReason: output.length > limited.length ? 'maxItems reached' : 'search plans exhausted',
  });
}

module.exports = {
  collectFromEventus,
  eventusSearchRequest,
  mapEventusResult,
  searchData,
  searchEventus,
};
