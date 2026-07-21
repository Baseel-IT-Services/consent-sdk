import { chromium } from 'playwright-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:4796';

const consoleMessages = [];
const pageErrors = [];

const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
const page = await browser.newPage();

page.on('console', (msg) => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => pageErrors.push(String(err)));

console.log('--- Navigating to / (mock server delays template fetch by 2500ms) ---');
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });

// Widget's initial fetch is in flight (2.5s delay). Click the unmount toggle quickly
// to try to trigger the just-fixed "unmount while fetch in flight" bug.
await page.waitForTimeout(300);
console.log('Clicking unmount toggle while fetch is still in flight...');
// The consent widget renders a full-viewport overlay while loading, which intercepts
// real pointer clicks on the toggle button behind it (expected overlay behavior, not a
// bug). Invoke the button's click handler directly via DOM instead of a synthetic mouse
// click, since we're testing unmount-during-fetch, not overlay click-through UX.
await page.evaluate(() => document.querySelector('#toggle-mount').click());
await page.waitForTimeout(500);
console.log('baseel-consent count right after unmount:', await page.locator('baseel-consent').count());

// Wait past the delay window so the in-flight fetch resolves after unmount.
await page.waitForTimeout(3000);

console.log('\n--- Console messages ---');
consoleMessages.forEach((m) => console.log(m));
console.log('\n--- Page errors (would show the unmount-during-fetch crash if regressed) ---');
pageErrors.forEach((m) => console.log(m));

// Remount to confirm the page still works normally afterward.
console.log('\nRe-clicking toggle to remount...');
await page.evaluate(() => document.querySelector('#toggle-mount').click());
await page.waitForTimeout(1000);
const widgetCount = await page.locator('baseel-consent').count();
console.log('baseel-consent count after remount:', widgetCount);

console.log('\n--- Console messages (final) ---');
consoleMessages.forEach((m) => console.log(m));
console.log('\n--- Page errors (final) ---');
pageErrors.forEach((m) => console.log(m));

await browser.close();
console.log('\nDONE');
