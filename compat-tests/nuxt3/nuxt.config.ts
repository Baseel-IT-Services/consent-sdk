// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  vue: {
    compilerOptions: {
      // Tell Vue's compiler that <baseel-consent> is a native custom element,
      // not a Vue component it should try to resolve — avoids a
      // "Failed to resolve component: baseel-consent" warning at build/runtime,
      // and avoids Vue trying to pass props to it as component props during SSR.
      isCustomElement: (tag) => tag === 'baseel-consent',
    },
  },
})
