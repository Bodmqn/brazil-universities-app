const REPO = 'Bodmqn/brazil-universities-app';
const WORKFLOW = 'scan-editais.yml';

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const token = process.env.GH_SCANNER_TOKEN;
  if (!token) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server not configured: missing GH_SCANNER_TOKEN' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  try {
    switch (body.action) {
      case 'trigger': {
        const dispatchRes = await fetch(
          `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
          { method: 'POST', headers: ghHeaders, body: JSON.stringify({ ref: 'main' }) }
        );

        if (dispatchRes.status !== 204) {
          const err = await dispatchRes.json().catch(() => ({}));
          return { statusCode: dispatchRes.status, headers, body: JSON.stringify({ error: err.message || 'Failed to trigger workflow' }) };
        }

        const runsRes = await fetch(
          `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=1&branch=main`,
          { headers: ghHeaders }
        );
        const runsData = await runsRes.json();
        const runId = runsData.workflow_runs?.[0]?.id || null;

        return { statusCode: 200, headers, body: JSON.stringify({ runId }) };
      }

      case 'status': {
        if (!body.runId) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing runId' }) };
        }
        const res = await fetch(
          `https://api.github.com/repos/${REPO}/actions/runs/${body.runId}`,
          { headers: ghHeaders }
        );
        const data = await res.json();
        return { statusCode: 200, headers, body: JSON.stringify(data) };
      }

      default:
        return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${body.action}` }) };
    }
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
