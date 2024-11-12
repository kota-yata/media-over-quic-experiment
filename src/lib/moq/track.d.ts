export type Track = {
  namespace: string[],
  name: string,
  alias?: string,
  subscribeIds: number[],
  type: string,
  priority: number,
}
