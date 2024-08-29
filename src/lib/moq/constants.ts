export const VIDEO_ENCODER_CONFIGS: { [key: string]: VideoEncoderConfig } = {
  'high': {
    codec: 'avc1.420028',
    width: 1920,
    height: 1080,
    bitrate: 2_000_000,
    framerate: 60,
    latencyMode: 'realtime',
    hardwareAcceleration: 'no-preference'
  },
  'medium': {
    codec: 'avc1.420028',
    width: 1280,
    height: 720,
    bitrate: 1_000_000,
    framerate: 60,
    latencyMode: 'realtime',
    hardwareAcceleration: 'no-preference'
  },
  'low': {
    codec: 'avc1.42001e',
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

// MOQ Parameters
export const MOQ_DRAFT01_VERSION = 0xff000001;
export const MOQ_DRAFT04_VERSION = 0xff000004;
export const MOQ_DRAFT05_VERSION = 0xff000005;
export const MOQ_SUPPORTED_VERSIONS = [MOQ_DRAFT04_VERSION];

export const MOQ_PARAMETER_ROLE = {
  KEY: 0x00,
  PUBLISHER: 0x01,
  SUBSCRIBER: 0x02,
  PUBSUB: 0x03,
};
export const MOQ_PARAMETER_PATH = { KEY: 0x01 };
export const MOQ_PARAMETER_AUTHORIZATION_INFO = 0x2;

export const MOQ_MAX_PARAMS = 256;
export const MOQ_MAX_ARRAY_LENGTH = 1024;

export const MOQ_LOCATION_MODE_NONE = 0x0;
export const MOQ_LOCATION_MODE_ABSOLUTE = 0x1;
export const MOQ_LOCATION_MODE_RELATIVE_PREVIOUS = 0x2;
export const MOQ_LOCATION_MODE_RELATIVE_NEXT = 0x3;

export const MOQ_MESSAGE = {
  OBJECT_STREAM: 0x0,
  OBJECT_DATAGRAM: 0x1,
  CLIENT_SETUP: 0x40,
  SERVER_SETUP: 0x41,
  // SUBSCRIBE_UPDATE:  0x2,
  SUBSCRIBE: 0x3,
  SUBSCRIBE_OK: 0x4,
  SUBSCRIBE_ERROR: 0x5,
  SUBSCRIBE_DONE: 0xB,
  UNSUBSCRIBE: 0xA,
  ANNOUNCE: 0x6,
  ANNOUNCE_OK: 0x7,
  ANNOUNCE_ERROR: 0x8,
  ANNOUNCE_CANCEL: 0xC,
  UNANNOUNCE: 0x9,
  GOAWAY: 0x10,
  TRACK_STATUS_REQUEST: 0xD,
  TRACK_STATUS: 0xE,
  STREAM_HEADER_TRACK: 0x50,
  STREAM_HEADER_GROUP: 0x51,
};

export const MOQ_SESSION_CLOSE_ERROR = {
  NO_ERROR: 0x0,
  INTERNAL_ERROR: 0x1,
  UNAUTHORIZED: 0x2,
  PROTOCOL_VIOLATION: 0x3,
  DUPLICATE_TRACK_ALIAS: 0x4,
  PARAMETER_LENGTH_MISMATCH: 0x5,
  GOAWAY_TIMEOUT: 0x10,
};

export const SUBSCRIBE_ERROR = {
  INTERNAL_ERROR: 0x0,
  INVALID_RANGE: 0x1,
  RETRY_TRACK_ALIAS: 0x2
};

export const SUBSCRIBE_DONE = {
  UNSUBSCRIBED: 0x0,
  INTERNAL_ERROR: 0x1,
  UNAUTHORIZED: 0x2,
  TRACK_ENDED: 0x3,
  SUBSCRIPTION_ENDED: 0x4,
  GOING_AWAY: 0x5,
  EXPIRED: 0x6
};

export const SUBSCRIBE_FILTER = {
  LATEST_GROUP: 0x1,
  LATEST_OBEJCT: 0x2,
  ABSOLUTE_START: 0x3,
  ABSOLUTE_RANGE: 0x4
};

export const SUBSCRIBE_GROUP_ORDER = {
  ASCENDING: 0x1,
  DESCENDING: 0x2
};

export const OBJECT_STATUS = {
  NORMAL: 0x0,
  NON_EXISTENT_OBJECT: 0x1,
  NON_EXISTENT_GROUP: 0x2,
  END_OF_GROUP: 0x3,
  END_OF_TRACK_AND_GROUP: 0x4,
};
