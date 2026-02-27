const express = require('express');
const yaml = require('js-yaml');
const fs = require('fs');
const https = require('https');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function getToken() {
  try {
    const config = yaml.load(fs.readFileSync(path.join(__dirname, 'config.yaml'), 'utf8'));
    const token = config.NETLIFY_API_TOKEN;
    if (!token || token === 'your_token_here') {
      throw new Error('NETLIFY_API_TOKEN not set in config.yaml');
    }
    return token;
  } catch (e) {
    throw new Error(e.message);
  }
}

function netlifyApi(method, apiPath) {
  return new Promise((resolve, reject) => {
    let token;
    try {
      token = getToken();
    } catch (e) {
      return reject(e);
    }

    const options = {
      hostname: 'api.netlify.com',
      path: `/api/v1${apiPath}`,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'netlify-project-manager/1.0',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
        } catch {
          resolve({ status: res.statusCode, data: data || null });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

app.get('/api/sites', async (req, res) => {
  try {
    const result = await netlifyApi('GET', '/sites?per_page=100&sort_by=updated_at&sort_order=desc');
    res.status(result.status).json(result.data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/sites/:id', async (req, res) => {
  try {
    const result = await netlifyApi('DELETE', `/sites/${req.params.id}`);
    if (result.status === 204 || result.status === 200) {
      res.status(200).json({ success: true });
    } else {
      res.status(result.status).json(result.data || { error: 'Delete failed' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log('\n  Netlify Project Manager');
  console.log(`  http://localhost:${PORT}`);
  console.log('  Put your token in config.yaml → NETLIFY_API_TOKEN\n');
});
