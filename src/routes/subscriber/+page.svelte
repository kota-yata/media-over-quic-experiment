<script lang="ts">
  import RelayServerUrl from "$lib/components/RelayServerUrl.svelte";
  import MoQTSubscriber from "$lib/components/MoQTSubscriber.svelte";
  let moqtServerUrl = "https://localhost:4433/moq";
</script>
<div class="container">
  <h1>Subscriber-only Page</h1>
  <div class="relay-server">
    <RelayServerUrl bind:serverUrl={moqtServerUrl} />
  </div>
  <div class="subscriber">
    <MoQTSubscriber {moqtServerUrl} canvasWidth={window.innerWidth * 0.7} canvasHeight={(window.innerWidth * 0.7) * 3/4} />
  </div>
</div>

<style lang="scss">
  .container {
    width: 100%;
    text-align: center;
  }
</style>
