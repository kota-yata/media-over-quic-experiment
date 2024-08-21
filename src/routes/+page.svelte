<script lang="ts">
  import { onMount } from 'svelte';
  import { Publisher } from '$lib/moq/publish/publisher';
  import { Subscriber } from '$lib/moq/subscribe/subscriber';
  import Performance from '$lib/components/Performance.svelte';
  import MoQTSubscriber from '$lib/components/MoQTSubscriber.svelte';

  let liveEl: HTMLVideoElement;
  let moqIsBroadcasting = false;
  let publisher: Publisher;
  let stream: MediaStream;

  let moqtServerUrl = 'https://srcm-moxygen.kota-yata.com:4433/moq';
  let moqtPubTrackNamespace = 'kota';
  let moqtPubVideoTrackName = 'kota-video';
  let moqtPubAudioTrackName = 'kota-audio';
  let moqtKeyFrameDuration = 60;

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
    publisher = new Publisher(moqtServerUrl);
    await publisher.init({
      namespace: moqtPubTrackNamespace,
      videoTrackName: moqtPubVideoTrackName,
      audioTrackName: moqtPubAudioTrackName,
      keyFrameDuration: moqtKeyFrameDuration
    });
    await publisher.encode(stream);
    moqIsBroadcasting = true;
  };
  const moqStopBroadcastOnClick = async () => {
    // console.log(moqIsBroadcasting)
    // if (!moqIsBroadcasting) return;
    await publisher.stop();
    moqIsBroadcasting = false;
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
      <div class="left-track track">
        <div>
          <label for="pub-track-namespace">Track Namespace</label>
          <input type="text" name="pub-track-info-namespace" bind:value={moqtPubTrackNamespace} />
        </div>
        <div>
          <label for="pub-track-video">Video Track Name</label>
          <input type="text" name="pub-track-video" bind:value={moqtPubVideoTrackName} />
        </div>
        <div>
          <label for="pub-track-audio">Audio Track Name</label>
          <input type="text" name="pub-track-audio" bind:value={moqtPubAudioTrackName} />
        </div>
        <div>
          <label for="pub-track-keyframe-duration">Key Frame Duration {moqtKeyFrameDuration}</label>
          <input type="range" min="1" max="120" name="pub-track-keyframe-duration" bind:value={moqtKeyFrameDuration} />
        </div>
      </div>
      <button on:click={async () => await moqBroadcastOnclick()}>Start publisher</button>
      <button on:click={async () => await moqStopBroadcastOnClick()}>Unannounce</button>
    </div>
    <div class="right">
     <MoQTSubscriber {moqtServerUrl}  />
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
      }
      .track {
        & > div {
          margin: 5px;
        }
      }
    }
  }
</style>
