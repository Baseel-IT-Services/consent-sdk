<script setup lang="ts">
// Log surface the Playwright driver script reads back via page.evaluate().
if (import.meta.client) {
  ;(window as any).__consentEvents = (window as any).__consentEvents || []
}
</script>

<template>
  <div>
    <h1>Baseel Consent Manager — Nuxt3 (SSR) compat test</h1>
    <nav>
      <NuxtLink to="/">Unwrapped</NuxtLink>
      |
      <NuxtLink to="/clientonly">Wrapped in ClientOnly</NuxtLink>
    </nav>
    <NuxtPage />
  </div>
</template>
