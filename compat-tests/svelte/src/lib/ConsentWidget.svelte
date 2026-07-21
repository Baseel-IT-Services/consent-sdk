<script lang="ts">
	// Plain client-only Svelte SPA (Vite template, no SSR) - a static top-level import
	// of the web component package is safe here since `HTMLElement` always exists
	// in this environment (unlike SvelteKit SSR, where the same import crashes
	// unless deferred with `browser` + dynamic import).
	import '@baseel/consent-web-component';
	import { onMount } from 'svelte';

	let el: HTMLElement;
	let log: string[] = $state([]);

	function addLog(msg: string) {
		log = [...log, msg];
		console.log('[ConsentWidget]', msg);
	}

	onMount(() => {
		const onGranted = (e: Event) => addLog(`consent-granted: ${JSON.stringify((e as CustomEvent).detail)}`);
		const onDenied = (e: Event) => addLog(`consent-denied: ${JSON.stringify((e as CustomEvent).detail)}`);
		const onError = (e: Event) => addLog(`consent-error: ${JSON.stringify((e as CustomEvent).detail)}`);

		el.addEventListener('baseel:consent-granted', onGranted);
		el.addEventListener('baseel:consent-denied', onDenied);
		el.addEventListener('baseel:consent-error', onError);

		return () => {
			el.removeEventListener('baseel:consent-granted', onGranted);
			el.removeEventListener('baseel:consent-denied', onDenied);
			el.removeEventListener('baseel:consent-error', onError);
		};
	});
</script>

<baseel-consent
	bind:this={el}
	public-key="pk_test"
	screen-id="scr_test"
	session-token="tok_test"
	api-base-url="http://localhost:4795"
></baseel-consent>

<h2>Event log</h2>
<ul id="event-log">
	{#each log as entry}
		<li>{entry}</li>
	{/each}
</ul>
