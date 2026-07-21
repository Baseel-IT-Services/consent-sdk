import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // Tell Vue's compiler that <baseel-consent> is a native custom element,
          // not a Vue component it should try to resolve — avoids a
          // "Failed to resolve component: baseel-consent" warning at build/runtime.
          isCustomElement: (tag) => tag === 'baseel-consent',
        },
      },
    }),
  ],
})
