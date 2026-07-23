const { readFile } = require('node:fs/promises');
const path = require('node:path');

const { collectAll } = require('./adapters');
const { loadLocalEnv } = require('./config/load-env');
const { AGGREGATOR_SOURCES, OPPORTUNITY_SOURCES } = require('./config/builtin-sources');
const { dedupeAcrossSources } = require('./domain/cross-source-dedupe');
const { createCategoryNotifier } = require('./discord/router');
const { sendOperationsAlert } = require('./discord/operations-alert');
const { runRadar } = require('./pipeline/run-radar');
const { JsonStore } = require('./store/json-store');
const { verifyUrl } = require('./validation/url-verifier');

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
  const persistedStore = new JsonStore(process.env.RADAR_STATE_FILE || 'data/state.json');
  const dryState = dryRun ? await persistedStore.load() : null;
  const store = dryRun
    ? {
        load: async () => structuredClone(dryState),
        save: async () => undefined,
      }
    : persistedStore;
  const sources = [...AGGREGATOR_SOURCES, ...OPPORTUNITY_SOURCES, ...sourceConfig.sources];
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
  const allowEmpty = new Set(sources.filter((source) => source.allowEmpty).map((source) => source.id));
  const emptySourceIds = successfulSourceIds.filter((sourceId) => (
    sourceCounts[sourceId] === 0 && !allowEmpty.has(sourceId)
  ));
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
  const warnings = emptySourceIds.map((sourceId) => (
    `${sourceId}: 수집 결과가 0건이어서 종료 판정을 보류했습니다.`
  ));
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
