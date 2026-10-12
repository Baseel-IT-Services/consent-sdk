# @baseel/consent-sdk

The Baseel Consent SDK in a single package: the `<baseel-consent>` web
component, the React `<BaseelConsent />` component, the `loadSdk` loader and
all shared TypeScript types.

```bash
npm install @baseel/consent-sdk
```

## Any framework / plain HTML

Importing the package registers the `<baseel-consent>` custom element.

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

Works in Angular, Astro, Nuxt 3, SolidJS, Svelte, SvelteKit and Vue 3 — see
[`compat-tests/`](https://github.com/Baseel-IT-Services/consent-sdk/tree/main/compat-tests).

## React / Next.js

```tsx
import { BaseelConsent } from "@baseel/consent-sdk/react";

<BaseelConsent
  publicKey="PUBLIC_KEY"
  sessionToken="TOKEN"
  screenId="example-screen"
  email="user@example.com" // optional — enables OTP verification
  onConsentGranted={(detail) => console.log(detail)}
/>;
```

`react` and `react-dom` (>= 18) are optional peer dependencies — only needed
when you import `@baseel/consent-sdk/react`.

## Loader and types

```ts
import { loadSdk, ConfigurationError } from "@baseel/consent-sdk";
import type { SdkConfig, WidgetTemplate } from "@baseel/consent-sdk";
```

## What it replaces

| Before                           | Now                                   |
| -------------------------------- | ------------------------------------- |
| `@baseel/consent-react`          | `@baseel/consent-sdk/react`           |
| `@baseel/consent-web-component`  | `@baseel/consent-sdk`                 |
| `@baseel/loader`                 | `@baseel/consent-sdk`                 |
| `@baseel/types`                  | `@baseel/consent-sdk`                 |

The custom element class is exported from the root as `BaseelConsent`; the
React component of the same name lives under `/react`.

Part of the [Baseel SDK monorepo](https://github.com/Baseel-IT-Services/consent-sdk).
