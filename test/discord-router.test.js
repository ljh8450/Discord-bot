const assert = require('node:assert/strict');
const test = require('node:test');

const { resolveWebhookUrl } = require('../src/discord/router');

const env = {
  DISCORD_JOBS_WEBHOOK_URL: 'https://discord.example/jobs',
  DISCORD_HACKATHONS_WEBHOOK_URL: 'https://discord.example/hackathons',
  DISCORD_INSIGHTS_WEBHOOK_URL: 'https://discord.example/insights',
  DISCORD_ACTIVITIES_WEBHOOK_URL: 'https://discord.example/activities',
  DISCORD_EDUCATION_WEBHOOK_URL: 'https://discord.example/education',
};

test('routes all five opportunity types to their own webhook', () => {
  assert.equal(resolveWebhookUrl('JOB', env), env.DISCORD_JOBS_WEBHOOK_URL);
  assert.equal(resolveWebhookUrl('HACKATHON', env), env.DISCORD_HACKATHONS_WEBHOOK_URL);
  assert.equal(resolveWebhookUrl('CONTENT', env), env.DISCORD_INSIGHTS_WEBHOOK_URL);
  assert.equal(resolveWebhookUrl('EXTERNAL_ACTIVITY', env), env.DISCORD_ACTIVITIES_WEBHOOK_URL);
  assert.equal(resolveWebhookUrl('EDUCATION', env), env.DISCORD_EDUCATION_WEBHOOK_URL);
});

test('keeps the legacy opportunities webhook as a JOB-only fallback', () => {
  const legacy = { DISCORD_OPPORTUNITIES_WEBHOOK_URL: 'https://discord.example/legacy' };
  assert.equal(resolveWebhookUrl('JOB', legacy), legacy.DISCORD_OPPORTUNITIES_WEBHOOK_URL);
  assert.throws(() => resolveWebhookUrl('HACKATHON', legacy), /DISCORD_HACKATHONS/);
});
