const assert = require('node:assert/strict');
const test = require('node:test');

const { BRIEF_SOURCES } = require('../src/config/builtin-sources');
const { dedupeAcrossSources } = require('../src/domain/cross-source-dedupe');

test('deduplicates the same company job across Zighang, Saramin, and Work24', () => {
  const base = {
    type: 'JOB',
    organization: '예시테크',
    closesAt: '2026-08-31',
  };
  const zighang = {
    ...base,
    title: '[신입] 백엔드 개발자',
    sourceId: 'zighang-entry-developers',
    url: 'https://zighang.com/recruitment/100',
    attributes: { sourcePriority: 85 },
  };
  const saramin = {
    ...base,
    title: '2026년 신입 백엔드 개발자',
    sourceId: 'saramin-entry-developers',
    url: 'https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=200',
    attributes: { sourcePriority: 95 },
  };
  const work24 = {
    ...base,
    title: '백엔드 개발자',
    sourceId: 'work24-entry-developers',
    url: 'https://www.work24.go.kr/wk/a/b/1500/empDetailAuthView.do?wantedAuthNo=300',
    attributes: { sourcePriority: 110 },
  };

  assert.deepEqual(dedupeAcrossSources([zighang, saramin, work24]), [work24]);
});

test('keeps separate jobs when companies differ despite identical titles', () => {
  const first = {
    type: 'JOB', title: '백엔드 개발자', organization: '첫번째 회사',
    url: 'https://example.com/jobs/1', attributes: { sourcePriority: 100 },
  };
  const second = {
    type: 'JOB', title: '백엔드 개발자', organization: '두번째 회사',
    url: 'https://example.com/jobs/2', attributes: { sourcePriority: 100 },
  };

  assert.deepEqual(dedupeAcrossSources([first, second]), [first, second]);
});

test('includes the official AWS Korea technical blog feed', () => {
  assert.ok(BRIEF_SOURCES.some((source) => (
    source.id === 'aws-korea-tech'
      && source.url === 'https://aws.amazon.com/ko/blogs/tech/feed/'
      && source.kind === 'rss'
  )));
});
