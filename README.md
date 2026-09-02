# Baseel SDK

Reusable, framework-independent consent-management SDK for embedding Baseel
consent screens directly in a web application — no iframe required.

The SDK talks to your existing Baseel CMP backend over HTTPS using a
short-lived session token; it does not implement any consent logic itself.

## Packages

| Package | Description |
|---|---|
| [`@baseel/types`](packages/types) | Shared TypeScript types used across the SDK |
| [`@baseel/consent-web-component`](packages/consent-web-component) | Framework-agnostic core, ships a custom element |
| [`@baseel/consent-react`](packages/consent-react) | React wrapper (`<BaseelConsent />`) around the web component |
| [`@baseel/loader`](packages/loader) | Lightweight `<script>`-tag loader for non-bundler integrations |

## Quick start (React / Next.js)

```bash
npm install @baseel/consent-react
```

```tsx
"use client";
import { BaseelConsent } from "@baseel/consent-react";

export function Consent({ token }: { token: string }) {
  return (
    <BaseelConsent
      sessionToken={token}
      screenId="example-screen"
      onConsentGranted={(data) => console.log("granted", data)}
    />
  );
}
```

## Quick start (any other framework / vanilla HTML)

```bash
npm install @baseel/consent-web-component
```

```html
<script type="module">
  import "@baseel/consent-web-component";
</script>

<baseel-consent
  session-token="TOKEN"
  screen-id="example-screen"
></baseel-consent>
```

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
