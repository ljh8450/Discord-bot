const { collectAll } = require('./adapters');
const { BRIEF_SOURCES } = require('./config/builtin-sources');
const { loadLocalEnv } = require('./config/load-env');
const { sendDeveloperBrief } = require('./discord/brief');
const { sendOperationsAlert } = require('./discord/operations-alert');
const { resolveWebhookUrl } = require('./discord/router');
const { addKoreanSummariesWithFallback } = require('./enrichment/korean-summary');
const { runBrief } = require('./pipeline/run-brief');
const { JsonStore } = require('./store/json-store');

async function main() {
  loadLocalEnv();
  const dryRun = process.argv[2] === 'dry-run';
  const persistedStore = new JsonStore(process.env.RADAR_STATE_FILE || 'data/state.json');
  const dryState = dryRun ? await persistedStore.load() : null;
  const store = dryRun
    ? { load: async () => structuredClone(dryState), save: async () => undefined }
    : persistedStore;
  const { items, errors, sourceCounts } = await collectAll(BRIEF_SOURCES);
  const selected = [];
  const summarize = (briefItems) => addKoreanSummariesWithFallback(briefItems, {
    token: process.env.GITHUB_TOKEN,
    model: process.env.GITHUB_MODELS_MODEL,
    onError: (error) => process.stderr.write(`Korean summary unavailable; using source summary: ${error.message}\n`),
  });
  const notify = dryRun
    ? async (briefItems) => {
        const summarized = await summarize(briefItems);
        selected.push(...summarized);
        return {};
      }
    : async (briefItems) => sendDeveloperBrief(await summarize(briefItems), {
        webhookUrl: resolveWebhookUrl('CONTENT'),
      });
  const report = await runBrief({ rawItems: items, store, notify });
  if (!dryRun && (errors.length || report.failed)) {
    await sendOperationsAlert({ command: 'brief', errors, warnings: [], report });
  }
  process.stdout.write(`${JSON.stringify({
    command: dryRun ? 'brief-dry-run' : 'brief', report, sourceErrors: errors, sourceCounts,
    candidates: selected.map(({ title, canonicalUrl, organization, koreanSummary }) => ({
      title, url: canonicalUrl, organization, koreanSummary,
    })),
  }, null, 2)}\n`);
  if (errors.length || report.failed) process.exitCode = 1;
}

main().catch(async (error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  try {
    await sendOperationsAlert({
      command: 'brief', errors: [{ sourceId: 'developer-brief', error: error.message }], warnings: [], report: {},
    });
  } catch {}
  process.exitCode = 1;
});
