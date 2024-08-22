import { type LOCObject } from "./loc";

interface LOCObjectExtended extends LOCObject {
  arrivalTime: number;
}

// Jitter buffer
export class MitterMuffer {
  bufferFrameSize: number;
  buffer: LOCObjectExtended[];
  constructor(bufferFrameSize: number) {
    this.bufferFrameSize = bufferFrameSize;
    this.buffer = [];
  }
  public addFrame(frame: LOCObject) {
    const arrivalTime = performance.now();
    this.buffer.push({ ...frame, arrivalTime });
    this.buffer.sort((a, b) => a.seqId - b.seqId);
  }
  public getFrame() {
    if (this.buffer.length === 0) return { ok: false, frame: null };
    if (this.buffer.length < this.bufferFrameSize) return { ok: false, frame: null };
    const frame = this.buffer.shift();
    return {
      ok: true,
      frame
    };
  }
  public getStats() {
    return {
      bufferLength: this.buffer.length,
      bufferFrameSize: this.bufferFrameSize,
    }
  }
}
