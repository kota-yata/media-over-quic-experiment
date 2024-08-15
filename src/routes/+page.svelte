<script lang="ts">
  import { onMount } from 'svelte';
  import { Publisher } from '$lib/moq/publish/publisher';
  import { Subscriber } from '$lib/moq/subscribe/subscriber';
  import { moqVideoEncodeLatencyStore } from '$lib/moq/utils/store';
  import { text } from 'svelte/internal';

  let liveEl: HTMLVideoElement;
  let moqEl: HTMLCanvasElement;
  let moqIsPlaying: boolean = false;
  let moqIsBroadcasting: boolean = false;
  let subscriber: Subscriber;
  let publisher: Publisher;
  let stream: MediaStream;

  let moqtServerUrl = 'https://localhost:4433/moq';

  const setLiveVideo = async (stream: MediaStream, videoEl: HTMLVideoElement): Promise<MediaStream> => {
    if (!stream) throw new Error('Failed retrieving media devices');
    videoEl.srcObject = stream;
    return stream;
  };
  const moqBroadcastOnclick = async () => {
    if (moqIsBroadcasting) return;
    // publisher = new Publisher('https://44.237.11.243:4433/moq');
    // publisher = new Publisher('https://norsk-moq-linode-chicago.englishm.net:4443');
    publisher = new Publisher(moqtServerUrl);
    await publisher.init();
    await publisher.encode(stream);
    moqIsBroadcasting = true;
  }
  const moqStopBroadcastOnClick = async () => {
    // console.log(moqIsBroadcasting)
    // if (!moqIsBroadcasting) return;
    await publisher.stop();
    moqIsBroadcasting = false;
  }
  const moqPlayStreamOnClick = async () => {
    if (moqIsPlaying) return;
    // subscriber = new Subscriber('https://norsk-moq-linode-chicago.englishm.net:4443');
    subscriber = new Subscriber(moqtServerUrl);
    await subscriber.init();
    subscriber.setCanvasElement(moqEl);
    moqIsPlaying = true;
  }
  const moqStopStreamOnClick = async () => {
    if (!moqIsPlaying) return;
    await subscriber.stop();
    moqIsPlaying = false;
  }

  onMount(async () => {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }).catch(() => {
      throw new Error('Error accessing media devices:');
    });
    setLiveVideo(stream, liveEl);
  });
</script>

<svelte:head>
  <title>Media over QUIC Experiment</title>
</svelte:head>

<!-- svelte-ignore a11y-media-has-caption -->
<div class="container">
  <h1>Video Call with MoQT</h1>
  <div class="container-videos">
    <div class="left">
      <h3>Publisher (Webcam capture)</h3>
      <video autoplay muted playsinline bind:this={liveEl} />
      <div class="left-server">
        <label for="ServerUrl">Relay Server</label>
        <input type="text" name="ServerUrl" bind:value={moqtServerUrl} placeholder="https://localhost:4433/moq" />
      </div>
      <button on:click={async () => await moqBroadcastOnclick()}>Start MOQ broadcast</button>
      <button on:click={async () => await moqStopBroadcastOnClick()}>Stop MOQ broadcast</button>
    </div>
    <div class="right">
      <h3>Subscriber</h3>
      <canvas width="480" height="360" bind:this={moqEl} />
      <button on:click={moqPlayStreamOnClick}>Start playing</button>
      <button on:click={moqStopStreamOnClick}>Stop playing</button>
    </div>
  </div>
</div>

<style lang="scss">
  .container {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    &-videos {
      margin: 10px 0 0 0;
      display: flex;
      justify-content: space-between;
      & > div {
        margin: 0 10px;
        max-width: 480px;
        display: flex;
        flex-direction: column;
        justify-content: start;
        align-items: center;
      }
      .left {
        &-server {
          width: 100%;
          margin: 5px;
          display: flex;
          justify-content: center;
          input {
            margin-left: 5px;
            width: 50%;
          }
        }
      }
    }
    canvas {
      background-color: #333;
    }
  }
</style>
