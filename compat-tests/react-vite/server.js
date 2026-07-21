// Minimal mock backend for the React+Vite compat test.
// Node built-in http only, no Express. Serves mock API endpoints on port 4788
// with CORS headers so the Vite preview server (a different port) can call it.
import { createServer } from 'node:http';

const PORT = 4788;

function withCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

function sendJson(res, status, body) {
  withCors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'OPTIONS') {
    withCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/template/')) {
    const screenId = url.pathname.split('/').pop();
    console.log(`[mock-server] GET template for screenId=${screenId}`);
    sendJson(res, 200, {
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
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/widget/consent/submit') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      console.log('[mock-server] POST consent submit body:', body);
      sendJson(res, 200, { consentId: 'consent-abc-123' });
    });
    return;
  }

  sendJson(res, 404, { error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`Mock API server listening on http://localhost:${PORT}`);
});
