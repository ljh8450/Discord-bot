function buildDeveloperBrief(items, options = {}) {
  const lines = items.map((item) => (
    `• [${item.title}](${item.canonicalUrl}) — ${item.summary}\n  _${item.organization || item.sourceId}_`
  ));
  return {
    username: options.username || 'Developer Brief',
    embeds: [{
      title: `🧭 오늘의 AI·개발 브리프 · ${items.length}건`,
      description: lines.join('\n').slice(0, 4000) || '오늘 새로 선별된 공식 업데이트가 없습니다.',
      color: 0x10b981,
      footer: { text: '공식 원문을 기준으로 선별했으며 링크에서 전체 내용을 확인하세요.' },
    }],
  };
}

async function sendDeveloperBrief(items, options = {}) {
  const response = await (options.fetchImpl || fetch)(
    `${options.webhookUrl}${options.webhookUrl.includes('?') ? '&' : '?'}wait=true`,
    {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildDeveloperBrief(items, options)), signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) throw new Error(`Discord webhook failed: HTTP ${response.status}`);
  return response.json();
}

module.exports = { buildDeveloperBrief, sendDeveloperBrief };
