const assert = require('node:assert/strict');
const test = require('node:test');

const { parseDaconPage } = require('../src/adapters/dacon-adapter');
const { parseEventPage } = require('../src/adapters/gdg-events-adapter');
const { parseCoursePage } = require('../src/adapters/programmers-education-adapter');
const { parseRssFeed } = require('../src/adapters/rss-feed-adapter');
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
