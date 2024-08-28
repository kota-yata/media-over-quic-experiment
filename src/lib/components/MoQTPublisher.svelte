<script lang="ts">
  import { Publisher } from '$lib/moq/publish/publisher';
  import { onMount } from 'svelte';

  let liveEl: HTMLVideoElement;
  let moqIsBroadcasting = false;
  let publisher: Publisher;
  let stream: MediaStream;

  export let moqtServerUrl;
  let namespace = 'kota';
  let videoTrackName = 'kota-video';
  let audioTrackName = 'kota-audio';
  let keyFrameDuration = 60;
  let authInfo = 'secret';

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
    await publisher.init({ namespace, videoTrackName, audioTrackName, keyFrameDuration, authInfo });
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
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1920, height: 1080 }, audio: true }).catch(() => {
      throw new Error('Error accessing media devices:');
    });
    camera.inputDevices = (await navigator.mediaDevices.enumerateDevices()).filter(
      (device) => device.kind === 'videoinput'
    );
    setLiveVideo(stream, liveEl);
  });
</script>

<div class="pub">
  <h3>Publisher (Webcam capture)</h3>
  <div class="pub-video">
    <video autoplay muted playsinline bind:this={liveEl} />
    {#if camera.inputDevices}
      <select on:change={changeDevice}>
        {#each camera.inputDevices as device}
          <option value={device.deviceId}>{device.label}</option>
        {/each}
      </select>
    {/if}
  </div>
  <div class="track">
    <div>
      <label for="pub-track-namespace">Track Namespace</label>
      <input type="text" name="pub-track-info-namespace" bind:value={namespace} />
    </div>
    <div>
      <label for="pub-track-video">Video Track Name</label>
      <input type="text" name="pub-track-video" bind:value={videoTrackName} />
    </div>
    <div>
      <label for="pub-track-audio">Audio Track Name</label>
      <input type="text" name="pub-track-audio" bind:value={audioTrackName} />
    </div>
    <div>
      <label for="pub-track-keyframe-duration">Key Frame Duration {keyFrameDuration}</label>
      <input type="range" min="1" max="120" name="pub-track-keyframe-duration" bind:value={keyFrameDuration} />
    </div>
    <div>
      <label for="pub-track-auth">Authorization Info</label>
      <input type="text" name="pub-track-auth" bind:value={authInfo} />
    </div> 
  </div>
  <button on:click={async () => await moqBroadcastOnclick()}>Start publisher</button>
  <button on:click={async () => await moqStopBroadcastOnClick()}>Unannounce</button>
</div>

<style lang="scss">
  .pub {
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: start;
    align-items: center;
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
    .track > div {
      margin: 5px;
    }
  }
</style>
