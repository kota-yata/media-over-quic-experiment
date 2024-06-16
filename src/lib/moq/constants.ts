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

// MOQ Parameters
export const MOQ_DRAFT01_VERSION = 0xff000001;
export const MOQ_SUPPORTED_VERSIONS = [MOQ_DRAFT01_VERSION];

export const MOQ_PARAMETER_ROLE = 0x0;
export const MOQ_PARAMETER_AUTHORIZATION_INFO = 0x2;

export const MOQ_MAX_PARAMS = 256;
export const MOQ_MAX_ARRAY_LENGTH = 1024;

export const MOQ_PARAMETER_ROLE_INVALID = 0x0;
export const MOQ_PARAMETER_ROLE_PUBLISHER = 0x1;
export const MOQ_PARAMETER_ROLE_SUBSCRIBER = 0x2;
export const MOQ_PARAMETER_ROLE_BOTH = 0x3;

export const MOQ_LOCATION_MODE_NONE = 0x0;
export const MOQ_LOCATION_MODE_ABSOLUTE = 0x1;
export const MOQ_LOCATION_MODE_RELATIVE_PREVIOUS = 0x2;
export const MOQ_LOCATION_MODE_RELATIVE_NEXT = 0x3;

export const MOQ_MESSAGE_OBJECT = 0x0;
export const MOQ_MESSAGE_OBJECT_WITH_LENGTH = 0x2;
export const MOQ_MESSAGE_CLIENT_SETUP = 0x40;
export const MOQ_MESSAGE_SERVER_SETUP = 0x41;

export const MOQ_MESSAGE_SUBSCRIBE = 0x3;
export const MOQ_MESSAGE_SUBSCRIBE_OK = 0x4;

export const MOQ_MESSAGE_ANNOUNCE = 0x6;
export const MOQ_MESSAGE_ANNOUNCE_OK = 0x7;
export const MOQ_MESSAGE_ANNOUNCE_ERROR = 0x8
export const MOQ_MESSAGE_UNANNOUNCE = 0x9
