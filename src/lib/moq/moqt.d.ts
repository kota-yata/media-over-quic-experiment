export type SubscribeProps = {
  subscribeId: number,
  trackAlias: number,
  namespace: string,
  trackName: string,
  subscriberPriority: number,
  filterType?: number,
  authInfo: string
};

export type AnnounceProps = {
  namespace: string[],
  authInfo: string 
}


