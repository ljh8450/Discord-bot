const { collectFromFile } = require('./file-adapter');
const { collectFromJsonFeed } = require('./json-feed-adapter');
const { collectFromKakaoCareers } = require('./kakao-careers-adapter');
const { collectFromNaverCareers } = require('./naver-careers-adapter');
const { collectFromWantedCareers } = require('./wanted-careers-adapter');

async function collectSource(source, options = {}) {
  if (source.kind === 'file') return collectFromFile(source, options.rootDir);
  if (source.kind === 'json') return collectFromJsonFeed(source, options.fetchImpl);
  if (source.kind === 'kakao-careers') return collectFromKakaoCareers(source, options.fetchImpl);
  if (source.kind === 'naver-careers') return collectFromNaverCareers(source, options.fetchImpl);
  if (source.kind === 'wanted-careers') return collectFromWantedCareers(source, options.fetchImpl);
  throw new TypeError(`unsupported source kind: ${source.kind}`);
}

async function collectAll(sources, options = {}) {
  const enabled = sources.filter((source) => source.enabled !== false);
  const settled = await Promise.allSettled(enabled.map((source) => collectSource(source, options)));
  const items = [];
  const errors = [];
  const successfulSourceIds = [];
  const sourceCounts = {};

  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      items.push(...result.value);
      successfulSourceIds.push(enabled[index].id);
      sourceCounts[enabled[index].id] = result.value.length;
    }
    else {
      sourceCounts[enabled[index].id] = null;
      errors.push({ sourceId: enabled[index].id, error: result.reason.message });
    }
  });
  return { items, errors, successfulSourceIds, sourceCounts };
}

module.exports = { collectAll, collectSource };
