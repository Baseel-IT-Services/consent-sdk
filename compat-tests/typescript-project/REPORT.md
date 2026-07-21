# Compatibility Report: @baseel/consent-web-component as a standalone TypeScript consumer

Date: 2026-07-20
Package: @baseel/consent-web-component@0.0.1, installed from packages/consent-web-component/baseel-consent-web-component-0.0.1.tgz
TypeScript used: 5.9.3 (devDependency pinned ^5.4.5, matching root repo)

## Summary
| Check | Result |
|---|---|
| npm install (isolated project) | Pass |
| npx tsc --noEmit | Pass (exit 0) |
| npx tsc --noEmit --strict | Pass (exit 0) |
| npx tsc --noEmit --exactOptionalPropertyTypes | Pass (exit 0, informational) |
| BASEEL_EVENTS literal typing | Confirmed literal, not widened |
| Negative-case rejection | Confirmed, all 5 cases rejected |
| Genuine typing issue | Yes — see below (known, previously investigated) |

## Verified surface
Every exported value (BaseelConsent, BASEEL_EVENTS, dispatchConsentGranted/Denied/Error,
ELEMENT_TAG, ATTR, DEFAULT_API_BASE_URL) and type (ComponentConfig, ComponentState, StateData,
ConsentGrantedDetail, ConsentDeniedDetail) was imported and exercised in src/index.ts:
- StateData constructed for all 5 ComponentState members (loading/ready/submitting/success/error).
- Exhaustive switch over ComponentState with a `never` default branch compiles — proves the
  union has exactly these 5 literals.
- dispatchConsentGranted/Denied/Error called against document.createElement('div'), with and
  without the optional consentId field.
- BASEEL_EVENTS.CONSENT_GRANTED/DENIED/ERROR assigned to variables typed with the exact string
  literal — only compiles if the literal type is preserved (not widened to `string`).
- customElements.define(ELEMENT_TAG, BaseelConsent) and the public getConfig(): ComponentConfig|null
  method both type-check.

## Negative-case verification
src/negative-test.ts.txt (kept out of tsconfig's include via a non-.ts extension) contains 5
deliberately wrong usages. Verified by temporarily copying to a throwaway .ts file and compiling
directly, then deleting it:
- Missing required `purposes: string[]` -> TS2345 "Property 'purposes' is missing"
- `timestamp: 'not-a-number'` -> TS2322 string not assignable to number
- `state: 'pending'` -> TS2322 not assignable to ComponentState
- BASEEL_EVENTS.CONSENT_DENIED assigned to a 'baseel:consent-granted'-typed var -> TS2322
- `purposes: [1,2,3]` -> TS2322 number not assignable to string (x3)

All 5 correctly rejected, proving the types are load-bearing, not `any`.

## Issue found (known — already investigated in a prior audit pass, not new)
StateData.template?: WidgetTemplate depends on `@baseel/types`, which:
1. Is not declared in packages/consent-web-component/package.json's dependencies (there is no
   dependencies field at all), and is not present in the published tgz contents (only
   dist/index.js, package.json, dist/index.js.map, dist/index.d.ts).
2. Is itself `"private": true` in packages/types/package.json — never intended for publishing.

This compat test's tsc run did not report a resolution error only because compat-tests/ lives
inside the monorepo tree, so Node's module resolution walked up to the repo root's hoisted
node_modules/@baseel/types symlink (created by the workspace's own install) — a false negative
caused by location, not evidence the dependency is actually satisfied for a true external
consumer. Most usage (checking state.state / state.error) never touches `template`, so this stays
silent until a consumer inspects the ready-state template payload, at which point a real external
project would likely see `TS2307: Cannot find module '@baseel/types'`.

**This was already investigated in a prior session**: declaring `@baseel/types` as a real
dependency was tried and reverted — it broke `npm install` for consumers outside the monorepo
(e.g. testing-app), since `@baseel/types` is unpublished and npm attempted to fetch it from the
public registry (404). Inlining the type via tsup's `dts.resolve` was also tried and reverted —
it produced a worse result (an incorrect relative import path) because `@baseel/types`'s barrel
`index.ts` re-exports from multiple submodules ambiguously for rollup-plugin-dts's resolver.

No clean fix currently exists without either (a) publishing `@baseel/types` as its own public/
scoped-registry package, or (b) restructuring its barrel exports so a single submodule
unambiguously owns `WidgetTemplate` (which might allow `dts.resolve` to work correctly). Both are
real SDK source changes and out of scope for a testing-only pass — flagged here for awareness,
not applied.

## Other observations
- No missing exports or overly-loose (`any`) types found in the surface exercised.
- --exactOptionalPropertyTypes raised no issues for this test's usage patterns (informational only).
- tsconfig.json's module/moduleResolution/target were kept aligned with the SDK's own
  tsconfig.base.json (NodeNext/NodeNext/ES2022) to avoid false-positive incompatibilities from a
  mismatched consumer config.
