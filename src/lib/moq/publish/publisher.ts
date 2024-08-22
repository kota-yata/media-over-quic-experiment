import { AUDIO_ENCODER_DEFAULT_CONFIG, MOQ_MESSAGE, VIDEO_ENCODER_CONFIGS } from '../constants';
import { LOC } from '../loc';
import { MOQT } from '../moqt';
import { serializeMetadata, varIntToNumber } from '../utils/bytes';
import { Mogger } from '../utils/mogger';
import { moqVideoFrameOnEncode } from '../utils/store';

export interface InitProps { namespace: string, videoTrackName: string, audioTrackName: string, keyFrameDuration: number };

export class Publisher {
  private audioEncoderConfig: AudioEncoderConfig = AUDIO_ENCODER_DEFAULT_CONFIG;
  private trackNamespace = 'kota';
  private low = {
    trackName: 'kota-video-low',
    encoder: {} as VideoEncoder
  }
  private medium = {
    trackName: 'kota-video-medium',
    encoder: {} as VideoEncoder
  }
  private high = {
    trackName: 'kota-video-high',
    encoder: {} as VideoEncoder
  }
  private audioTrackName = 'kota-audio';
  private videoReader: ReadableStreamDefaultReader;
  private audioReader: ReadableStreamDefaultReader;
  private keyframeDuration = 60;
  private mogger = new Mogger('Publisher');
  state: 'created' | 'running' | 'stopped';
  videoChunkCount: number;
  audioChunkCount: number;
  private moqt: MOQT;
  constructor(url: string) {
    this.moqt = new MOQT(url);
    this.videoChunkCount = 0;
    this.audioChunkCount = 0;
  }
  public async init(props: InitProps) {
    this.trackNamespace = props.namespace;
    this.low.trackName = `${props.videoTrackName}-low`;
    this.medium.trackName = `${props.videoTrackName}-medium`;
    this.high.trackName = `${props.videoTrackName}-high`;
    this.audioTrackName = props.audioTrackName;
    this.moqt.trackManager.addTrack({ namespace: props.namespace, name: this.low.trackName, subscribeIds: [], type: 'video', priority: 4 });
    this.moqt.trackManager.addTrack({ namespace: props.namespace, name: this.medium.trackName,subscribeIds: [], type: 'video', priority: 3 });
    this.moqt.trackManager.addTrack({ namespace: props.namespace, name: this.high.trackName, subscribeIds: [], type: 'video', priority: 2 });
    this.moqt.trackManager.addTrack({ namespace: props.namespace, name: props.audioTrackName, subscribeIds: [], type: 'audio', priority: 1 });
    this.keyframeDuration = props.keyFrameDuration;
    await this.moqt.initControlStream();
    await this.moqt.startPublisher();
    this.state = 'running';
    this.mogger.info(`Announced tracks ${props.videoTrackName} (low, medium and high quality) and ${this.audioTrackName}`);
    this.startLoopSubscriptionsLoop();
  }
  public async stop() {
    await this.moqt.unannounce();
    this.state = 'stopped';
    this.mogger.info('unannounced');
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
    const names = ['low', 'medium', 'high'];
    for (const name of names) {
      const track = this[name];
      track.encoder = new VideoEncoder({
        output: (chunk, metadata) => this.handleEncodedVideoChunk(chunk, track.trackName, metadata),
        error: (error: DOMException) => this.mogger.error(error.message)
      });
      track.encoder.configure(VIDEO_ENCODER_CONFIGS[name]);
    }
    const audioEncoder = new AudioEncoder({
      output: (chunk, metadata) => this.handleEncodedAudioChunk(chunk, metadata),
      error: (error: DOMException) => this.mogger.error(error.message)
    });
    audioEncoder.configure(this.audioEncoderConfig);

    while (this.state === 'running') {
      await Promise.all([
        (async () => {
          const { done: vDone, value: vFrame } = await this.videoReader.read();
          if (vDone) return;
          for (const track of [this.low, this.medium, this.high]) {
            if (this.moqt.trackManager.getTrack(track.trackName).subscribeIds.length > 0) {
              moqVideoFrameOnEncode.set(performance.now());
              track.encoder.encode(vFrame, { keyFrame: this.videoChunkCount % this.keyframeDuration === 0 });
            }
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
  private async handleEncodedVideoChunk(chunk: EncodedVideoChunk, trackName: string, metadata) {
    const chunkData = new Uint8Array(chunk.byteLength);
    chunk.copyTo(chunkData);
    const locPacket = new LOC();
    locPacket.setData('video', chunk.type, this.videoChunkCount, chunk.timestamp, chunkData, serializeMetadata(metadata));
    this.videoChunkCount++;
    try {
      await this.moqt.sendObject(locPacket, trackName);
    } catch (e) {
      this.mogger.error(e);
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
        this.moqt.trackManager.addSubscribeId(subscribe.trackName, subscribe.subscribeId);
        this.mogger.info(`Received subscription to track ${subscribe.trackName}`);
        await this.moqt.sendSubscribeResponse(subscribe.subscribeId, 0);
      } else if (messageType === MOQ_MESSAGE.UNSUBSCRIBE) {
        const unsubscribe = await this.moqt.readUnsubscribe();
        this.moqt.trackManager.removeSubscribeId(unsubscribe.subscribeId);
        this.mogger.info(`Received unsubscrition from id ${unsubscribe.subscribeId}`);
      } else {
        throw new Error('Unexpected message type received');
      }
    }
  }
}
