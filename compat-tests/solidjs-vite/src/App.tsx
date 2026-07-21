import { createSignal, Show } from 'solid-js'
import '@baseel/consent-web-component'
import './App.css'

// Solid's JSX namespace has no built-in knowledge of the `baseel-consent`
// custom element or its kebab-case attributes. Without this augmentation,
// `tsc` flags `<baseel-consent ...>` as an unknown intrinsic element/props
// (mirrors the pattern @baseel/consent-react uses for React's JSX namespace).
declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'baseel-consent': {
        ref?: (el: HTMLElement) => void
        'public-key'?: string
        'session-token'?: string
        'screen-id'?: string
        'api-base-url'?: string
        class?: string
      }
    }
  }
}

let grantedCount = 0

function ConsentWidget() {
  // Solid's `on:eventname` directive lowercases/attaches via addEventListener
  // under the hood, but the directive name is parsed as a plain JS identifier
  // segment — a name containing a literal `:` (`baseel:consent-granted`) is not
  // valid there (`on:baseel:consent-granted` does not parse as a single
  // attribute; Solid's compiler treats `on:` as the namespace and expects a
  // bare identifier after it, so a second colon breaks it). We instead use
  // Solid's `ref` callback to call `addEventListener` directly, exactly as
  // @baseel/consent-react does with its `ref` prop.
  const ref = (el: HTMLElement) => {
    el.addEventListener('baseel:consent-granted', (e) => {
      grantedCount++
      console.log('[App] baseel:consent-granted fired, count =', grantedCount, (e as CustomEvent).detail)
      const out = document.getElementById('granted-log')
      if (out) out.textContent = `granted x${grantedCount}: ${JSON.stringify((e as CustomEvent).detail)}`
    })
    el.addEventListener('baseel:consent-denied', (e) => {
      console.log('[App] baseel:consent-denied fired', (e as CustomEvent).detail)
    })
    el.addEventListener('baseel:consent-error', (e) => {
      console.log('[App] baseel:consent-error fired', (e as CustomEvent).detail)
    })
  }

  return (
    <baseel-consent
      ref={ref}
      public-key="pk_test"
      screen-id="scr_test"
      session-token="tok_test"
      api-base-url="http://localhost:4790"
    />
  )
}

function App() {
  const [mounted, setMounted] = createSignal(true)

  return (
    <>
      <h1>Baseel Consent - Solid + Vite compat test</h1>
      <button type="button" onClick={() => setMounted((m) => !m)}>
        {mounted() ? 'Unmount' : 'Mount'}
      </button>
      <div id="granted-log">granted x0</div>
      <div id="mount-point">
        <Show when={mounted()}>
          <ConsentWidget />
        </Show>
      </div>
    </>
  )
}

export default App
