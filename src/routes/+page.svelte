<script lang="ts">
  import { onMount } from 'svelte';
  import { Publisher } from '$lib/moq/publish/publisher';
  import { Subscriber } from '$lib/moq/subscribe/subscriber';
  import { moqVideoEncodeLatencyStore } from '$lib/moq/utils/store';

  let liveEl: HTMLVideoElement;
  let moqEl: HTMLCanvasElement;
  let moqIsPlaying = false;
  let moqIsBroadcasting = false;
  let subscriber: Subscriber;
  let publisher: Publisher;
  let stream: MediaStream;

  let moqtServerUrl = 'https://localhost:4433/moq';
  let moqtTrackNamespace = 'kota';
  let moqtVideoTrackName = 'kota-video';
  let moqtAudioTrackName = 'kota-audio';

  const camera = {
    inputDevices: null as MediaDeviceInfo[],
    selectedDevice: null as string
  };

  const changeDevice = async (e) => {
    const newStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: e.target.value } } });
    stream.removeTrack(stream.getVideoTracks()[0]);
    stream.addTrack(newStream.getVideoTracks()[0]);
    setLiveVideo(newStream, liveEl);
    if (!publisher) return;
    publisher.replaceTrack(stream);
  };

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
  };
  const moqStopBroadcastOnClick = async () => {
    // console.log(moqIsBroadcasting)
    // if (!moqIsBroadcasting) return;
    await publisher.stop();
    moqIsBroadcasting = false;
  };
  const moqPlayStreamOnClick = async () => {
    if (moqIsPlaying) return;
    // subscriber = new Subscriber('https://norsk-moq-linode-chicago.englishm.net:4443');
    subscriber = new Subscriber(moqtServerUrl);
    await subscriber.init();
    subscriber.setCanvasElement(moqEl);
    moqIsPlaying = true;
  };
  const moqStopStreamOnClick = async () => {
    if (!moqIsPlaying) return;
    await subscriber.stop();
    moqIsPlaying = false;
  };

  onMount(async () => {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }).catch(() => {
      throw new Error('Error accessing media devices:');
    });
    camera.inputDevices = (await navigator.mediaDevices.enumerateDevices()).filter(
      (device) => device.kind === 'videoinput'
    );
    setLiveVideo(stream, liveEl);
  });
</script>

<svelte:head>
  <title>Media over QUIC Experiment</title>
</svelte:head>

<!-- svelte-ignore a11y-media-has-caption -->
<div class="container">
  <h1>Video Call with MoQT</h1>
  <div class="relay-server">
    <label for="relay-server-url">Relay Server</label>
    <input type="text" name="relay-server-url" bind:value={moqtServerUrl} />
  </div>
  <div class="container-videos">
    <div class="left">
      <h3>Publisher (Webcam capture)</h3>
      <div class="left-video">
        <video autoplay muted playsinline bind:this={liveEl} />
        {#if camera.inputDevices}
          <select on:change={changeDevice}>
            {#each camera.inputDevices as device}
              <option value={device.deviceId}>{device.label}</option>
            {/each}
          </select>
        {/if}
      </div>
      <div class="left-track">
        <div>
          <label for="track-info-namespace">Track Namespace</label>
          <input type="text" name="track-info-namespace" bind:value={moqtTrackNamespace} />
        </div>
        <div>
          <label for="track-info-video">Video Track Name</label>
          <input type="text" name="track-info-video" bind:value={moqtVideoTrackName} />
        </div>
        <div>
          <label for="track-info-audio">Audio Track Name</label>
          <input type="text" name="track-info-audio" bind:value={moqtAudioTrackName} />
        </div>
      </div>
      <button on:click={async () => await moqBroadcastOnclick()}>Start publisher</button>
      <button on:click={async () => await moqStopBroadcastOnClick()}>Unannounce</button>
    </div>
    <div class="right">
      <h3>Subscriber</h3>
      <canvas width="480" height="360" bind:this={moqEl} />
      <button on:click={moqPlayStreamOnClick}>Subscribe</button>
      <button on:click={moqStopStreamOnClick}>Unsubscribe</button>
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
    .relay-server {
      width: 100%;
      margin: 5px;
      display: flex;
      justify-content: center;
      input {
        margin-left: 5px;
        width: 50%;
      }
    }
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
        &-video {
          position: relative;
          video {
            object-fit: contain;
          }
          & > select {
            position: absolute;
            bottom: 10px;
            left: 10px;
            border: none;
            padding: 5px 10px;
          }
        }
        &-track {
          & > div {
            margin: 5px;
          }
        }
      }
    }
    canvas {
      background-color: #333;
    }
  }
</style>
