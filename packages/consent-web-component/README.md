# @baseel-sdk/consent-web-component

Framework-agnostic core of the Baseel Consent SDK. Ships a `<baseel-consent>`
custom element that renders a consent screen fetched from your Baseel CMP
backend — no iframe required.

```bash
npm install @baseel-sdk/consent-web-component
```

```html
<script type="module">
  import "@baseel-sdk/consent-web-component";
</script>

<baseel-consent
  session-token="TOKEN"
  screen-id="example-screen"
></baseel-consent>
```

Using React? Use [`@baseel-sdk/consent-react`](https://www.npmjs.com/package/@baseel-sdk/consent-react)
instead for a native `<BaseelConsent />` component.

See [`compat-tests/`](https://github.com/baseel-sdk/baseel-sdk/tree/main/compat-tests)
in the main repo for working examples in Angular, Astro, Nuxt 3, SolidJS,
Svelte, SvelteKit, and Vue 3.

Part of the [Baseel SDK monorepo](https://github.com/baseel-sdk/baseel-sdk).

## License

[MIT](../../LICENSE) © Baseel
