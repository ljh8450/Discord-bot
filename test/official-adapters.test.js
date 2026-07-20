const assert = require('node:assert/strict');
const test = require('node:test');

const { mapKakaoJob } = require('../src/adapters/kakao-careers-adapter');
const { parseNaverCareers } = require('../src/adapters/naver-careers-adapter');

test('parses a NAVER careers card into a grounded opportunity', () => {
  const html = `
    <li class="card_item ">
      <a href="#n" class="card_link" onclick="show('30005133')">
        <h4 class="card_title">[NAVER Cloud] AI Model 개발 (체험형 인턴)</h4>
        <dl class="card_info">
          <dd class="info_text">Tech</dd>
          <dd class="info_text">AI/ML</dd>
          <dd class="info_text">신입</dd>
          <dd class="info_text">인턴</dd>
          <dd class="info_text">2026.07.10 ~ 2026.07.31</dd>
        </dl>
      </a>
    </li>`;
  const [item] = parseNaverCareers(html, {
    id: 'naver-cloud-careers',
    url: 'https://recruit.navercloudcorp.com/rcrt/list.do?lang=ko',
    organization: '네이버클라우드',
    locations: ['경기'],
  });

  assert.equal(item.externalId, '30005133');
  assert.equal(item.status, 'OPEN');
  assert.equal(item.closesAt, '2026-07-31T23:59:59+09:00');
  assert.match(item.url, /annoId=30005133/);
  assert.ok(item.tags.includes('AI Engineer'));
});

test('maps Kakao API fields and rejects implicit career-only eligibility', () => {
  const item = mapKakaoJob({
    realId: 'P-14476',
    jobOfferTitle: 'LLM Research Engineer (Pre-training) (신입/경력)',
    companyName: '카카오',
    employeeTypeName: '정규직',
    locationName: '판교',
    closeFlag: false,
    regDate: '2026-07-20T10:00:00',
    endDate: null,
    qualification: '신입 또는 관련 프로젝트 경험을 보유하신 분',
    workContentDesc: '대규모 언어 모델을 연구하고 개발합니다.',
    jobTypeName: '테크',
  }, { id: 'kakao-tech-careers', locations: ['경기'] });

  assert.equal(item.externalId, 'P-14476');
  assert.equal(item.status, 'OPEN');
  assert.ok(item.eligibility.includes('신입'));
  assert.deepEqual(item.locations, ['판교', '경기']);
  assert.match(item.summary, /언어 모델/);
});
