# Compatibility Report: Vanilla JS / Plain HTML (deep 18-category sweep)

Date: 2026-07-20
Package: @baseel/consent-web-component@0.0.1 (post-fix build, shasum 306c487e2a...)

Framework-less baseline test. No bundler, no framework — a plain `index.html` +
`main.js` served (along with a mock backend) by a single Node `http`-only `server.js`
(no extra deps beyond the SDK tgz itself), covering all applicable test categories.

Live browser verification was performed via a real Chrome binary (driven directly with
`playwright-core`, since the Playwright MCP browser-extension relay was blocked by Chrome
in this environment) — genuine DOM/event/timing observation, not code-review guesses.

## Results

| # | Category | Result |
|---|---|---|
| 1 | Initialization | Pass — loads once, re-fetches/re-renders on attribute change without duplicating |
| 2 | Consent banner | Pass — renders as the modal/dialog overlay; header/body/footer/purposes/Agree button all visible |
| 3 | Consent actions | Pass (after fix) — see "Bugs found & fixed" below; unchecked purposes/PIIs are now correctly excluded from the submitted payload |
| 4 | SDK "APIs" | N/A — this SDK has no `getConsent()`/`updateConsent()`/`resetConsent()`/`openPreferenceCenter()`/`destroy()`; its only surface is the custom element's attributes + 3 events. Confirmed by reading source, not assumed. |
| 5 | Event listeners | Pass — each event (`baseel:consent-granted`/`-denied`/`-error`) fires exactly once per action |
| 6 | Storage | N/A by design — confirmed via grep that `packages/consent-web-component/src` contains zero references to `localStorage`/`sessionStorage`/`document.cookie`. Consent persistence currently relies entirely on the backend, not the client. Not a bug, just worth knowing. |
| 7 | SPA navigation | N/A — no router in a static page (see Bug 2 below, which is the cross-framework-relevant version of this concern) |
| 8 | SSR | N/A — no SSR in a static page |
| 9 | Dynamic imports | Pass — `import()` at runtime behaves identically to a static top-level import |
| 10 | Tree-shaking | N/A without a bundler — covered instead in the Vite-based framework batches |
| 11 | Bundle size | Baseline recorded: `dist/index.js` ≈ 32.0 kB unminified-by-tsup ESM (see package.json pack output) — reference point for later per-framework bundle-size comparisons |
| 12 | Performance | Init-to-first-render and click-to-granted-event timings measured via `performance.now()`, both sub-100ms against the local mock backend (network-bound in real usage). 20x mount/unmount loop: prior to the fix, threw 20/20 times (see Bug 2); after the fix, 0 errors. |
| 13 | Browser compatibility | Chromium only, verified live. Firefox/Safari/mobile were not tested — no access to those engines/devices in this environment. |
| 14 | Error handling | Pass — forced-500 backend response and a missing `screen-id` attribute both produce the documented `console.error` + error-state UI rather than throwing |
| 15 | TypeScript | N/A here — covered separately in `compat-tests/typescript-project/REPORT.md` |
| 16 | Accessibility | Partial — Agree button is a real `<button>`, keyboard-operable (Tab + Enter/Space). Gaps found (not bugs, just missing): the dialog/overlay has no `role="dialog"`/`aria-modal`, and there is no Escape-to-close or focus-trap behavior. Confirmed against `Renderer.ts` and verified live that Escape does not close it. |
| 17 | Cleanup | Pass (after fix) — see Bug 2. No leftover `.baseel-overlay` DOM nodes accumulate across remounts. |

## Bugs found — both fixed during this pass

**Bug 1 — checkbox selections were never read (compliance-relevant).**
`Renderer.ts`'s `attachFormHandlers()` built the submitted `purposes`/`piis` arrays from
`querySelectorAll` over every matching checkbox, without ever checking `.checked`.
Unchecking an optional purpose or PII had no effect — the exact same "everything granted"
payload was POSTed regardless of what the user selected.
**Fix applied:** both checkbox collections are now `.filter(cb => cb.checked)` before
being mapped into the submitted payload. No change to the event name, payload shape, or
any exported API.

**Bug 2 — unmounting while a fetch was in flight threw an uncaught TypeError.**
`connectedCallback` registered a `StateManager.onChange` closure; `disconnectedCallback`
nulled `this.renderer` but never unsubscribed the listener, and `StateManager` had no
unsubscribe mechanism at all. If the element was removed from the DOM before its initial
`getConsentScreen()` fetch resolved, the eventual state update still invoked the stale
listener, which called `.render()` on a null renderer. Reproduced 20/20 times in a
mount→append→remove loop.
**Fix applied:** added a non-exported `offChange()` method to `StateManager`, and
`disconnectedCallback` now calls it (plus the render call itself uses `?.` instead of `!`
as a second layer of safety). This also incidentally fixes a subtler duplicate-listener
accumulation issue if the same element node is ever disconnected and reconnected.

Both fixes are internal-logic-only — no exported API, event name, attribute, or payload
shape changed. Rebuilt, retested via the same harness, and repacked; testing-app and this
harness were both reinstalled against the fixed build.
