const assert = require('node:assert/strict');
const test = require('node:test');

const { classifyBriefSourceErrors } = require('../src/pipeline/brief-health');

test('downgrades partial brief collection failures to non-fatal warnings', () => {
  const result = classifyBriefSourceErrors(
    [{ sourceId: 'youtube', error: 'HTTP 500' }],
    ['github-blog'],
  );
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, ['youtube: HTTP 500']);
});

test('keeps collection failures fatal when every brief source failed', () => {
  const errors = [{ sourceId: 'youtube', error: 'HTTP 500' }];
  const result = classifyBriefSourceErrors(errors, []);
  assert.deepEqual(result.errors, errors);
  assert.deepEqual(result.warnings, []);
});
