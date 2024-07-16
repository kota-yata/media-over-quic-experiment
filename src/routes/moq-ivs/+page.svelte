<script lang="ts">
  import { onMount } from 'svelte';
  import { Publisher } from '$lib/moq/publish/publisher';
  import { Subscriber } from '$lib/moq/subscribe/subscriber';
  import { broadcast } from '$lib/ivs';
  import HLS from 'hls.js';
  import { moqVideoDecodeLatencyStore, moqVideoEncodeLatencyStore, moqVideoTransmissionLatencyStore } from '$lib/moq/utils/store';

  let liveEl: HTMLVideoElement;
  let IVSEl: HTMLVideoElement;
  let moqEl: HTMLCanvasElement;
  let moqIsPlaying: boolean = false;
  let moqIsBroadcasting: boolean = false;
  let subscriber: Subscriber;
  let publisher: Publisher;
  let stream: MediaStream;

  let streamKey: string = '';

  const setLiveVideo = async (stream: MediaStream, videoEl: HTMLVideoElement): Promise<MediaStream> => {
    if (!stream) throw new Error('Failed retrieving media devices');
    videoEl.srcObject = stream;
    return stream;
  };

  const ivsBroadcastOnclick = () => {
    broadcast(stream, streamKey);
  }
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

  const hlsUrl = 'https://516172ba1ccf.us-west-2.playback.live-video.net/api/video/v1/us-west-2.058264281702.channel.46F81L1y5iqM.m3u8';

  const hlsStreamOnClick = () => {
    if (HLS.isSupported()) {
      console.log('HLS supported');
      const hls = new HLS();
      hls.loadSource(hlsUrl);
      hls.attachMedia(IVSEl);
      hls.on(HLS.Events.MANIFEST_PARSED, () => {
        IVSEl.play();
      });
    } else if (IVSEl.canPlayType('application/vnd.apple.mpegurl')) {
      console.log('MPEGURL supported')
      IVSEl.src = hlsUrl;
      IVSEl.addEventListener('loadedmetadata', () => {
        IVSEl.play();
      });
    }
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
  <title>IVS vs Media over QUIC</title>
</svelte:head>

<!-- svelte-ignore a11y-media-has-caption -->
<div class="container">
  <h1>Streaming Quality Comparison</h1>
  <h3>Live Video</h3>
  <video autoplay muted playsinline bind:this={liveEl} />
  <input type="text" placeholder="Enter your stream key" bind:value={streamKey}/>
  <button on:click={ivsBroadcastOnclick}>Start IVS broadcast</button>
  <button on:click={async () => await moqBroadcastOnclick()}>Start MOQ broadcast</button>
  <button on:click={moqStopBroadcastOnClick}>Stop MOQ broadcast</button>
  <div class="container-videos">
    <div class="left">
      <h3>RTMP + HLS</h3>
      <video autoplay playsinline bind:this={IVSEl} />
      <button on:click={hlsStreamOnClick}>Watch IVS streaming</button>
    </div>
    <div class="right">
      <h3>Media over QUIC</h3>
      <canvas width="480" height="360" bind:this={moqEl} />
      <button on:click={moqPlayStreamOnClick}>Start playing</button>
      <div class="performance">
        <p>Encoding&Packaging Latency: {Math.round($moqVideoEncodeLatencyStore)}ms</p>
        <p>Transmission Latency: {Math.round($moqVideoTransmissionLatencyStore)}ms</p>
        <p>Decoding&Depackaging Latency: {Math.round($moqVideoDecodeLatencyStore)}ms</p>
      </div>
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
        justify-content: top;
        align-items: center;
      }
      .right {
        .performance {
          text-align: right;
        }
      }
    }
    canvas {
      background-color: #333;
    }
  }
</style>
