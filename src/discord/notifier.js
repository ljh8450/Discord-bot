const TYPE_LABELS = {
  JOB: '신입 채용',
  HACKATHON: '해커톤·공모전',
  EDUCATION: '교육·활동',
};

function formatDate(value, timezone = 'Asia/Seoul') {
  if (!value) return '마감일 미표기';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: timezone,
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function buildWebhookPayload(opportunity, options = {}) {
  const facts = [
    opportunity.eligibility[0],
    opportunity.locations.join('·'),
    `${formatDate(opportunity.closesAt, options.timezone)} 마감`,
  ].filter(Boolean).join(' · ');
  const buttons = [{
    type: 2,
    style: 5,
    label: '공고 보기',
    url: opportunity.canonicalUrl,
  }];

  if (options.feedbackBaseUrl) {
    for (const [action, label] of [
      ['interested', '관심 있어요'],
      ['applied', '지원했어요'],
      ['irrelevant', '관련 없어요'],
    ]) {
      const url = new URL(options.feedbackBaseUrl);
      url.searchParams.set('opportunityId', opportunity.id);
      url.searchParams.set('action', action);
      buttons.push({ type: 2, style: 5, label, url: url.toString() });
    }
  }

  return {
    username: options.username || 'Opportunity Radar',
    embeds: [{
      title: `🚀 [${TYPE_LABELS[opportunity.type]}] ${opportunity.title}`,
      url: opportunity.canonicalUrl,
      description: `${facts}\n한 줄: ${opportunity.summary}`,
      color: 0x5865f2,
      footer: { text: `${opportunity.organization || opportunity.sourceId} · ${opportunity.sourceId}` },
    }],
    components: [{ type: 1, components: buttons }],
  };
}

function createDiscordNotifier(options = {}) {
  const webhookUrl = options.webhookUrl || process.env.DISCORD_OPPORTUNITIES_WEBHOOK_URL;
  const fetchImpl = options.fetchImpl || fetch;

  return async function notify(opportunity) {
    if (!webhookUrl) throw new Error('DISCORD_OPPORTUNITIES_WEBHOOK_URL is required');
    const response = await fetchImpl(`${webhookUrl}${webhookUrl.includes('?') ? '&' : '?'}wait=true`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildWebhookPayload(opportunity, options)),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Discord webhook failed: HTTP ${response.status}`);
    return response.json();
  };
}

module.exports = { buildWebhookPayload, createDiscordNotifier };
