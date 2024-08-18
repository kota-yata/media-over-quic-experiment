import { AUDIO_ENCODER_DEFAULT_CONFIG, MOQ_MESSAGE, VIDEO_ENCODER_DEFAULT_CONFIG } from '../constants';
import { LOC } from '../loc';
import { MOQT } from '../moqt';
import { serializeMetadata, varIntToNumber } from '../utils/bytes';
import { moqVideoFrameOnEncode } from '../utils/store';

export class Publisher {
  private videoEncoderConfig: VideoEncoderConfig = VIDEO_ENCODER_DEFAULT_CONFIG
  private audioEncoderConfig: AudioEncoderConfig = AUDIO_ENCODER_DEFAULT_CONFIG;
  private videoTrackName = 'kota-video';
  private audioTrackName = 'kota-audio';
  private videoReader: ReadableStreamDefaultReader;
  private audioReader: ReadableStreamDefaultReader;
  private keyframeDuration = 60;
  state: 'created' | 'running' | 'stopped';
  videoChunkCount: number;
  audioChunkCount: number;
  private moqt: MOQT;
  constructor(url: string) {
    this.moqt = new MOQT(url);
    this.videoChunkCount = 0;
    this.audioChunkCount = 0;
  }
  public async init() {
    this.moqt.trackManager.addTrack({
      namespace: 'kota',
      name: 'kota-video',
      subscribeIds: [],
      type: 'video',
      priority: 2,
    });
    this.moqt.trackManager.addTrack({
      namespace: 'kota',
      name: 'kota-audio',
      subscribeIds: [],
      type: 'audio',
      priority: 1,
    });
    await this.moqt.initControlStream();
    await this.moqt.startPublisher();
    this.state = 'running';
    this.startLoopSubscriptionsLoop();
  }
  public async stop() {
    await this.moqt.unannounce();
    this.state = 'stopped';
    console.log('stopped');
  }
  public async replaceTrack(mediaStream: MediaStream) {
    this.resetStream(mediaStream);
  }
  public resetStream(mediaStream: MediaStream) {
    // stream removal and addition are done in page.svelte
    const videoTrack = mediaStream.getVideoTracks()[0];
    const audioTrack = mediaStream.getAudioTracks()[0];
    const videoProcessor = new MediaStreamTrackProcessor({ track: videoTrack });
    const audioProcessor = new MediaStreamTrackProcessor({ track: audioTrack });
    this.videoReader = videoProcessor.readable.getReader();
    this.audioReader = audioProcessor.readable.getReader();
  }
  public async encode(mediaStream: MediaStream) {
    this.resetStream(mediaStream);
    const videoEncoder = new VideoEncoder({
      output: (chunk, metadata) => this.handleEncodedVideoChunk(chunk, metadata),
      error: (error) => console.error('VideoEncoder error:', error)
    });
    videoEncoder.configure(this.videoEncoderConfig);

    const audioEncoder = new AudioEncoder({
      output: (chunk, metadata) => this.handleEncodedAudioChunk(chunk, metadata),
      error: (error) => console.error('AudioEncoder error:', error)
    });
    audioEncoder.configure(this.audioEncoderConfig);

    while (this.state === 'running') {
      await Promise.all([
      (async () => {
        const { done: vDone, value: vFrame } = await this.videoReader.read();
        if (vDone) return;
        if (this.moqt.trackManager.getTrack(this.videoTrackName).subscribeIds.length > 0) {
          moqVideoFrameOnEncode.set(performance.now());
          videoEncoder.encode(vFrame, { keyFrame: this.videoChunkCount % this.keyframeDuration === 0 });
        }
        vFrame.close();
      })(),
      // (async () => {
      //   const { done: aDone, value: aFrame } = await audioReader.read();
      //   if (aDone) return;
      //   if (this.moqt.getTrack(this.audioTrackName).numSubscribers > 0) {
      //     audioEncoder.encode(aFrame, { keyFrame: this.videoChunkCount % this.keyframeDuration === 0 }); // TODO: Keyframe option can be set here
      //   }
      //   aFrame.close();
      // })()
      ]);
    }
    }
  private async handleEncodedVideoChunk(chunk: EncodedVideoChunk, metadata) {
    const chunkData = new Uint8Array(chunk.byteLength);
    chunk.copyTo(chunkData);
    const locPacket = new LOC();
    locPacket.setData('video', chunk.type, this.videoChunkCount, chunk.timestamp, chunkData, serializeMetadata(metadata));
    this.videoChunkCount++;
    try {
      await this.moqt.sendObject(locPacket, this.videoTrackName);
    } catch(e) {
      console.error('something went wrong', e);
    }
  }
  private async handleEncodedAudioChunk(chunk: EncodedAudioChunk, metadata) {
    const chunkData = new Uint8Array(chunk.byteLength);
    chunk.copyTo(chunkData);
    const locPacket = new LOC();
    locPacket.setData('audio', chunk.type, this.audioChunkCount++, chunk.timestamp, chunkData, serializeMetadata(metadata));
    await this.moqt.sendObject(locPacket, this.audioTrackName);
  }
  public async startLoopSubscriptionsLoop() {
    while (this.state === 'running') {
      const messageType = await this.moqt.readControlMessageType();
      if (messageType === MOQ_MESSAGE.SUBSCRIBE) {
        const subscribe = await this.moqt.readSubscribe();
        console.log(`Received subscribe request for track ${subscribe.trackName}`);
        this.moqt.trackManager.addSubscribeId(subscribe.trackName, subscribe.subscribeId);
        console.log(`Subscribed to track ${subscribe.trackName}`);
        await this.moqt.sendSubscribeResponse(subscribe.subscribeId, 0);
      } else if (messageType === MOQ_MESSAGE.UNSUBSCRIBE) {
        const unsubscribe = await this.moqt.readUnsubscribe();
        this.moqt.trackManager.removeSubscribeId(unsubscribe.subscribeId);
        console.log('Received unsubscribe from id', unsubscribe.subscribeId);
      } else {
        throw new Error('Unexpected message type received');
      }
    }
  }
}
