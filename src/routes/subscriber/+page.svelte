<script lang="ts">
  import RelayServerUrl from "$lib/components/RelayServerUrl.svelte";
  import MoQTSubscriber from "$lib/components/MoQTSubscriber.svelte";
  import Performance from "$lib/components/Performance.svelte";
  let moqtServerUrl = "https://srcm-moxygen.kota-yata.com:4433/moq";
</script>
<div class="container">
  <h1>Subscriber-only Page</h1>
  <div class="relay-server">
    <RelayServerUrl bind:serverUrl={moqtServerUrl} />
  </div>
  <div class="subscriber">
    <MoQTSubscriber {moqtServerUrl} canvasWidth={720} canvasHeight={480} />
  </div>
  <div>
    <Performance />
  </div>
</div>

<style lang="scss">
  .container {
    width: 100%;
    text-align: center;
  }
</style>
