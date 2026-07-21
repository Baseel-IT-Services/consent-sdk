// Regression check for the just-fixed "unmount while initial fetch is in
// flight" bug. Requires the mock server to be started with MOCK_DELAY_MS set
// high enough (e.g. 2000) so the template fetch is still pending when we act.
import { chromium } from 'playwright-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = process.argv[3] || 'http://localhost:3791';
// Git Bash mangles leading "/" args into Windows paths, so accept keywords instead.
const routeArg = process.argv[2] || 'index';
const route = routeArg === 'clientonly' ? '/clientonly' : '/';
const APP_URL = BASE_URL + route;

const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
const page = await browser.newPage();

const consoleMessages = [];
page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
const pageErrors = [];
page.on('pageerror', (err) => pageErrors.push(String(err)));

// Don't wait for networkidle (the template fetch is deliberately slow) — just
// wait for the custom element + toggle button to be attached.
await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#toggle-btn', { timeout: 5000 });
await page.waitForSelector('baseel-consent', { timeout: 5000, state: 'attached' });

// Fetch is now in flight (server delay is large). Unmount immediately.
await page.click('#toggle-btn', { force: true });
console.log('Clicked unmount while fetch presumably still in flight.');

// Wait past the mock server's artificial delay so the (now-orphaned) fetch
// resolves while the element is detached — this is exactly the scenario the
// fix targets.
await page.waitForTimeout(3000);

// Remount to confirm the app is still alive / no crash / no duplicate element.
await page.click('#toggle-btn', { force: true });
await page.waitForTimeout(1000);

const widgetCount = await page.evaluate(() => document.querySelectorAll('baseel-consent').length);

console.log('=== Unmount-during-in-flight-fetch race result ===');
console.log('baseel-consent element count after race + remount:', widgetCount);
console.log('Console messages:', JSON.stringify(consoleMessages, null, 2));
console.log('Page errors:', JSON.stringify(pageErrors, null, 2));

await browser.close();
