<script lang="ts">
	// EXPERIMENT B: onMount-wrapped dynamic import, gated by $app/environment `browser`.
	// EXPERIMENT A (static top-level `import '@baseel/consent-web-component'`) was tried first and
	// crashed SSR with "ReferenceError: HTMLElement is not defined" - see report. Switched to this
	// pattern to fix it.
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';

	let el: HTMLElement;
	let log: string[] = $state([]);

	function addLog(msg: string) {
		log = [...log, msg];
		console.log('[page]', msg);
	}

	onMount(() => {
		if (!browser) return;
		import('@baseel/consent-web-component');

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

<h1>SvelteKit + baseel-consent (top-level import experiment)</h1>
<p><a href="/other">Go to other page</a></p>

<baseel-consent
	bind:this={el}
	public-key="pk_test"
	screen-id="scr_test"
	session-token="tok_test"
	api-base-url="http://localhost:4792"
></baseel-consent>

<h2>Event log</h2>
<ul id="event-log">
	{#each log as entry}
		<li>{entry}</li>
	{/each}
</ul>
