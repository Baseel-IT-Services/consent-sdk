// Drives the system's real Chrome binary directly via playwright-core
// (the Playwright MCP browser-extension relay is blocked by Chrome in this
// environment). Run with: node drive.mjs
import { chromium } from 'playwright-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:5174/';

const mode = process.argv[2] || 'full'; // 'warncheck' | 'full'

const browser = await chromium.launch({
  executablePath: CHROME_PATH,
  headless: true,
});
const page = await browser.newPage();

const consoleMessages = [];
page.on('console', (msg) => {
  consoleMessages.push({ type: msg.type(), text: msg.text() });
});
const pageErrors = [];
page.on('pageerror', (err) => {
  pageErrors.push(String(err));
});

await page.goto(APP_URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

if (mode === 'warncheck') {
  console.log('--- CONSOLE MESSAGES ---');
  for (const m of consoleMessages) console.log(`[${m.type}] ${m.text}`);
  console.log('--- PAGE ERRORS ---');
  for (const e of pageErrors) console.log(e);
  await browser.close();
  process.exit(0);
}

// Wait for the widget dialog to render (template fetched from mock server).
await page.waitForSelector('baseel-consent', { timeout: 5000, state: 'attached' });
await page.waitForTimeout(800);

console.log('=== After initial mount ===');
console.log('Console messages so far:', JSON.stringify(consoleMessages, null, 2));
console.log('Page errors so far:', JSON.stringify(pageErrors, null, 2));

// Find the overlay/dialog inside the shadow root or light DOM.
const snapshot1 = await page.evaluate(() => {
  const el = document.querySelector('baseel-consent');
  return {
    outerHTMLLength: el ? el.outerHTML.length : null,
    hasShadow: el ? !!el.shadowRoot : null,
    innerText: el ? (el.shadowRoot ? el.shadowRoot.textContent : el.textContent) : null,
  };
});
console.log('Widget snapshot:', JSON.stringify(snapshot1, null, 2));

// Locate checkboxes (in shadow DOM or light DOM) and uncheck the optional PII (Phone).
const checkboxInfo = await page.evaluate(() => {
  const el = document.querySelector('baseel-consent');
  const root = el.shadowRoot || el;
  const checkboxes = Array.from(root.querySelectorAll('input[type="checkbox"]'));
  return checkboxes.map((cb) => ({
    id: cb.id,
    name: cb.name,
    value: cb.value,
    checked: cb.checked,
    labelText: cb.closest('label') ? cb.closest('label').textContent.trim() : (cb.parentElement ? cb.parentElement.textContent.trim() : ''),
  }));
});
console.log('Checkboxes found:', JSON.stringify(checkboxInfo, null, 2));

// Step 1: explicitly turn the optional "Phone" PII checkbox ON first (so the
// regression check is meaningful — prove it round-trips both ways, not just
// that it happens to already match the default state), then turn it back OFF.
const toggleResult = await page.evaluate(() => {
  const el = document.querySelector('baseel-consent');
  const root = el.shadowRoot || el;
  const checkboxes = Array.from(root.querySelectorAll('input[type="checkbox"]'));
  const target = checkboxes.find((cb) => {
    const label = cb.closest('label') ? cb.closest('label').textContent : (cb.parentElement ? cb.parentElement.textContent : '');
    return /phone/i.test(label || '');
  });
  if (!target) return { found: false };
  const initialChecked = target.checked;
  target.click(); // turn ON
  const afterOn = target.checked;
  target.click(); // turn back OFF
  const afterOff = target.checked;
  return { found: true, initialChecked, afterOn, afterOff };
});
console.log('Phone PII checkbox toggle result:', JSON.stringify(toggleResult, null, 2));

// Step 2: check the required "I agree to terms" checkbox — the Agree & Save
// button starts disabled until this is checked (per Renderer.ts attachFormHandlers).
const agreeCheckResult = await page.evaluate(() => {
  const el = document.querySelector('baseel-consent');
  const root = el.shadowRoot || el;
  const agreeCheck = root.querySelector('[data-agree-check]');
  if (!agreeCheck) return { found: false };
  agreeCheck.click();
  const acceptBtn = root.querySelector('button.btn-primary, [data-action="accept"]');
  return { found: true, checked: agreeCheck.checked, acceptBtnDisabled: acceptBtn ? acceptBtn.disabled : null };
});
console.log('Agree-to-terms checkbox result:', JSON.stringify(agreeCheckResult, null, 2));

// Intercept the POST request body.
let submitBody = null;
page.on('request', (req) => {
  if (req.method() === 'POST' && req.url().includes('/api/widget/consent/submit')) {
    submitBody = req.postData();
  }
});

// Click the Agree & Save / submit button.
const clickResult = await page.evaluate(() => {
  const el = document.querySelector('baseel-consent');
  const root = el.shadowRoot || el;
  const buttons = Array.from(root.querySelectorAll('button'));
  const agreeBtn = buttons.find((b) => /agree/i.test(b.textContent || ''));
  if (agreeBtn) {
    agreeBtn.click();
    return { clicked: true, text: agreeBtn.textContent, wasDisabled: agreeBtn.disabled };
  }
  return { clicked: false, allButtons: buttons.map((b) => b.textContent) };
});
console.log('Agree click result:', JSON.stringify(clickResult, null, 2));

await page.waitForTimeout(800);

console.log('Submitted POST body:', submitBody);

const events = await page.evaluate(() => (window).__consentEvents);
console.log('Captured consent events:', JSON.stringify(events, null, 2));

// --- Mount/unmount/remount cycle ---
console.log('=== Mount/unmount/remount cycle ===');
consoleMessages.length = 0;
pageErrors.length = 0;

for (let i = 0; i < 3; i++) {
  await page.click('#toggle-btn', { force: true }); // unmount (widget's own modal overlay legitimately covers the page, so force is needed for this test-harness button, not indicative of a bug)
  await page.waitForTimeout(300);
  await page.click('#toggle-btn', { force: true }); // remount
  await page.waitForTimeout(500);
}

const widgetCount = await page.evaluate(() => document.querySelectorAll('baseel-consent').length);
console.log('baseel-consent element count after remount cycle:', widgetCount);
console.log('Console messages during remount cycle:', JSON.stringify(consoleMessages, null, 2));
console.log('Page errors during remount cycle:', JSON.stringify(pageErrors, null, 2));

await browser.close();
