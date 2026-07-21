import { chromium } from 'playwright-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:4796';

const consoleMessages = [];
const pageErrors = [];

const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
const page = await browser.newPage();

page.on('console', (msg) => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => pageErrors.push(String(err)));

const requests = [];
page.on('request', (req) => {
	if (req.url().includes('4795')) {
		requests.push({ method: req.method(), url: req.url() });
	}
});

const postBodies = [];
page.on('requestfinished', async (req) => {
	if (req.url().includes('/api/widget/consent/submit')) {
		postBodies.push(req.postData());
	}
});

console.log('--- Navigating to / ---');
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

const hasWidget = await page.locator('baseel-consent').count();
console.log('baseel-consent element count:', hasWidget);

const checkboxes = await page.locator('input[type=checkbox]').count();
console.log('Checkbox count (pierces shadow DOM):', checkboxes);

console.log('\n--- Console messages after load ---');
consoleMessages.forEach((m) => console.log(m));
console.log('\n--- Page errors ---');
pageErrors.forEach((m) => console.log(m));

// Checkbox regression check:
// pii-1 (Email) is required -> rendered checked+disabled by default.
// pii-2 (Phone) is optional -> rendered UNCHECKED by default.
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

// Unmount / remount via the toggle button (client-only, no router involved)
console.log('\n--- Unmount / remount via toggle button ---');
await page.click('#toggle-mount');
await page.waitForTimeout(300);
console.log('baseel-consent count after unmount:', await page.locator('baseel-consent').count());
await page.click('#toggle-mount');
await page.waitForTimeout(500);
console.log('baseel-consent count after remount:', await page.locator('baseel-consent').count());

console.log('\n--- Console messages (all, cumulative) ---');
consoleMessages.forEach((m) => console.log(m));
console.log('\n--- Page errors (all, cumulative) ---');
pageErrors.forEach((m) => console.log(m));

await browser.close();
console.log('\nDONE');
