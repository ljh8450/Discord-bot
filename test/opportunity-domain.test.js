const assert = require('node:assert/strict');
const test = require('node:test');

const profile = require('../config/profile.json');
const { applyProfileFilter } = require('../src/domain/filter');
const { canonicalizeUrl, normalizeOpportunity } = require('../src/domain/opportunity');
const { assessBenefit, validateMinimum } = require('../src/domain/validation');

function job(overrides = {}) {
  return normalizeOpportunity({
    type: 'JOB', sourceId: 'test', externalId: '1',
    url: 'https://jobs.example.com/1?utm_source=test',
    title: '신입 백엔드 개발자', organization: '테스트 회사', status: 'OPEN',
    locations: ['서울'], eligibility: ['신입'], tags: ['백엔드'],
    summary: 'API 서버를 개발합니다', summaryEvidence: ['https://jobs.example.com/1'],
    closesAt: '2026-08-01T18:00:00+09:00', ...overrides,
  }, new Date('2026-07-20T00:00:00Z'));
}

test('canonical URL removes tracking parameters and fragments', () => {
  assert.equal(canonicalizeUrl('https://Example.com/job/1/?utm_source=x&role=backend#apply'), 'https://example.com/job/1?role=backend');
});

test('accepts an entry-level metropolitan backend job', () => {
  assert.equal(applyProfileFilter(job(), profile).decision, 'APPROVED');
});

test('rejects experienced and non-metropolitan jobs', () => {
  assert.equal(applyProfileFilter(job({ title: '백엔드 개발자', eligibility: ['경력 5년'] }), profile).decision, 'REJECTED');
  assert.equal(applyProfileFilter(job({ locations: ['부산'] }), profile).decision, 'REJECTED');
});

test('conservative role passes only for allowlisted organizations', () => {
  assert.equal(applyProfileFilter(job({ title: '신입 임베디드 개발자', tags: ['임베디드'] }), profile).decision, 'REJECTED');
  assert.equal(applyProfileFilter(job({ organization: '네이버', title: '신입 임베디드 개발자', tags: ['임베디드'] }), profile).decision, 'APPROVED');
});

test('minimum validation requires source-grounded summary', () => {
  assert.equal(validateMinimum(job({ summaryEvidence: [] }), new Date('2026-07-20T00:00:00Z')).valid, false);
  assert.equal(validateMinimum(job(), new Date('2026-07-20T00:00:00Z')).valid, true);
});

test('benefit assessment uses explicit evidence flags', () => {
  const opportunity = job({ attributes: { freeOrFunded: true, industryMentoring: true, portfolioProject: true } });
  assert.deepEqual(assessBenefit(opportunity, 3), { decision: 'APPROVED', reason: '혜택 근거 3/8개', score: 3 });
});

test('normalizes external activities as a separate channel type', () => {
  const activity = normalizeOpportunity({
    type: 'EXTERNAL_ACTIVITY',
    sourceId: 'activity-source',
    externalId: 'activity-1',
    url: 'https://example.com/activities/1',
    title: '개발 동아리 모집',
    organization: '개발 커뮤니티',
    status: 'OPEN',
    summary: '팀 프로젝트를 진행하는 개발 동아리',
    summaryEvidence: ['https://example.com/activities/1'],
  });
  assert.equal(activity.type, 'EXTERNAL_ACTIVITY');
  assert.equal(applyProfileFilter(activity, profile).decision, 'APPROVED');
});
