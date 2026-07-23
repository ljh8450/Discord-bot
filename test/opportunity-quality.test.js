const assert = require('node:assert/strict');
const test = require('node:test');

const { mapLinkareerDetail } = require('../src/adapters/linkareer-adapter');
const { mapCampuspickDetail } = require('../src/adapters/campuspick-adapter');
const { mapTicketaEvent } = require('../src/adapters/ticketa-adapter');
const { hasDevelopmentOutput } = require('../src/domain/development-relevance');
const { applyProfileFilter } = require('../src/domain/filter');
const { BRIEF_SOURCES } = require('../src/config/builtin-sources');

function linkareerHtml(activity) {
  return `<script id='__NEXT_DATA__'>${JSON.stringify({ props: { pageProps: {
    data: { activityData: { activity } },
  } } })}</script>`;
}

function mapActivity(activity, type) {
  return mapLinkareerDetail(
    linkareerHtml({
      id: 1, organizationName: '예시 기관', recruitCloseAt: Date.parse('2026-08-20'),
      categories: [], educationTypes: [], skills: [], benefits: [], regions: [], addresses: [],
      targets: [], ...activity,
    }),
    { id: 'linkareer', priority: 100 }, 'https://linkareer.com/activity/1', type,
    new Date('2026-07-20'),
  );
}

test('does not treat an AI video contest as a developer-output competition', () => {
  const item = mapActivity({ title: 'AI 숏폼 영상 공모전', skills: ['AI', '영상 제작'] }, 'HACKATHON');
  assert.equal(item.attributes.developmentOutput, false);
  const decision = applyProfileFilter({
    ...item, canonicalUrl: item.url, tags: item.tags || [], eligibility: item.eligibility || [],
  }, {});
  assert.equal(decision.decision, 'REJECTED');
});

test('rejects creative AI competitions without explicit implementation evidence', () => {
  assert.equal(hasDevelopmentOutput('AI 미디어아트 공모전'), false);
  assert.equal(hasDevelopmentOutput('생성형 AI 영화제 및 숏필름 공모전'), false);
  assert.equal(hasDevelopmentOutput('AI 콘텐츠 제작 UCC 대회'), false);
});

test('keeps creative-domain competitions with explicit software implementation', () => {
  assert.equal(hasDevelopmentOutput('AI 영상 분석 모델 개발 경진대회'), true);
  assert.equal(hasDevelopmentOutput('미디어아트 컴퓨터 비전 API 구현 해커톤'), true);
});

test('drops a Ticketa AI film contest before it reaches the radar', () => {
  const item = mapTicketaEvent({
    id: 'film-1', title: '생성형 AI 숏필름 공모전', status: 'PUBLIC',
    start_date: '2026-08-20T09:00:00+09:00', organization_id: 'AI 문화재단', venues: {},
  }, { id: 'ticketa', priority: 70 }, new Date('2026-07-20'));

  assert.equal(item, null);
});

test('final hackathon filter overrides an incorrect development-output flag', () => {
  const decision = applyProfileFilter({
    type: 'HACKATHON', title: 'AI 미디어아트 영화제 공모전', organization: '문화재단',
    tags: ['AI', '영상 제작'], eligibility: [], locations: [], summary: 'AI 창작 작품 제출',
    attributes: { developmentOutput: true },
  }, {});

  assert.equal(decision.decision, 'REJECTED');
});

test('keeps data and API implementation competitions as developer opportunities', () => {
  const item = mapActivity({
    title: '공공데이터 API 서비스 개발 공모전', skills: ['데이터', 'API'],
  }, 'HACKATHON');
  assert.equal(item.attributes.developmentOutput, true);
  const decision = applyProfileFilter({
    ...item, canonicalUrl: item.url, tags: item.tags || [], eligibility: item.eligibility || [],
  }, {});
  assert.equal(decision.decision, 'APPROVED');
});

test('accepts curated platform developer events in the hackathon channel', () => {
  const decision = applyProfileFilter({
    type: 'HACKATHON', title: 'Android 개발자 밋업', organization: 'GDG',
    tags: ['개발자 행사'], eligibility: [], locations: ['서울'], summary: '기술 발표',
    attributes: { developmentOutput: false, platformDeveloperEvent: true },
  }, {});

  assert.equal(decision.decision, 'APPROVED');
});

test('routes forum, conference, lecture, and seminar contests to external activities', () => {
  for (const title of [
    'AI 개발 포럼 공모전', '클라우드 컨퍼런스 공모전',
    '백엔드 강연 공모전', '개발자 세미나 공모전',
  ]) {
    const item = mapActivity({ title, skills: ['개발'] }, 'HACKATHON');
    const decision = applyProfileFilter(item, {});
    assert.equal(item.type, 'EXTERNAL_ACTIVITY', title);
    assert.equal(decision.decision, 'APPROVED', title);
  }
});

