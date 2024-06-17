import { MOQ_DRAFT01_VERSION, MOQ_LOCATION_MODE_ABSOLUTE, MOQ_LOCATION_MODE_NONE, MOQ_LOCATION_MODE_RELATIVE_NEXT, MOQ_MAX_PARAMS, MOQ_MESSAGE_ANNOUNCE, MOQ_MESSAGE_ANNOUNCE_OK, MOQ_MESSAGE_CLIENT_SETUP, MOQ_MESSAGE_OBJECT, MOQ_MESSAGE_OBJECT_WITH_LENGTH, MOQ_MESSAGE_SERVER_SETUP, MOQ_MESSAGE_SUBSCRIBE, MOQ_MESSAGE_SUBSCRIBE_OK, MOQ_PARAMETER_AUTHORIZATION_INFO, MOQ_PARAMETER_ROLE, MOQ_PARAMETER_ROLE_PUBLISHER, MOQ_PARAMETER_ROLE_SUBSCRIBER } from './constants';
import type { LOC } from './loc';
import { numberToVarInt, concatBuffer, varIntToNumber, buffRead } from './utils/bytes';

interface SenderState {
  [key: number]: {
    currentGroupSeq: number,
    currentObjectSeq: number,
  }
}
interface Track { 
  [key: string]: {
    namespace: string,
    id: number,
    type: string,
    priority: number,
    numSubscribers: number,
  }
}

