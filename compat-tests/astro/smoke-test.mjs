// Runtime smoke test driven directly via playwright-core against the system
// Chrome binary (the Playwright MCP browser-extension relay is blocked by
// Chrome in this environment, so this drives the real browser directly).
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryFetch = async () => {
      try {
        const res = await fetch(url);
        if (res.ok || res.status === 404) return resolve();
      } catch {
        // not up yet
      }
      if (Date.now() - start > timeoutMs) return reject(new Error(`timeout waiting for ${url}`));
      setTimeout(tryFetch, 300);
    };
    tryFetch();
  });
}

async function main() {
  const results = [];
  const log = (msg) => {
    console.log(msg);
    results.push(msg);
  };

  // 1. Start mock API server (port 4793)
  const apiServer = spawn(process.execPath, ['server.js'], { stdio: 'pipe' });
  apiServer.stdout.on('data', (d) => process.stdout.write(`[api] ${d}`));
  apiServer.stderr.on('data', (d) => process.stderr.write(`[api-err] ${d}`));

  // 2. Start astro preview (serves dist/) on port 4322
  const preview = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['astro', 'preview', '--port', '4322'],
    { stdio: 'pipe', shell: process.platform === 'win32' }
  );
  preview.stdout.on('data', (d) => process.stdout.write(`[preview] ${d}`));
  preview.stderr.on('data', (d) => process.stderr.write(`[preview-err] ${d}`));

  try {
    await waitForServer('http://localhost:4793/api/template/scr_test');
    await waitForServer('http://localhost:4322/');

    const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
    const page = await browser.newPage();

    const consoleErrors = [];
    const consoleWarnings = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') consoleErrors.push(text);
      if (type === 'warning') consoleWarnings.push(text);
    });
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    let capturedSubmitBody = null;
    await page.route('**/api/widget/consent/submit', async (route) => {
      capturedSubmitBody = route.request().postData();
      await route.continue();
    });

    // --- Initial load of the statically-generated HTML ---
    await page.goto('http://localhost:4322/', { waitUntil: 'load' });
    await page.waitForSelector('text=Baseel Consent Astro Compat Test');

    // Wait for the widget's Agree button inside the shadow DOM (Playwright's
    // CSS engine pierces open shadow roots automatically).
    await page.waitForSelector('button:has-text("Agree")', { timeout: 10000 });
    log('PASS: static HTML loaded and consent widget rendered (dialog visible) with zero client:* directives');

    if (pageErrors.length > 0) {
      log(`FAIL: pageerror(s) thrown during initial load: ${JSON.stringify(pageErrors)}`);
    } else {
      log('PASS: no thrown errors during initial load');
    }

    if (consoleErrors.length > 0) {
      log(`INFO: console errors seen during load: ${JSON.stringify(consoleErrors)}`);
    } else {
      log('PASS: no console errors during initial load');
    }
    if (consoleWarnings.length > 0) {
      log(`INFO: console warnings seen: ${JSON.stringify(consoleWarnings)}`);
    }

    // --- Toggle optional PII checkbox off, then click Agree ---
    // Phone (pii-2) is the optional, non-disabled checkbox.
    const phoneCheckbox = page.locator('input[type="checkbox"][name="pii"]:not([disabled])').first();
    await phoneCheckbox.waitFor({ state: 'visible' });
    await phoneCheckbox.uncheck();
    const phoneChecked = await phoneCheckbox.isChecked();
    log(`INFO: optional PII (Phone) checkbox checked state after uncheck: ${phoneChecked}`);

    // Must check the "I agree" checkbox to enable the Agree button.
    const agreeCheckbox = page.locator('input[data-agree-check]');
    await agreeCheckbox.check();

    const agreeBtn = page.locator('button:has-text("Agree")');
    await agreeBtn.click();

    // Wait for the submit request to be captured
    await page.waitForTimeout(1000);

    if (capturedSubmitBody) {
      const parsed = JSON.parse(capturedSubmitBody);
      log(`INFO: captured submit body: ${capturedSubmitBody}`);
      const purposesArr = parsed.purposes ?? [];
      const allPiis = purposesArr.flatMap((p) => p.piis ?? []);
      const piiUuids = allPiis.map((p) => p.piiUuid ?? p.uuid);
      const includesPhone = piiUuids.includes('pii-2');
      const includesEmail = piiUuids.includes('pii-1');
      if (!includesPhone && includesEmail) {
        log('PASS: unchecked optional PII (Phone/pii-2) correctly excluded from submit payload; required PII (Email/pii-1) still included');
      } else {
        log(`FAIL: submit payload did not correctly exclude unchecked PII. piiUuids=${JSON.stringify(piiUuids)}`);
      }
    } else {
      log('FAIL: no POST to /api/widget/consent/submit was captured');
    }

    // --- consent-granted event check ---
    await page.waitForTimeout(300);
    const eventLogText = await page.locator('#event-log').innerText();
    const grantedMatches = (eventLogText.match(/baseel:consent-granted/g) || []).length;
    log(`INFO: event log content: ${JSON.stringify(eventLogText)}`);
    if (grantedMatches === 1) {
      log('PASS: baseel:consent-granted fired exactly once, caught via plain document.addEventListener');
    } else {
      log(`FAIL: baseel:consent-granted fired ${grantedMatches} times (expected 1)`);
    }

    await browser.close();
  } finally {
    apiServer.kill();
    preview.kill();
  }

  console.log('\n=== SMOKE TEST SUMMARY ===');
  results.forEach((r) => console.log(r));

  const failures = results.filter((r) => r.startsWith('FAIL'));
  if (failures.length > 0) {
    console.log(`\n${failures.length} FAILURE(S) DETECTED`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('SMOKE TEST CRASHED:', err);
  process.exit(1);
});
