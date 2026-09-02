# @baseel-sdk/consent-react

React components for embedding Baseel consent screens directly in your app —
no iframe required.

```bash
npm install @baseel-sdk/consent-react
```

```tsx
"use client"; // required in Next.js App Router — this renders a custom element client-side

import { BaseelConsent } from "@baseel-sdk/consent-react";

export function Consent({ token }: { token: string }) {
  return (
    <BaseelConsent
      sessionToken={token}
      screenId="example-screen"
      onConsentGranted={(data) => {
        // continue your app's flow
      }}
      onConsentDenied={() => {
        // handle denial
      }}
    />
  );
}
```

## Peer dependencies

Requires `react` and `react-dom` `>=18.0.0` in the consuming app.

## License

[MIT](../../LICENSE) © Baseel
