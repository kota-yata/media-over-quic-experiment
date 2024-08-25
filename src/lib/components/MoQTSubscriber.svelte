<script lang="ts">
  import { Subscriber } from '$lib/moq/subscribe/subscriber';
  let moqEl: HTMLCanvasElement;
  let moqIsPlaying = false;
  let subscriber: Subscriber;

  export let moqtServerUrl;
  export let canvasWidth = 480;
  export let canvasHeight = 360;
  let moqtSubTrackNamespace = 'kota';
  let moqtSubVideoTrackName = 'kota-video';
  let moqtSubAudioTrackName = 'kota-audio';
  let moqtSubAuth = 'secret';
  let moqtSubJitterBufferFrameSize = 10;

  let videoQuality: 'low' | 'medium' | 'high' = 'low';

  const qualityOnChange = async (event) => {
    videoQuality = event.target.value;
    if (moqIsPlaying) {
      await subscriber.stop();
      subscriber = new Subscriber(moqtServerUrl, canvasWidth, canvasHeight);
      await subscriber.init({
        namespace: moqtSubTrackNamespace,
        videoTrackName: `${moqtSubVideoTrackName}-${videoQuality}`,
        audioTrackName: moqtSubAudioTrackName,
        authInfo: moqtSubAuth,
        jitterBufferFrameSize: moqtSubJitterBufferFrameSize,
      });
      subscriber.setCanvasElement(moqEl);
    }
  }
  const moqPlayStreamOnClick = async () => {
    if (moqIsPlaying) return;
    // subscriber = new Subscriber('https://norsk-moq-linode-chicago.englishm.net:4443');
    subscriber = new Subscriber(moqtServerUrl, canvasWidth, canvasHeight);
    await subscriber.init({
      namespace: moqtSubTrackNamespace,
      videoTrackName: `${moqtSubVideoTrackName}-${videoQuality}`,
      audioTrackName: moqtSubAudioTrackName,
      authInfo: moqtSubAuth,
      jitterBufferFrameSize: moqtSubJitterBufferFrameSize
    });
    subscriber.setCanvasElement(moqEl);
    moqIsPlaying = true;
  };
  const moqStopStreamOnClick = async () => {
    if (!moqIsPlaying) return;
    moqIsPlaying = false;
    await subscriber.stop();
  };
</script>

<div class="sub">
  <h3>Subscriber</h3>
  <canvas width="{canvasWidth}" height="{canvasHeight}" bind:this={moqEl} />
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
    <div>
      <label for="sub-auth">Authorization Info</label>
      <input type="text" name="sub-auth" bind:value={moqtSubAuth} />
    </div>
    <div>
      <label for="pub-track-jitter">Jitter Buffer Frame Size {moqtSubJitterBufferFrameSize}</label>
      <input type="range" min="0" max="60" step="10" name="pub-track-jitter" bind:value={moqtSubJitterBufferFrameSize} />
    </div>
  </div>
  <button on:click={moqPlayStreamOnClick}>Subscribe</button>
  <button on:click={moqStopStreamOnClick}>Unsubscribe</button>
  <div>
    <fieldset>
      <legend>Video Quality</legend>
      <input type="radio" name="sub-video-quality" on:change={qualityOnChange} value="low" checked/>
      <label for="sub-video-quality">Low</label>
      <input type="radio" name="sub-video-quality" on:change={qualityOnChange} value="medium" />
      <label for="sub-video-quality">Medium</label>
      <input type="radio" name="sub-video-quality" on:change={qualityOnChange} value="high" />
      <label for="sub-video-quality">High</label>
    </fieldset>
  </div>
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
  fieldset {
    margin: 10px 0;
  }
</style>
