export const VIDEO_ENCODER_DEFAULT_CONFIG: VideoEncoderConfig = {
  codec: 'avc1.42001e', // Baseline = 66, level 30 (see: https://en.wikipedia.org/wiki/Advanced_Video_Coding)
  width: 320,
  height: 180,
  bitrate: 1_000_000, // 1 Mbps
  framerate: 30,
  latencyMode: 'realtime', // Sends 1 chunk per frame
};
export const AUDIO_ENCODER_DEFAULT_CONFIG: AudioEncoderConfig = {
  codec: 'opus', // AAC NOT implemented YET (it is in their roadmap)
  sampleRate: 48000, // To fill later
  numberOfChannels: 1, // To fill later
  bitrate: 32000,
  opus: { // See https://www.w3.org/TR/webcodecs-opus-codec-registration/
    frameDuration: 10000 // In ns. Lower latency than default = 20000
  }
};

export const VIDEO_DECODER_DEFAULT_CONFIG: VideoDecoderConfig = {
  codec: 'avc1.42000D', 
  codedHeight: 180,
  codedWidth: 320,
  colorSpace: { 'fullRange': false, 'matrix': 'smpte170m', 'primaries': 'bt709', 'transfer': 'bt709' },
  hardwareAcceleration: 'prefer-software',
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
