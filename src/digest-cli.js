const { loadLocalEnv } = require('./config/load-env');
const { sendOpportunityDigest } = require('./discord/digest');
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

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
