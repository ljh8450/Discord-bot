const { cleanText } = require('./xml-utils');

function parseDeadline(text, now = new Date()) {
  const match = text.match(/모집\s*기간[\s\S]{0,80}?~?\s*(?:(\d{2,4})년\s*)?(\d{1,2})월\s*(\d{1,2})일/);
  if (!match) return null;
  let year = match[1] ? Number(match[1]) : now.getFullYear();
  if (year < 100) year += 2000;
  return `${year}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}T23:59:59+09:00`;
}

function parseCoursePage(html, source, url, now = new Date()) {
  const text = cleanText(html);
  const title = cleanText(html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1]
    || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const closesAt = parseDeadline(text, now);
  if (!title || !closesAt || new Date(closesAt) < now) return null;
  const summary = text.match(/모집\s*기간[\s\S]{0,400}/)?.[0]?.slice(0, 280)
    || '프로젝트와 멘토링을 포함하는 개발자 교육 과정';
  return {
    type: 'EDUCATION', sourceId: source.id, externalId: url, url, title,
    organization: '프로그래머스 데브코스', status: 'OPEN', closesAt,
    locations: [/온라인/.test(text) ? '온라인' : '서울'], eligibility: ['지원 자격 상세 확인'],
    tags: ['개발 교육', /백엔드/.test(title) ? '백엔드' : '개발', /AI|인공지능/i.test(title) ? 'AI' : '프로젝트'],
    summary: cleanText(summary), summaryEvidence: [url],
    attributes: {
      freeOrFunded: /국비|전액\s*무료|K-Digital/i.test(text),
      financialSupport: /장려금|지원금/i.test(text),
      trustedOrganizer: true,
      industryMentoring: /멘토|코드리뷰/i.test(text),
      portfolioProject: /프로젝트|포트폴리오/i.test(text),
      hiringConnection: /취업|채용/i.test(text),
    },
  };
}

async function collectFromProgrammersEducation(source, fetchImpl = fetch) {
  const response = await fetchImpl(source.url, {
    headers: { 'user-agent': 'Mozilla/5.0 OpportunityRadar/1.0' }, signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${source.id}: HTTP ${response.status}`);
  const html = await response.text();
  const urls = [...new Set([...html.matchAll(/(?:href=["']|https:\/\/school\.programmers\.co\.kr)(\/learn\/courses\/\d+[^"'<\s]*)/gi)]
    .map((match) => new URL(match[1], 'https://school.programmers.co.kr').toString()))]
    .slice(0, source.maxItems || 20);
  const settled = await Promise.allSettled(urls.map(async (url) => {
    const detail = await fetchImpl(url, {
      headers: { 'user-agent': 'Mozilla/5.0 OpportunityRadar/1.0' }, signal: AbortSignal.timeout(20_000),
    });
    if (!detail.ok) throw new Error(`HTTP ${detail.status}`);
    return parseCoursePage(await detail.text(), source, url);
  }));
  return settled.flatMap((result) => (
    result.status === 'fulfilled' && result.value ? [result.value] : []
  ));
}

module.exports = { collectFromProgrammersEducation, parseCoursePage, parseDeadline };
