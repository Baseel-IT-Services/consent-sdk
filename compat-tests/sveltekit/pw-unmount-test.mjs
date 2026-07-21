import { chromium } from 'playwright-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:4793';

const consoleMessages = [];
const pageErrors = [];

const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
const page = await browser.newPage();

page.on('console', (msg) => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => pageErrors.push(String(err)));

console.log('--- Navigating to / (mock server delays template fetch by 2500ms) ---');
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });

// Widget's initial fetch is in flight (2.5s delay). Navigate away quickly via client-side router
// to try to trigger the just-fixed "unmount while fetch in flight" bug.
await page.waitForTimeout(300);
console.log('Clicking to /other while fetch is still in flight...');
await page.evaluate(() => {
	document.querySelector('a[href="/other"]').click();
});
await page.waitForTimeout(500);
console.log('URL now:', page.url());

// Wait past the delay window so the in-flight fetch resolves after unmount.
await page.waitForTimeout(3000);

console.log('\n--- Console messages ---');
consoleMessages.forEach((m) => console.log(m));
console.log('\n--- Page errors (would show the unmount-during-fetch crash if regressed) ---');
pageErrors.forEach((m) => console.log(m));

// Navigate back to confirm the page still works normally afterward.
console.log('\nNavigating back to / ...');
await page.evaluate(() => {
	document.querySelector('a[href="/"]').click();
});
await page.waitForTimeout(1500);
console.log('URL after nav back:', page.url());
const widgetCount = await page.locator('baseel-consent').count();
console.log('baseel-consent count after returning:', widgetCount);

console.log('\n--- Console messages (final) ---');
consoleMessages.forEach((m) => console.log(m));
console.log('\n--- Page errors (final) ---');
pageErrors.forEach((m) => console.log(m));

await browser.close();
console.log('\nDONE');