test('includes the requested YouTube insight channels without duplicating EO Korea', () => {
  const youtubeSources = BRIEF_SOURCES.filter((source) => source.kind === 'youtube');
  const organizations = youtubeSources.map((source) => source.organization);
  for (const organization of ['AgentOS', 'EO Korea', '코딩하는 기술사', '코딩애플', 'Chase AI']) {
    assert.equal(organizations.filter((name) => name === organization).length, 1, organization);
  }
});

test('rejects an IT crew without a required development output', () => {
  const item = mapActivity({
    title: '대학생 IT 크루 모집', skills: ['IT'],
    description: 'SNS 콘텐츠 제작과 행사 홍보 및 친목 활동',
  }, 'EXTERNAL_ACTIVITY');
  const decision = applyProfileFilter(item, {});

  assert.equal(item.attributes.verifiedDevelopmentActivity, false);
  assert.equal(decision.decision, 'REJECTED');
  assert.match(decision.reason, /개발 결과물/);
});

test('accepts Protocol Camp as an explicit product-building activity', () => {
  const item = mapActivity({
    title: 'Protocol Camp 10기 모집',
    description: '12주 동안 블록체인 제품 MVP를 개발하고 배포하는 빌더 프로그램',
  }, 'EXTERNAL_ACTIVITY');
  const decision = applyProfileFilter(item, {});

  assert.equal(item.attributes.verifiedDevelopmentActivity, true);
  assert.equal(decision.decision, 'APPROVED');
});

test('accepts GIWA GASOK as an explicit builder activity', () => {
  const item = mapActivity({
    title: 'GIWA GASOK 빌더 프로그램',
    description: 'MVP 구축부터 테스트넷과 메인넷 배포까지 진행',
  }, 'EXTERNAL_ACTIVITY');
  const decision = applyProfileFilter(item, {});

  assert.equal(item.attributes.verifiedDevelopmentActivity, true);
  assert.equal(decision.decision, 'APPROVED');
});

test('applies the conservative activity rule to Campuspick too', () => {
  const html = `<script id='__INITIAL_STATE__'>${JSON.stringify({ activity: {
    id: 11, title: 'AI 서비스 홍보 크루 모집', end_date: '2026-08-20',
    company: '예시 기관', description: 'SNS 카드뉴스와 홍보 영상 제작',
  } })}</script>`;
  const item = mapCampuspickDetail(
    html, { id: 'campuspick', priority: 80 },
    'https://campuspick.com/activity/view?id=11', 'EXTERNAL_ACTIVITY',
    new Date('2026-07-20'),
  );
  const decision = applyProfileFilter(item, {});

  assert.equal(item.attributes.verifiedDevelopmentActivity, false);
  assert.equal(decision.decision, 'REJECTED');
});

test('keeps LG AImers but rejects broad AI programs and hackathon staff roles', () => {
  const cases = [
    {
      title: 'LG AImers 9기 모집',
      description: 'AI 코딩 역량으로 실제 데이터 모델을 개발하는 온라인 해커톤',
      expected: 'APPROVED',
    },
    {
      title: 'SK 대학생 대외활동 써니 C',
      description: 'AI Literacy 학습과 현업 문제 해결 AI 팀 프로젝트',
      expected: 'REJECTED',
    },
    {
      title: 'ONSO FutuRES College 모집',
      description: '미래 사회 문제를 정의하고 해결 솔루션을 기획하는 활동',
      expected: 'REJECTED',
    },
    {
      title: 'AI 해커톤 멘토 모집',
      description: '참가팀 모델 개발과 프로젝트 구현 과정의 기술 멘토링',
      expected: 'REJECTED',
    },
  ];

  for (const [index, current] of cases.entries()) {
    const item = mapActivity({ id: index + 20, ...current }, 'EXTERNAL_ACTIVITY');
    const actual = item ? applyProfileFilter(item, {}).decision : 'REJECTED';
    assert.equal(actual, current.expected, current.title);
  }
});

test('sends aggregator education through benefit review instead of immediate approval', () => {
  const item = mapActivity({
    title: 'AI 서비스 개발자 교육', skills: ['개발'], additionalBenefit: '포트폴리오 프로젝트',
  }, 'EDUCATION');
  assert.equal(item.attributes.immediateCategory, false);
  assert.equal(item.attributes.requiresBenefitReview, true);
});
