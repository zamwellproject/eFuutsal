const MAX_PACKET_BYTES = 64 * 1024;
const MAX_DEPTH = 8;

function isSafeValue(value, depth = 0) {
  if (depth > MAX_DEPTH) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 100 && value.every(item => isSafeValue(item, depth + 1));
  if (typeof value !== 'object') return false;
  const entries = Object.entries(value);
  return entries.length <= 100 && entries.every(([key, item]) => key.length <= 64 && isSafeValue(item, depth + 1));
}

function packetSize(value) {
  try { return new TextEncoder().encode(JSON.stringify(value)).length; }
  catch { return Infinity; }
}

export function normalizeNetworkInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const x = Number(input.x), z = Number(input.z);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  const direction = input.direction && typeof input.direction === 'object' ? input.direction : { x, z };
  const dx = Number(direction.x), dz = Number(direction.z);
  if (!Number.isFinite(dx) || !Number.isFinite(dz)) return null;
  return {
    x: Math.max(-1, Math.min(1, x)),
    z: Math.max(-1, Math.min(1, z)),
    sprint: !!input.sprint,
    pass: !!input.pass,
    shoot: !!input.shoot,
    through: !!input.through,
    tackle: !!input.tackle,
    direction: { x: Math.max(-1, Math.min(1, dx)), z: Math.max(-1, Math.min(1, dz)) }
  };
}

export class NetworkSync {
  constructor(peer, { onState, onInput, onReady, onSessionReady, role = peer?.role || null } = {}) {
    this.peer = peer;
    this.role = role;
    this.onState = onState;
    this.onInput = onInput;
    this.onReady = onReady;
    this.onSessionReady = onSessionReady;
    this.protocolVersion = 1;
    this.remoteHello = false;
    this.localHelloAck = false;
    this.sessionReady = false;
    this.helloSent = false;
    this.lastSeq = -1;
    this.lastStateTick = -1;
    this.receivedPackets = 0;
    this.sequenceGaps = 0;
    this.rejectedPackets = 0;
    this.lastMessageAt = 0;
    this.roundTripMs = null;
    this.lastPongAt = 0;
    this.lastPingAt = 0;
    this._messageHandler = message => this.receive(message);
    this._unsubscribeMessage = peer.on('message', this._messageHandler);
    this._disposed = false;
    this._sendHello();
  }

  /** Detaches this sync instance from the peer event stream. */
  dispose() {
    if (this._disposed) return false;
    this._disposed = true;
    if (typeof this._unsubscribeMessage === 'function') this._unsubscribeMessage();
    else this.peer.off?.('message', this._messageHandler);
    this.sessionReady = false;
    this.onSessionReady?.(false);
    return true;
  }

  /** Starts a fresh protocol session after a transport reconnect. Old session counters and acknowledgements are discarded. */
  resetSession() {
    if (this._disposed) return false;
    this.remoteHello = false;
    this.localHelloAck = false;
    this.sessionReady = false;
    this.helloSent = false;
    this.lastSeq = -1;
    this.lastStateTick = -1;
    this.receivedPackets = 0;
    this.sequenceGaps = 0;
    this.rejectedPackets = 0;
    this.lastMessageAt = 0;
    this.roundTripMs = null;
    this.lastPongAt = 0;
    this.lastPingAt = 0;
    this.onSessionReady?.(false);
    return this._sendHello();
  }


  _sendHello() {
    if (this.helloSent || !this.role) return false;
    const sent = this.peer.send('hello', { protocol: this.protocolVersion, role: this.role });
    if (sent === false) return false;
    this.helloSent = true;
    return true;
  }

  _updateSessionReady() {
    if (this.sessionReady || !this.remoteHello || !this.localHelloAck) return false;
    this.sessionReady = true;
    this.onSessionReady?.(true);
    return true;
  }

