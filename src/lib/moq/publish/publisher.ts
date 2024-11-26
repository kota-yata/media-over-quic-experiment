import { AUDIO_ENCODER_DEFAULT_CONFIG, MOQ_MESSAGE, SETUP_PARAMETERS, SUBSCRIBE_GROUP_ORDER, VIDEO_ENCODER_CONFIGS } from '../constants';
import { LOC } from '../loc';
import { MOQT } from '../moqt';
import { serializeMetadata, varIntToNumber } from '../utils/bytes';
import { Mogger } from '../utils/mogger';
import { moqVideoFrameOnEncode } from '../utils/store';
import type { PublisherInitProps }  from './publisher.d';

export class Publisher {
  private audioEncoderConfig: AudioEncoderConfig = AUDIO_ENCODER_DEFAULT_CONFIG;
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
  private groupOrder = SUBSCRIBE_GROUP_ORDER.ASCENDING;
  private mogger = new Mogger('Publisher');
  state: 'created' | 'running' | 'stopped';
  videoChunkCount: number;
  audioChunkCount: number;
  private moqt: MOQT;
  constructor(url: string) {
    this.moqt = new MOQT({ url });
    this.videoChunkCount = 0;
    this.audioChunkCount = 0;
  }
  public async init(props: PublisherInitProps) {
    this.low.trackName = `${props.videoTrackName}-low`;
    this.medium.trackName = `${props.videoTrackName}-medium`;
    this.high.trackName = `${props.videoTrackName}-high`;
    // this.audioTrackName = props.audioTrackName;
    this.moqt.trackManager.addTrack({ namespace: props.namespace, name: this.low.trackName, subscribeIds: [], type: 'video', priority: 4 });
    this.moqt.trackManager.addTrack({ namespace: props.namespace, name: this.medium.trackName,subscribeIds: [], type: 'video', priority: 3 });
    this.moqt.trackManager.addTrack({ namespace: props.namespace, name: this.high.trackName, subscribeIds: [], type: 'video', priority: 2 });
    // this.moqt.trackManager.addTrack({ namespace: props.namespace, name: props.audioTrackName, subscribeIds: [], type: 'audio', priority: 1 });
    this.keyframeDuration = props.keyFrameDuration;
    await this.moqt.initControlStream();
    // publisher setup
    await this.moqt.setup({ role: SETUP_PARAMETERS.ROLE.PUBLISHER });
    this.mogger.info('Sent SETUP message');
    const setupType = await this.moqt.readControlMessageType();
    if (setupType !== MOQ_MESSAGE.SERVER_SETUP) {
      throw new Error(`SETUP answer with type ${setupType} is not supported`);
    }
    this.mogger.info('Received SETUP message');
    await this.moqt.readSetup();
    const announcedNs = [];
    // announce all the video and audio tracks
    for (const trackData of this.moqt.trackManager.getAllTracks()) {
      if (announcedNs.includes(trackData.namespace)) continue;
      announcedNs.push(trackData.namespace);
      await this.moqt.announce({ namespace: trackData.namespace, authInfo: props.authInfo });
      const announceResponseType = await this.moqt.readControlMessageType();
      switch (announceResponseType) {
        case MOQ_MESSAGE.ANNOUNCE_OK:
          const announceOk = await this.moqt.readAnnounceOk();
          this.mogger.info(`Announced namespace ${announceOk.namespace}`);
          break;
        case MOQ_MESSAGE.ANNOUNCE_ERROR:
          const announceError = await this.moqt.readAnnounceError();
          this.mogger.error(`Announce error: ${announceError.errorCode} ${announceError.reasonPhrase}`);
          break;
        default:
          throw new Error(`ANNOUNCE answer type must be either ${MOQ_MESSAGE.ANNOUNCE_OK} or ${MOQ_MESSAGE.ANNOUNCE_ERROR}, got ${announceResponseType}`);
      }
    }
    this.state = 'running';
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
      await this.moqt.sendObject({ trackName: trackName, data: locPacket.toBytes(), newGroup: locPacket.chunkType === 'key' });
    } catch (e) {
      this.mogger.error(e);
    }
  }
  private async handleEncodedAudioChunk(chunk: EncodedAudioChunk, metadata) {
    const chunkData = new Uint8Array(chunk.byteLength);
    chunk.copyTo(chunkData);
    const locPacket = new LOC();
    locPacket.setData('audio', chunk.type, this.audioChunkCount++, chunk.timestamp, chunkData, serializeMetadata(metadata));
    await this.moqt.sendObject({ trackName: this.audioTrackName, data: locPacket.toBytes(), newGroup: locPacket.chunkType === 'key' });
  }
  public async startLoopSubscriptionsLoop() {
    while (this.state === 'running') {
      const messageType = await this.moqt.readControlMessageType();
      if (messageType === MOQ_MESSAGE.SUBSCRIBE) {
        const subscribe = await this.moqt.readSubscribe();
        this.moqt.trackManager.addSubscribeId(subscribe.trackName, subscribe.subscribeId);
        this.mogger.info(`Received subscription to track ${subscribe.trackName}`);
        await this.moqt.sendSubscribeOk({ subscribeId: subscribe.subscribeId, expiresMs: 0, groupOrder: this.groupOrder });
      } else if (messageType === MOQ_MESSAGE.UNSUBSCRIBE) {
        const unsubscribe = await this.moqt.readUnsubscribe();
        this.moqt.trackManager.removeSubscribeId(unsubscribe.subscribeId);
        this.mogger.info(`Received unsubscrition from id ${unsubscribe.subscribeId}`);
      } else {
        throw new Error(`Unexpected message type received: ${messageType}`);
      }
    }
  }
}
