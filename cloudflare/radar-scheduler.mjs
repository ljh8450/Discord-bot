const WORKFLOW_API_ROOT =
  'https://api.github.com/repos/ljh8450/Discord-bot/actions/workflows';
const DIGEST_CRON = '5 0,9 * * *';

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

export async function dispatchWorkflow(env, workflowFile, inputs) {
  if (!env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not configured');

  const response = await fetch(`${WORKFLOW_API_ROOT}/${workflowFile}/dispatches`, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'content-type': 'application/json',
      'user-agent': 'discord-bot-cloudflare-scheduler',
      'x-github-api-version': '2026-03-10',
    },
    body: JSON.stringify({ ref: 'main', ...(inputs ? { inputs } : {}) }),
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`GitHub workflow dispatch failed with HTTP ${response.status}: ${text}`);
  }

  return { status: response.status, response: text ? JSON.parse(text) : null };
}

export function dispatchRadar(env) {
  return dispatchWorkflow(env, 'opportunity-radar.yml');
}

export function dispatchDigest(env) {
  return dispatchWorkflow(env, 'opportunity-digest.yml');
}

const worker = {
  async scheduled(controller, env, ctx) {
    const isDigest = controller.cron === DIGEST_CRON;
    const workflowFile = isDigest ? 'opportunity-digest.yml' : 'opportunity-radar.yml';
    const dispatch = isDigest ? dispatchDigest(env) : dispatchRadar(env);
    ctx.waitUntil(dispatch.then((result) => {
      console.log('GitHub workflow dispatch accepted', {
        workflowFile,
        cron: controller.cron,
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
