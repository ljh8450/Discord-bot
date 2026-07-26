const assert = require('node:assert/strict');
const test = require('node:test');
const { dedupeAcrossSources } = require('../src/domain/cross-source-dedupe');

test('keeps the higher-priority source for equivalent titles', () => {
  const low = { type: 'HACKATHON', title: '2026년 포항시 데이터 분석 아이디어 공모전',
    closesAt: '2026-08-01', url: 'https://low.example/a', attributes: { sourcePriority: 60 } };
  const high = { type: 'HACKATHON', title: '[포항시] 2026 포항시 데이터 분석 아이디어 공모전',
    closesAt: '2026-08-01', url: 'https://high.example/a', attributes: { sourcePriority: 100 } };
  assert.deepEqual(dedupeAcrossSources([low, high]), [high]);
});

test('deduplicates legal company-name variants across recruitment services', () => {
  const zighang = {
    type: 'JOB',
    sourceId: 'zighang',
    title: '신입 백엔드 개발자 채용',
    organization: '(주)니치AI',
    url: 'https://zighang.com/recruitment/1',
    attributes: { sourcePriority: 80 },
  };
  const wanted = {
    ...zighang,
    sourceId: 'wanted',
    organization: '주식회사 니치AI',
    url: 'https://www.wanted.co.kr/wd/2',
    attributes: { sourcePriority: 90 },
  };

  assert.deepEqual(dedupeAcrossSources([zighang, wanted]), [wanted]);
});
