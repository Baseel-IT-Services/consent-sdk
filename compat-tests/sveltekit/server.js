import http from 'node:http';

const PORT = 4792;

// Set to a positive number of milliseconds to delay the template GET response,
// used to test the unmount-during-fetch fix under SvelteKit's client-side router.
const TEMPLATE_DELAY_MS = Number(process.env.TEMPLATE_DELAY_MS || 0);

function sendJson(res, status, body) {
	const data = JSON.stringify(body);
	res.writeHead(status, {
		'Content-Type': 'application/json',
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Headers': '*',
		'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
	});
	res.end(data);
}

const template = {
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
				{ uuid: 'pii-2', name: 'Phone', required: false }
			]
		}
	]
};

const server = http.createServer((req, res) => {
	const url = new URL(req.url, `http://${req.headers.host}`);

	if (req.method === 'OPTIONS') {
		res.writeHead(204, {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Headers': '*',
			'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
		});
		res.end();
		return;
	}

	if (req.method === 'GET' && url.pathname.startsWith('/api/template/')) {
		const respond = () => sendJson(res, 200, { template });
		if (TEMPLATE_DELAY_MS > 0) {
			setTimeout(respond, TEMPLATE_DELAY_MS);
		} else {
			respond();
		}
		return;
	}

	if (req.method === 'POST' && url.pathname === '/api/widget/consent/submit') {
		let body = '';
		req.on('data', (chunk) => (body += chunk));
		req.on('end', () => {
			console.log('[mock-server] consent submit body:', body);
			sendJson(res, 200, { consentId: 'consent-abc-123' });
		});
		return;
	}

	res.writeHead(404, { 'Content-Type': 'application/json' });
	res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, () => {
	console.log(`Mock consent API listening on http://localhost:${PORT} (TEMPLATE_DELAY_MS=${TEMPLATE_DELAY_MS})`);
});
