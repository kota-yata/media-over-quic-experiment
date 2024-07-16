import { writable }from "svelte/store";
import type { Writable } from "svelte/store";

export const moqVideoEncodeLatencyStore = writable<number>(0);
export const moqVideoTransmissionLatencyStore = writable<number>(0);
export const moqVideoDecodeLatencyStore = writable<number>(0);

// export interface moqVideoFrameOnEncode {
//   vFrameTs: number;
//   performanceTs: number;
// }

export class moqVideoFrameOnEncode {
  private static store: number = 0;
  public static get() {
    return moqVideoFrameOnEncode.store;
  }
  public static set(performanceNow: number) {
    moqVideoFrameOnEncode.store = performanceNow;
  }
  public static calcLatency(performanceNow: number) {
    return performanceNow - moqVideoFrameOnEncode.store;
  }
}

export class moqVideoFrameOnDecode {
  private static store: number = 0;
  public static get() {
    return moqVideoFrameOnDecode.store;
  }
  public static set(performanceNow: number) {
    moqVideoFrameOnDecode.store = performanceNow;
  }
  public static calcLatency(performanceNow: number) {
    return performanceNow - moqVideoFrameOnDecode.store;
  }
}
