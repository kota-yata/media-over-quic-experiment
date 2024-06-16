import { buffRead, concatBuffer, numberToVarInt, readUntilEof, varIntToNumber } from './utils/bytes';

type LOCMediaTypeUnion = 'data' | 'video' | 'audio';
type LOCChunkTypeUnion = EncodedVideoChunkType | EncodedAudioChunkType;

interface LOCObject {
  mediaType: LOCMediaTypeUnion;
  chunkType: LOCChunkTypeUnion;
  seqId: number;
  timestamp: number;
  data: ArrayBuffer;
  metadata: any;
  duration: number;
  firstFrameClkms: number;
}

export class LOC {
  mediaType: LOCMediaTypeUnion;
  chunkType: LOCChunkTypeUnion;
  seqId: number;
  timestamp: number;
  data: ArrayBuffer;
  metadata: any;
  duration: number;
  firstFrameClkms: number;
  private READ_BLOCK_SIZE = 1024 * 1024;
  public setData(mediaType: LOCMediaTypeUnion, chunkType: LOCChunkTypeUnion, seqId: number, timestamp: number, data: ArrayBuffer, metadata:any) {
    this.chunkType = chunkType;
    this.mediaType = mediaType;
    this.seqId = seqId;
    this.timestamp = timestamp;
    this.data = data;
    this.metadata = metadata;
  }
  public toBytes() {
    const chunkTypeBytes = numberToVarInt(this.chunkType === 'delta' ? 0 : 1);
    const mediaTypeBytes = numberToVarInt(this.mediaType === 'data' ? 0 : this.chunkType === 'audio' ? 1 : 2);
    const seqIdBytes = numberToVarInt(this.seqId);
    const timestampBytes = numberToVarInt(this.timestamp);
    const dataBytes = new Uint8Array(this.data);
    const metadataBytes = new Uint8Array(this.metadata);
    return concatBuffer([chunkTypeBytes, mediaTypeBytes, seqIdBytes, timestampBytes, dataBytes, metadataBytes]);
  }
  public toObject(): LOCObject {
    return {
      mediaType: this.mediaType,
      chunkType: this.chunkType,
      seqId: this.seqId,
      timestamp: this.timestamp,
      data: this.data,
      metadata: this.metadata,
      duration: this.duration,
      firstFrameClkms: this.firstFrameClkms,
    };
  }
  public async fromBytes(readerStream) {
    const mediaTypeInt = await varIntToNumber(readerStream);
    if (mediaTypeInt === 0) {
      this.mediaType = 'data';
    } else if (mediaTypeInt === 1) {
      this.mediaType = 'audio';
    } else if (mediaTypeInt === 2) {
      this.mediaType = 'video';
    } else {
      throw new Error(`Mediatype ${mediaTypeInt} not supported`);
    }

    const chunkTypeInt = await varIntToNumber(readerStream);
    if (chunkTypeInt === 0) {
      this.chunkType = 'delta';
    } else if (chunkTypeInt === 1) {
      this.chunkType = 'key';
    } else {
      throw new Error(`chunkType ${chunkTypeInt} not supported`);
    }

    this.seqId = await varIntToNumber(readerStream);
    this.timestamp = await varIntToNumber(readerStream);
    this.duration = await varIntToNumber(readerStream);
    this.firstFrameClkms = await varIntToNumber(readerStream);
    const metadataSize = await varIntToNumber(readerStream);
    if (metadataSize > 0) {
      this.metadata = await buffRead(readerStream, metadataSize);
    } else {
      this.metadata = null;
    }
    this.data = await readUntilEof(readerStream, this.READ_BLOCK_SIZE);
  }
}
