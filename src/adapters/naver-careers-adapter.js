function decodeHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

function endOfKoreanDay(value) {
  const match = String(value).match(/(\d{4})\.(\d{2})\.(\d{2})$/);
  return match ? `${match[1]}-${match[2]}-${match[3]}T23:59:59+09:00` : null;
}

function inferRoleTags(title, department, field) {
  const text = `${title} ${department} ${field}`.toLowerCase();
  const tags = [department, field].filter(Boolean);
  if (/backend|server|백엔드|서버/.test(text)) tags.push('백엔드');
  if (/frontend|front-end|프론트/.test(text)) tags.push('프론트엔드');
  if (/full.?stack|풀스택/.test(text)) tags.push('풀스택');
  if (/\bai\b|machine learning|머신러닝|deep learning|world model|llm/.test(text)) tags.push('AI Engineer');
  return tags;
}

function parseNaverCareers(html, source) {
  const items = [];
  const cardPattern = /<li\s+class=['"]card_item\s*([^'"]*)['"][^>]*>[\s\S]*?<a[^>]+onclick=['"]show\(['"]?(\d+)['"]?\)['"][^>]*>([\s\S]*?)<\/a>/gi;
  let card;
  while ((card = cardPattern.exec(html))) {
    const disabled = /disabled/i.test(card[1]);
    const id = card[2];
    const body = card[3];
    const title = decodeHtml((body.match(/<h4[^>]*class=['"]card_title['"][^>]*>([\s\S]*?)<\/h4>/i) || [])[1]);
    const info = [...body.matchAll(/<dd[^>]*class=['"]info_text['"][^>]*>([\s\S]*?)<\/dd>/gi)]
      .map((match) => decodeHtml(match[1]));
    if (!title || info.length < 4) continue;

    const [department, field, career, employment, period = ''] = info;
    const detailUrl = new URL(source.detailPath || '/rcrt/view.do', source.url);
    detailUrl.searchParams.set('annoId', id);
    detailUrl.searchParams.set('lang', 'ko');
    const closingText = period.split('~').at(-1).trim();
    items.push({
      type: 'JOB',
      sourceId: source.id,
      externalId: id,
      url: detailUrl.toString(),
      title,
      organization: source.organization,
      status: disabled ? 'CLOSED' : 'OPEN',
      locations: source.locations || ['경기'],
      eligibility: [career, employment].filter(Boolean),
      tags: inferRoleTags(title, department, field),
      summary: `${department || '개발'} · ${field || '기술'} 분야의 ${employment || '채용'} 공고`,
      summaryEvidence: [detailUrl.toString()],
      closesAt: /상시|채용시/.test(closingText) ? null : endOfKoreanDay(closingText),
      attributes: { department, field, employment },
    });
  }
  return items;
}

async function collectFromNaverCareers(source, fetchImpl = fetch) {
  const response = await fetchImpl(source.url, {
    headers: { accept: 'text/html', 'user-agent': 'developer-opportunity-radar/0.1' },
    signal: AbortSignal.timeout(source.timeoutMs || 20_000),
  });
  if (!response.ok) throw new Error(`${source.id}: HTTP ${response.status}`);
  return parseNaverCareers(await response.text(), source);
}

module.exports = { collectFromNaverCareers, decodeHtml, parseNaverCareers };
