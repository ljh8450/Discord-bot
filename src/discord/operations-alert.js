function buildOperationsPayload(details) {
  const errors = details.errors || [];
  const warnings = details.warnings || [];
  const lines = [
    ...errors.map((item) => `❌ ${item.sourceId}: ${item.error}`),
    ...warnings.map((item) => `⚠️ ${item}`),
  ];
  if (details.report?.failed) lines.push(`❌ Discord 발송 실패: ${details.report.failed}건`);
  return {
    username: 'Opportunity Radar Ops',
    embeds: [{
      title: `레이더 운영 경고 · ${details.command}`,
      description: lines.join('\n').slice(0, 4000),
      color: errors.length || details.report?.failed ? 0xef4444 : 0xf59e0b,
      timestamp: new Date().toISOString(),
    }],
  };
}

async function sendOperationsAlert(details, options = {}) {
  const webhookUrl = options.webhookUrl || process.env.DISCORD_OPERATIONS_WEBHOOK_URL;
  if (!webhookUrl) return null;
  const response = await (options.fetchImpl || fetch)(
    `${webhookUrl}${webhookUrl.includes('?') ? '&' : '?'}wait=true`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildOperationsPayload(details)),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) throw new Error(`operations webhook failed: HTTP ${response.status}`);
  return response.json();
}

module.exports = { buildOperationsPayload, sendOperationsAlert };
