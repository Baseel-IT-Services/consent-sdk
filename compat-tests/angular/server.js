const http = require('http');

const PORT = 4794;

const TEMPLATE_RESPONSE = {
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

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Publishable-Key');
}

const server = http.createServer((req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url || '';

  if (req.method === 'GET' && /^\/api\/template\//.test(url)) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(TEMPLATE_RESPONSE));
    return;
  }

  if (req.method === 'POST' && url === '/api/widget/consent/submit') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      console.log('[mock-server] POST /api/widget/consent/submit body:', body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ consentId: 'consent-abc-123' }));
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found', url }));
});

server.listen(PORT, () => {
  console.log(`[mock-server] listening on http://localhost:${PORT}`);
});
