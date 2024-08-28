<script lang="ts">
    import RelayServerUrl from "$lib/components/RelayServerUrl.svelte";
    import MoQTPublisher from "$lib/components/MoQTPublisher.svelte";
    let moqtServerUrl = "https://srcm-moxygen.kota-yata.com:4433/moq";
  </script>
  <div class="container">
    <h1>Publisher-only Page</h1>
    <div class="relay-server">
      <RelayServerUrl bind:serverUrl={moqtServerUrl} />
    </div>
    <div class="publisher">
      <MoQTPublisher {moqtServerUrl} />
    </div>
  </div>
  
  <style lang="scss">
    .container {
      width: 100%;
      text-align: center;
    }
  </style>
  