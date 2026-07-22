const { collectFromFile } = require('./file-adapter');
const { collectFromDacon } = require('./dacon-adapter');
const { collectFromEventus } = require('./eventus-adapter');
const { collectFromCampuspick } = require('./campuspick-adapter');
const { collectFromGdgEvents } = require('./gdg-events-adapter');
const { collectFromJsonFeed } = require('./json-feed-adapter');
const { collectFromKakaoCareers } = require('./kakao-careers-adapter');
const { collectFromLinkareer } = require('./linkareer-adapter');
const { collectFromNaverCareers } = require('./naver-careers-adapter');
const { collectFromProgrammersEducation } = require('./programmers-education-adapter');
const { collectFromRssFeed } = require('./rss-feed-adapter');
const { collectFromTicketa } = require('./ticketa-adapter');
const { collectFromWantedCareers } = require('./wanted-careers-adapter');
const { collectFromSaraminCareers } = require('./saramin-careers-adapter');
const { collectFromGreenhouseCareers } = require('./greenhouse-careers-adapter');
const { collectFromGeekNews } = require('./geeknews-adapter');
const { collectFromYouTube } = require('./youtube-feed-adapter');
const { collectFromAnthropicNews } = require('./anthropic-news-adapter');

async function collectSource(source, options = {}) {
  if (source.kind === 'anthropic-news') {
    return collectFromAnthropicNews(source, options.fetchImpl);
  }
  if (source.kind === 'file') return collectFromFile(source, options.rootDir);
  if (source.kind === 'campuspick') return collectFromCampuspick(source, options.fetchImpl);
  if (source.kind === 'dacon') return collectFromDacon(source, options.fetchImpl);
  if (source.kind === 'eventus') return collectFromEventus(source, options.fetchImpl);
  if (source.kind === 'gdg-events') return collectFromGdgEvents(source, options.fetchImpl);
  if (source.kind === 'json') return collectFromJsonFeed(source, options.fetchImpl);
  if (source.kind === 'kakao-careers') return collectFromKakaoCareers(source, options.fetchImpl);
  if (source.kind === 'linkareer') return collectFromLinkareer(source, options.fetchImpl);
  if (source.kind === 'naver-careers') return collectFromNaverCareers(source, options.fetchImpl);
  if (source.kind === 'programmers-education') {
    return collectFromProgrammersEducation(source, options.fetchImpl);
  }
  if (source.kind === 'rss') return collectFromRssFeed(source, options.fetchImpl);
  if (source.kind === 'ticketa') return collectFromTicketa(source, options.fetchImpl);
  if (source.kind === 'wanted-careers') return collectFromWantedCareers(source, options.fetchImpl);
  if (source.kind === 'saramin-careers') {
    return collectFromSaraminCareers(source, options.fetchImpl, options.env);
  }
  if (source.kind === 'greenhouse-careers') {
    return collectFromGreenhouseCareers(source, options.fetchImpl);
  }
  if (source.kind === 'geeknews') return collectFromGeekNews(source, options.fetchImpl);
  if (source.kind === 'youtube') return collectFromYouTube(source, options.fetchImpl);
  throw new TypeError(`unsupported source kind: ${source.kind}`);
}

async function collectAll(sources, options = {}) {
  const configured = sources.filter((source) => source.enabled !== false);
  const env = options.env || process.env;
  const skippedSources = configured
    .filter((source) => source.requiredEnv && !env[source.requiredEnv])
    .map((source) => ({ sourceId: source.id, reason: `missing ${source.requiredEnv}` }));
  const skippedIds = new Set(skippedSources.map((source) => source.sourceId));
  const enabled = configured.filter((source) => !skippedIds.has(source.id));
  const settled = await Promise.allSettled(enabled.map((source) => collectSource(source, options)));
  const items = [];
  const errors = [];
  const successfulSourceIds = [];
  const sourceCounts = {};
  for (const source of skippedSources) sourceCounts[source.sourceId] = 'SKIPPED';

  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      items.push(...result.value.map((item) => ({
        ...item,
        attributes: { ...item.attributes, sourcePriority: item.attributes?.sourcePriority ?? enabled[index].priority },
      })));
      successfulSourceIds.push(enabled[index].id);
      sourceCounts[enabled[index].id] = result.value.length;
    }
    else {
      sourceCounts[enabled[index].id] = null;
      errors.push({ sourceId: enabled[index].id, error: result.reason.message });
    }
  });
  return { items, errors, successfulSourceIds, sourceCounts, skippedSources };
}

module.exports = { collectAll, collectSource };