  receive(message) {
    if (this._disposed) return false;
    if (!message || typeof message !== 'object' || !Number.isSafeInteger(message.seq) || message.seq < 0 || message.seq <= this.lastSeq) { this.rejectedPackets++; return false; }
    if (!['hello', 'helloAck', 'input', 'state', 'ready', 'ping', 'pong'].includes(message.type)) { this.rejectedPackets++; return false; }
    const payload = message.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !isSafeValue(payload) || packetSize(payload) > MAX_PACKET_BYTES) { this.rejectedPackets++; return false; }
    if (message.type === 'hello' || message.type === 'helloAck') {
      if (this.sessionReady) { this.rejectedPackets++; return false; }
      const expectedRemoteRole = this.role === 'host' ? 'guest' : this.role === 'guest' ? 'host' : null;
      if (!expectedRemoteRole || payload.protocol !== this.protocolVersion || payload.role !== expectedRemoteRole) { this.rejectedPackets++; return false; }
      this._acceptSequence(message.seq);
      this.lastSeq = message.seq;
      if (message.type === 'hello') {
        this.remoteHello = true;
        this._sendHello();
        this.peer.send('helloAck', { protocol: this.protocolVersion, role: this.role });
      } else {
        this.localHelloAck = true;
      }
      this._updateSessionReady();
      return true;
    }
    if (!this.sessionReady) { this.rejectedPackets++; return false; }
    if (message.type === 'input') {
      if (this.role === 'guest') { this.rejectedPackets++; return false; }
      const input = normalizeNetworkInput(payload);
      if (!input) { this.rejectedPackets++; return false; }
      this._acceptSequence(message.seq);
      this.lastSeq = message.seq;
      this.onInput?.(input, { seq: message.seq });
      return true;
    }
    if (message.type === 'ready') {
      if (this.role !== 'host' || typeof payload.ready !== 'boolean') { this.rejectedPackets++; return false; }
      this._acceptSequence(message.seq);
      this.lastSeq = message.seq;
      this.onReady?.(payload.ready);
      return true;
    }
    if (message.type === 'ping') {
      if (!Number.isSafeInteger(payload.sentAt) || payload.sentAt < 0) { this.rejectedPackets++; return false; }
      this._acceptSequence(message.seq);
      this.lastSeq = message.seq;
      this.peer.send('pong', { sentAt: payload.sentAt });
      return true;
    }
    if (message.type === 'pong') {
      if (!Number.isSafeInteger(payload.sentAt) || payload.sentAt < 0) { this.rejectedPackets++; return false; }
      this._acceptSequence(message.seq);
      this.lastSeq = message.seq;
      this.roundTripMs = Math.max(0, Date.now() - payload.sentAt);
      this.lastPongAt = Date.now();
      return true;
    }
    if (this.role === 'host') { this.rejectedPackets++; return false; }
    if (!Number.isSafeInteger(payload.tick) || payload.tick < 0 || payload.tick <= this.lastStateTick) { this.rejectedPackets++; return false; }
    this.lastStateTick = payload.tick;
    this._acceptSequence(message.seq);
    this.lastSeq = message.seq;
    this.onState?.(payload);
    return true;
  }

  _acceptSequence(seq) {
    if (this.lastSeq >= 0 && seq > this.lastSeq + 1) this.sequenceGaps += seq - this.lastSeq - 1;
    this.receivedPackets++;
    this.lastMessageAt = Date.now();
  }

  ping(now = Date.now()) {
    if (!this.sessionReady || !Number.isSafeInteger(now) || now < 0 || now - this.lastPingAt < 1000) return false;
    const sent = this.peer.send('ping', { sentAt: now });
    if (sent === false) return false;
    this.lastPingAt = now;
    return true;
  }

  getDiagnostics(now = Date.now()) {
    const lastPongAgeMs = this.lastPongAt ? Math.max(0, now - this.lastPongAt) : null;
    const pendingHeartbeatAgeMs = this.lastPingAt && !this.lastPongAt ? Math.max(0, now - this.lastPingAt) : null;
    const heartbeatAgeMs = lastPongAgeMs ?? pendingHeartbeatAgeMs;
    return {
      receivedPackets: this.receivedPackets,
      sequenceGaps: this.sequenceGaps,
      rejectedPackets: this.rejectedPackets,
      lastMessageAgeMs: this.lastMessageAt ? Math.max(0, now - this.lastMessageAt) : null,
      roundTripMs: this.roundTripMs,
      lastPongAgeMs,
      heartbeatStale: heartbeatAgeMs !== null && heartbeatAgeMs > 3500,
      sessionReady: this.sessionReady,
      remoteHello: this.remoteHello
    };
  }

  sendInput(input) {
    if (!this.sessionReady || this.role === 'host') return false;
    const normalized = normalizeNetworkInput(input);
    if (!normalized) return false;
    const sent = this.peer.send('input', normalized);
    return sent === false ? false : (Number.isSafeInteger(sent) ? sent : true);
  }

  sendState(state) {
    if (!this.sessionReady || this.role === 'guest') return false;
    if (!state || typeof state !== 'object' || Array.isArray(state) || !isSafeValue(state) || packetSize(state) > MAX_PACKET_BYTES) return false;
    this.peer.send('state', state);
    return true;
  }
}