export class MOQT {
  private MAX_INFLIGHT_REQUESTS = 50;
  private wt: WebTransport;
  private controlStream: WebTransportBidirectionalStream;
  private controlWriter: WritableStream;
  private controlReader: ReadableStream;
  private moqTracks: Track = {};
  private senderState: SenderState = {};
  private inflightRequests: string[] = [];
  constructor(url: string) {
    this.wt = new WebTransport(url);
  }
  public async initControlStream() {
    await this.wt.ready;
    this.controlStream = await this.wt.createBidirectionalStream();
    this.controlWriter = this.controlStream.writable;
    this.controlReader = this.controlStream.readable;
  }
  public getIncomingStream(): ReadableStream {
    return this.wt.incomingUnidirectionalStreams;
  }
  // Start as a publisher
  public async startPublisher() {
    await this.setup(MOQ_PARAMETER_ROLE_PUBLISHER);
    await this.readSetup();
    const announcedNs = [];
    for (const [trackType, trackData] of Object.entries(this.moqTracks)) {
      if (announcedNs.includes(trackData.namespace)) continue;
      announcedNs.push(trackData.namespace);
      await this.announce(trackData.namespace, 'secret');
      const announceResponse = await this.readAnnounce();
      console.log(`ANNOUNCE Response: ${announceResponse.namespace}`);
    }
  }
  private async send(writerStream: WritableStream, dataBytes: Uint8Array) {
    const writer = writerStream.getWriter();
    await writer.write(dataBytes);
    writer.releaseLock();
  }
  // Start as a subscriber
  public async startSubscriber() {
    await this.wt.ready;
    await this.setup(MOQ_PARAMETER_ROLE_SUBSCRIBER);
    await this.readSetup();
    // video
    await this.subscribe('kota', 'kota-video', 'secret');
    const subscribeResponse = await this.readSubscribeResponse();
    console.log(`SUBSCRIBE Response: ${subscribeResponse.namespace} ${subscribeResponse.trackName} ${subscribeResponse.trackId} ${subscribeResponse.expires}`);
    if (!this.getTrack(subscribeResponse.trackName)) {
      this.moqTracks[subscribeResponse.trackName] = {
        namespace: subscribeResponse.namespace,
        id: subscribeResponse.trackId,
        type: 'video',
        priority: 1,
        numSubscribers: 1,
      };
    } else {
      this.moqTracks[subscribeResponse.trackName].numSubscribers++;
    }
    // audio
    await this.subscribe('kota', 'kota-audio', 'secret');
    const subscribeResponseAudio = await this.readSubscribeResponse();
    console.log(`SUBSCRIBE Response: ${subscribeResponseAudio.namespace} ${subscribeResponseAudio.trackName} ${subscribeResponseAudio.trackId} ${subscribeResponseAudio.expires}`);
    if (!this.getTrack(subscribeResponseAudio.trackName)) {
      this.moqTracks[subscribeResponseAudio.trackName] = {
        namespace: subscribeResponseAudio.namespace,
        id: subscribeResponseAudio.trackId,
        type: 'audio',
        priority: 10000,
        numSubscribers: 1,
      };
    } else {
      this.moqTracks[subscribeResponseAudio.trackName].numSubscribers++;
    }
  }
  // SETUP
  private generateSetupMessage(moqIntRole: number) {
    const messageType = numberToVarInt(MOQ_MESSAGE_CLIENT_SETUP);
    const versionLength = numberToVarInt(1);
    const version = numberToVarInt(MOQ_DRAFT01_VERSION);
    const numberOfParams = numberToVarInt(1);
    const roleParamId = numberToVarInt(MOQ_PARAMETER_ROLE);
    const roleParamData = numberToVarInt(moqIntRole);
    const roleParamRoleLength = numberToVarInt(roleParamData.byteLength);
    return concatBuffer([messageType, versionLength, version, numberOfParams, roleParamId, roleParamRoleLength, roleParamData]);
  }
  public async setup(role: number) {
    const setup = this.generateSetupMessage(role);
    await this.send(this.controlWriter, setup);
  }
  public async readSetup() {
    const ret = { version: 0, parameters: null };
    const type = await varIntToNumber(this.controlReader);
    if (type !== MOQ_MESSAGE_SERVER_SETUP) {
      throw new Error(`SETUP answer with type ${type} is not supported`);
    }
    ret.version = await varIntToNumber(this.controlReader);
    console.log(`Server version: ${ret.version}`);
    ret.parameters = await this.readParams();
    return ret;
  }
  // ANNOUNCE
  private generateAnnounceMessage(ns: string, authInfo: string) {
    const messageType = numberToVarInt(MOQ_MESSAGE_ANNOUNCE);
    const namespace = this.stringToBytes(ns);
    const numberOfParams = numberToVarInt(1);
    const authInfoIdBytes = numberToVarInt(MOQ_PARAMETER_AUTHORIZATION_INFO);
    const authInfoBytes = this.stringToBytes(authInfo);
    return concatBuffer([messageType, namespace, numberOfParams, authInfoIdBytes, authInfoBytes]);
  }
  public async announce(ns: string, authInfo: string) {
    const announce = this.generateAnnounceMessage(ns, authInfo);
    await this.send(this.controlWriter, announce);
  }
  public async readAnnounce() {
    const type = await varIntToNumber(this.controlReader);
    if (type !== MOQ_MESSAGE_ANNOUNCE_OK) {
      throw new Error(`ANNOUNCE answer type must be ${MOQ_MESSAGE_ANNOUNCE_OK}, got ${type}`);
    }
    const namespace = await this.readString();
    return { namespace };
  }
  // SUBSCRIBE
  private generateSubscribeMessage(ns: string, trackName: string, authInfo: string) {
    const messageTypeBytes = numberToVarInt(MOQ_MESSAGE_SUBSCRIBE);
    const namespaceBytes = this.stringToBytes(ns);
    const trackNameBytes = this.stringToBytes(trackName);
    const startGroupBytesMode = numberToVarInt(MOQ_LOCATION_MODE_RELATIVE_NEXT);
    const startGroupBytesValue = numberToVarInt(0);
    const startObjectBytesMode = numberToVarInt(MOQ_LOCATION_MODE_ABSOLUTE);
    const startObjectBytesValue = numberToVarInt(0);
    const endGroupBytesMode = numberToVarInt(MOQ_LOCATION_MODE_NONE);
    const endObjectBytesMode = numberToVarInt(MOQ_LOCATION_MODE_NONE);
    const numberOfParamsBytes = numberToVarInt(1);
    const authInfoParamIdBytes = numberToVarInt(MOQ_PARAMETER_AUTHORIZATION_INFO);
    const authInfoBytes = this.stringToBytes(authInfo);
    return concatBuffer([messageTypeBytes, namespaceBytes, trackNameBytes, startGroupBytesMode, startGroupBytesValue, startObjectBytesMode, startObjectBytesValue, endGroupBytesMode, endObjectBytesMode, numberOfParamsBytes, authInfoParamIdBytes, authInfoBytes]);
  }
  public async subscribe(ns: string, trackName: string, authInfo: string) {
    const subscribe = this.generateSubscribeMessage(ns, trackName, authInfo);
    await this.send(this.controlWriter, subscribe);
  }
  public async readSubscribe() {
    const ret = { namespace: '', trackName: '', startGroup: -1, startObject: -1, endGroup: -1, endObject: -1, parameters: null };
    const type = await varIntToNumber(this.controlReader);
    if (type !== MOQ_MESSAGE_SUBSCRIBE) {
      throw new Error(`SUBSCRIBE type must be ${MOQ_MESSAGE_SUBSCRIBE}, got ${type}`);
    }
    ret.namespace = await this.readString();
    ret.trackName = await this.readString();
    ret.startGroup = await varIntToNumber(this.controlReader);
    if (ret.startGroup !== MOQ_LOCATION_MODE_NONE) await varIntToNumber(this.controlReader);
    ret.startObject = await varIntToNumber(this.controlReader);
    if (ret.startObject !== MOQ_LOCATION_MODE_NONE) await varIntToNumber(this.controlReader);
    ret.endGroup = await varIntToNumber(this.controlReader);
    if (ret.endGroup !== MOQ_LOCATION_MODE_NONE) await varIntToNumber(this.controlReader);
    ret.endObject = await varIntToNumber(this.controlReader);
    if (ret.endObject !== MOQ_LOCATION_MODE_NONE) await varIntToNumber(this.controlReader);
    ret.parameters = await this.readParams();

    return ret;
  }
  private generateSubscribeResponseMessage(ns: string, trackName: string, trackId: number, expiresMs) {
    const messageTypeBytes = numberToVarInt(MOQ_MESSAGE_SUBSCRIBE_OK);
    const namespaceBytes = this.stringToBytes(ns);
    const trackNameBytes = this.stringToBytes(trackName);
    const trackIdBytes = numberToVarInt(trackId);
    const expiresBytes = numberToVarInt(expiresMs);
    return concatBuffer([messageTypeBytes, namespaceBytes, trackNameBytes, trackIdBytes, expiresBytes]);
  }
  public async sendSubscribeResponse(ns: string, trackName: string, trackId: number, expiresMs: number) {
    const subscribeResponse = this.generateSubscribeResponseMessage(ns, trackName, trackId, expiresMs);
    await this.send(this.controlWriter, subscribeResponse);
  }
  public async readSubscribeResponse() {
    const ret = { namespace: '', trackName: '', trackId: -1, expires: -1 };
    const type = await varIntToNumber(this.controlReader);
    if (type !== MOQ_MESSAGE_SUBSCRIBE_OK) {
      throw new Error(`SUBSCRIBE answer type must be ${MOQ_MESSAGE_SUBSCRIBE_OK}, got ${type}`);
    }
    ret.namespace = await this.readString();
    ret.trackName = await this.readString();
    ret.trackId = await varIntToNumber(this.controlReader);
    ret.expires = await varIntToNumber(this.controlReader);
    return ret;
  }
  // OBJECT
  private generateObjectMessage(trackId: number, groupSeq: number, objectSeq: number, sendOrder: number, data: ArrayBuffer) {
    const messageTypeBytes = numberToVarInt(MOQ_MESSAGE_OBJECT);
    const trackIdBytes = numberToVarInt(trackId);
    const groupSeqBytes = numberToVarInt(groupSeq);
    const objectSeqBytes = numberToVarInt(objectSeq);
    const sendOrderBytes = numberToVarInt(sendOrder);
    return {
      getId: () => `${trackId}-${groupSeq}-${objectSeq}-${sendOrder}`,
      toBytes: () => concatBuffer([messageTypeBytes, trackIdBytes, groupSeqBytes, objectSeqBytes, sendOrderBytes, data])
    }
  }
  public async sendObject(locPacket: LOC, trackName: string) {
    const targetTrack = this.getTrack(trackName);
    const trackId = targetTrack.id;
    if (!this.senderState[trackId]) {
      this.senderState[trackId] = {
        currentGroupSeq: 0,
        currentObjectSeq: 0,
      };
    } else {
      this.senderState[trackId].currentObjectSeq++;
    }
    const sendOrder = (this.senderState[trackId].currentObjectSeq + 1) * targetTrack.priority; // Really temporary
    const uniStream = await this.wt.createUnidirectionalStream({ sendOrder });
    const moqtObject = this.generateObjectMessage(trackId, this.senderState[trackId].currentGroupSeq, this.senderState[trackId].currentObjectSeq, sendOrder, locPacket.toBytes());
    const success = this.addInflightRequest(moqtObject.getId());
    if (success.success) {
      await this.send(uniStream, moqtObject.toBytes());
      uniStream.close().finally(() => {
        this.removeInflightRequest(moqtObject.getId());
      });
    }
  }
  public async readObject(readableStream: ReadableStream) {
    const type = await varIntToNumber(readableStream);
    if (type !== MOQ_MESSAGE_OBJECT && type !== MOQ_MESSAGE_OBJECT_WITH_LENGTH) {
      throw new Error(`OBJECT answer type must be ${MOQ_MESSAGE_OBJECT} or ${MOQ_MESSAGE_OBJECT_WITH_LENGTH}, got ${type}`);
    }
    const trackId = await varIntToNumber(readableStream);
    const groupSeq = await varIntToNumber(readableStream);
    const objSeq = await varIntToNumber(readableStream);
    const sendOrder = await varIntToNumber(readableStream);
    const ret = { trackId, groupSeq, objSeq, sendOrder, payloadLength: 0 };
    if (type === MOQ_MESSAGE_OBJECT_WITH_LENGTH) {
      ret.payloadLength = await varIntToNumber(readableStream);
    }
    return ret;
  }
  // MISC
  private stringToBytes(str: string) {
    const dataStrBytes = new TextEncoder().encode(str);
    const dataStrLengthBytes = numberToVarInt(dataStrBytes.byteLength);
    return concatBuffer([dataStrLengthBytes, dataStrBytes]);
  }
  private async readString() {
    const size = await varIntToNumber(this.controlReader);
    const buffer = await buffRead(this.controlReader, size);
    return new TextDecoder().decode(buffer);
  }
  private async readParams() {
    const ret = { authInfo: '', role: -1 };
    const numParams = await varIntToNumber(this.controlReader);
    if (numParams > MOQ_MAX_PARAMS) {
      throw new Error(`exceeded the max number of supported params ${MOQ_MAX_PARAMS}, got ${numParams}`);
    }
    for (let i = 0; i < numParams; i++) {
      const paramId = await varIntToNumber(this.controlReader);
      if (paramId === MOQ_PARAMETER_AUTHORIZATION_INFO) {
        ret.authInfo = await this.readString();
        break;
      } else if (paramId === MOQ_PARAMETER_ROLE) {
        await varIntToNumber(this.controlReader);
        ret.role = await varIntToNumber(this.controlReader);
      } else {
        const paramLength = await varIntToNumber(this.controlReader);
        const skip = await buffRead(this.controlReader, paramLength);
        ret[`unknown-${i}-${paramId}-${paramLength}`] = JSON.stringify(skip);
      }
    }
    return ret;
  }
  // Track management
  public getTrack(trackName: string) {
    return this.moqTracks[trackName];
  }
  public setTrack(trackName: string, props: { namespace: string, id: number, type: string, priority: number, numSubscribers: number }) {
    this.moqTracks[trackName] = {
      namespace: props.namespace,
      id: props.id,
      type: props.type,
      priority: props.priority,
      numSubscribers: props.numSubscribers,
    };
  }
  public searchTrackType(trackId: number) {
    for (const [trackName, trackData] of Object.entries(this.moqTracks)) {
      if (trackData.id === trackId) {
        return trackData.type;
      }
    }
    return null;
  }
  private addInflightRequest(requestId: string): { success: boolean } {
    if (this.inflightRequests.length > this.MAX_INFLIGHT_REQUESTS) {
      return { success: false };
    }
    this.inflightRequests.push(requestId);
    return { success: true };
  }
  private removeInflightRequest(requestId: string) {
    this.inflightRequests = this.inflightRequests.filter((id) => id !== requestId);
  }
}
