// Netlify serverless function
// Token: set NETLIFY_API_TOKEN in Netlify dashboard → Site configuration → Environment variables
const https = require('https');

function callNetlify(token, method, path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.netlify.com',
        path: `/api/v1${path}`,
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'netlify-project-manager/1.0',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
          } catch {
            resolve({ status: res.statusCode, data: null });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

exports.handler = async (event) => {
  const token = process.env.NETLIFY_API_TOKEN;
  if (!token) {
    return json(500, { error: 'NETLIFY_API_TOKEN environment variable not set' });
  }

  // Password protection
  const appPassword = process.env.APP_PASSWORD;
  if (appPassword) {
    const provided = event.headers['x-app-password'] ?? '';
    if (provided !== appPassword) {
      return json(401, { error: 'Unauthorized' });
    }
  }

  // event.path keeps the original path before redirect (e.g. /api/sites/abc123)
  const siteIdMatch = event.path.match(/\/api\/sites\/([^/]+)/);
  const siteId = siteIdMatch?.[1] ?? null;

  try {
    if (event.httpMethod === 'GET' && !siteId) {
      const r = await callNetlify(token, 'GET', '/sites?per_page=100&sort_by=updated_at&sort_order=desc');
      return json(r.status, r.data);
    }

    if (event.httpMethod === 'DELETE' && siteId) {
      const r = await callNetlify(token, 'DELETE', `/sites/${siteId}`);
      if (r.status === 200 || r.status === 204) return json(200, { success: true });
      return json(r.status, r.data || { error: 'Delete failed' });
    }

    return json(404, { error: 'Not found' });
  } catch (e) {
    return json(500, { error: e.message });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
