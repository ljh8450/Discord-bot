const { cleanText } = require('./xml-utils');
const { requestOptions } = require('./platform-utils');

function htmlAttribute(value) {
  return cleanText(String(value || '').replace(/&#x([0-9a-f]+);/gi, (_, code) => (
    String.fromCodePoint(Number.parseInt(code, 16))
  )).replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code))));
}

function parseGeekNewsPopular(html, source) {
  const baseUrl = source.url || 'https://news.hada.io/';
  const rows = [...html.matchAll(
    /<div class=['"]topic_row['"][^>]*data-topic-state-id=['"](\d+)['"][^>]*>([\s\S]*?)(?=<div class=['"]topic_row['"]|<script\b|$)/gi,
  )];

  return rows.map(([, topicId, row]) => {
    const rank = Number(row.match(/<div class=(?:['"])?votenum(?:['"])?>(\d+)<\/div>/i)?.[1]);
    const points = Number(row.match(new RegExp(`<span id=['"]?tp${topicId}['"]?>(\\d+)<\\/span>`, 'i'))?.[1]);
    const title = cleanText(row.match(/<h2 class=['"]topic-title-heading['"]>([\s\S]*?)<\/h2>/i)?.[1]);
    const href = htmlAttribute(row.match(/<div class=(?:['"])?topictitle(?:['"])?[\s\S]*?<a href=['"]([^'"]+)['"]/i)?.[1]);
    const summary = cleanText(row.match(/<div class=['"]topicdesc['"]>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]);
    const publishedAt = htmlAttribute(row.match(/<time\b[^>]*datetime=['"]([^'"]+)['"]/i)?.[1]);
    if (!title || !href || !publishedAt || !Number.isFinite(points) || !Number.isFinite(rank)) return null;
    if (rank > (source.maxRank || 20) || points < (source.minPoints || 5)) return null;

    return {
      type: 'CONTENT', sourceId: source.id, externalId: topicId,
      url: new URL(href, baseUrl).toString(), title,
      organization: source.organization || 'GeekNews', status: 'OPEN', publishedAt,
      tags: source.tags || ['개발', '커뮤니티'],
      summary: summary.slice(0, 280) || 'GeekNews 커뮤니티 인기 글',
      summaryEvidence: [new URL(`topic?id=${topicId}`, baseUrl).toString()],
      attributes: {
        authority: source.authority ?? 2,
        practicalValue: source.practicalValue ?? 1,
        sourcePriority: source.priority ?? 0,
        communityPoints: points,
        communityRank: rank,
      },
    };
  }).filter(Boolean).slice(0, source.maxItems || 15);
}

async function collectFromGeekNews(source, fetchImpl = fetch) {
  const response = await fetchImpl(source.url || 'https://news.hada.io/', requestOptions());
  if (!response.ok) throw new Error(`${source.id}: HTTP ${response.status}`);
  return parseGeekNewsPopular(await response.text(), source);
}

module.exports = { collectFromGeekNews, parseGeekNewsPopular };
