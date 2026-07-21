<script setup lang="ts">
import { ref } from 'vue'

// Toggle to mount/unmount/remount the widget for the cleanup smoke test.
const showWidget = ref(true)

// Log surface the Playwright driver script reads back via page.evaluate().
;(window as any).__consentEvents = []

function onGranted(e: Event) {
  ;(window as any).__consentEvents.push({ type: 'granted', detail: (e as CustomEvent).detail })
  console.log('baseel:consent-granted', (e as CustomEvent).detail)
}
function onDenied(e: Event) {
  ;(window as any).__consentEvents.push({ type: 'denied', detail: (e as CustomEvent).detail })
  console.log('baseel:consent-denied', (e as CustomEvent).detail)
}
function onError(e: Event) {
  ;(window as any).__consentEvents.push({ type: 'error', detail: (e as CustomEvent).detail })
  console.log('baseel:consent-error', (e as CustomEvent).detail)
}

function toggleWidget() {
  showWidget.value = !showWidget.value
}
</script>

<template>
  <div>
    <h1>Baseel Consent Manager — Vue 3 + Vite compat test</h1>
    <button id="toggle-btn" @click="toggleWidget">Toggle widget (mount/unmount)</button>

    <baseel-consent
      v-if="showWidget"
      public-key="pk_test"
      screen-id="scr_test"
      session-token="tok_test"
      api-base-url="http://127.0.0.1:4789"
      @baseel:consent-granted="onGranted"
      @baseel:consent-denied="onDenied"
      @baseel:consent-error="onError"
    ></baseel-consent>
  </div>
</template>
