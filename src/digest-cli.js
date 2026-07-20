const { loadLocalEnv } = require('./config/load-env');
const { sendOpportunityDigest } = require('./discord/digest');
const { sendOperationsAlert } = require('./discord/operations-alert');
const { resolveWebhookUrl } = require('./discord/router');
const { JsonStore } = require('./store/json-store');

async function main() {
  loadLocalEnv();
  const store = new JsonStore(process.env.RADAR_STATE_FILE || 'data/state.json');
  const state = await store.load();
  const now = new Date();
  const opportunities = Object.values(state.opportunities).filter((item) => (
    item.type === 'JOB'
    && item.review?.status === 'SENT'
    && item.status === 'OPEN'
    && (!item.closesAt || new Date(item.closesAt) >= now)
  ));
  const message = await sendOpportunityDigest(opportunities, {
    webhookUrl: resolveWebhookUrl('JOB'),
    timezone: 'Asia/Seoul',
  });
  process.stdout.write(`${JSON.stringify({
    sent: true,
    count: opportunities.length,
    messageId: message.id || null,
  })}\n`);
}

main().catch(async (error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  try {
    await sendOperationsAlert({
      command: 'digest',
      errors: [{ sourceId: 'daily-digest', error: error.message }],
      warnings: [],
      report: {},
    });
  } catch (alertError) {
    process.stderr.write(`운영 경고 발송 실패: ${alertError.message}\n`);
  }
  process.exitCode = 1;
});
