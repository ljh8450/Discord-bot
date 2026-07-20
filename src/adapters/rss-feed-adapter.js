const { cleanText } = require('./xml-utils');

function xmlValue(block, name) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return cleanText(match?.[1]);
}

function parseRssFeed(xml, source) {
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)]
    .slice(0, source.maxItems || 30)
    .map(([, block]) => {
      const url = xmlValue(block, 'link');
      const title = xmlValue(block, 'title');
      const description = xmlValue(block, 'description') || xmlValue(block, 'content:encoded');
      if (!url || !title) return null;
      return {
        type: 'CONTENT', sourceId: source.id, externalId: xmlValue(block, 'guid') || url,
        url, title, organization: source.organization, status: 'OPEN',
        publishedAt: xmlValue(block, 'pubDate') || null, tags: source.tags || [],
        summary: description.slice(0, 280) || `${source.organization} 공식 업데이트`,
        summaryEvidence: [url],
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

module.exports = { collectFromRssFeed, parseRssFeed };
