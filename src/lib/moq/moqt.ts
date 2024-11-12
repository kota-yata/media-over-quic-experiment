import { MOQ_DRAFT07_VERSION, MOQ_MAX_PARAMS, MOQ_MESSAGE, VERSION_SPECIFIC_PARAMETERS, SETUP_PARAMETERS, OBJECT_STATUS, SUBSCRIBE_FILTER, SUBSCRIBE_GROUP_ORDER, MAX_SUBSCRIBE_ID } from './constants';
import { TrackManager } from './track';
import { numberToVarInt, concatBuffer, varIntToNumber, buffRead, stringToVarBytes, toString, arrayToVarTulple } from './utils/bytes';
import { moqVideoEncodeLatencyStore, moqVideoFrameOnEncode, moqVideoTransmissionLatencyStore } from './utils/store';
import type { AnnounceProps, SubscribeProps } from './moqt.d';

interface SenderState {
  [key: string]: {
    currentGroupSeq: number,
    currentObjectSeq: number,
  }
}

export class MOQT {
  private MAX_INFLIGHT_REQUESTS = 50;
  private wt: WebTransport;
  private controlStream: WebTransportBidirectionalStream;
  private controlWriter: WritableStream;
  private controlReader: ReadableStream;
  private senderState: SenderState = {};
  private inflightRequests: string[] = [];
  public trackManager: TrackManager;
  constructor(props: { url: string, maxInflightRequests?: number }) {
    this.wt = new WebTransport(props.url, { congestionControl: 'throughput' }); // 'throughput' or 'low-latency' although only Firefox supports 'low-latency'
    this.trackManager = new TrackManager();
    if (props.maxInflightRequests) this.MAX_INFLIGHT_REQUESTS = props.maxInflightRequests;
  }
  public async initControlStream() {
    await this.wt.ready;
    this.controlStream = await this.wt.createBidirectionalStream();
    this.controlWriter = this.controlStream.writable;
    this.controlReader = this.controlStream.readable;
  }
  
