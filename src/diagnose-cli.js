const { readFile } = require('node:fs/promises');
const path = require('node:path');

const { collectAll } = require('./adapters');
const { loadLocalEnv } = require('./config/load-env');
const { AGGREGATOR_SOURCES, OPPORTUNITY_SOURCES } = require('./config/builtin-sources');
const { applyProfileFilter } = require('./domain/filter');
const { normalizeOpportunity } = require('./domain/opportunity');
const { validateMinimum } = require('./domain/validation');
const { JsonStore } = require('./store/json-store');

function normalizeQuery(value) {
  return String(value || '').toLowerCase().replace(/[^0-9a-z가-힣]+/g, '');
}

function matchesQuery(item, query) {
  const needle = normalizeQuery(query);
  return needle && normalizeQuery([
    item.title, item.organization, item.summary, item.tags,
  ].flat().filter(Boolean).join(' ')).includes(needle);
}

function assessCollectedItem(raw, profile, now = new Date()) {
  try {
    const opportunity = normalizeOpportunity(raw, now);
    const validation = validateMinimum(opportunity, now);
    if (!validation.valid) {
      return { stage: 'validation', decision: 'REJECTED', reasons: validation.errors };
    }
    const decision = applyProfileFilter(opportunity, profile);
    return { stage: 'profile-filter', ...decision, type: opportunity.type };
  } catch (error) {
    return { stage: 'normalization', decision: 'REJECTED', reason: error.message };
  }
}

async function diagnose(query, options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const readJson = async (file) => JSON.parse(await readFile(path.resolve(rootDir, file), 'utf8'));
  const profile = options.profile || await readJson('config/profile.json');
  const sourceConfig = options.sourceConfig || await readJson('config/sources.json');
  const sources = options.sources
    || [...AGGREGATOR_SOURCES, ...OPPORTUNITY_SOURCES, ...sourceConfig.sources];
  const collected = await collectAll(sources, {
    rootDir,
    fetchImpl: options.fetchImpl,
    env: options.env,
  });
  const matches = collected.items.filter((item) => matchesQuery(item, query)).map((item) => ({
    title: item.title,
    sourceId: item.sourceId,
    url: item.url,
    assessment: assessCollectedItem(item, profile, options.now),
  }));
  let stateMatches = [];
  if (!matches.length) {
    const store = options.store || new JsonStore(
      options.stateFile || path.resolve(rootDir, 'data/state.json'),
    );
    const state = await store.load();
    stateMatches = Object.values(state.opportunities)
      .filter((item) => matchesQuery(item, query))
      .map((item) => ({
        title: item.title,
        sourceId: item.sourceId,
        status: item.status,
        review: item.review,
        lastSeenAt: item.lastSeenAt,
      }));
  }
  return {
    query,
    foundInCurrentCollection: matches.length > 0,
    matches,
    stateMatches,
    sourceCounts: collected.sourceCounts,
    sourceStats: collected.sourceStats,
    sourceErrors: collected.errors,
    recommendation: matches.length
      ? 'assessment 필드에서 현재 승인·탈락 단계를 확인하세요.'
      : '현재 수집 목록에 없습니다. sourceStats의 페이지·목록 범위와 공식 출처 설정을 확인하세요.',
  };
}

async function main() {
  loadLocalEnv();
  const query = process.argv.slice(2).join(' ').trim();
  if (!query) throw new Error('usage: npm run diagnose -- "검색할 제목"');
  process.stdout.write(`${JSON.stringify(await diagnose(query), null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { assessCollectedItem, diagnose, matchesQuery, normalizeQuery };
