<script lang="ts">
	import ConsentWidget from './lib/ConsentWidget.svelte';

	let mounted = $state(true);
</script>

<h1>Plain Svelte (Vite SPA) + baseel-consent</h1>

<button id="toggle-mount" onclick={() => (mounted = !mounted)}>
	{mounted ? 'Unmount' : 'Mount'} widget
</button>

{#if mounted}
	<ConsentWidget />
{/if}
