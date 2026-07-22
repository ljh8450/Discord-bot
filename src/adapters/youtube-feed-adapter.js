const { fetchWithRetry, parseFeedlyItems, parseRssFeed } = require('./rss-feed-adapter');

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isShortForm(item) {
  return /(?:#|\b)shorts?\b|쇼츠/i.test(`${item.title} ${item.summary}`);
}

function matchesTerms(item, terms = []) {
  if (!terms.length) return true;
  const text = `${item.title} ${item.summary}`.toLowerCase();
  return terms.some((term) => text.includes(String(term).toLowerCase()));
}

function normalizeYouTubeItems(rawItems, source, now = new Date()) {
  const items = rawItems.filter((item) => !isShortForm(item));
  const latestPublishedAt = items.reduce((latest, item) => {
    const publishedAt = new Date(item.publishedAt).getTime();
    return Number.isFinite(publishedAt) ? Math.max(latest, publishedAt) : latest;
  }, 0);
  const dormantCutoff = now.getTime() - ((source.dormancyDays || 90) * 86_400_000);
  if (!latestPublishedAt || latestPublishedAt < dormantCutoff) return [];

  return items.filter((item) => matchesTerms(item, source.includeTerms)).map((item) => ({
    ...item,
    tags: [...new Set([...(item.tags || []), 'YouTube', '영상'])],
    attributes: {
      ...item.attributes,
      authority: source.authority ?? 2,
      practicalValue: source.practicalValue ?? 2,
      channelId: source.channelId,
      contentFormat: 'VIDEO',
      latestChannelActivityAt: new Date(latestPublishedAt).toISOString(),
    },
  })).slice(0, source.maxItems || 15);
}

function parseYouTubeFeed(xml, source, now = new Date()) {
  return normalizeYouTubeItems(parseRssFeed(xml, {
    ...source,
    kind: 'rss',
    maxItems: source.feedMaxItems || 30,
  }), source, now);
}

function feedlyYouTubeUrl(source) {
  const feedUrl = source.url
    || `https://www.youtube.com/feeds/videos.xml?channel_id=${source.channelId}`;
  const streamId = encodeURIComponent(`feed/${feedUrl}`);
  return `https://cloud.feedly.com/v3/streams/contents?streamId=${streamId}&count=${source.feedMaxItems || 30}`;
}

async function fetchYouTubeFeed(source, fetchImpl) {
  const attempts = source.retryAttempts || 3;
  const baseDelayMs = source.retryDelayMs ?? 500;
  const url = source.url
    || `https://www.youtube.com/feeds/videos.xml?channel_id=${source.channelId}`;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: { 'user-agent': 'Mozilla/5.0 OpportunityRadar/1.0' },
        signal: AbortSignal.timeout(source.timeoutMs || 20_000),
      });
      if (response.ok) return response.text();
      lastError = new Error(`HTTP ${response.status}`);
      if (!RETRYABLE_STATUSES.has(response.status) && response.status !== 404) throw lastError;
    } catch (error) {
      lastError = error;
      if (
        error.name !== 'AbortError'
        && error.name !== 'TimeoutError'
        && !/^HTTP (404|429|5\d\d)$/.test(error.message)
      ) throw error;
    }
    if (attempt < attempts && baseDelayMs > 0) await delay(baseDelayMs * attempt);
  }
  throw new Error(`${source.id}: ${lastError?.message || 'request failed'} after ${attempts} attempts`);
}

async function collectFromYouTube(source, fetchImpl = fetch) {
  if (!source.channelId && !source.url) throw new Error(`${source.id}: channelId or url is required`);
  try {
    return parseYouTubeFeed(await fetchYouTubeFeed(source, fetchImpl), source);
  } catch (primaryError) {
    try {
      const response = await fetchWithRetry(feedlyYouTubeUrl(source), {
        ...source,
        retryAttempts: source.fallbackRetryAttempts || 2,
      }, fetchImpl);
      return normalizeYouTubeItems(parseFeedlyItems(await response.json(), {
        ...source,
        maxItems: source.feedMaxItems || 30,
      }), source);
    } catch (fallbackError) {
      throw new Error(`${primaryError.message}; Feedly fallback ${fallbackError.message}`);
    }
  }
}

module.exports = {
  collectFromYouTube,
  fetchYouTubeFeed,
  feedlyYouTubeUrl,
  isShortForm,
  matchesTerms,
  normalizeYouTubeItems,
  parseYouTubeFeed,
};
