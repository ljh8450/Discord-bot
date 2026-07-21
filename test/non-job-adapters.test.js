const assert = require('node:assert/strict');
const test = require('node:test');

const { parseDaconPage } = require('../src/adapters/dacon-adapter');
const { collectFromGdgEvents, parseEventPage } = require('../src/adapters/gdg-events-adapter');
const { parseCoursePage } = require('../src/adapters/programmers-education-adapter');
const { parseRssFeed } = require('../src/adapters/rss-feed-adapter');
const { parseGeekNewsPopular } = require('../src/adapters/geeknews-adapter');
const { collectFromYouTube, parseYouTubeFeed } = require('../src/adapters/youtube-feed-adapter');
const { mapLinkareerDetail } = require('../src/adapters/linkareer-adapter');
const { mapCampuspickDetail } = require('../src/adapters/campuspick-adapter');
const { mapTicketaEvent } = require('../src/adapters/ticketa-adapter');

test('maps current DACON competitions and hackathons', () => {
  const title = JSON.stringify('AI 서비스 경진대회');
  const keyword = JSON.stringify('AI | 개발 | 서비스');
  const officialEnd = JSON.stringify('2026-08-01 18:00:00');
  const id = JSON.stringify('hack-1');
  const hackTitle = JSON.stringify('AI 해커톤');
  const url = JSON.stringify('https://example.com/hack');
  const hackEnd = JSON.stringify('2026-08-02 18:00:00');
  const html = `onGoingCompetitions:[{cpt_id:123,name:${title},keyword:${keyword},period_end:${officialEnd}}],dakerHackathons:[{id:${id},title:${hackTitle},url:${url},endDate:${hackEnd}}]`;
  const items = parseDaconPage(html, { id: 'dacon' }, new Date('2026-07-20T00:00:00Z'));
  assert.equal(items.length, 2);
  assert.ok(items.every((item) => item.type === 'HACKATHON'));
});

test('maps future GDG schema events', () => {
  const event = {
    '@type': 'Event', name: 'AI 개발자 밋업', startDate: '2026-08-01T19:00:00+09:00',
    endDate: '2026-08-01T21:00:00+09:00', description: '개발자 hands-on 워크숍',
    organizer: { name: 'GDG Seoul' }, location: { address: { addressLocality: '서울' } },
  };
  const html = `<script type='application/ld+json'>${JSON.stringify(event)}</script>`;
  const item = parseEventPage(
    html, { id: 'gdg' }, 'https://gdg.community.dev/events/details/example/',
    new Date('2026-07-20T00:00:00Z'),
  );
  assert.equal(item.type, 'EXTERNAL_ACTIVITY');
  assert.deepEqual(item.locations, ['서울']);
});

test('retries transient GDG errors and isolates a failed chapter', async () => {
  const eventUrl = 'https://gdg.community.dev/events/details/gdg-seoul-ai-meetup/';
  const attempts = new Map();
  const fetchImpl = async (url) => {
    attempts.set(url, (attempts.get(url) || 0) + 1);
    if (url.endsWith('/broken/')) return { ok: false, status: 502 };
    if (url.endsWith('/retry/') && attempts.get(url) === 1) return { ok: false, status: 502 };
    if (url.endsWith('/retry/')) {
      return { ok: true, async text() { return `<a href="${eventUrl}">event</a>`; } };
    }
    return {
      ok: true,
      async text() {
        return `<script type="application/ld+json">${JSON.stringify({
          '@type': 'Event', name: 'AI 개발자 밋업',
          startDate: '2026-08-01T19:00:00+09:00',
          endDate: '2026-08-01T21:00:00+09:00',
          description: '개발자 hands-on 워크숍',
        })}</script>`;
      },
    };
  };
  const items = await collectFromGdgEvents({
    id: 'gdg', urls: ['https://example.com/retry/', 'https://example.com/broken/'],
    retryAttempts: 2, retryDelayMs: 0,
  }, fetchImpl);
  assert.equal(attempts.get('https://example.com/retry/'), 2);
  assert.equal(attempts.get('https://example.com/broken/'), 2);
  assert.equal(items.length, 1);
});

