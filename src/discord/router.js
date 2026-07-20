const { createDiscordNotifier } = require('./notifier');

const ENV_BY_TYPE = Object.freeze({
  JOB: 'DISCORD_JOBS_WEBHOOK_URL',
  HACKATHON: 'DISCORD_HACKATHONS_WEBHOOK_URL',
  CONTENT: 'DISCORD_INSIGHTS_WEBHOOK_URL',
  EXTERNAL_ACTIVITY: 'DISCORD_ACTIVITIES_WEBHOOK_URL',
  EDUCATION: 'DISCORD_EDUCATION_WEBHOOK_URL',
});

function resolveWebhookUrl(type, env = process.env) {
  const key = ENV_BY_TYPE[type];
  if (!key) throw new Error(`unsupported Discord route: ${type}`);
  if (env[key]) return env[key];
  if (type === 'JOB' && env.DISCORD_OPPORTUNITIES_WEBHOOK_URL) {
    return env.DISCORD_OPPORTUNITIES_WEBHOOK_URL;
  }
  throw new Error(`${key} is required for ${type}`);
}

function createCategoryNotifier(options = {}) {
  const env = options.env || process.env;
  return async function notifyByCategory(opportunity) {
    const webhookUrl = resolveWebhookUrl(opportunity.type, env);
    return createDiscordNotifier({
      ...options,
      env: undefined,
      webhookUrl,
    })(opportunity);
  };
}

module.exports = { ENV_BY_TYPE, createCategoryNotifier, resolveWebhookUrl };
