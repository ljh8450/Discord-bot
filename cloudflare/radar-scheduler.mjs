const DISPATCH_URL =
  'https://api.github.com/repos/ljh8450/Discord-bot/actions/workflows/opportunity-radar.yml/dispatches';

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

export async function dispatchRadar(env) {
  if (!env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not configured');

  const response = await fetch(DISPATCH_URL, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'content-type': 'application/json',
      'user-agent': 'discord-bot-cloudflare-scheduler',
      'x-github-api-version': '2026-03-10',
    },
    body: JSON.stringify({ ref: 'main' }),
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`GitHub workflow dispatch failed with HTTP ${response.status}: ${text}`);
  }

  return { status: response.status, response: text ? JSON.parse(text) : null };
}

const worker = {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(dispatchRadar(env).then((result) => {
      console.log('Opportunity Radar dispatch accepted', {
        scheduledTime: controller.scheduledTime,
        status: result.status,
        workflowRunId: result.response?.workflow_run_id || null,
      });
    }));
  },

  async fetch(request, env) {
    if (
      !env.MANUAL_TRIGGER_SECRET
      || request.headers.get('authorization') !== `Bearer ${env.MANUAL_TRIGGER_SECRET}`
    ) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
    }
    if (request.method !== 'POST') {
      return jsonResponse({ ok: false, error: 'Method Not Allowed' }, 405, { allow: 'POST' });
    }

    try {
      const result = await dispatchRadar(env);
      return jsonResponse({ ok: true, ...result });
    } catch (error) {
      console.error('Manual Opportunity Radar dispatch failed', error);
      return jsonResponse({ ok: false, error: error.message }, 502);
    }
  },
};

export default worker;
