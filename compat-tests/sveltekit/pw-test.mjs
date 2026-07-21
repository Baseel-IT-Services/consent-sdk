import { chromium } from 'playwright-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:4793';

const consoleMessages = [];
const pageErrors = [];

const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
const page = await browser.newPage();

page.on('console', (msg) => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => pageErrors.push(String(err)));

const requests = [];
page.on('request', (req) => {
	if (req.url().includes('4792')) {
		requests.push({ method: req.method(), url: req.url() });
	}
});

const postBodies = [];
page.on('requestfinished', async (req) => {
	if (req.url().includes('/api/widget/consent/submit')) {
		postBodies.push(req.postData());
	}
});

console.log('--- Navigating to /', '---');
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

const hasWidget = await page.locator('baseel-consent').count();
console.log('baseel-consent element count:', hasWidget);

// Playwright's locator engine pierces open shadow roots automatically.
const checkboxes = await page.locator('input[type=checkbox]').count();
console.log('Checkbox count (pierces shadow DOM):', checkboxes);

console.log('\n--- Console messages after hydration ---');
consoleMessages.forEach((m) => console.log(m));
console.log('\n--- Page errors ---');
pageErrors.forEach((m) => console.log(m));

// Checkbox regression check:
// pii-1 (Email) is required -> rendered checked+disabled by default.
// pii-2 (Phone) is optional -> rendered UNCHECKED by default.
// To exercise the fixed .checked-filter meaningfully: check Phone ON, then toggle it back OFF,
// check the master agree box, click Agree, and confirm the submit POST body excludes pii-2.
try {
	const phoneCheckbox = page.locator('input[type=checkbox][name=pii][value=pii-2]');
	console.log('\nPhone checkbox count:', await phoneCheckbox.count());
	console.log('Phone checkbox initially checked:', await phoneCheckbox.isChecked());

	await phoneCheckbox.check();
	console.log('Phone checkbox after check():', await phoneCheckbox.isChecked());
	await phoneCheckbox.uncheck();
	console.log('Phone checkbox after uncheck():', await phoneCheckbox.isChecked());

	const agreeCheck = page.locator('[data-agree-check]');
	console.log('Agree master checkbox count:', await agreeCheck.count());
	await agreeCheck.check();

	const agreeBtn = page.locator('[data-action=accept]');
	console.log('Agree button count:', await agreeBtn.count(), 'disabled:', await agreeBtn.isDisabled());
	await agreeBtn.click();
	await page.waitForTimeout(600);
} catch (e) {
	console.log('Checkbox/agree interaction error:', e.message);
}

console.log('\n--- POST bodies to /api/widget/consent/submit ---');
postBodies.forEach((b) => console.log(b));

console.log('\n--- Event log entries on page ---');
const logEntries = await page.locator('#event-log li').allTextContents();
console.log(JSON.stringify(logEntries));

// Navigate to /other then back, check for duplicate dialog / errors
console.log('\n--- Client-side navigation: / -> /other -> / ---');
await page.click('a[href="/other"]');
await page.waitForTimeout(300);
console.log('URL after nav to other:', page.url());
await page.click('a[href="/"]');
await page.waitForTimeout(500);
console.log('URL after nav back:', page.url());
const widgetCountAfterNav = await page.locator('baseel-consent').count();
console.log('baseel-consent count after nav back:', widgetCountAfterNav);

console.log('\n--- Console messages (all, cumulative) ---');
consoleMessages.forEach((m) => console.log(m));
console.log('\n--- Page errors (all, cumulative) ---');
pageErrors.forEach((m) => console.log(m));

await browser.close();
console.log('\nDONE');
