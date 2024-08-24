<script lang='ts'>
  export let serverUrl: string;
</script>

<div>
  <label for="relay-server-url">Relay Server</label>
  <input type="text" name="relay-server-url" bind:value={serverUrl} />
</div>

<style>
  div {
    width: 100%;
    display: flex;
    justify-content: center;
  }
  div > input {
    margin-left: 5px;
    width: 50%;
    max-width: 300px;
  }
</style>
