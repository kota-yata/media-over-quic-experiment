import { moqtBytes } from 'moqtail';

const { buffRead, concatBuffer, deSerializeMetadata, numberToVarInt, readUntilEof, varIntToNumber } = moqtBytes;

type LOCMediaTypeUnion = 'data' | 'video' | 'audio';
type LOCChunkTypeUnion = EncodedVideoChunkType | EncodedAudioChunkType;

export interface LOCObject {
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
  data: Uint8Array;
  metadata: Uint8Array;
  duration: number;
  firstFrameClkms: number;
  private READ_BLOCK_SIZE = 1024 * 1024;
  public setData(mediaType: LOCMediaTypeUnion, chunkType: LOCChunkTypeUnion, seqId: number, timestamp: number, data: Uint8Array, metadata: Uint8Array) {
    this.chunkType = chunkType;
    this.mediaType = mediaType;
    this.seqId = seqId;
    this.timestamp = timestamp;
    this.data = data;
    this.metadata = metadata;
  }
  public toBytes() {
    let mediaTypeBytes;
    if (this.mediaType === 'data') {
      mediaTypeBytes = numberToVarInt(0);
    } else if (this.mediaType === 'audio') {
      mediaTypeBytes = numberToVarInt(1);
    } else if (this.mediaType === 'video') {
      mediaTypeBytes = numberToVarInt(2);
    }
    const chunkTypeBytes = numberToVarInt(this.chunkType === 'delta' ? 0 : 1);
    const timestampBytes = numberToVarInt(this.timestamp);
    const seqIdBytes = numberToVarInt(this.seqId);
    const metadataSizeBytes = numberToVarInt(this.metadata ? this.metadata.byteLength : 0);
    const metadataBytes = this.metadata;
    const dataBytes = this.data;
    if (this.metadata) {
      return concatBuffer([mediaTypeBytes, chunkTypeBytes, timestampBytes, seqIdBytes, metadataSizeBytes, metadataBytes, dataBytes]);
    } else {
      return concatBuffer([mediaTypeBytes, chunkTypeBytes, timestampBytes, seqIdBytes, metadataSizeBytes, dataBytes]);
    }
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
    this.timestamp = await varIntToNumber(readerStream);
    this.seqId = await varIntToNumber(readerStream);
    const metadataSize = await varIntToNumber(readerStream);
    if (metadataSize > 0) {
      const metadataBytes = await buffRead(readerStream, metadataSize);
      this.metadata = deSerializeMetadata(metadataBytes);
    } else {
      this.metadata = null;
    }
    this.data = await readUntilEof(readerStream, this.READ_BLOCK_SIZE);
  }
}
