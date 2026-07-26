const assert = require('node:assert/strict');
const test = require('node:test');

const { buildCollectionWarnings } = require('../src/monitoring/source-health');

test('warns when a configured source is skipped because its secret is missing', () => {
  const warnings = buildCollectionWarnings({
    skippedSources: [{
      sourceId: 'saramin-entry-developers',
      reason: 'missing SARAMIN_ACCESS_KEY',
    }],
  });

  assert.deepEqual(warnings, [
    'saramin-entry-developers: missing SARAMIN_ACCESS_KEY 때문에 수집을 건너뛰었습니다.',
  ]);
});

test('warns for unexpected empty sources but allows optional-empty sources', () => {
  const warnings = buildCollectionWarnings({
    sources: [
      { id: 'required-source' },
      { id: 'optional-source', allowEmpty: true },
    ],
    successfulSourceIds: ['required-source', 'optional-source'],
    sourceCounts: {
      'required-source': 0,
      'optional-source': 0,
    },
  });

  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /required-source/);
});

test('reports trusted items sent despite bot-protected source URLs', () => {
  const warnings = buildCollectionWarnings({ report: { unverifiable: 2 } });

  assert.deepEqual(warnings, [
    '원문 URL이 봇 차단으로 검증되지 않은 2건을 상세 수집 근거로 발송했습니다.',
  ]);
});
