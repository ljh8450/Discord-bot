const assert = require('node:assert/strict');
const test = require('node:test');

const {
  collectFromZighangCareers,
  mapZighangJob,
} = require('../src/adapters/zighang-careers-adapter');

function detail(overrides = {}) {
  return {
    id: '94338859-c1d1-440c-8bb1-dd9b04412aa6',
    status: 'ACTIVE',
    affiliate: '그룹바이',
    company: { name: '예시테크' },
    title: 'AI 백엔드 엔지니어',
    createdAt: '2026-07-24T09:00:00',
    endDate: '2026-08-31T23:59:59',
    deadlineType: '마감일',
    careerMin: 0,
    careerMax: 2,
    regions: ['서울'],
    employeeTypes: ['정규직'],
    educations: ['학력무관'],
    depthOnes: ['IT_개발', 'AI_데이터'],
    depthTwos: ['서버_백엔드', 'LLM'],
    keywords: ['Node.js'],
    redirectUrl: 'https://company.example/jobs/123',
    content: {
      type: 'doc',
      content: [{
        type: 'heading',
        content: [{ type: 'text', text: '주요업무' }],
      }, {
        type: 'paragraph',
        content: [{ type: 'text', text: 'LLM 검색 API와 데이터 파이프라인을 개발합니다.' }],
      }],
    },
    ...overrides,
  };
}

test('maps a Zighang detail to an entry-level job with a direct source URL', () => {
  const item = mapZighangJob(detail(), { id: 'zighang-entry-developers' });

  assert.equal(item.url, 'https://company.example/jobs/123');
  assert.equal(item.status, 'OPEN');
  assert.equal(item.publishedAt, '2026-07-24T09:00:00+09:00');
  assert.equal(item.closesAt, '2026-08-31T23:59:59+09:00');
  assert.ok(item.eligibility.includes('신입 지원 가능'));
  assert.ok(item.tags.includes('서버·백엔드'));
  assert.match(item.summary, /LLM 검색 API/);
  assert.equal(
    item.attributes.sourceListingUrl,
    'https://zighang.com/recruitment/94338859-c1d1-440c-8bb1-dd9b04412aa6',
  );
});

test('does not infer entry-level eligibility from a broad zero-minimum career range', () => {
  const item = mapZighangJob(detail({
    title: '[경력직] 시스템 운영 개발자',
    careerMin: 0,
    careerMax: 100,
    content: {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: '관련 경력 3년 이상 필수' }],
      }],
    },
  }), { id: 'zighang-entry-developers' });

  assert.equal(item.eligibility.includes('신입 지원 가능'), false);
});

test('collects filtered Zighang summaries and enriches them with details', async () => {
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(String(url));
    const isDetail = /\/recruitments\/[^/?]+$/.test(String(url));
    return {
      ok: true,
      json: async () => ({
        success: true,
        data: isDetail
          ? detail()
          : { content: [{ id: detail().id }] },
      }),
    };
  };

  const items = await collectFromZighangCareers({
    id: 'zighang-entry-developers',
    maxItems: 10,
    detailConcurrency: 2,
  }, fetchImpl);

  assert.equal(items.length, 1);
  const listUrl = new URL(requested[0]);
  assert.deepEqual(listUrl.searchParams.getAll('depthOnes'), ['IT_개발', 'AI_데이터']);
  assert.deepEqual(listUrl.searchParams.getAll('regions'), ['서울', '경기', '인천']);
  assert.equal(listUrl.searchParams.get('careerMax'), '0');
  assert.equal(listUrl.searchParams.get('sortCondition'), 'LATEST');
  assert.match(requested[1], new RegExp(`/recruitments/${detail().id}$`));
});
