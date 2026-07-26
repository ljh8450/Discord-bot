const { collectAll } = require('./adapters');
const { loadLocalEnv } = require('./config/load-env');
const { loadRuntimeConfig } = require('./config/runtime-config');
const { dedupeAcrossSources } = require('./domain/cross-source-dedupe');
const { createCategoryNotifier } = require('./discord/router');
const { sendOperationsAlert } = require('./discord/operations-alert');
const { buildCollectionWarnings } = require('./monitoring/source-health');
const { runRadar } = require('./pipeline/run-radar');
const { JsonStore } = require('./store/json-store');
const { verifyUrl } = require('./validation/url-verifier');

async function main() {
  loadLocalEnv();
  const command = process.argv[2] || 'run';
  if (!['run', 'recover', 'dry-run'].includes(command)) throw new Error(`unknown command: ${command}`);

  const { profile, radarSources: sources } = await loadRuntimeConfig();
  const candidates = [];
  const dryRun = command === 'dry-run';
  const persistedStore = new JsonStore(process.env.RADAR_STATE_FILE || 'data/state.json');
  const dryState = dryRun ? await persistedStore.load() : null;
  const store = dryRun
    ? {
        load: async () => structuredClone(dryState),
        save: async () => undefined,
      }
    : persistedStore;
  const collected = await collectAll(
    sources,
    { rootDir: process.cwd() },
  );
  const {
    errors, successfulSourceIds, sourceCounts, sourceStats, skippedSources,
  } = collected;
  const items = dedupeAcrossSources(collected.items);
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
    : createCategoryNotifier({
        timezone: profile.timezone,
        feedbackBaseUrl: process.env.FEEDBACK_BASE_URL,
      });
  const verifyOpportunityUrl = dryRun || process.env.RADAR_VERIFY_URLS === 'false'
    ? undefined
    : (url) => verifyUrl(url);
  const checkedSourceIds = successfulSourceIds.filter((sourceId) => sourceCounts[sourceId] > 0);
  const configuredLimit = Number.parseInt(process.env.RADAR_MAX_NOTIFICATIONS_PER_RUN || '10', 10);
  const maxNotifications = Number.isInteger(configuredLimit) && configuredLimit > 0
    ? configuredLimit
    : 10;
  const report = await runRadar({
    rawItems: items,
    profile,
    store,
    notify,
    checkedSourceIds,
    verifyOpportunityUrl,
    maxNotifications,
    maxNotificationsByType: profile.notifications?.maxPerRunByType,
  });
  const warnings = buildCollectionWarnings({
    sources,
    successfulSourceIds,
    sourceCounts,
    skippedSources,
    report,
  });
  if (!dryRun && (errors.length || warnings.length || report.failed)) {
    try {
      await sendOperationsAlert({ command, errors, warnings, report });
    } catch (error) {
      process.stderr.write(`운영 경고 발송 실패: ${error.message}\n`);
    }
  }
  process.stdout.write(`${JSON.stringify({
    command, report, sourceErrors: errors, sourceWarnings: warnings,
    skippedSources, sourceCounts, sourceStats, candidates,
  }, null, 2)}\n`);
  if (errors.length || report.failed) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
