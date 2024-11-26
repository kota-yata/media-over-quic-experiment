export const VIDEO_ENCODER_CONFIGS: { [key: string]: VideoEncoderConfig } = {
  'high': {
    codec: 'hvc1.1.6.L120.00',
    width: 3840,
    height: 2160,
    framerate: 30,
    latencyMode: 'realtime',
    hardwareAcceleration: 'no-preference'
  },
  'medium': {
    codec: 'avc1.64002A',
    width: 1920,
    height: 1080,
    bitrate: 2_000_000,
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

// MOQ Parameters
export const MOQ_DRAFT07_VERSION = 0xff070002;

export const MOQ_MAX_PARAMS = 256;
export const MOQ_MAX_ARRAY_LENGTH = 1024;
export const MAX_SUBSCRIBE_ID = 128;

export const MOQ_MESSAGE = {
  SUBSCRIBE_UPDATE: 0x2,
  SUBSCRIBE: 0x3,
  SUBSCRIBE_OK: 0x4,
  SUBSCRIBE_ERROR: 0x5,
  ANNOUNCE: 0x6,
  ANNOUNCE_OK: 0x7,
  ANNOUNCE_ERROR: 0x8,
  UNANNOUNCE: 0x9,
  UNSUBSCRIBE: 0xA,
  SUBSCRIBE_DONE: 0xB,
  ANNOUNCE_CANCEL: 0xC,
  TRACK_STATUS_REQUEST: 0xD,
  TRACK_STATUS: 0xE,
  GOAWAY: 0x10,
  SUBSCRIBE_ANNOUNCES: 0x11,
  SUBSCRIBE_ANNOUNCES_OK: 0x12,
  SUBSCRIBE_ANNOUNCES_ERROR: 0x13,
  UNSUBSCRIBE_ANNOUNCES: 0x14,
  MAX_SUBSCRIBE_ID: 0x15,
  FETCH: 0x16,
  FETCH_CANCEL: 0x17,
  FETCH_OK: 0x18,
  FETCH_ERROR: 0x19,
  CLIENT_SETUP: 0x40,
  SERVER_SETUP: 0x41,
};

export const MOQ_SESSION_CLOSE_ERROR = {
  NO_ERROR: 0x0,
  INTERNAL_ERROR: 0x1,
  UNAUTHORIZED: 0x2,
  PROTOCOL_VIOLATION: 0x3,
  DUPLICATE_TRACK_ALIAS: 0x4,
  PARAMETER_LENGTH_MISMATCH: 0x5,
  TOO_MANY_SUBSRIBES: 0x6,
  GOAWAY_TIMEOUT: 0x10,
};

// since Setup parameters use a separate namespace, it is impossible for these parameters to appear in Setup messages
export const VERSION_SPECIFIC_PARAMETERS = {
  AUTHORIZATION_INFO: { KEY: 0x02 },
  DELIVERY_TIMEOUT: { KEY: 0x03 },
  MAX_CACHE_DURATION: { KEY: 0x04 },
}

export const SETUP_PARAMETERS = {
  ROLE : {
    KEY: 0x00,
    PUBLISHER: 0x01,
    SUBSCRIBER: 0x02,
    PUBSUB: 0x03,
  },
  PATH:  { KEY: 0x01 }, // not used as this is only for raw quic
  MAX_SUBSCRIBE_ID: { KEY: 0x02 },
}

export const SUBSCRIBE_ERROR = {
  INTERNAL_ERROR: 0x0,
  INVALID_RANGE: 0x1,
  RETRY_TRACK_ALIAS: 0x2,
  TRACK_DOES_NOT_EXIST: 0x3,
  UNAUTHORIZED: 0x4,
  TIMEOUT: 0x5,
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

export const OBJECT_STREAM_TYPE = {
  OBJECT_DATAGRAM: 0x1,
  STREAM_HEADER_SUBGROUP: 0x4,
  FETCH_HEADER: 0x5,
}

export const OBJECT_STATUS = {
  NORMAL: 0x0,
  NON_EXISTENT_OBJECT: 0x1,
  NON_EXISTENT_GROUP: 0x2,
  END_OF_GROUP: 0x3,
  END_OF_TRACK_AND_GROUP: 0x4,
};
