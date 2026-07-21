const { chromium } = require('playwright-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:58231/';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  const page = await browser.newPage();

  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // Slow down the template GET so we have a window to unmount mid-flight.
  await page.route('**/api/template/**', async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });

  console.log('=== Navigating (template fetch delayed 1500ms) ===');
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

  // Immediately unmount (force click, widget may not have rendered anything to overlay yet).
  await page.waitForTimeout(200);
  console.log('=== Unmounting while fetch is in flight ===');
  // Dispatch directly on the element - the widget's own overlay legitimately blocks
  // coordinate-based clicks on the page behind it even before data loads (expected
  // modal UX), so this bypasses hit-testing to specifically exercise the *ngIf
  // toggle + SDK unmount-during-fetch code path.
  await page.evaluate(() => document.getElementById('toggle-btn').click());

  // Wait past the point where the delayed fetch would have resolved.
  await page.waitForTimeout(2500);

  console.log('baseel-consent count after unmount-during-fetch:', await page.locator('baseel-consent').count());
  console.log('=== Page errors (thrown exceptions) ===');
  console.log(pageErrors.length === 0 ? '(none)' : pageErrors.join('\n'));
  console.log('=== Console errors ===');
  console.log(consoleErrors.length === 0 ? '(none)' : consoleErrors.join('\n'));

  await browser.close();
  if (pageErrors.length > 0) process.exit(1);
})().catch((err) => {
  console.error('UNMOUNT RACE TEST FAILED:', err);
  process.exit(1);
});
