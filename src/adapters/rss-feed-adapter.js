const { cleanText } = require('./xml-utils');

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

async function collectFromRssFeed(source, fetchImpl = fetch) {
  const response = await fetchImpl(source.url, {
    headers: { 'user-agent': 'OpportunityRadar/1.0' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${source.id}: HTTP ${response.status}`);
  return parseRssFeed(await response.text(), source);
}

module.exports = { atomLink, collectFromRssFeed, parseRssFeed };
