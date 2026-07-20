const assert = require('node:assert/strict');
const test = require('node:test');

const { buildOperationsPayload, sendOperationsAlert } = require('../src/discord/operations-alert');

test('builds one operations alert from source and delivery failures', () => {
  const payload = buildOperationsPayload({
    command: 'run',
    errors: [{ sourceId: 'careers', error: 'HTTP 500' }],
    warnings: ['empty-source: 수집 결과 0건'],
    report: { failed: 2 },
  });
  assert.match(payload.embeds[0].description, /careers: HTTP 500/);
  assert.match(payload.embeds[0].description, /수집 결과 0건/);
  assert.match(payload.embeds[0].description, /발송 실패: 2건/);
});

test('skips operations delivery when no webhook is configured', async () => {
  const result = await sendOperationsAlert(
    { command: 'run', warnings: ['warning'] },
    { webhookUrl: '' },
  );
  assert.equal(result, null);
});
