<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';

  const dispatch = createEventDispatcher();

  let videoEl: HTMLVideoElement;
  let canvasEl: HTMLCanvasElement;
  export let title: string;
  export let type: 'video' | 'canvas' = 'video';

  onMount(() => {
    const element = type === 'video' ? videoEl : canvasEl;
    dispatch('el', { el: element });
  });
</script>

<!-- svelte-ignore a11y-media-has-caption -->
<div>
  <h3>{title}</h3>
  {#if type === 'video'}
    <video autoplay playsinline bind:this={videoEl} />
  {:else if type === 'canvas'}
    <canvas bind:this={canvasEl} />
  {/if}
</div>

<style lang="scss">
  div {
    width: 45vw;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
</style>
