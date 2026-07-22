const { cleanText } = require('./xml-utils');

const RETRYABLE_STATUSES = new Set([403, 429, 500, 502, 503, 504]);

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function xmlValue(block, name) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return cleanText(match?.[1]);
}

function atomLink(block) {
  const alternate = block.match(/<link\b[^>]*rel=['"]alternate['"][^>]*href=['"]([^'"]+)['"][^>]*\/?\s*>/i)
    || block.match(/<link\b[^>]*href=['"]([^'"]+)['"][^>]*\/?\s*>/i);
  return cleanText(alternate?.[1]);
}

function parseRssFeed(xml, source) {
  const rssItems = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)]
    .map((match) => ({ block: match[1], format: 'rss' }));
  const atomEntries = [...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)]
    .map((match) => ({ block: match[1], format: 'atom' }));

  return [...rssItems, ...atomEntries]
    .slice(0, source.maxItems || 30)
    .map(({ block, format }) => {
      const url = format === 'atom' ? atomLink(block) : xmlValue(block, 'link');
      const title = xmlValue(block, 'title');
      const description = xmlValue(block, 'description') || xmlValue(block, 'content:encoded')
        || xmlValue(block, 'summary') || xmlValue(block, 'content')
        || xmlValue(block, 'media:description');
      if (!url || !title) return null;
      return {
        type: 'CONTENT', sourceId: source.id,
        externalId: xmlValue(block, 'guid') || xmlValue(block, 'id') || url,
        url, title, organization: source.organization, status: 'OPEN',
        publishedAt: xmlValue(block, 'pubDate') || xmlValue(block, 'published')
          || xmlValue(block, 'updated') || null,
        tags: source.tags || [],
        summary: description.slice(0, 280) || `${source.organization} 공식 업데이트`,
        summaryEvidence: [url],
        attributes: {
          authority: source.authority ?? 2,
          practicalValue: source.practicalValue ?? 1,
          sourcePriority: source.priority ?? 0,
          feedFormat: format,
        },
      };
    })
    .filter(Boolean);
}

function parseWordPressPosts(posts, source) {
  return (Array.isArray(posts) ? posts : [])
    .slice(0, source.maxItems || 30)
    .map((post) => {
      const url = cleanText(post.link);
      const title = cleanText(post.title?.rendered);
      if (!url || !title) return null;
      const summary = cleanText(post.excerpt?.rendered || post.content?.rendered)
        .slice(0, 280);
      return {
        type: 'CONTENT', sourceId: source.id,
        externalId: String(post.id || url),
        url, title, organization: source.organization, status: 'OPEN',
        publishedAt: post.date_gmt ? `${post.date_gmt}Z` : post.date || null,
        tags: source.tags || [],
        summary: summary || `${source.organization} 공식 업데이트`,
        summaryEvidence: [url],
        attributes: {
          authority: source.authority ?? 2,
          practicalValue: source.practicalValue ?? 1,
          sourcePriority: source.priority ?? 0,
          feedFormat: 'wordpress-rest',
        },
      };
    })
    .filter(Boolean);
}

async function fetchWithRetry(url, source, fetchImpl) {
  const attempts = source.retryAttempts || 3;
  const baseDelayMs = source.retryDelayMs ?? 500;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: {
          accept: 'application/rss+xml, application/atom+xml, application/json;q=0.9, */*;q=0.8',
          'user-agent': 'Mozilla/5.0 (compatible; OpportunityRadar/1.0; +https://github.com/ljh8450/Discord-bot)',
        },
        signal: AbortSignal.timeout(source.timeoutMs || 20_000),
      });
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}`);
      if (!RETRYABLE_STATUSES.has(response.status)) throw lastError;
    } catch (error) {
      lastError = error;
      if (
        error.name !== 'AbortError'
        && error.name !== 'TimeoutError'
        && !/^HTTP (403|429|5\d\d)$/.test(error.message)
      ) throw error;
    }
    if (attempt < attempts && baseDelayMs > 0) await delay(baseDelayMs * attempt);
  }
  throw new Error(`${lastError?.message || 'request failed'} after ${attempts} attempts`);
}

async function collectFromRssFeed(source, fetchImpl = fetch) {
  try {
    const response = await fetchWithRetry(source.url, source, fetchImpl);
    return parseRssFeed(await response.text(), source);
  } catch (primaryError) {
    if (!source.fallbackUrl) throw new Error(`${source.id}: ${primaryError.message}`);
    try {
      const fallback = await fetchWithRetry(source.fallbackUrl, source, fetchImpl);
      if (source.fallbackKind === 'wordpress-rest') {
        return parseWordPressPosts(await fallback.json(), source);
      }
      return parseRssFeed(await fallback.text(), source);
    } catch (fallbackError) {
      throw new Error(
        `${source.id}: primary ${primaryError.message}; fallback ${fallbackError.message}`,
      );
    }
  }
}

module.exports = {
  atomLink,
  collectFromRssFeed,
  fetchWithRetry,
  parseRssFeed,
  parseWordPressPosts,
};
