# Baseel SDK

Reusable, framework-independent consent-management SDK for embedding Baseel
consent screens directly in a web application — no iframe required.

The SDK talks to your existing Baseel CMP backend over HTTPS using a
short-lived session token; it does not implement any consent logic itself.

## Installation

Everything ships as **one package**:

```bash
npm install @baseel/consent-sdk
```

| Import | What you get |
|---|---|
| `@baseel/consent-sdk` | `<baseel-consent>` custom element (auto-registered), `loadSdk` loader + error classes, all shared TypeScript types |
| `@baseel/consent-sdk/react` | React wrapper `<BaseelConsent />` (`react`/`react-dom` >= 18 are optional peers, only needed for this entry) |

## Quick start (React / Next.js)

```tsx
"use client";
import { BaseelConsent } from "@baseel/consent-sdk/react";

export function Consent({ token }: { token: string }) {
  return (
    <BaseelConsent
      publicKey="PUBLIC_KEY"
      sessionToken={token}
      screenId="example-screen"
      onConsentGranted={(data) => console.log("granted", data)}
    />
  );
}
```

## Quick start (any other framework / vanilla HTML)

```html
<script type="module">
  import "@baseel/consent-sdk";
</script>

<baseel-consent
  public-key="PUBLIC_KEY"
  session-token="TOKEN"
  screen-id="example-screen"
></baseel-consent>
```

## Monorepo layout

The published [`@baseel/consent-sdk`](packages/consent-sdk) bundles these
internal workspace packages from source; they are not installed separately:

| Internal package | Description |
|---|---|
| [`packages/types`](packages/types) | Shared TypeScript types used across the SDK |
| [`packages/consent-web-component`](packages/consent-web-component) | Framework-agnostic core, ships a custom element |
| [`packages/consent-react`](packages/consent-react) | React wrapper (`<BaseelConsent />`) around the web component |
| [`packages/loader`](packages/loader) | Headless app-config bootstrapper (`loadSdk`) |

See [`compat-tests/`](compat-tests) for working examples against Angular,
Astro, Nuxt 3, SolidJS, Svelte, SvelteKit, Vue 3, and plain HTML.

## Development

```bash
npm install
npm run build
npm run test
npm run lint
```

This is an npm-workspaces monorepo (`packages/*`, `apps/*`), built with
[Turborepo](https://turbo.build).

## License

[MIT](LICENSE) © Baseel