test('maps an open funded Programmers education course', () => {
  const html = `<meta property='og:title' content='AI 백엔드 데브코스'> 모집 기간 ~ 26년 8월 5일 국비 전액 무료 멘토 코드리뷰 팀 프로젝트 취업 지원`;
  const item = parseCoursePage(
    html, { id: 'devcourse' }, 'https://school.programmers.co.kr/learn/courses/1',
    new Date('2026-07-20T00:00:00Z'),
  );
  assert.equal(item.type, 'EDUCATION');
  assert.equal(item.attributes.freeOrFunded, true);
});

test('maps official RSS items into content opportunities', () => {
  const xml = `<rss><channel><item><title>AI agent API update</title><link>https://example.com/post</link><guid>post-1</guid><pubDate>Mon, 20 Jul 2026 01:00:00 GMT</pubDate><description>Developer tooling update</description></item></channel></rss>`;
  const [item] = parseRssFeed(xml, { id: 'official', organization: 'Official', tags: ['AI'] });
  assert.equal(item.type, 'CONTENT');
  assert.equal(item.externalId, 'post-1');
});

test('maps Atom entries from Korean tech blogs', () => {
  const xml = `<feed><entry><title>NAVER AI 운영 사례</title><link rel="alternate" href="https://d2.naver.com/helloworld/1"/><id>post-1</id><published>2026-07-20T01:00:00+09:00</published><content type="html"><![CDATA[실서비스에 AI를 도입한 사례]]></content></entry></feed>`;
  const [item] = parseRssFeed(xml, {
    id: 'naver-d2', organization: 'NAVER D2', tags: ['AI'],
  });
  assert.equal(item.externalId, 'post-1');
  assert.equal(item.url, 'https://d2.naver.com/helloworld/1');
  assert.equal(item.attributes.feedFormat, 'atom');
});

test('keeps only popular GeekNews homepage items', () => {
  const row = (id, rank, points, title) => `<div class='topic_row' data-topic-state-id='${id}'><div class=votenum>${rank}</div><div class=topictitle><a href='https://example.com/${id}'><h2 class='topic-title-heading'>${title}</h2></a></div><div class='topicdesc'><a href='topic?id=${id}'>실무 개발 사례 요약</a></div><div class='topicinfo'><span id='tp${id}'>${points}</span><time datetime='2026-07-20T09:00:00+09:00'>1일전</time></div></div>`;
  const items = parseGeekNewsPopular(
    `${row(1, 1, 12, '인기 AI 개발 글')}${row(2, 2, 2, '새 글')}`,
    { id: 'geeknews-popular', url: 'https://news.hada.io/', minPoints: 5, maxRank: 20 },
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].attributes.communityPoints, 12);
  assert.equal(items[0].summaryEvidence[0], 'https://news.hada.io/topic?id=1');
});

test('collects recent regular YouTube videos and excludes Shorts', () => {
  const entry = (id, title, published, description = 'AI 개발 실무 영상') => `
    <entry>
      <id>yt:video:${id}</id>
      <title>${title}</title>
      <link rel="alternate" href="https://www.youtube.com/watch?v=${id}"/>
      <published>${published}</published>
      <media:group><media:description>${description}</media:description></media:group>
    </entry>`;
  const xml = `<feed>
    ${entry('regular', 'AI 에이전트 구현 사례', '2026-07-20T01:00:00Z')}
    ${entry('short', 'AI 뉴스 #Shorts', '2026-07-21T01:00:00Z')}
  </feed>`;
  const items = parseYouTubeFeed(xml, {
    id: 'youtube-test', channelId: 'channel-1', organization: '테스트 채널',
    tags: ['AI'], dormancyDays: 90,
  }, new Date('2026-07-21T12:00:00Z'));
  assert.equal(items.length, 1);
  assert.equal(items[0].externalId, 'yt:video:regular');
  assert.equal(items[0].attributes.contentFormat, 'VIDEO');
  assert.match(items[0].summary, /개발 실무/);
});

