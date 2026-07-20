const assert = require('node:assert/strict');
const test = require('node:test');

const { mapLinkareerDetail } = require('../src/adapters/linkareer-adapter');
const { applyProfileFilter } = require('../src/domain/filter');

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

test('sends aggregator education through benefit review instead of immediate approval', () => {
  const item = mapActivity({
    title: 'AI 서비스 개발자 교육', skills: ['개발'], additionalBenefit: '포트폴리오 프로젝트',
  }, 'EDUCATION');
  assert.equal(item.attributes.immediateCategory, false);
  assert.equal(item.attributes.requiresBenefitReview, true);
});
