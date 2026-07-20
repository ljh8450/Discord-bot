const assert = require('node:assert/strict');
const test = require('node:test');

const { mapWantedJob } = require('../src/adapters/wanted-careers-adapter');

test('maps a Wanted entry-level detail response into a grounded job', () => {
  const item = mapWantedJob({
    id: 12345,
    status: 'active',
    hidden: false,
    position: 'AI 백엔드 개발자 (신입)',
    annual_from: 0,
    annual_to: 2,
    company: { name: '예시테크' },
    address: { location: '서울', district: '강남구', full_location: '서울 강남구' },
    due_time: '2026-08-31T14:59:59Z',
    detail: {
      main_tasks: '• LLM 기반 검색 API를 개발합니다.\n• 데이터 파이프라인을 운영합니다.',
      requirements: '신입 지원 가능, Python 사용 경험',
    },
  }, { id: 'wanted-entry-developers' });

  assert.equal(item.externalId, '12345');
  assert.equal(item.organization, '예시테크');
  assert.ok(item.eligibility.includes('신입 지원 가능'));
  assert.ok(item.tags.includes('백엔드'));
  assert.ok(item.tags.includes('AI Engineer'));
  assert.match(item.summary, /LLM 기반 검색 API/);
  assert.equal(item.summaryEvidence[0], 'https://www.wanted.co.kr/wd/12345');
});
