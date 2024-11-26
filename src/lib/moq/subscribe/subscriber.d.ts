export type SubscriberInitProps = {
  namespace: string[],
  videoTrackName: string,
  audioTrackName: string,
  authInfo: string,
  jitterBufferFrameSize?: number
};
