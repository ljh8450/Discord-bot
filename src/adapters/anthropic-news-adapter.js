const { cleanText } = require('./xml-utils');

function decodeHtml(value) {
  return cleanText(String(value || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code))));
}

function parseAnthropicNews(html, source) {
  const baseUrl = source.url || 'https://www.anthropic.com/news';
  const rows = [...html.matchAll(
    /<a\b[^>]*href=['"]([^'"]+)['"][^>]*class=['"][^'"]*__listItem[^'"]*['"][^>]*>([\s\S]*?)<\/a>/gi,
  )];

  return rows.map(([, href, row]) => {
    const title = decodeHtml(row.match(
      /<span\b[^>]*class=['"][^'"]*__title[^'"]*['"][^>]*>([\s\S]*?)<\/span>/i,
    )?.[1]);
    const published = decodeHtml(row.match(/<time\b[^>]*>([\s\S]*?)<\/time>/i)?.[1]);
    const category = decodeHtml(row.match(
      /<span\b[^>]*class=['"][^'"]*__subject[^'"]*['"][^>]*>([\s\S]*?)<\/span>/i,
    )?.[1]);
    const url = new URL(href, baseUrl).toString();
    const timestamp = Date.parse(published);
    if (!title || !Number.isFinite(timestamp)) return null;

    return {
      type: 'CONTENT', sourceId: source.id,
      externalId: new URL(url).pathname, url, title,
      organization: source.organization || 'Anthropic', status: 'OPEN',
      publishedAt: new Date(timestamp).toISOString(),
      tags: source.tags || ['AI', 'Claude'],
      summary: category ? `${category} · Anthropic 공식 업데이트` : 'Anthropic 공식 업데이트',
      summaryEvidence: [url],
      attributes: {
        authority: source.authority ?? 3,
        practicalValue: source.practicalValue ?? 2,
        sourcePriority: source.priority ?? 0,
        contentCategory: category || null,
      },
    };
  }).filter(Boolean).slice(0, source.maxItems || 30);
}

async function collectFromAnthropicNews(source, fetchImpl = fetch) {
  const response = await fetchImpl(source.url || 'https://www.anthropic.com/news', {
    headers: { 'user-agent': 'OpportunityRadar/1.0' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${source.id}: HTTP ${response.status}`);
  return parseAnthropicNews(await response.text(), source);
}

module.exports = { collectFromAnthropicNews, parseAnthropicNews };
