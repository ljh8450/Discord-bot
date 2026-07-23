const assert = require('node:assert/strict');
const test = require('node:test');

const { collectFromCampuspick } = require('../src/adapters/campuspick-adapter');
const {
  collectFromEventus, eventusSearchRequest,
} = require('../src/adapters/eventus-adapter');
const { collectFromLinkareer } = require('../src/adapters/linkareer-adapter');
const {
  mapOfficialPage, selectPreferredUrl,
} = require('../src/adapters/official-opportunity-adapter');
const { matchesQuery, normalizeQuery } = require('../src/diagnose-cli');

function response(body, kind = 'text') {
  return {
    ok: true,
    status: 200,
    async text() { return kind === 'text' ? body : JSON.stringify(body); },
    async json() { return kind === 'json' ? body : JSON.parse(body); },
  };
}

function linkareerList(url) {
  return `<script id='__NEXT_DATA__'>${JSON.stringify({ props: { pageProps: {
    activityItems: [{ url }],
  } } })}</script>`;
}

function linkareerDetail(id, title, createdAt) {
  return `<script id='__NEXT_DATA__'>${JSON.stringify({ props: { pageProps: { data: {
    activityData: { activity: {
      id, title, organizationName: '개발 재단', createdAt,
      recruitCloseAt: Date.now() + 86_400_000,
      categories: ['개발'], educationTypes: [], skills: ['API'],
      benefits: [], regions: [], addresses: [], targets: [],
      homepageURL: `https://official.example/${id}`,
    } },
  } } } })}</script>`;
}

test('paginates Linkareer until a page is older than the recent window', async () => {
  const calls = [];
  const recent = Date.now();
  const old = Date.now() - (10 * 86_400_000);
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes('page=1')) return response(linkareerList('https://linkareer.com/activity/1'));
    if (url.includes('page=2')) return response(linkareerList('https://linkareer.com/activity/2'));
    if (url.endsWith('/1')) return response(linkareerDetail(1, 'AI API 개발 해커톤', recent));
    if (url.endsWith('/2')) return response(linkareerDetail(2, '클라우드 서비스 개발 공모전', old));
    throw new Error(`unexpected URL: ${url}`);
  };

  const items = await collectFromLinkareer({
    id: 'linkareer', routes: ['contest'], recentDays: 7, maxPagesPerRoute: 5,
  }, fetchImpl);

  assert.equal(items.length, 2);
  assert.equal(items.collectionStats.pagesFetched, 2);
  assert.match(items.collectionStats.stopReason, /older than 7 days/);
  assert.equal(calls.some((url) => url.includes('page=3')), false);
});

function campusList(url) {
  return `<script type='application/ld+json'>${JSON.stringify({
    itemListElement: [{ '@type': 'ListItem', url }],
  })}</script>`;
}

function campusDetail(id, title, createdAt) {
  return `<script id='__INITIAL_STATE__'>${JSON.stringify({ activity: {
    id, title, created_at: createdAt, end_date: '2099-08-30',
    website: `https://official.example/${id}`, company: '개발 재단',
    description: 'API 서비스를 개발하고 배포하는 프로젝트',
  } })}</script>`;
}

test('paginates Campuspick and exposes collection-stage statistics', async () => {
  const recent = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const old = new Date(Date.now() - (10 * 86_400_000)).toISOString().slice(0, 19).replace('T', ' ');
  const fetchImpl = async (url) => {
    if (url.includes('page=1')) return response(campusList('https://www.campuspick.com/contest/view?id=1'));
    if (url.includes('page=2')) return response(campusList('https://www.campuspick.com/contest/view?id=2'));
    if (url.endsWith('id=1')) return response(campusDetail(1, 'AI API 개발 해커톤', recent));
    if (url.endsWith('id=2')) return response(campusDetail(2, '웹 서비스 개발 공모전', old));
    throw new Error(`unexpected URL: ${url}`);
  };

  const items = await collectFromCampuspick({
    id: 'campuspick', routes: ['contest'], recentDays: 7, maxPagesPerRoute: 5,
  }, fetchImpl);

  assert.equal(items.length, 2);
  assert.equal(items.collectionStats.pagesFetched, 2);
  assert.equal(items.collectionStats.detailRequests, 2);
});

test('builds Event-us category and deadline filters', () => {
  const request = eventusSearchRequest({
    category: 'IT/프로그래밍',
    keyword: 'AI Agent',
    page: 2,
    now: new Date('2026-07-24T00:00:00Z'),
  });

  assert.equal(request.query, 'AI Agent');
  assert.equal(request.page.current, 2);
  assert.deepEqual(
    request.filters.all.find((filter) => filter.category),
    { category: ['IT/프로그래밍'] },
  );
  assert.equal(
    request.filters.all.find((filter) => filter.register_due_date)
      .register_due_date.from,
    '2026-07-24T00:00:00.000Z',
  );
});

test('deduplicates Event-us keyword results across search plans', async () => {
  const raw = {
    id: { raw: '130848' },
    title: { raw: 'AGENT:24 AI 에이전트 해커톤' },
    subdomain: { raw: 'yai' },
    register_due_date: { raw: '2099-07-28T14:59:00Z' },
    category: { raw: 'IT/프로그래밍' },
    event_type: { raw: '대회/공모전' },
    description: { raw: 'AI 에이전트 API 서비스를 직접 개발하고 라이브 데모로 발표' },
    tags: { raw: ['AI', '개발'] },
  };
  const fetchImpl = async () => response({
    meta: { page: { total_pages: 1 } },
    results: [raw],
  }, 'json');

  const items = await collectFromEventus({
    id: 'eventus-keyword', keywords: ['AGENT', '해커톤'], maxKeywordPages: 1,
  }, fetchImpl);

  assert.equal(items.length, 1);
  assert.equal(items[0].title.includes('AGENT:24'), true);
  assert.equal(items.collectionStats.duplicates, 1);
});

test('maps a configured official builder page and prefers its official application domain', () => {
  const source = {
    id: 'official-builders',
    url: 'https://news.example/article',
    preferredDomains: ['giwa.io'],
    organization: '두나무·GIWA',
    tags: ['개발'],
  };
  const page = {
    url: 'https://giwa.io/gasok?lang=ko',
    applicationUrl: 'https://giwa.io/gasok/apply',
    title: 'GIWA GASOK 빌더 프로그램',
    closesAt: '2099-07-31T23:59:59+09:00',
    developmentOutput: true,
  };
  const item = mapOfficialPage('<html><body>MVP 개발과 배포</body></html>', source, page);

  assert.equal(item.url, 'https://giwa.io/gasok/apply');
  assert.equal(item.attributes.officialSource, true);
  assert.equal(item.attributes.developmentOutput, true);
  assert.equal(selectPreferredUrl([
    'https://news.example/article', 'https://giwa.io/gasok',
  ], source), 'https://giwa.io/gasok');
});

test('diagnostic title matching ignores punctuation and whitespace', () => {
  assert.equal(normalizeQuery('AGENT: 24'), 'agent24');
  assert.equal(matchesQuery({ title: 'AGENT:24 — AI 해커톤' }, 'agent 24'), true);
});
