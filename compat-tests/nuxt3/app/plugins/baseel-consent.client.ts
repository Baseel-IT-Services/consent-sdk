// Idiomatic Nuxt pattern for loading a browser-only, side-effecting import:
// a `.client.ts` plugin only ever runs in the browser (Nuxt strips it from the
// server bundle entirely), so it's the recommended place to register a Web
// Component's `customElements.define()` side effect rather than importing the
// package directly in a shared (SSR + client) component/page.
//
// Note: this import is ALSO safe to place directly in a shared component,
// because register.ts guards `customElements.define()` behind
// `typeof customElements !== 'undefined'`. This plugin is the "belt" to that
// guard's "suspenders" — it documents intent and keeps the browser-only
// dependency out of the server bundle/chunk graph entirely.
import '@baseel/consent-web-component'

export default defineNuxtPlugin(() => {
  // Side effect already ran on import above (customElements.define()).
  // This plugin body just needs to exist with a default export so Nuxt
  // actually includes the file in the client build — a plugin file with
  // no default export is silently dropped at build time (NUXT_B2005).
})
