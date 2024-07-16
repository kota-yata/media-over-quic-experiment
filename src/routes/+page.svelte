<script lang="ts">
  import { onMount } from 'svelte';
  import { Publisher } from '$lib/moq/publish/publisher';
  import { Subscriber } from '$lib/moq/subscribe/subscriber';
  import { moqVideoEncodeLatencyStore } from '$lib/moq/utils/store';

  let liveEl: HTMLVideoElement;
  let moqEl: HTMLCanvasElement;
  let moqIsPlaying: boolean = false;
  let moqIsBroadcasting: boolean = false;
  let subscriber: Subscriber;
  let publisher: Publisher;
  let stream: MediaStream;

  const setLiveVideo = async (stream: MediaStream, videoEl: HTMLVideoElement): Promise<MediaStream> => {
    if (!stream) throw new Error('Failed retrieving media devices');
    videoEl.srcObject = stream;
    return stream;
  };
  const moqBroadcastOnclick = async () => {
    if (moqIsBroadcasting) return;
    publisher = new Publisher('https://44.237.11.243:4433/moq');
    await publisher.init();
    await publisher.encode(stream);
    moqIsBroadcasting = true;
  }
  const moqStopBroadcastOnClick = () => {
    if (!moqIsBroadcasting) return;
    publisher.stop();
    moqIsBroadcasting = false;
  }
  const moqPlayStreamOnClick = async () => {
    if (moqIsPlaying) return;
    subscriber = new Subscriber('https://44.237.11.243:4433/moq');
    await subscriber.init();
    subscriber.setCanvasElement(moqEl);
    moqIsPlaying = true;
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
  <h1>MoQ Performance Examination</h1>
  <div class="container-videos">
    <div class="left">
      <h3>Live Video</h3>
      <video autoplay muted playsinline bind:this={liveEl} />
      <button on:click={async () => await moqBroadcastOnclick()}>Start MOQ broadcast</button>
      <button on:click={moqStopBroadcastOnClick}>Stop MOQ broadcast</button>
    </div>
    <div class="right">
      <h3>Media over QUIC</h3>
      <canvas width="480" height="360" bind:this={moqEl} />
      <button on:click={moqPlayStreamOnClick}>Start playing</button>
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
    }
    canvas {
      background-color: #333;
    }
  }
</style>