  public getIncomingStream(): ReadableStream { return this.wt.incomingUnidirectionalStreams; }
  private async send(props: { writerStream: WritableStream, dataBytes: Uint8Array }) {
    const writer = props.writerStream.getWriter();
    await writer.write(props.dataBytes);
    writer.releaseLock();
  }
  // read message type
  public async readControlMessageType(): Promise<number> {
    return await varIntToNumber(this.controlReader);
  }
  // SETUP
  private generateSetupMessage(props: { role: number }) {
    const messageType = numberToVarInt(MOQ_MESSAGE.CLIENT_SETUP);
    const versionLength = numberToVarInt(1);
    const version = numberToVarInt(MOQ_DRAFT07_VERSION);
    const numberOfParams = numberToVarInt(2);
    const roleParamType = numberToVarInt(SETUP_PARAMETERS.ROLE.KEY);
    const roleParamValue = numberToVarInt(props.role);
    const roleParamLength = numberToVarInt(roleParamValue.byteLength);
    const maxSubIdType = numberToVarInt(SETUP_PARAMETERS.MAX_SUBSCRIBE_ID.KEY);
    const maxSubIdValue = numberToVarInt(MAX_SUBSCRIBE_ID);
    const maxSubIdLength = numberToVarInt(maxSubIdValue.byteLength);
    const msg = [versionLength, version, numberOfParams, roleParamType, roleParamLength, roleParamValue, maxSubIdType, maxSubIdLength, maxSubIdValue];
    const messageLength = numberToVarInt(concatBuffer(msg).byteLength);
    return concatBuffer([messageType, messageLength, ...msg]);
  }
  public async setup(props: { role: number }) {
    const setup = this.generateSetupMessage(props);
    await this.send({writerStream: this.controlWriter, dataBytes: setup});
  }
  public async readSetup() {
    const ret = { version: 0, parameters: null };
    await varIntToNumber(this.controlReader); // message length which I don't really need
    ret.version = await varIntToNumber(this.controlReader);
    ret.parameters = await this.readParams();
    return ret;
  }
  // ANNOUNCE
  private generateAnnounceMessage(props: AnnounceProps) {
    const messageType = numberToVarInt(MOQ_MESSAGE.ANNOUNCE);
    const namespace = arrayToVarTulple(props.namespace);
    const numberOfParams = numberToVarInt(1);
    const authInfoIdBytes = numberToVarInt(VERSION_SPECIFIC_PARAMETERS.AUTHORIZATION_INFO.KEY);
    const authInfoBytes = stringToVarBytes(props.authInfo);
    const msg = [namespace, numberOfParams, authInfoIdBytes, authInfoBytes];
    const messageLength = numberToVarInt(concatBuffer(msg).byteLength);
    return concatBuffer([messageType, messageLength, ...msg]);
  }
  public async announce(props: AnnounceProps) {
    const announce = this.generateAnnounceMessage(props);
    await this.send({writerStream: this.controlWriter, dataBytes: announce});
  }
  public async readAnnounceOk() {
    await varIntToNumber(this.controlReader); // message length
    const namespace = await toString(this.controlReader);
    return { namespace };
  }
  public async readAnnounceError() {
    await varIntToNumber(this.controlReader); // message length
    const namespace = await toString(this.controlReader);
    const errorCode = await varIntToNumber(this.controlReader);
    const reasonPhraseLength = await varIntToNumber(this.controlReader);
    const reasonPhrase = await toString(this.controlReader, reasonPhraseLength);
    return { namespace, errorCode, reasonPhrase };
  }
  public generateUnannounceMessage(ns: string) {
    const messageType = numberToVarInt(MOQ_MESSAGE.UNANNOUNCE);
    const namespace = stringToVarBytes(ns);
    return concatBuffer([messageType, namespace]);
  }
  public async unannounce() {
    const unannounce = this.generateUnannounceMessage('kota');
    await this.send({writerStream: this.controlWriter, dataBytes: unannounce});
  }
  // TODO: announce error, announce cancel and unannounce
  // TODO: track status request, track status
  // SUBSCRIBE
  private generateSubscribeMessage(props: SubscribeProps) {
    const messageTypeBytes = numberToVarInt(MOQ_MESSAGE.SUBSCRIBE);
    const subscribeIdBytes = numberToVarInt(props.subscribeId);
    const trackAliasBytes = numberToVarInt(props.trackAlias); // temporary value
    const namespaceBytes = stringToVarBytes(props.namespace);
    const trackNameBytes = stringToVarBytes(props.trackName);
    const trackNameLengthBytes = numberToVarInt(trackNameBytes.byteLength);
    const subscriberPriorityBytes = numberToVarInt(props.subscriberPriority);
    const filterTypeBytes = numberToVarInt(SUBSCRIBE_FILTER.LATEST_OBEJCT); // streaming specific
    // const groupOrderBytes = numberToVarInt(SUBSCRIBE_GROUP_ORDER.ASCENDING); // temporary constant prob v5
    // const startGroupBytesValue = numberToVarInt(0);
    // const startObjectBytesValue = numberToVarInt(0);
    // const endGroupBytesValue
    // const endObjectBytesValue
    const numberOfParamsBytes = numberToVarInt(1);
    const authInfoParamIdBytes = numberToVarInt(VERSION_SPECIFIC_PARAMETERS.AUTHORIZATION_INFO.KEY);
    const authInfoBytes = stringToVarBytes(props.authInfo);
    return concatBuffer([messageTypeBytes, subscribeIdBytes, trackAliasBytes, namespaceBytes, trackNameBytes, filterTypeBytes, numberOfParamsBytes, authInfoParamIdBytes, authInfoBytes]);
  }
  public async subscribe(props: SubscribeProps) {
    const subscribe = this.generateSubscribeMessage(props);
    await this.send({ writerStream: this.controlWriter, dataBytes: subscribe });
  }
  public async readSubscribe(): Promise<SubscribeProps> {
    const subscribeId = await varIntToNumber(this.controlReader);
    const trackAlias = await varIntToNumber(this.controlReader);
    const namespace = await toString(this.controlReader);
    const trackName = await toString(this.controlReader);
    const subscriberPriority = await varIntToNumber(this.controlReader);
    const filterType = await varIntToNumber(this.controlReader);
    const parameters = await this.readParams();

    return { subscribeId, trackAlias, namespace, trackName, subscriberPriority, filterType, authInfo: parameters.authInfo };
  }
  private generateSubscribeResponseMessage(props: {subscribeId: number, expiresMs: number }) {
    const messageTypeBytes = numberToVarInt(MOQ_MESSAGE.SUBSCRIBE_OK);
    const subscriptionIdBytes = numberToVarInt(props.subscribeId);
    const expiresBytes = numberToVarInt(props.expiresMs);
    const contentExistsBytes = numberToVarInt(1); // temporary constant
    const largestGroupIdBytes = numberToVarInt(0); // temporary constant
    const largestObjectIdBytes = numberToVarInt(0); // temporary constant
    return concatBuffer([messageTypeBytes, subscriptionIdBytes, expiresBytes, contentExistsBytes, largestGroupIdBytes, largestObjectIdBytes]);
  }
  public async sendSubscribeResponse(props: {subscribeId: number, expiresMs: number }) {
    const subscribeResponse = this.generateSubscribeResponseMessage(props);
    await this.send({ writerStream: this.controlWriter, dataBytes: subscribeResponse });
  }
  public async readSubscribeResponse() {
    const ret = { subscribeId: -1, expires: -1, contentExists: -1 };
    ret.subscribeId = await varIntToNumber(this.controlReader);
    ret.expires = await varIntToNumber(this.controlReader);
    ret.contentExists = await varIntToNumber(this.controlReader);
    return ret;
  }
  private generateSubscribeUpdateMessage() {}
  public async readSubscribeError() {
    const subscribeId = await varIntToNumber(this.controlReader);
    const errorCode = await varIntToNumber(this.controlReader);
    const reasonPhrase = await toString(this.controlReader);
    const trackAlias = await varIntToNumber(this.controlReader);
    return { subscribeId, errorCode, reasonPhrase, trackAlias };
  }
  public readSubscribeDone() {}
  private generateUnsubscribeMessage(subscribeId: number) {
    const messageTypeBytes = numberToVarInt(MOQ_MESSAGE.UNSUBSCRIBE);
    const subscribeIdBytes = numberToVarInt(subscribeId);
    return concatBuffer([messageTypeBytes, subscribeIdBytes]);
  }
  public async unsubscribe(subscribeId: number) {
    const unsubscribeMessage = this.generateUnsubscribeMessage(subscribeId);
    await this.send({ writerStream: this.controlWriter, dataBytes: unsubscribeMessage });
  }
  public async readUnsubscribe () {
    const subscribeId = await varIntToNumber(this.controlReader);
    return { subscribeId };
  }
  public async readGoaway() {
    await varIntToNumber(this.controlReader); // message length
    const newSessionUriLength = await varIntToNumber(this.controlReader);
    const newSessionUri = await toString(this.controlReader, newSessionUriLength); // might not work if i misundestand the meaning of (..) in the spec
    return { newSessionUri };
  }
  // OBJECT
  private generateObjectMessage(props: {subscribeId: number, groupSeq: number, objectSeq: number, sendOrder: number, data: Uint8Array}) {
    const messageTypeBytes = numberToVarInt(MOQ_MESSAGE.OBJECT_STREAM);
    const subscribeIdBytes = numberToVarInt(props.subscribeId);
    const trackAliasBytes = numberToVarInt(props.subscribeId); // temporary value
    const groupIdBytes = numberToVarInt(props.groupSeq);
    const objectIdBytes = numberToVarInt(props.objectSeq);
    const sendOrderBytes = numberToVarInt(props.sendOrder);
    const objectStatusBytes = numberToVarInt(OBJECT_STATUS.NORMAL);
    const performanceBytes = numberToVarInt(Math.floor(performance.timeOrigin + performance.now()));
    return {
      getId: () => `${props.subscribeId}-${props.groupSeq}-${props.objectSeq}`,
      toBytes: () => concatBuffer([messageTypeBytes, subscribeIdBytes, trackAliasBytes, groupIdBytes, objectIdBytes, sendOrderBytes, objectStatusBytes, performanceBytes, props.data])
    };
  }
  public async sendObject(props: { trackName: string, data: Uint8Array, newGroup: boolean }) {
    const targetTrack = this.trackManager.getTrack(props.trackName);
    if (!this.senderState[props.trackName]) {
      this.senderState[props.trackName] = {
        currentGroupSeq: 0,
        currentObjectSeq: 0,
      };
    } else {
      this.senderState[props.trackName].currentObjectSeq++;
    }
    if (props.newGroup) {
      this.senderState[props.trackName].currentGroupSeq++;
      this.senderState[props.trackName].currentObjectSeq = 0;
    }
    const sendOrder = (this.senderState[props.trackName].currentObjectSeq + 1) * targetTrack.priority; // Really temporary
    const uniStream = await this.wt.createUnidirectionalStream({ sendOrder });
    for (const subscribeId of targetTrack.subscribeIds) {
      const moqtObject = this.generateObjectMessage({
        subscribeId,
        groupSeq: this.senderState[props.trackName].currentGroupSeq,
        objectSeq: this.senderState[props.trackName].currentObjectSeq,
        sendOrder,
        data: props.data});
      const success = this.addInflightRequest(moqtObject.getId());
      if (success.success) {
        const latency = moqVideoFrameOnEncode.calcLatency(performance.now());
        moqVideoEncodeLatencyStore.set(latency);
        await this.send({ writerStream: uniStream, dataBytes: moqtObject.toBytes() });
        uniStream.close().finally(() => {
          this.removeInflightRequest(moqtObject.getId());
        });
      }
    }
  }
  public async readObject(props: { readableStream: ReadableStream }) {
    const type = await varIntToNumber(props.readableStream);
    if (type !== MOQ_MESSAGE.OBJECT_STREAM && type !== MOQ_MESSAGE.OBJECT_DATAGRAM) {
      throw new Error(`OBJECT answer type must be ${MOQ_MESSAGE.OBJECT_STREAM} or ${MOQ_MESSAGE.OBJECT_DATAGRAM}, got ${type}`);
    }
    const subscribeId = await varIntToNumber(props.readableStream);
    const trackAlias = await varIntToNumber(props.readableStream);
    const groupId = await varIntToNumber(props.readableStream);
    const objId = await varIntToNumber(props.readableStream);
    const sendOrder = await varIntToNumber(props.readableStream);
    const objectStatus = await varIntToNumber(props.readableStream);
    const sourcePerformance = await varIntToNumber(props.readableStream);
    moqVideoTransmissionLatencyStore.set(Math.floor(performance.timeOrigin + performance.now()) - sourcePerformance);
    return { subscribeId, trackAlias, groupId, objId, sendOrder, objectStatus };
  }
  // Generic params reader
  // reads not only the version-specific params but also setup params
  private async readParams() {
    const ret = {
      authInfo: '', // appears in SUBSCRIBE, SUBSCRIBE_ANNOUNCES or ANNOUNCE
      deliveryTimeout: -1, // appears in SUBSCRIBE, SUBSCRIBE_OK or SUBSCRIBE UPDATE
      maxCacheDuration: -1, // appears in SUBSCRIBE??? (not explicitly mentioned in the spec)
      role: -1, // appears in SETUP
      path: '', // appears in SETUP
      maxSubscribeId: -1, // appears in SETUP
    };
    const numParams = await varIntToNumber(this.controlReader);
    if (numParams > MOQ_MAX_PARAMS) {
      throw new Error(`exceeded the max number of supported params ${MOQ_MAX_PARAMS}, got ${numParams}`);
    }
    for (let i = 0; i < numParams; i++) {
      const paramId = await varIntToNumber(this.controlReader);
      switch (paramId) {
        case VERSION_SPECIFIC_PARAMETERS.AUTHORIZATION_INFO.KEY:
          ret.authInfo = await toString(this.controlReader);
          break;
        case VERSION_SPECIFIC_PARAMETERS.DELIVERY_TIMEOUT.KEY:
          ret.deliveryTimeout = await varIntToNumber(this.controlReader);
          break;
        case VERSION_SPECIFIC_PARAMETERS.MAX_CACHE_DURATION.KEY:
          ret.maxCacheDuration = await varIntToNumber(this.controlReader);
          break;
        case SETUP_PARAMETERS.ROLE.KEY:
          ret.role = await varIntToNumber(this.controlReader);
          break;
        case SETUP_PARAMETERS.PATH.KEY:
          ret.path = await toString(this.controlReader);
          break;
        case SETUP_PARAMETERS.MAX_SUBSCRIBE_ID:
          ret.maxSubscribeId = await varIntToNumber(this.controlReader);
          break;
        default:
          const paramLength = await varIntToNumber(this.controlReader);
          const skip = await buffRead(this.controlReader, paramLength);
          ret[`unknown-${i}-${paramId}-${paramLength}`] = JSON.stringify(skip);
          break;
      }
    }
    return ret;
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
