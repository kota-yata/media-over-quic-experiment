import IVSBroadcastClient, { Stage, LocalStageStream, SubscribeType, StageEvents, ConnectionState, StreamType, StageConnectionState } from 'amazon-ivs-web-broadcast';

export const broadcast = async (mediaStream: MediaStream, streamKey: string) => {
  const client = IVSBroadcastClient.create({
    streamConfig: {
      maxResolution: { width: 640, height: 480 },
      maxFramerate: 30,
      maxBitrate: 3500
    },
    ingestEndpoint: 'rtmps://516172ba1ccf.global-contribute.live-video.net:443/app/'
  });
  client.addVideoInputDevice(mediaStream, 'camera', { index: 0 });
  client.addAudioInputDevice(mediaStream, 'microphone');

  try {
    await client.startBroadcast(streamKey);
    console.log('Broadcast started');
  } catch (error) {
    console.error('Failed to start broadcast:', error);
  }
} 
