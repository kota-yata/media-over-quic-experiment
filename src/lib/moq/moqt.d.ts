export type SubscribeProps = {
  subscribeId: number,
  trackAlias: number,
  namespace: string[],
  trackName: string,
  subscriberPriority: number,
  groupOrder: number,
  filterType: number,
  startGroup?: number,
  startObject?: number,
  endGroup?: number,
  endObject?: number,
  authInfo: string
};

export type AnnounceProps = {
  namespace: string[],
  authInfo: string 
}


