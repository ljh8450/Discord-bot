function decodeJsString(value) {
  try { return JSON.parse(`"${value}"`); } catch { return value; }
}

function stringField(block, key) {
  const match = block.match(new RegExp(`${key}:"((?:\\\\.|[^"])*)"`));
  return match ? decodeJsString(match[1]) : null;
}

function numberField(block, key) {
  return block.match(new RegExp(`${key}:(\\d+)`))?.[1] || null;
}

function extractArray(html, key) {
  const marker = `${key}:[`;
  const start = html.indexOf(marker);
  if (start < 0) return '';
  let depth = 0;
  let quoted = false;
  let escaped = false;
  const valueStart = start + marker.length - 1;
  for (let index = valueStart; index < html.length; index += 1) {
    const character = html[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === '[') depth += 1;
    else if (character === ']' && --depth === 0) return html.slice(valueStart + 1, index);
  }
  return '';
}

function seoulDate(value) {
  return value ? `${value.replace(' ', 'T')}+09:00` : null;
}

function parseDaconPage(html, source, now = new Date()) {
  const items = [];
  for (const block of extractArray(html, 'onGoingCompetitions').split('},{')) {
    const externalId = numberField(block, 'cpt_id');
    const title = stringField(block, 'name');
    const closesAt = seoulDate(stringField(block, 'period_end'));
    if (!externalId || !title || !closesAt || new Date(closesAt) < now) continue;
    const keyword = stringField(block, 'keyword') || 'AI | 경진대회';
    const url = `https://dacon.io/competitions/official/${externalId}/overview/description`;
    items.push({
      type: 'HACKATHON', sourceId: source.id, externalId: `competition-${externalId}`,
      url, title, organization: 'DACON', status: 'OPEN', closesAt,
      locations: ['온라인'], eligibility: ['참가 자격 상세 확인'],
      tags: keyword.split('|').map((tag) => tag.trim()).filter(Boolean),
      summary: `${keyword.replace(/\s*\|\s*/g, ' · ')} 분야 AI·개발 경진대회`,
      summaryEvidence: [url], attributes: { developmentOutput: true },
    });
  }
  for (const block of extractArray(html, 'dakerHackathons').split('},{')) {
    const externalId = stringField(block, 'id');
    const title = stringField(block, 'title');
    const url = stringField(block, 'url');
    const closesAt = seoulDate(stringField(block, 'endDate'));
    if (!externalId || !title || !url || !closesAt || new Date(closesAt) < now) continue;
    items.push({
      type: 'HACKATHON', sourceId: source.id, externalId: `hackathon-${externalId}`,
      url, title, organization: stringField(block, 'organizerName') || 'DACON Daker',
      status: 'OPEN', closesAt, locations: ['온라인'], eligibility: ['참가 자격 상세 확인'],
      tags: ['AI', '개발', '해커톤'], summary: '팀 빌딩과 결과물 구현을 포함하는 AI·개발 해커톤',
      summaryEvidence: [url], attributes: { developmentOutput: true },
    });
  }
  return items;
}

async function collectFromDacon(source, fetchImpl = fetch) {
  const response = await fetchImpl(source.url, {
    headers: { 'user-agent': 'Mozilla/5.0 OpportunityRadar/1.0' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${source.id}: HTTP ${response.status}`);
  return parseDaconPage(await response.text(), source);
}

module.exports = { collectFromDacon, extractArray, parseDaconPage };
