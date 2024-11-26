import { MOQ_DRAFT07_VERSION, MOQ_MAX_PARAMS, MOQ_MESSAGE, VERSION_SPECIFIC_PARAMETERS, SETUP_PARAMETERS, OBJECT_STATUS, SUBSCRIBE_FILTER, SUBSCRIBE_GROUP_ORDER, MAX_SUBSCRIBE_ID, OBJECT_STREAM_TYPE } from './constants';
import { TrackManager } from './track';
import { numberToVarInt, concatBuffer, varIntToNumber, buffRead, stringToBytes, BytesToString, arrayToVarTulple, varTupleToArray } from './utils/bytes';
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
  public async readControlMessageType(): Promise<number> {;
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
    if (ret.version !== MOQ_DRAFT07_VERSION) {
      throw new Error(`unsupported version ${ret.version}`);
    }
    ret.parameters = await this.readSetupParams();
    return ret;
  }
  // ANNOUNCE
  private generateAnnounceMessage(props: AnnounceProps) {
    const messageType = numberToVarInt(MOQ_MESSAGE.ANNOUNCE);
    const namespace = arrayToVarTulple(props.namespace);
    const numberOfParams = numberToVarInt(1);
    const authInfoIdBytes = numberToVarInt(VERSION_SPECIFIC_PARAMETERS.AUTHORIZATION_INFO.KEY);
    const authInfoBytes = stringToBytes(props.authInfo);
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
    const namespace = await varTupleToArray(this.controlReader);
    return { namespace };
  }
  public async readAnnounceError() {
    await varIntToNumber(this.controlReader); // message length
    const namespace = await BytesToString(this.controlReader);
    const errorCode = await varIntToNumber(this.controlReader);
    const reasonPhraseLength = await varIntToNumber(this.controlReader);
    const reasonPhrase = await BytesToString(this.controlReader, reasonPhraseLength);
    return { namespace, errorCode, reasonPhrase };
  }
  public generateUnannounceMessage(ns: string) {
    const messageType = numberToVarInt(MOQ_MESSAGE.UNANNOUNCE);
    const namespace = stringToBytes(ns);
    return concatBuffer([messageType, namespace]);
  }
  public async unannounce() {
    const unannounce = this.generateUnannounceMessage('kota');
    await this.send({writerStream: this.controlWriter, dataBytes: unannounce});
  }
  // TODO: announce cancel and unannounce
  // TODO: track status request, track status
  // SUBSCRIBE
  private generateSubscribeMessage(props: SubscribeProps) {
    const messageTypeBytes = numberToVarInt(MOQ_MESSAGE.SUBSCRIBE);
    const subscribeIdBytes = numberToVarInt(props.subscribeId);
    const trackAliasBytes = numberToVarInt(props.trackAlias);
    const namespaceBytes = arrayToVarTulple(props.namespace);
    const trackNameBytes = stringToBytes(props.trackName);
    const trackNameLengthBytes = numberToVarInt(trackNameBytes.byteLength);
    const subscriberPriorityBytes = numberToVarInt(props.subscriberPriority);
    const groupOrderBytes = numberToVarInt(props.groupOrder);
    const filterTypeBytes = numberToVarInt(props.filterType);
    let startGroupBytes = numberToVarInt(0);
    let startObjectBytes = numberToVarInt(0);
    let endGroupBytes = numberToVarInt(0);
    let endObjectBytes = numberToVarInt(0);
    if (props.filterType === SUBSCRIBE_FILTER.ABSOLUTE_START || props.filterType === SUBSCRIBE_FILTER.ABSOLUTE_RANGE) {
      startGroupBytes = numberToVarInt(props.startGroup);
      startObjectBytes = numberToVarInt(props.startObject);
      if (props.filterType === SUBSCRIBE_FILTER.ABSOLUTE_RANGE) {
        endGroupBytes = numberToVarInt(props.endGroup);
        endObjectBytes = numberToVarInt(props.endObject);
      }
    }
    const numberOfParamsBytes = numberToVarInt(1);
    const authInfoParamIdBytes = numberToVarInt(VERSION_SPECIFIC_PARAMETERS.AUTHORIZATION_INFO.KEY);
    const authInfoBytes = stringToBytes(props.authInfo);
    const authInfoLengthBytes = numberToVarInt(authInfoBytes.byteLength);
    // FIXME: this dirty-ass code
    let payload = [subscribeIdBytes, trackAliasBytes, namespaceBytes, trackNameLengthBytes, trackNameBytes, subscriberPriorityBytes, groupOrderBytes, filterTypeBytes, numberOfParamsBytes, authInfoParamIdBytes, authInfoLengthBytes, authInfoBytes];
    if (props.filterType === SUBSCRIBE_FILTER.ABSOLUTE_START || props.filterType === SUBSCRIBE_FILTER.ABSOLUTE_RANGE) {
      payload = [subscribeIdBytes, trackAliasBytes, namespaceBytes, trackNameLengthBytes, trackNameBytes, subscriberPriorityBytes, groupOrderBytes, filterTypeBytes, startGroupBytes, startObjectBytes, numberOfParamsBytes, authInfoParamIdBytes, authInfoLengthBytes, authInfoBytes];
      if (props.filterType === SUBSCRIBE_FILTER.ABSOLUTE_RANGE) {
        payload = [subscribeIdBytes, trackAliasBytes, namespaceBytes, trackNameLengthBytes, trackNameBytes, subscriberPriorityBytes, groupOrderBytes, filterTypeBytes, startGroupBytes, startObjectBytes, endGroupBytes, endObjectBytes, numberOfParamsBytes, authInfoParamIdBytes, authInfoLengthBytes, authInfoBytes];
      }
    }
    const payloadLengthBytes = numberToVarInt(concatBuffer(payload).byteLength);
    return concatBuffer([messageTypeBytes, payloadLengthBytes, ...payload]);
  }
  public async subscribe(props: SubscribeProps) {
    const subscribe = this.generateSubscribeMessage(props);
    await this.send({ writerStream: this.controlWriter, dataBytes: subscribe });
  }
  public async readSubscribe(): Promise<SubscribeProps> {
    const ret = {} as SubscribeProps;
    await varIntToNumber(this.controlReader); // message length
    ret.subscribeId = await varIntToNumber(this.controlReader);
    ret.trackAlias = await varIntToNumber(this.controlReader);
    ret.namespace = await varTupleToArray(this.controlReader);
    await varIntToNumber(this.controlReader); // track name length
    ret.trackName = await BytesToString(this.controlReader);
    ret.subscriberPriority = await varIntToNumber(this.controlReader);
    ret.groupOrder = await varIntToNumber(this.controlReader);
    ret.filterType = await varIntToNumber(this.controlReader);
    if (ret.filterType === SUBSCRIBE_FILTER.ABSOLUTE_START || ret.filterType === SUBSCRIBE_FILTER.ABSOLUTE_RANGE) {
      ret.startGroup = await varIntToNumber(this.controlReader);
      ret.startObject = await varIntToNumber(this.controlReader);
      if (ret.filterType === SUBSCRIBE_FILTER.ABSOLUTE_RANGE) {
        ret.endGroup = await varIntToNumber(this.controlReader);
        ret.endObject = await varIntToNumber(this.controlReader);
      }
    }
    const parameters = await this.readParams();
    ret.authInfo = parameters.authInfo;

    return ret;
  }
  private generateSubscribeOkMessage(props: { subscribeId: number, expiresMs: number, groupOrder: number }) {
    const messageTypeBytes = numberToVarInt(MOQ_MESSAGE.SUBSCRIBE_OK);
    const subscriptionIdBytes = numberToVarInt(props.subscribeId);
    const expiresBytes = numberToVarInt(props.expiresMs);
    const groupOrderBytes = numberToVarInt(props.groupOrder); // this is publisher's group order
    const contentExistsBytes = numberToVarInt(1);
    const largestGroupIdBytes = numberToVarInt(0);
    const largestObjectIdBytes = numberToVarInt(0);
    const numberOfParamsBytes = numberToVarInt(0);
    const payload = [subscriptionIdBytes, expiresBytes, groupOrderBytes, contentExistsBytes, largestGroupIdBytes, largestObjectIdBytes, numberOfParamsBytes];
    const payloadLengthBytes = numberToVarInt(concatBuffer(payload).byteLength);
    return concatBuffer([messageTypeBytes, payloadLengthBytes, ...payload]);
  }
  public async sendSubscribeOk(props: {subscribeId: number, expiresMs: number, groupOrder: number }) {
    const subscribeResponse = this.generateSubscribeOkMessage(props);
    await this.send({ writerStream: this.controlWriter, dataBytes: subscribeResponse });
  }
  public async readSubscribeOk() {
    await varIntToNumber(this.controlReader); // message length
    const ret = { subscribeId: -1, expires: -1, contentExists: -1, largestGroupId: -1, largestObjectId: -1, params: null };
    ret.subscribeId = await varIntToNumber(this.controlReader);
    ret.expires = await varIntToNumber(this.controlReader);
    ret.contentExists = await varIntToNumber(this.controlReader);
    if (ret.contentExists === 1) {
      ret.largestGroupId = await varIntToNumber(this.controlReader);
      ret.largestObjectId = await varIntToNumber(this.controlReader);
    }
    ret.params = await this.readParams();
    return ret;
  }
  private generateSubscribeUpdateMessage() {}
  public async readSubscribeError() {
    await varIntToNumber(this.controlReader); // message length
    const subscribeId = await varIntToNumber(this.controlReader);
    const errorCode = await varIntToNumber(this.controlReader);
    const reasonPhrase = await BytesToString(this.controlReader);
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
    const newSessionUri = await BytesToString(this.controlReader, newSessionUriLength); // might not work if i misundestand the meaning of (..) in the spec
    return { newSessionUri };
  }
  // OBJECT
  private generateStreamHeaderSubgroupMessage(){}
  private sendStreamHeaderSubgroupMessage(){}
  private readStreamHeaderSubgroupMessage(){}
  private generateObjectDatagramMessage(props: {trackAlias: number, groupSeq: number, objectId: number, sendOrder: number, data: Uint8Array}) {
    const objectIdBytes = numberToVarInt(props.objectId);
    const objectPayloadLengthBytes = numberToVarInt(props.data.byteLength);
    const objectStatusBytes = numberToVarInt(OBJECT_STATUS.END_OF_GROUP);
    const performanceBytes = numberToVarInt(Math.floor(performance.timeOrigin + performance.now())); // just for this app
    const objectStream = props.data.byteLength > 0 ?
      concatBuffer([objectIdBytes, objectPayloadLengthBytes, performanceBytes, props.data]) :
      concatBuffer([objectIdBytes, objectPayloadLengthBytes, performanceBytes, objectStatusBytes]);
    return {
      getId: () => `${props.trackAlias}-${props.objectId}`,
      toBytes: () => objectStream
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
      const moqtObject = this.generateObjectDatagramMessage({
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
  private async readSetupParams() {
    const ret = {
      role: -1,
      path: '',
      maxSubscribeId: -1,
    }
    const numParams = await varIntToNumber(this.controlReader);
    if (numParams > MOQ_MAX_PARAMS) throw new Error(`exceeded the max number of supported params ${MOQ_MAX_PARAMS}, got ${numParams}`);
    for (let i = 0; i < numParams; i++) {
      const paramType = await varIntToNumber(this.controlReader);
      const paramLength = await varIntToNumber(this.controlReader);
      switch (paramType) {
        case SETUP_PARAMETERS.ROLE.KEY:
          ret.role = await varIntToNumber(this.controlReader);
          break;
        case SETUP_PARAMETERS.PATH.KEY:
          ret.path = await BytesToString(this.controlReader);
          break;
        case SETUP_PARAMETERS.MAX_SUBSCRIBE_ID.KEY:
          ret.maxSubscribeId = await varIntToNumber(this.controlReader);
          break;
        default:
          const skip = await varIntToNumber(this.controlReader);
          ret[`unknown-${i}-${paramType}-${paramLength}`] = skip;
          break;
      }
    }
    return ret;
  }
  private async readParams() {
    const ret = {
      authInfo: '', // appears in SUBSCRIBE, SUBSCRIBE_ANNOUNCES or ANNOUNCE
      deliveryTimeout: -1, // appears in SUBSCRIBE, SUBSCRIBE_OK or SUBSCRIBE UPDATE
      maxCacheDuration: -1, // appears in SUBSCRIBE??? (not explicitly mentioned in the spec)
    };
    const numParams = await varIntToNumber(this.controlReader);
    if (numParams > MOQ_MAX_PARAMS) throw new Error(`exceeded the max number of supported params ${MOQ_MAX_PARAMS}, got ${numParams}`);
    for (let i = 0; i < numParams; i++) {
      const paramType = await varIntToNumber(this.controlReader);
      const paramLength = await varIntToNumber(this.controlReader);
      switch (paramType) {
        case VERSION_SPECIFIC_PARAMETERS.AUTHORIZATION_INFO.KEY:
          ret.authInfo = await BytesToString(this.controlReader, paramLength);
          break;
        case VERSION_SPECIFIC_PARAMETERS.DELIVERY_TIMEOUT.KEY:
          ret.deliveryTimeout = await varIntToNumber(this.controlReader);
          break;
        case VERSION_SPECIFIC_PARAMETERS.MAX_CACHE_DURATION.KEY:
          ret.maxCacheDuration = await varIntToNumber(this.controlReader);
          break;
        default:
          const skip = await varIntToNumber(this.controlReader);
          ret[`unknown-${i}-${paramType}-${paramLength}`] = skip;
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