test('marks a YouTube channel dormant when it has no recent regular video', () => {
  const xml = `<feed><entry>
    <id>yt:video:old</id><title>오래된 AI 영상</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=old"/>
    <published>2025-01-01T00:00:00Z</published>
    <media:group><media:description>AI 개발</media:description></media:group>
  </entry></feed>`;
  const items = parseYouTubeFeed(xml, {
    id: 'youtube-dormant', channelId: 'channel-2', organization: '휴면 채널',
    tags: ['AI'], dormancyDays: 90,
  }, new Date('2026-07-21T12:00:00Z'));
  assert.deepEqual(items, []);
});

test('retries a transient YouTube feed response', async () => {
  let attempts = 0;
  const fetchImpl = async () => {
    attempts += 1;
    if (attempts === 1) return { ok: false, status: 404 };
    return {
      ok: true,
      async text() {
        return `<feed><entry>
          <id>yt:video:retry</id><title>AI 개발 실무</title>
          <link rel="alternate" href="https://www.youtube.com/watch?v=retry"/>
          <published>2026-07-20T00:00:00Z</published>
          <media:group><media:description>AI 에이전트 구현</media:description></media:group>
        </entry></feed>`;
      },
    };
  };
  const items = await collectFromYouTube({
    id: 'youtube-retry', channelId: 'channel-3', organization: '재시도 채널',
    tags: ['AI'], retryAttempts: 2, retryDelayMs: 0,
  }, fetchImpl);
  assert.equal(attempts, 2);
  assert.equal(items.length, 1);
});

test('maps a tech contest from Linkareer with its original URL', () => {
  const activity = { id: 7, title: 'AI 서비스 공모전', organizationName: '테크재단',
    recruitCloseAt: Date.parse('2026-08-01T09:00:00Z'), categories: [{ name: '과학/공학' }],
    educationTypes: [], skills: ['AI'], benefits: [{ name: '상장 수여' }],
    homepageURL: 'https://example.com/contest', regions: [], addresses: [], targets: [] };
  const html = `<script id='__NEXT_DATA__'>${JSON.stringify({ props: { pageProps: {
    data: { activityData: { activity } } } } })}</script>`;
  const item = mapLinkareerDetail(html, { id: 'linkareer', priority: 100 },
    'https://linkareer.com/activity/7', 'HACKATHON', new Date('2026-07-20'));
  assert.equal(item.url, 'https://example.com/contest');
  assert.equal(item.attributes.sourcePriority, 100);
});

test('maps Campuspick and Ticketa tech events', () => {
  const activity = { id: 8, title: 'AI 개발 해커톤', end_date: '2026-08-02',
    website: 'https://example.com/hack', company: '테크재단', description: 'AI 앱 개발',
    prize_total: 100, region: '서울' };
  const html = `<script id='__INITIAL_STATE__'>${JSON.stringify({ activity })}</script>`;
  const camp = mapCampuspickDetail(html, { id: 'campuspick', priority: 80 },
    'https://campuspick.com/contest/view?id=8', 'HACKATHON', new Date('2026-07-20'));
  assert.equal(camp.attributes.financialSupport, true);
  const ticket = mapTicketaEvent({ id: 'abc', title: '개발자 AI 밋업', status: 'PUBLIC',
    start_date: '2026-08-03T10:00:00Z', venues: { province: '서울' } },
  { id: 'ticketa', priority: 70 }, new Date('2026-07-20'));
  assert.equal(ticket.url, 'https://ticketa.co/event/abc');
});
