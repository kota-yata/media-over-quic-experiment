<script lang="ts">
  import Performance from '$lib/components/Performance.svelte';
  import MoQTSubscriber from '$lib/components/MoQTSubscriber.svelte';
  import MoQtPublisher from '$lib/components/MoQTPublisher.svelte';

  let moqtServerUrl = 'https://srcm-moxygen.kota-yata.com:4433/moq';
</script>

<svelte:head>
  <title>VIdeo Call over MoQT</title>
</svelte:head>

<!-- svelte-ignore a11y-media-has-caption -->
<div class="container">
  <h1>Video Call over MoQT</h1>
  <div class="relay-server">
    <label for="relay-server-url">Relay Server</label>
    <input type="text" name="relay-server-url" bind:value={moqtServerUrl} />
  </div>
  <div class="container-videos">
    <div class="left">
      <MoQtPublisher {moqtServerUrl} />
    </div>
    <div class="right">
      <MoQTSubscriber {moqtServerUrl} />
    </div>
  </div>
  <Performance />
</div>

<style lang="scss">
  .container {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    .relay-server {
      width: 100%;
      margin: 5px;
      display: flex;
      justify-content: center;
      input {
        margin-left: 5px;
        width: 50%;
        max-width: 300px;
      }
    }
    &-videos {
      margin: 10px 0 0 0;
      display: flex;
      justify-content: space-between;
      & > div {
        margin: 0 10px;
        max-width: 480px;
      }
    }
  }
</style>
