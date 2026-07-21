// Registers the custom element via a plain static import (side-effecting register call).
import '@baseel/consent-web-component';

const logEl = document.getElementById('log');
const mountPoint = document.getElementById('mount-point');
let lastRemovedEl = null; // keeps a JS reference to a detached element for the raw-dispatch test

function log(line) {
  const ts = new Date().toISOString().split('T')[1].replace('Z', '');
  logEl.textContent += `[${ts}] ${line}\n`;
  logEl.scrollTop = logEl.scrollHeight;
  console.log('[main.js]', line);
}

// Public events are bubbling + composed, so a single listener on `document`
// catches them regardless of which <baseel-consent> instance dispatched them.
document.addEventListener('baseel:consent-granted', e => {
  log(`EVENT baseel:consent-granted detail=${JSON.stringify(e.detail)}`);
});
document.addEventListener('baseel:consent-denied', e => {
  log(`EVENT baseel:consent-denied detail=${JSON.stringify(e.detail)}`);
});
document.addEventListener('baseel:consent-error', e => {
  log(`EVENT baseel:consent-error detail=${JSON.stringify(e.detail)}`);
});

log('main.js loaded, custom element registered (static import).');

// ---- button wiring ----

document.getElementById('btn-remove').addEventListener('click', () => {
  const el = document.getElementById('main-el');
  if (el) {
    el.remove();
    lastRemovedEl = el;
    log('Removed <baseel-consent id="main-el"> from DOM (disconnectedCallback should fire).');
  } else {
    log('No #main-el present to remove.');
  }
});

document.getElementById('btn-add').addEventListener('click', () => {
  if (document.getElementById('main-el')) {
    log('#main-el already present; remove it first.');
    return;
  }
  const el = document.createElement('baseel-consent');
  el.id = 'main-el';
  el.setAttribute('public-key', 'pk_test');
  el.setAttribute('session-token', 'tok_test');
  el.setAttribute('screen-id', 'scr_test');
  el.setAttribute('api-base-url', 'http://localhost:4787');
  mountPoint.appendChild(el);
  log('Re-added fresh <baseel-consent id="main-el"> to DOM.');
});

document.getElementById('btn-change-screen').addEventListener('click', () => {
  const el = document.getElementById('main-el');
  if (!el) {
    log('No #main-el present; add it first.');
    return;
  }
  el.setAttribute('screen-id', 'scr_test_2');
  log('Changed screen-id attribute to "scr_test_2" (expect a fresh fetch+render, no duplication).');
});

document.getElementById('btn-force-error').addEventListener('click', () => {
  const el = document.createElement('baseel-consent');
  el.id = 'force-error-el';
  el.setAttribute('public-key', 'pk_test');
  el.setAttribute('session-token', 'tok_test');
  el.setAttribute('screen-id', 'force-error'); // server.js returns HTTP 500 for this screen-id
  el.setAttribute('api-base-url', 'http://localhost:4787');
  mountPoint.appendChild(el);
  log('Added element with screen-id="force-error" (expect baseel:consent-error + error UI).');
});

document.getElementById('btn-missing-attr').addEventListener('click', () => {
  const el = document.createElement('baseel-consent');
  el.id = 'missing-attr-el';
  el.setAttribute('public-key', 'pk_test');
  el.setAttribute('session-token', 'tok_test');
  // screen-id intentionally omitted
  el.setAttribute('api-base-url', 'http://localhost:4787');
  mountPoint.appendChild(el);
  log('Added element with screen-id OMITTED (expect console.error + synchronous error UI, no network call).');
});

document.getElementById('btn-dynamic-import').addEventListener('click', async () => {
  const t0 = performance.now();
  const mod = await import('@baseel/consent-web-component');
  const t1 = performance.now();
  log(`Dynamic import() resolved in ${(t1 - t0).toFixed(2)}ms. Exports: ${Object.keys(mod).join(', ')}`);
});

document.getElementById('btn-dispatch-raw').addEventListener('click', () => {
  const el = lastRemovedEl;
  if (!el || document.contains(el)) {
    log('For this test, click "Remove" first so a detached element reference is captured.');
    return;
  }
  try {
    el.shadowRoot.dispatchEvent(new CustomEvent('baseel:internal:accept', {
      detail: { purposes: [] },
      bubbles: true,
      composed: true,
    }));
    log('Dispatched raw baseel:internal:accept at detached node shadowRoot — no throw, no submit expected (listener was removed in disconnectedCallback).');
  } catch (err) {
    log(`ERROR: raw dispatch threw: ${err.message}`);
  }
});

document.getElementById('btn-mount-loop').addEventListener('click', async () => {
  const before = performance.memory ? performance.memory.usedJSHeapSize : null;
  let errors = 0;
  for (let i = 0; i < 20; i++) {
    const el = document.createElement('baseel-consent');
    el.setAttribute('public-key', 'pk_test');
    el.setAttribute('session-token', 'tok_test');
    el.setAttribute('screen-id', 'scr_test');
    el.setAttribute('api-base-url', 'http://localhost:4787');
    try {
      mountPoint.appendChild(el);
      // allow connectedCallback + initial render (loading state) to run synchronously; no need to await fetch
      mountPoint.removeChild(el);
    } catch (err) {
      errors++;
      log(`ERROR during mount/unmount loop iteration ${i}: ${err.message}`);
    }
  }
  const after = performance.memory ? performance.memory.usedJSHeapSize : null;
  log(`Mount/unmount loop x20 complete. errors=${errors}. ` +
    (before !== null ? `heap before=${before} after=${after} delta=${after - before} bytes` : 'performance.memory unavailable in this browser.'));
});

// ---- performance measurement: connect -> first render ----
(function measureInitialRender() {
  const el = document.getElementById('main-el');
  if (!el || !el.shadowRoot) return;
  const t0 = performance.now();
  const observer = new MutationObserver(() => {
    const overlay = el.shadowRoot.querySelector('.baseel-overlay');
    if (overlay) {
      const t1 = performance.now();
      log(`PERF: element-present-to-first-render = ${(t1 - t0).toFixed(2)}ms`);
      observer.disconnect();
    }
  });
  observer.observe(el.shadowRoot, { childList: true, subtree: true });
})();
