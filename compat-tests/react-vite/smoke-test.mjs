// Runtime smoke test driven directly via playwright-core against the system
// Chrome binary (the Playwright MCP browser-extension relay is blocked by
// Chrome in this environment, so this drives the real browser directly).
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME_PATH =
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

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

  // 1. Start mock API server (port 4788)
  const apiServer = spawn(process.execPath, ['server.js'], { stdio: 'pipe' });
  apiServer.stdout.on('data', (d) => process.stdout.write(`[api] ${d}`));
  apiServer.stderr.on('data', (d) => process.stderr.write(`[api-err] ${d}`));

  // 2. Start vite preview (serves dist/) on port 4789
  const preview = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vite', 'preview', '--port', '4789', '--strictPort'],
    { stdio: 'pipe', shell: process.platform === 'win32' }
  );
  preview.stdout.on('data', (d) => process.stdout.write(`[preview] ${d}`));
  preview.stderr.on('data', (d) => process.stderr.write(`[preview-err] ${d}`));

  try {
    await waitForServer('http://localhost:4788/api/template/scr_test');
    await waitForServer('http://localhost:4789/');

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

    // --- Initial load ---
    await page.goto('http://localhost:4789/', { waitUntil: 'load' });
    await page.waitForSelector('text=Baseel Consent React Compat Test');

    // Wait for the widget's Agree button inside the shadow DOM (Playwright's
    // CSS engine pierces open shadow roots automatically).
    await page.waitForSelector('button:has-text("Agree")', { timeout: 10000 });
    log('PASS: page loaded and consent widget rendered (dialog visible)');

    if (pageErrors.length > 0) {
      log(`FAIL: pageerror(s) thrown during initial load: ${JSON.stringify(pageErrors)}`);
    } else {
      log('PASS: no thrown errors during initial load');
    }

    // --- React console warning check ---
    const reactRelatedWarnings = consoleWarnings.filter(
      (w) => /unknown prop|custom element|DOM element|React does not recognize/i.test(w)
    );
    if (reactRelatedWarnings.length > 0) {
      log(`FINDING: React console warnings related to custom element props: ${JSON.stringify(reactRelatedWarnings)}`);
    } else {
      log('PASS: no React console warnings about unknown DOM properties on <baseel-consent>');
    }
    if (consoleWarnings.length > 0) {
      log(`INFO: all console warnings seen: ${JSON.stringify(consoleWarnings)}`);
    }
    if (consoleErrors.length > 0) {
      log(`INFO: all console errors seen: ${JSON.stringify(consoleErrors)}`);
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

    // --- onConsentGranted callback check ---
    await page.waitForTimeout(300);
    const eventLogText = await page.locator('#event-log').innerText();
    const grantedMatches = (eventLogText.match(/onConsentGranted/g) || []).length;
    log(`INFO: event log content: ${JSON.stringify(eventLogText)}`);
    if (grantedMatches === 1) {
      log('PASS: onConsentGranted fired exactly once');
    } else {
      log(`FAIL: onConsentGranted fired ${grantedMatches} times (expected 1)`);
    }

    // --- Mount / unmount / remount check ---
    const toggleBtn = page.locator('#toggle-mount');
    const consentErrorsBeforeToggle = consoleErrors.length;
    const pageErrorsBeforeToggle = pageErrors.length;

    // The widget auto-closes ~1.2s after success; wait for that so we start clean.
    await page.waitForTimeout(1500);

    await toggleBtn.click(); // unmount
    await page.waitForTimeout(300);
    await toggleBtn.click(); // remount
    await page.waitForTimeout(1500);

    const overlayCount = await page.locator('baseel-consent').count();
    log(`INFO: <baseel-consent> element count after unmount/remount: ${overlayCount}`);
    if (overlayCount === 1) {
      log('PASS: exactly one <baseel-consent> element present after unmount/remount (no duplicates)');
    } else {
      log(`FAIL: expected 1 <baseel-consent> element after remount, found ${overlayCount}`);
    }

    const newConsoleErrors = consoleErrors.length - consentErrorsBeforeToggle;
    const newPageErrors = pageErrors.length - pageErrorsBeforeToggle;
    if (newConsoleErrors === 0 && newPageErrors === 0) {
      log('PASS: no console errors or thrown errors during unmount/remount cycle');
    } else {
      log(`FAIL: unmount/remount produced ${newConsoleErrors} new console errors and ${newPageErrors} new page errors: ${JSON.stringify(consoleErrors.slice(consentErrorsBeforeToggle))} ${JSON.stringify(pageErrors.slice(pageErrorsBeforeToggle))}`);
    }

    await browser.close();
  } finally {
    apiServer.kill();
    preview.kill();
  }

  console.log('\n=== SMOKE TEST SUMMARY ===');
  results.forEach((r) => console.log(r));
}

main().catch((err) => {
  console.error('SMOKE TEST CRASHED:', err);
  process.exit(1);
});
