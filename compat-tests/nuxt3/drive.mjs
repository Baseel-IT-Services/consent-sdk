// Drives the system's real Chrome binary directly via playwright-core
// (the Playwright MCP browser-extension relay is blocked by Chrome in this
// environment). Run with: node drive.mjs
import { chromium } from 'playwright-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = process.argv[3] || 'http://localhost:3791';
// Git Bash mangles leading "/" args into Windows paths, so accept keywords instead.
const routeArg = process.argv[2] || 'index';
const route = routeArg === 'clientonly' ? '/clientonly' : '/';
const APP_URL = BASE_URL + route;

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

console.log(`=== Route: ${route} — after initial load + hydration ===`);
console.log('Console messages:', JSON.stringify(consoleMessages, null, 2));
console.log('Page errors:', JSON.stringify(pageErrors, null, 2));

const hydrationWarnings = consoleMessages.filter((m) => /hydration/i.test(m.text));
console.log('Hydration-related console messages:', JSON.stringify(hydrationWarnings, null, 2));

await page.waitForSelector('baseel-consent', { timeout: 5000, state: 'attached' });
await page.waitForTimeout(800);

const snapshot1 = await page.evaluate(() => {
  const el = document.querySelector('baseel-consent');
  return {
    outerHTMLLength: el ? el.outerHTML.length : null,
    hasShadow: el ? !!el.shadowRoot : null,
    innerText: el ? (el.shadowRoot ? el.shadowRoot.textContent : el.textContent) : null,
  };
});
console.log('Widget snapshot after hydration:', JSON.stringify(snapshot1, null, 2));

// Locate checkboxes (in shadow DOM or light DOM) and uncheck the optional PII (Phone).
const checkboxInfo = await page.evaluate(() => {
  const el = document.querySelector('baseel-consent');
  const root = el.shadowRoot || el;
  const checkboxes = Array.from(root.querySelectorAll('input[type="checkbox"]'));
  return checkboxes.map((cb) => ({
    id: cb.id,
    name: cb.name,
    checked: cb.checked,
    labelText: cb.closest('label') ? cb.closest('label').textContent.trim() : (cb.parentElement ? cb.parentElement.textContent.trim() : ''),
  }));
});
console.log('Checkboxes found:', JSON.stringify(checkboxInfo, null, 2));

// Turn the optional "Phone" PII checkbox ON then back OFF (round-trip check).
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
  target.click();
  const afterOn = target.checked;
  target.click();
  const afterOff = target.checked;
  return { found: true, initialChecked, afterOn, afterOff };
});
console.log('Phone PII checkbox toggle result:', JSON.stringify(toggleResult, null, 2));

// Check the required "I agree to terms" checkbox.
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

let submitBody = null;
page.on('request', (req) => {
  if (req.method() === 'POST' && req.url().includes('/api/widget/consent/submit')) {
    submitBody = req.postData();
  }
});

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
if (submitBody) {
  try {
    const parsed = JSON.parse(submitBody);
    console.log('Parsed submit body:', JSON.stringify(parsed, null, 2));
  } catch { /* ignore */ }
}

const events = await page.evaluate(() => (window).__consentEvents);
console.log('Captured consent events:', JSON.stringify(events, null, 2));

// --- Mount/unmount/remount cycle ---
console.log('=== Mount/unmount/remount cycle ===');
consoleMessages.length = 0;
pageErrors.length = 0;

for (let i = 0; i < 3; i++) {
  await page.click('#toggle-btn', { force: true });
  await page.waitForTimeout(300);
  await page.click('#toggle-btn', { force: true });
  await page.waitForTimeout(500);
}

const widgetCount = await page.evaluate(() => document.querySelectorAll('baseel-consent').length);
console.log('baseel-consent element count after remount cycle:', widgetCount);
console.log('Console messages during remount cycle:', JSON.stringify(consoleMessages, null, 2));
console.log('Page errors during remount cycle:', JSON.stringify(pageErrors, null, 2));

await browser.close();
