const { chromium } = require('playwright-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:58231/';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });
  const page = await browser.newPage();

  const consoleMessages = [];
  const pageErrors = [];
  const requests = [];

  page.on('console', (msg) => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('request', (req) => {
    if (req.url().includes('localhost:4794')) {
      requests.push({ method: req.method(), url: req.url(), postData: req.postData() });
    }
  });

  console.log('=== Navigating ===');
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const dialogCountInitial = await page.locator('baseel-consent').count();
  console.log('baseel-consent element count after initial mount:', dialogCountInitial);

  // Take a snapshot of shadow DOM / rendered content for sanity.
  const bodyText = await page.locator('baseel-consent').first().innerText().catch(() => '(could not read innerText)');
  console.log('=== baseel-consent innerText (first 300 chars) ===');
  console.log(bodyText.slice(0, 300));

  // Try to find the optional "Phone" checkbox and uncheck it, then click Agree.
  console.log('=== Attempting to toggle optional PII checkbox off ===');
  const host = page.locator('baseel-consent').first();

  // The component likely uses Shadow DOM - use page.locator with piercing via >> or evaluate.
  const checkboxInfo = await page.evaluate(() => {
    const host = document.querySelector('baseel-consent');
    if (!host || !host.shadowRoot) return { found: false, reason: 'no shadowRoot' };
    const checkboxes = Array.from(host.shadowRoot.querySelectorAll('input[type="checkbox"]'));
    return {
      found: true,
      count: checkboxes.length,
      labels: checkboxes.map((cb) => {
        const label = cb.closest('label');
        return { checked: cb.checked, text: label ? label.textContent.trim() : cb.outerHTML };
      }),
    };
  });
  console.log('Checkbox info:', JSON.stringify(checkboxInfo, null, 2));

  // Uncheck the "Phone" (pii-2, optional/not required) checkbox via shadow DOM evaluate.
  const uncheckResult = await page.evaluate(() => {
    const host = document.querySelector('baseel-consent');
    if (!host || !host.shadowRoot) return { success: false, reason: 'no shadowRoot' };
    const phoneBox = host.shadowRoot.querySelector('input[type="checkbox"][value="pii-2"]');
    if (!phoneBox) return { success: false, reason: 'phone (pii-2) checkbox not found' };
    if (phoneBox.disabled) return { success: false, reason: 'phone checkbox disabled' };
    if (phoneBox.checked) {
      phoneBox.click();
    }
    return { success: true, checkedAfter: phoneBox.checked };
  });
  console.log('Uncheck result:', JSON.stringify(uncheckResult));

  // Check the "agree" checkbox if present, then click the Agree/Submit button.
  const clickAgreeResult = await page.evaluate(() => {
    const host = document.querySelector('baseel-consent');
    if (!host || !host.shadowRoot) return { success: false, reason: 'no shadowRoot' };
    const agreeCheck = host.shadowRoot.querySelector('[data-agree-check]');
    if (agreeCheck && !agreeCheck.checked) agreeCheck.click();

    const buttons = Array.from(host.shadowRoot.querySelectorAll('button'));
    const agreeBtn = buttons.find((b) => /agree|accept|submit/i.test(b.textContent || ''));
    if (!agreeBtn) {
      return { success: false, reason: 'agree button not found', buttonTexts: buttons.map((b) => b.textContent.trim()) };
    }
    agreeBtn.click();
    return { success: true, buttonText: agreeBtn.textContent.trim(), agreeCheckWasPresent: !!agreeCheck };
  });
  console.log('Click Agree result:', JSON.stringify(clickAgreeResult));

  await page.waitForTimeout(2000);

  console.log('=== Requests captured to mock API ===');
  for (const r of requests) {
    console.log(r.method, r.url);
    if (r.postData) console.log('  body:', r.postData);
  }

  console.log('=== grantedCount displayed in Angular component ===');
  const grantedText = await page.locator('#log').innerText().catch(() => '(not found)');
  console.log(grantedText);

  // Mount/unmount/remount test. The widget is a full-viewport modal overlay by design
  // (it intentionally intercepts pointer events on the underlying page until consent is
  // resolved), which also blocks real coordinate-based clicks on our harness buttons behind
  // it. That's expected consent-banner UX, not an Angular/SDK bug - so we dispatch the click
  // directly on the button element (bypassing browser hit-testing) to exercise the Angular
  // *ngIf toggle + SDK mount/unmount logic specifically.
  console.log('=== Testing unmount/remount ===');
  await page.evaluate(() => document.getElementById('toggle-btn').click());
  await page.waitForTimeout(300);
  const countAfterUnmount = await page.locator('baseel-consent').count();
  console.log('baseel-consent count after unmount click:', countAfterUnmount);

  await page.evaluate(() => document.getElementById('remount-btn').click());
  await page.waitForTimeout(1000);
  const countAfterRemount = await page.locator('baseel-consent').count();
  console.log('baseel-consent count after remount:', countAfterRemount);

  console.log('=== Console messages ===');
  consoleMessages.forEach((m) => console.log(m));

  console.log('=== Page errors (thrown exceptions) ===');
  if (pageErrors.length === 0) {
    console.log('(none)');
  } else {
    pageErrors.forEach((e) => console.log('ERROR:', e));
  }

  await browser.close();
})().catch((err) => {
  console.error('SMOKE TEST FAILED:', err);
  process.exit(1);
});
