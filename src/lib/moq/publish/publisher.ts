import { AUDIO_ENCODER_DEFAULT_CONFIG, VIDEO_ENCODER_DEFAULT_CONFIG } from '../constants';
import { LOC } from '../loc';
import { MOQT } from '../moqt';

export class Publisher {
  private videoEncoderConfig: VideoEncoderConfig = VIDEO_ENCODER_DEFAULT_CONFIG
  private audioEncoderConfig: AudioEncoderConfig = AUDIO_ENCODER_DEFAULT_CONFIG;
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
    await this.moqt.startPublisher();
    this.state = 'running';
    this.startLoopSubscriptionsLoop();
  }
  public async encode(mediaStream: MediaStream) {
    const videoTrack = mediaStream.getVideoTracks()[0];
    const audioTrack = mediaStream.getAudioTracks()[0];

    const videoProcessor = new MediaStreamTrackProcessor({ track: videoTrack });
    const audioProcessor = new MediaStreamTrackProcessor({ track: audioTrack });

    const videoReader = videoProcessor.readable.getReader();
    const audioReader = audioProcessor.readable.getReader();

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

    while (true) {
      const { done, value: frame } = await videoReader.read();
      if (done) break;
      videoEncoder.encode(frame);
      frame.close();
    }
    while (true) {
      const { done, value: frame } = await audioReader.read();
      if (done) break;

      audioEncoder.encode(frame);
      frame.close();
    }
  }
  private async handleEncodedVideoChunk(chunk: EncodedVideoChunk, metadata) {
    const chunkData = new Uint8Array(chunk.byteLength);
    chunk.copyTo(chunkData);
    const locPacket = new LOC();
    locPacket.setData('video', chunk.type, this.videoChunkCount++, chunk.timestamp, chunkData, metadata);
    await this.moqt.sendObject(locPacket);
  }
  private async handleEncodedAudioChunk(chunk: EncodedAudioChunk, metadata) {
    const chunkData = new Uint8Array(chunk.byteLength);
    chunk.copyTo(chunkData);
    const locPacket = new LOC();
    locPacket.setData('audio', chunk.type, this.audioChunkCount++, chunk.timestamp, chunkData, metadata);
    await this.moqt.sendObject(locPacket);
  }
  public async startLoopSubscriptionsLoop() {
    while (this.state === 'running') {
      const subscribe = await this.moqt.readSubscribe();
      console.log(`Received subscribe request for track ${subscribe.trackName}`);
      const track = this.moqt.getTrack(subscribe.trackName);
      track.numSubscribers++;
      console.log(`Subscribed to track ${subscribe.trackName} with id ${track.id} and ${track.numSubscribers} subscribers`);
      await this.moqt.sendSubscribeResponse(subscribe.namespace, subscribe.trackName, track.id, 0);
    }
  }
}
