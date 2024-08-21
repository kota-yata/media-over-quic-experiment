<script lang="ts">
  import { Subscriber } from '$lib/moq/subscribe/subscriber';
  let moqEl: HTMLCanvasElement;
  let moqIsPlaying = false;
  let subscriber: Subscriber;

  export let moqtServerUrl;
  let moqtSubTrackNamespace = 'kota';
  let moqtSubVideoTrackName = 'kota-video';
  let moqtSubAudioTrackName = 'kota-audio';

  const camera = {
    inputDevices: null as MediaDeviceInfo[],
    selectedDevice: null as string
  };
  const moqPlayStreamOnClick = async () => {
    if (moqIsPlaying) return;
    // subscriber = new Subscriber('https://norsk-moq-linode-chicago.englishm.net:4443');
    subscriber = new Subscriber(moqtServerUrl);
    await subscriber.init({
      namespace: moqtSubTrackNamespace,
      videoTrackName: moqtSubVideoTrackName,
      audioTrackName: moqtSubAudioTrackName
    });
    subscriber.setCanvasElement(moqEl);
    moqIsPlaying = true;
  };
  const moqStopStreamOnClick = async () => {
    if (!moqIsPlaying) return;
    await subscriber.stop();
    moqIsPlaying = false;
  };
</script>

<div class="sub">
  <h3>Subscriber</h3>
  <canvas width="480" height="360" bind:this={moqEl} />
  <div class="track">
    <div>
      <label for="sub-track-namespace">Track Namespace</label>
      <input type="text" name="sub-track-namespace" bind:value={moqtSubTrackNamespace} />
    </div>
    <div>
      <label for="sub-track-video">Video Track Name</label>
      <input type="text" name="sub-track-info-video" bind:value={moqtSubVideoTrackName} />
    </div>
    <div>
      <label for="sub-track-audio">Audio Track Name</label>
      <input type="text" name="sub-track-audio" bind:value={moqtSubAudioTrackName} />
    </div>
  </div>
  <button on:click={moqPlayStreamOnClick}>Subscribe</button>
  <button on:click={moqStopStreamOnClick}>Unsubscribe</button>
</div>

<style>
  .sub {
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: start;
    align-items: center;
  }
  .track > div {
    margin: 5px;
  }
  canvas {
      background-color: #333;
    }
</style>
