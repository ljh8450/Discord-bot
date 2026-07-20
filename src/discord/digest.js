function formatDeadline(value, timezone = 'Asia/Seoul') {
  if (!value) return '마감일 미표기';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: timezone,
    month: 'numeric',
    day: 'numeric',
  }).format(new Date(value));
}

function opportunityLine(opportunity, timezone) {
  const facts = [
    opportunity.eligibility?.[0],
    opportunity.locations?.join('·'),
    opportunity.closesAt ? `${formatDeadline(opportunity.closesAt, timezone)} 마감` : null,
  ].filter(Boolean).join(' · ');
  const suffix = facts ? ` (${facts})` : '';
  return `• [${opportunity.title}](${opportunity.canonicalUrl}) — ${opportunity.summary}${suffix}`;
}

function chunkLines(lines, maxLength = 3800) {
  const chunks = [];
  let current = '';
  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length > maxLength && current) {
      chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function buildOpportunityDigest(opportunities, options = {}) {
  const timezone = options.timezone || 'Asia/Seoul';
  const sorted = [...opportunities].sort((left, right) => {
    if (!left.closesAt) return 1;
    if (!right.closesAt) return -1;
    return new Date(left.closesAt) - new Date(right.closesAt);
  });
  const lines = sorted.map((item) => opportunityLine(item, timezone));
  const descriptions = chunkLines(lines.length ? lines : ['현재 지원 가능한 신규 공고가 없습니다.']);
  return {
    username: options.username || 'Opportunity Radar',
    embeds: descriptions.slice(0, 10).map((description, index) => ({
      title: index === 0 ? `📋 채용공고 큐레이팅 · ${sorted.length}건` : `채용공고 큐레이팅 · 계속 ${index + 1}`,
      description,
      color: 0x5865f2,
      footer: { text: '각 공고를 눌러 공식 원문을 확인하세요.' },
    })),
  };
}

async function sendOpportunityDigest(opportunities, options = {}) {
  const response = await (options.fetchImpl || fetch)(
    `${options.webhookUrl}${options.webhookUrl.includes('?') ? '&' : '?'}wait=true`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildOpportunityDigest(opportunities, options)),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) throw new Error(`Discord webhook failed: HTTP ${response.status}`);
  return response.json();
}

module.exports = { buildOpportunityDigest, opportunityLine, sendOpportunityDigest };
