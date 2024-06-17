import { AUDIO_DECODER_DEFAULT_CONFIG, VIDEO_DECODER_DEFAULT_CONFIG } from '../constants';
import { LOC } from '../loc';
import { MOQT } from '../moqt';
import { deSerializeMetadata } from '../utils/bytes';

export class Subscriber {
  private moqt: MOQT;
  private loc: LOC;
  private vDecoder: VideoDecoder;
  private aDecoder: AudioDecoder;
  private canvasElement: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private waitForKeyFrame = true;
  private videoDecoderConfig: VideoDecoderConfig = VIDEO_DECODER_DEFAULT_CONFIG
  private audioEncoderConfig: AudioDecoderConfig = AUDIO_DECODER_DEFAULT_CONFIG;
  constructor(url: string) {
    this.moqt = new MOQT(url);
    this.loc = new LOC();
    this.vDecoder = new VideoDecoder({
      output: (frame) => this.handleVideoFrame(frame),
      error: (e) => console.error(e.message)
    });
    this.aDecoder = new AudioDecoder({
      output: (frame) => this.handleAudioFrame(frame),
      error: (e) => console.error(e.message)
    });
  }
  public async init() {
    await this.moqt.initControlStream();
    await this.moqt.startSubscriber();
    this.startLoopObject();
  }
  public setCanvasElement(canvasElement: HTMLCanvasElement) {
    this.canvasElement = canvasElement;
    this.ctx = this.canvasElement.getContext('2d');
  }
  public async startLoopObject() {
    const incoming = this.moqt.getIncomingStream();
    const readableStream = incoming.getReader();
    while (true) {
      const stream = await readableStream.read();
      if (stream.done) {
        break;
      }
      await this.processObject(stream.value);
    }
  }
  public async processObject(readerStream) {
    const object = await this.moqt.readObject(readerStream);
    const trackType = this.moqt.searchTrackType(object.trackId);
    await this.loc.fromBytes(readerStream);
    const locObject = this.loc.toObject();
    if (this.loc.chunkType === 'delta' && this.waitForKeyFrame) return;
    this.setWaitForKeyFrame(false);
    if (trackType === 'video') {
      if (locObject.metadata === null) return;
      const config: VideoDecoderConfig = deSerializeMetadata(locObject.metadata);
      config.optimizeForLatency = true;
      config.hardwareAcceleration = 'prefer-software';
      this.vDecoder.configure(config);
      const chunk = new EncodedVideoChunk({
        timestamp: locObject.timestamp,
        type: locObject.chunkType,
        data: locObject.data,
        duration: locObject.duration,
      });
      this.vDecoder.decode(chunk);
    }
    if (trackType === 'audio') {
      if (locObject.metadata === null) return;
      const config: AudioDecoderConfig = deSerializeMetadata(locObject.metadata);
      config.optimizeForLatency = true;
      config.hardwareAcceleration = 'prefer-software';
      this.aDecoder.configure(config);
      const chunk = new EncodedAudioChunk({
        timestamp: locObject.timestamp,
        type: locObject.chunkType,
        data: locObject.data,
        duration: locObject.duration,
      });
      this.aDecoder.decode(chunk);
    }
  }
  private handleVideoFrame(frame: VideoFrame) {
    console.log(frame);
    if (!this.ctx) return;
    this.ctx.drawImage(frame, 0, 0, frame.displayWidth, frame.displayHeight);
    frame.close();
  }
  private handleAudioFrame(frame: AudioFrame) {
    // set audioframe to audio element
    console.log(frame.sampleRate);
  }
  public setWaitForKeyFrame(waitForKeyFrame: boolean) {
    this.waitForKeyFrame = waitForKeyFrame;
  }
}
