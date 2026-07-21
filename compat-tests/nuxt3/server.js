// Minimal mock-API server for the Nuxt3 (SSR) compat test.
// Built with Node's built-in `http` module only — no Express, no extra deps.
import http from 'http';
import url from 'url';

const PORT = 4791;

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

// Optional artificial delay (ms) on the template fetch, so the
// unmount-during-in-flight-fetch regression check can be triggered
// deterministically by navigating away before the response arrives.
// The SDK builds the template URL itself (`${apiBaseUrl}/api/template/:id?key=..&token=..`)
// so there's no room for it to pass a query param through; instead this is
// controlled via the MOCK_DELAY_MS env var when launching this server.
const MOCK_DELAY_MS = parseInt(process.env.MOCK_DELAY_MS, 10) || 0;

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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
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
    const delayMs = parseInt(parsed.query.delay, 10) || MOCK_DELAY_MS;
    const send = () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(TEMPLATE_FIXTURE));
    };
    if (delayMs > 0) {
      setTimeout(send, delayMs);
    } else {
      send();
    }
    return;
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
