// Minimal mock API server for the Solid + Vite compat test.
// Built with Node's built-in `http` module only — no Express, no extra deps.
import http from 'http';
import url from 'url';

const PORT = 4790;

const TEMPLATE_FIXTURE = {
  template: {
    uuid: 'tmpl-1',
    title: 'Test Consent Template',
    status: 'active',
    version: '1.0',
    legalEntityName: 'Acme Test Co',
    header: 'We value your privacy',
    body: 'Please review your preferences.',
    footer: 'I agree to the terms and conditions',
    purposes: [
      {
        uuid: 'purpose-1',
        name: 'Marketing',
        description: 'desc',
        piis: [
          { uuid: 'pii-1', name: 'Email', required: true },
          { uuid: 'pii-2', name: 'Phone', required: false },
        ],
      },
    ],
  },
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function withCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Publishable-Key');
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  withCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const templateMatch = pathname.match(/^\/api\/template\/([^/]+)$/);
  if (req.method === 'GET' && templateMatch) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(TEMPLATE_FIXTURE));
  }

  if (req.method === 'POST' && pathname === '/api/widget/consent/submit') {
    const body = await readBody(req);
    let parsedBody = {};
    try { parsedBody = JSON.parse(body || '{}'); } catch { /* ignore */ }
    console.log('[server] POST /api/widget/consent/submit', JSON.stringify(parsedBody));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ consentId: 'consent-abc-123' }));
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
