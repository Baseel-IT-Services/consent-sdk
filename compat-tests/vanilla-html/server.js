// Minimal static + mock-API server for the bundler-free compat test page.
// Built with Node's built-in `http` module only — no Express, no extra deps.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 4787;
const ROOT = __dirname;

const TEMPLATE_FIXTURE = {
  template: {
    uuid: 'tmpl-1',
    title: 'Test Consent Template',
    status: 'active',
    version: '1.0',
    legalEntityName: 'Acme Test Co',
    header: 'We value your privacy',
    body: 'Please review and manage your data sharing preferences below.',
    footer: 'I agree to the terms and conditions',
    purposes: [
      {
        uuid: 'purpose-1',
        name: 'Marketing',
        description: 'Used to send you offers',
        piis: [
          { uuid: 'pii-1', name: 'Email', required: true },
          { uuid: 'pii-2', name: 'Phone Number', required: false },
        ],
      },
    ],
    notice: {
      title: 'Privacy Notice',
      content: '<p>This is a test privacy notice.</p>',
      version: '1.0',
    },
  },
};

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ts': 'video/mp2t', // not actually served as a real content type target; d.ts unused at runtime
};

function serveFile(res, absPath) {
  fs.readFile(absPath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found: ' + absPath);
      return;
    }
    const ext = path.extname(absPath);
    res.writeHead(200, { 'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // ---- static files ----
  if (req.method === 'GET' && pathname === '/') {
    return serveFile(res, path.join(ROOT, 'index.html'));
  }
  if (req.method === 'GET' && pathname === '/main.js') {
    return serveFile(res, path.join(ROOT, 'main.js'));
  }
  // Serve the installed package straight out of node_modules so the page's
  // bare-specifier `import '@baseel/consent-web-component'` (resolved to an
  // absolute /node_modules/... path by an import map in index.html) works
  // with zero bundler involved.
  if (req.method === 'GET' && pathname.startsWith('/node_modules/')) {
    const rel = pathname.replace(/^\/node_modules\//, '');
    const absPath = path.join(ROOT, 'node_modules', rel);
    // Guard against path traversal outside node_modules.
    if (!absPath.startsWith(path.join(ROOT, 'node_modules'))) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    return serveFile(res, absPath);
  }

  // ---- mock API: template fetch ----
  const templateMatch = pathname.match(/^\/api\/template\/([^/]+)$/);
  if (req.method === 'GET' && templateMatch) {
    const screenId = decodeURIComponent(templateMatch[1]);
    const forceError = parsed.query.forceError;

    // Two ways to force a 500: `?forceError=1` query flag (for direct curl testing),
    // or a magic screen-id value (since the SDK's fetch URL is built entirely from
    // the `screen-id` attribute — it has no way to attach extra query params itself,
    // so the browser-driven test triggers this via screen-id="force-error" instead).
    if (forceError === '1' || forceError === 'true' || screenId === 'force-error') {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: 'Simulated server error (forced)' }));
    }

    if (screenId === '__missing__') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: 'Unknown screen id' }));
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(TEMPLATE_FIXTURE));
  }

  // ---- mock API: consent submit ----
  if (req.method === 'POST' && pathname === '/api/widget/consent/submit') {
    const body = await readBody(req);
    const auth = req.headers['authorization'];
    const pubKey = req.headers['x-publishable-key'];

    let parsedBody = {};
    try { parsedBody = JSON.parse(body || '{}'); } catch { /* ignore */ }

    console.log('[server] POST /api/widget/consent/submit', {
      authorization: auth,
      xPublishableKey: pubKey,
      body: parsedBody,
    });

    if (!auth || !auth.startsWith('Bearer ') || !pubKey) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: 'Missing Authorization or X-Publishable-Key header' }));
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ consentId: 'consent-abc-123' }));
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
