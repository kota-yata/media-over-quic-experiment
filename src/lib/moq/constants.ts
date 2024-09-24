export const VIDEO_ENCODER_CONFIGS: { [key: string]: VideoEncoderConfig } = {
  'high': {
    // codec: 'hvc1.1.6.L120.00',
    // width: 3840,
    // height: 2160,
    codec: 'avc1.64002A',
    width: 1920,
    height: 1080,
    framerate: 30,
    latencyMode: 'realtime',
    hardwareAcceleration: 'no-preference'
  },
  'medium': {
    codec: 'avc1.64002A',
    width: 1920,
    height: 1080,
    framerate: 60,
    latencyMode: 'realtime',
    hardwareAcceleration: 'no-preference'
  },
  'low': {
    codec: 'avc1.64002A',
    width: 720,
    height: 404,
    bitrate: 500_000,
    framerate: 30,
    latencyMode: 'realtime',
    hardwareAcceleration: 'no-preference'
  },
};
export const AUDIO_ENCODER_DEFAULT_CONFIG: AudioEncoderConfig = {
  codec: 'opus', // AAC NOT implemented YET (it is in their roadmap)
  sampleRate: 48000,
  numberOfChannels: 1,
  bitrate: 32000,
  opus: { // See https://www.w3.org/TR/webcodecs-opus-codec-registration/
    frameDuration: 10000 // In ns. Lower latency than default = 20000
  }
};

export const VIDEO_DECODER_DEFAULT_CONFIG: VideoDecoderConfig = {
  codec: 'avc1.420028',
  codedWidth: 1920,
  codedHeight: 1080,
  colorSpace: { 'fullRange': false, 'matrix': 'smpte170m', 'primaries': 'bt709', 'transfer': 'bt709' },
  hardwareAcceleration: 'prefer-hardware',
  optimizeForLatency: true
};
export const AUDIO_DECODER_DEFAULT_CONFIG: AudioDecoderConfig = {
  codec: 'opus', // AAC NOT implemented YET (it is in their roadmap)
  sampleRate: 48000, // To fill later
  numberOfChannels: 1, // To fill later
  bitrate: 32000,
  opus: { // See https://www.w3.org/TR/webcodecs-opus-codec-registration/
    frameDuration: 10000 // In ns. Lower latency than default = 20000
  }
};
