// Runtime smoke test driven directly against the system Chrome binary via
// playwright-core (the Playwright MCP browser-extension relay is blocked by
// Chrome in this environment). Requires server.js (port 4790) and
// `vite preview` (port 4173) to already be running.
import { chromium } from 'playwright-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:4173/';

const consoleMessages = [];
const pageErrors = [];
const requests = [];

function log(...args) {
  console.log('[smoke-test]', ...args);
}

const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
const page = await browser.newPage();

page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
page.on('pageerror', (err) => pageErrors.push(err.message));
page.on('request', (req) => {
  if (req.url().includes('/api/')) {
    requests.push({ method: req.method(), url: req.url(), postData: req.postData() });
  }
});

await page.goto(APP_URL, { waitUntil: 'networkidle' });

// ---- 1. Initial render check ----
await page.waitForSelector('baseel-consent', { state: 'attached' });
await page.waitForTimeout(500);
log('console so far:', JSON.stringify(consoleMessages));
log('pageErrors so far:', JSON.stringify(pageErrors));
const overlayVisible = await page.evaluate(() => {
  const el = document.querySelector('baseel-consent');
  return !!el && !!el.shadowRoot && !!el.shadowRoot.querySelector('.baseel-overlay');
});
log('Initial render: overlay present =', overlayVisible);

// ---- 2. Toggle optional PII checkbox off, check the top-level agreement
//         checkbox (which enables the otherwise-disabled Agree button), then
//         click Agree; inspect the resulting POST body ----
const uncheckedPiiUuid = await page.evaluate(() => {
  const el = document.querySelector('baseel-consent');
  // Optional PII checkbox per fixture: pii-2 ("Phone"), data-required="false".
  const optional = el.shadowRoot.querySelector('input[type="checkbox"][name="pii"][data-required="false"]');
  if (optional && optional.checked) {
    optional.click();
    return optional.value;
  }
  return optional ? optional.value : null;
});
log('unchecked optional PII uuid =', uncheckedPiiUuid);

await page.evaluate(() => {
  const el = document.querySelector('baseel-consent');
  const agreeCheck = el.shadowRoot.querySelector('[data-agree-check]');
  if (agreeCheck && !agreeCheck.checked) {
    agreeCheck.click(); // enables the Agree & Save button
  }
});

const submitReqPromise = page.waitForRequest((req) => req.url().includes('/api/widget/consent/submit'));
await page.evaluate(() => {
  const el = document.querySelector('baseel-consent');
  const btn = el.shadowRoot.querySelector('[data-action="accept"]');
  btn && btn.click();
});
const submitReq = await submitReqPromise;
const submitBody = submitReq.postData();
log('POST /api/widget/consent/submit body =', submitBody);

// ---- 3. granted-event handler fired exactly once, correct detail shape ----
await page.waitForTimeout(300);
const grantedLog = await page.evaluate(() => document.getElementById('granted-log')?.textContent);
log('granted-log text =', grantedLog);

// ---- 4. Mount / unmount / remount via Solid <Show> signal toggle ----
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => /mount/i.test(b.textContent || ''));
  btn.click(); // unmount
});
await page.waitForTimeout(200);
const afterUnmountCount = await page.evaluate(() => document.querySelectorAll('baseel-consent').length);

await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => /mount/i.test(b.textContent || ''));
  btn.click(); // remount
});
await page.waitForTimeout(500);
const afterRemountCount = await page.evaluate(() => document.querySelectorAll('baseel-consent').length);

log('baseel-consent count after unmount =', afterUnmountCount, ', after remount =', afterRemountCount);

await browser.close();

console.log('\n=== SUMMARY ===');
console.log('overlayVisible:', overlayVisible);
console.log('submitBody:', submitBody);
console.log('grantedLog:', grantedLog);
console.log('afterUnmountCount:', afterUnmountCount, 'afterRemountCount:', afterRemountCount);
console.log('pageErrors:', JSON.stringify(pageErrors));
console.log('console warnings/errors:', JSON.stringify(consoleMessages.filter((m) => m.type === 'warning' || m.type === 'error')));
console.log('all api requests:', JSON.stringify(requests, null, 2));
