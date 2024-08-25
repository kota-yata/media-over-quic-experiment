import { AUDIO_DECODER_DEFAULT_CONFIG, VIDEO_DECODER_DEFAULT_CONFIG } from '../constants';
import { LOC } from '../loc';
import { MitterMuffer } from '../mitter-muffer';
import { MOQT } from '../moqt';
import { Mogger } from '../utils/mogger';
import { moqVideoDecodeLatencyStore, moqVideoFrameOnDecode } from '../utils/store';

export class Subscriber {
  private moqt: MOQT;
  private vDecoder: VideoDecoder;
  private aDecoder: AudioDecoder;
  private canvasElement: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private waitForKeyFrame = true;
  private videoDecoderConfig: VideoDecoderConfig = VIDEO_DECODER_DEFAULT_CONFIG;
  private audioEncoderConfig: AudioDecoderConfig = AUDIO_DECODER_DEFAULT_CONFIG;
  private mogger = new Mogger('Subscriber');
  private videoJitterBuffer: MitterMuffer;
  private audioJitterBuffer: MitterMuffer;
  private canvasWidth: number;
  private canvasHeight: number;
  constructor(url: string, canvasWidth: number, canvasHeight: number) {
    this.moqt = new MOQT(url);
    this.vDecoder = new VideoDecoder({
      output: (frame) => this.handleVideoFrame(frame),
      error: (error: DOMException) => this.mogger.error(error.message)
    });
    this.aDecoder = new AudioDecoder({
      output: (frame) => this.handleAudioFrame(frame),
      error: (error: DOMException) => this.mogger.error(error.message)
    });
    this.vDecoder.configure(this.videoDecoderConfig);
    this.setWaitForKeyFrame(true);
    this.aDecoder.configure(this.audioEncoderConfig);
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }
  public async init(props: { namespace: string, videoTrackName: string, audioTrackName: string, authInfo: string, jitterBufferFrameSize: number }) {
    await this.moqt.initControlStream();
    await this.moqt.startSubscriber({ ...props, secret: props.authInfo });
    this.startLoopObject();
    this.videoJitterBuffer = new MitterMuffer(props.jitterBufferFrameSize);
    this.audioJitterBuffer = new MitterMuffer(props.jitterBufferFrameSize);
  }
  public async stop() {
    // unsubscribe but keep the control stream
    await this.moqt.stopSubscriber();
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
    moqVideoFrameOnDecode.set(performance.now());
    const object = await this.moqt.readObject({ readableStream: readerStream });
    const trackType = this.moqt.trackManager.getTrackBySubscribeId(object.subscribeId).type;
    const loc = new LOC();
    try {
      await loc.fromBytes(readerStream);
    } catch (e) {
      this.mogger.error(e);
    }
    const currentLocObject = loc.toObject();
    if (loc.chunkType === 'delta' && this.waitForKeyFrame) return;
    this.setWaitForKeyFrame(false);
    if (trackType === 'video') {
      this.videoJitterBuffer.addFrame(currentLocObject);
      const jitterRet = this.videoJitterBuffer.getFrame();
      if (!jitterRet.ok) return;
      const locObject = jitterRet.frame;
      if (locObject.metadata) {
        const config: VideoDecoderConfig = locObject.metadata;
        this.mogger.info(`received config: ${JSON.stringify(config)}`);
        config.optimizeForLatency = true;
        config.hardwareAcceleration = 'prefer-software';
        this.vDecoder.configure(config);
      }
      const chunk = new EncodedVideoChunk({
        timestamp: locObject.timestamp,
        type: locObject.chunkType,
        data: locObject.data,
        duration: locObject.duration,
      });
      // TODO: put the chunk in the jitter buffer
      this.vDecoder.decode(chunk);
    }
    if (trackType === 'audio') {
      this.audioJitterBuffer.addFrame(currentLocObject);
      const jitterRet = this.audioJitterBuffer.getFrame();
      if (!jitterRet.ok) return;
      const locObject = jitterRet.frame
      if (locObject.metadata) {
        const config: AudioDecoderConfig = locObject.metadata;
        config.optimizeForLatency = true;
        config.hardwareAcceleration = 'prefer-software';
        this.aDecoder.configure(config);
      }
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
    if (!this.ctx) return;
    const latency = moqVideoFrameOnDecode.calcLatency(performance.now());
    moqVideoDecodeLatencyStore.set(latency);
    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
    this.ctx.drawImage(frame, 0, 0, this.canvasWidth, frame.displayHeight * this.canvasWidth / frame.displayWidth);
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
