export class PeerManager {
  constructor() {
    this.peer = null; this.conn = null; this.role = null; this.handlers = {};
    this.remoteReady = false; this._seq = 0; this.remoteId = null;
    this.reconnectPromise = null; this._lifecycleId = 0;
  }
  on(type, fn) { this.handlers[type] = fn; }
  emit(type, data) { this.handlers[type]?.(data); }
  async create() {
    this._lifecycleId++;
    const { Peer } = await import('https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.esm.js');
    this.peer = new Peer();
    return new Promise((resolve, reject) => {
      this.peer.on('open', id => { this.role = 'host'; this._seq = 0; resolve(id); });
      this.peer.on('connection', c => {
        if (this.conn) { c.close(); this.emit('status', 'Room penuh: hanya satu guest yang didukung.'); return; }
        this.attach(c);
      });
      this.peer.on('error', reject);
      this.peer.on('disconnected', () => this.emit('status', 'Signaling disconnected'));
    });
  }
  async join(hostId) {
    if (typeof hostId !== 'string' || !hostId.trim() || hostId.length > 128) throw new Error('Peer ID tidak valid.');
    this._lifecycleId++;
    const { Peer } = await import('https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.esm.js');
    this.peer = new Peer();
    return new Promise((resolve, reject) => {
      this.peer.on('open', () => {
        this.role = 'guest'; this._seq = 0; this.remoteId = hostId.trim(); this.conn = this.peer.connect(this.remoteId, { reliable: true }); this.attach(this.conn);
        this.conn.on('open', () => resolve(true)); this.conn.on('error', reject);
      });
      this.peer.on('error', reject);
    });
  }
  async reconnect({ timeoutMs = 10000 } = {}) {
    if (this.reconnectPromise) return this.reconnectPromise;
    if (!this.peer || this.role !== 'guest' || !this.remoteId) return false;
    if (this.conn?.open) return true;
    const lifecycleId = this._lifecycleId;
    const attempt = this._reconnect(timeoutMs, lifecycleId);
    this.reconnectPromise = attempt;
    try { return await attempt; }
    finally { if (this.reconnectPromise === attempt) this.reconnectPromise = null; }
  }
  async _reconnect(timeoutMs, lifecycleId) {
    if (this.peer.disconnected) this.peer.reconnect();
    const connection = this.peer.connect(this.remoteId, { reliable: true });
    this.attach(connection);
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error, value = false) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (error) reject(error); else resolve(value);
      };
      const timeout = setTimeout(() => {
        if (this.conn === connection) this.conn = null;
        connection.close();
        finish(new Error('Reconnect timeout.'));
      }, Math.max(1000, Math.min(30000, timeoutMs)));
      connection.on('open', () => {
        if (this._lifecycleId !== lifecycleId || this.conn !== connection) {
          finish(new Error('Reconnect dibatalkan karena sesi telah berubah.'));
          return;
        }
        finish(null, true);
      });
      connection.on('error', error => finish(error || new Error('Reconnect failed.')));
      connection.on('close', () => finish(new Error('Reconnect closed before opening.')));
    });
  }
  attach(connection) {
    this.conn = connection;
    connection.on('open', () => { if (this.conn === connection) this.emit('status', 'Peer connected'); });
    connection.on('data', message => { if (this.conn === connection) this.emit('message', message); });
    connection.on('close', () => {
      if (this.conn !== connection) return;
      this.conn = null;
      this.emit('status', 'Peer disconnected');
    });
    connection.on('error', error => {
      if (this.conn === connection) this.emit('status', `Peer error: ${error.type || error.message}`);
    });
  }
  send(type, payload) {
    if (!this.conn?.open) return false;
    const seq = ++this._seq;
    this.conn.send({ type, payload, ts: Date.now(), seq });
    return seq;
  }
  close() {
    this._lifecycleId++;
    try { this.conn?.close(); this.peer?.destroy(); }
    catch (error) { console.warn('Peer cleanup', error); }
    this.conn = this.peer = null; this.role = null; this._seq = 0; this.remoteReady = false; this.remoteId = null; this.reconnectPromise = null;
  }
}
