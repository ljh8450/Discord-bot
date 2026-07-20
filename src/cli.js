const { readFile } = require('node:fs/promises');
const path = require('node:path');

const { collectAll } = require('./adapters');
const { loadLocalEnv } = require('./config/load-env');
const { createDiscordNotifier } = require('./discord/notifier');
const { runRadar } = require('./pipeline/run-radar');
const { JsonStore } = require('./store/json-store');

async function readJson(filePath) {
  return JSON.parse(await readFile(path.resolve(filePath), 'utf8'));
}

async function main() {
  loadLocalEnv();
  const command = process.argv[2] || 'run';
  if (!['run', 'recover', 'dry-run'].includes(command)) throw new Error(`unknown command: ${command}`);

  const profile = await readJson(process.env.RADAR_PROFILE || 'config/profile.json');
  const sourceConfig = await readJson(process.env.RADAR_SOURCES || 'config/sources.json');
  const candidates = [];
  const dryRun = command === 'dry-run';
  const store = dryRun
    ? {
        load: async () => ({ opportunities: {}, deliveries: {}, pending: {}, feedback: [] }),
        save: async () => undefined,
      }
    : new JsonStore(process.env.RADAR_STATE_FILE || 'data/state.json');
  const { items, errors } = await collectAll(sourceConfig.sources, { rootDir: process.cwd() });
  if (command === 'recover') {
    const state = await store.load();
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);
    for (const opportunity of Object.values(state.opportunities)) {
      if (new Date(opportunity.lastSeenAt).getTime() < cutoff) continue;
      if (state.deliveries[opportunity.dedupeKey]?.status === 'SENT') continue;
      items.push({ ...opportunity, url: opportunity.canonicalUrl });
    }
  }
  const notify = dryRun
    ? async (opportunity) => {
        candidates.push({ title: opportunity.title, url: opportunity.canonicalUrl });
        return {};
      }
    : createDiscordNotifier({
        timezone: profile.timezone,
        feedbackBaseUrl: process.env.FEEDBACK_BASE_URL,
      });
  const report = await runRadar({ rawItems: items, profile, store, notify });
  process.stdout.write(`${JSON.stringify({ command, report, sourceErrors: errors, candidates }, null, 2)}\n`);
  if (errors.length || report.failed) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
