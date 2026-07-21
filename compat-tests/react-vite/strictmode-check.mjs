// Quick check: does React 18/19 StrictMode (default-on in the scaffolded main.tsx)
// cause double-fetch/double-render in DEV mode specifically (production build
// does not double-invoke effects regardless of StrictMode).
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryFetch = async () => {
      try {
        const res = await fetch(url);
        if (res.ok || res.status === 404) return resolve();
      } catch {}
      if (Date.now() - start > timeoutMs) return reject(new Error(`timeout waiting for ${url}`));
      setTimeout(tryFetch, 300);
    };
    tryFetch();
  });
}

async function main() {
  const apiServer = spawn(process.execPath, ['server.js'], { stdio: 'pipe' });
  apiServer.stdout.on('data', (d) => process.stdout.write(`[api] ${d}`));

  const dev = spawn('npx.cmd', ['vite', '--port', '4790', '--strictPort'], {
    stdio: 'pipe',
    shell: true,
  });
  dev.stdout.on('data', (d) => process.stdout.write(`[dev] ${d}`));
  dev.stderr.on('data', (d) => process.stderr.write(`[dev-err] ${d}`));

  try {
    await waitForServer('http://localhost:4788/api/template/scr_test');
    await waitForServer('http://localhost:4790/');

    const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
    const page = await browser.newPage();

    let templateFetchCount = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/template/')) templateFetchCount++;
    });

    const consoleErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.goto('http://localhost:4790/', { waitUntil: 'load' });
    try {
      await page.waitForSelector('button:has-text("Agree")', { timeout: 15000 });
    } catch (e) {
      console.log('DEBUG bodyHTML snippet:', (await page.content()).slice(0, 2000));
      console.log('DEBUG console errors so far:', JSON.stringify(consoleErrors));
      throw e;
    }
    await page.waitForTimeout(1000);

    const dialogCount = await page.locator('.baseel-overlay').count().catch(() => 0);
    const elementCount = await page.locator('baseel-consent').count();

    console.log(`\n=== STRICTMODE DEV-MODE CHECK ===`);
    console.log(`GET /api/template/* request count on initial dev-mode load: ${templateFetchCount}`);
    console.log(`<baseel-consent> element count: ${elementCount}`);
    console.log(`console/page errors: ${JSON.stringify(consoleErrors)}`);

    await browser.close();
  } finally {
    apiServer.kill();
    dev.kill();
  }
}

main().catch((err) => {
  console.error('STRICTMODE CHECK CRASHED:', err);
  process.exit(1);
});
