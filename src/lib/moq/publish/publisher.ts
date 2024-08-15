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
    // generate new tracks
    this.moqt.setTrack(this.videoTrackName, {
      namespace: 'kota',
      id: 0,
      type: 'video',
      priority: 1,
      numSubscribers: 0,
    });
    this.moqt.setTrack(this.audioTrackName, {
      namespace: 'kota',
      id: 1,
      type: 'audio',
      priority: 1000,
      numSubscribers: 0,
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
  public async encode(mediaStream: MediaStream) {
    const videoTrack = mediaStream.getVideoTracks()[0];
    const audioTrack = mediaStream.getAudioTracks()[0];

    const videoProcessor = new MediaStreamTrackProcessor({ track: videoTrack });
    const audioProcessor = new MediaStreamTrackProcessor({ track: audioTrack });

    const videoReader: ReadableStreamDefaultReader = videoProcessor.readable.getReader();
    const audioReader: ReadableStreamDefaultReader = audioProcessor.readable.getReader();

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
        const { done: vDone, value: vFrame } = await videoReader.read();
        if (vDone) return;
        if (this.moqt.getTrack(this.videoTrackName).numSubscribers > 0) {
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
        const track = this.moqt.getTrack(subscribe.trackName);
        track.numSubscribers++;
        console.log(`Subscribed to track ${subscribe.trackName} with id ${track.id} and ${track.numSubscribers} subscribers`);
        await this.moqt.sendSubscribeResponse(subscribe.namespace, subscribe.trackName, track.id, 0);
      } else if (messageType === MOQ_MESSAGE.UNSUBSCRIBE) {
        const unsubscribe = await this.moqt.readUnsubscribe();
        console.log('Received unsubscribe from id', unsubscribe.subscribeId);
      } else {
        throw new Error('Unexpected message type received');
      }
    }
  }
}
