export class PeerManager {
  constructor() {
    this.peer = null; this.conn = null; this.role = null; this.handlers = {};
    this.remoteReady = false; this._seq = 0; this.remoteId = null;
    this.reconnectPromise = null; this._lifecycleId = 0;
  }
  on(type, fn) { if (!this.handlers[type]) this.handlers[type] = new Set(); this.handlers[type].add(fn); return () => this.off(type, fn); }
  off(type, fn) { this.handlers[type]?.delete(fn); }
  emit(type, data) { for (const fn of [...(this.handlers[type] || [])]) fn(data); }
  async loadPeerConstructor(timeoutMs = 12000) {
    let timer;
    try {
      const module = await Promise.race([
        import('https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.esm.js'),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Timeout memuat library PeerJS dari CDN. Periksa koneksi atau pemblokir konten.')), timeoutMs); })
      ]);
      return module.Peer;
    } finally { clearTimeout(timer); }
  }
  async create({ timeoutMs = 15000 } = {}) {
    this.close();
    const lifecycleId = ++this._lifecycleId;
    const Peer = await this.loadPeerConstructor();
    if (this._lifecycleId !== lifecycleId) throw new Error('Pembuatan room dibatalkan.');
    this.peer = new Peer();
    const peer = this.peer;
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (error) {
          if (this.peer === peer) this.close();
          reject(error instanceof Error ? error : new Error(error?.message || 'PeerJS gagal membuat room.'));
        } else resolve(value);
      };
      const timeout = setTimeout(() => finish(new Error('Timeout membuat room: signaling server tidak memberikan Peer ID dalam 15 detik.')), Math.max(3000, timeoutMs));
      peer.on('open', id => {
        if (this._lifecycleId !== lifecycleId || this.peer !== peer) return finish(new Error('Pembuatan room dibatalkan karena sesi berubah.'));
        this.role = 'host'; this._seq = 0; finish(null, id);
      });
      peer.on('connection', c => {
        if (this.peer !== peer || this.conn) { c.close(); this.emit('status', 'Room penuh: hanya satu guest yang didukung.'); return; }
        this.attach(c);
      });
      peer.on('error', error => finish(error || new Error('PeerJS signaling error.')));
      peer.on('disconnected', () => this.emit('status', 'Signaling disconnected'));
    });
  }
  async join(hostId, { timeoutMs = 15000 } = {}) {
    if (typeof hostId !== 'string' || !hostId.trim() || hostId.length > 128) throw new Error('Peer ID tidak valid.');
    this.close();
    const lifecycleId = ++this._lifecycleId;
    const Peer = await this.loadPeerConstructor();
    if (this._lifecycleId !== lifecycleId) throw new Error('Join dibatalkan.');
    this.peer = new Peer();
    const peer = this.peer;
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error, value) => {
        if (settled) return;
        settled = true; clearTimeout(timeout);
        if (error) { if (this.peer === peer) this.close(); reject(error instanceof Error ? error : new Error(error?.message || 'Gagal terhubung ke host.')); }
        else resolve(value);
      };
      const timeout = setTimeout(() => finish(new Error('Timeout join: signaling atau koneksi ke host tidak merespons.')), Math.max(3000, timeoutMs));
      peer.on('open', () => {
        if (this._lifecycleId !== lifecycleId || this.peer !== peer) return finish(new Error('Join dibatalkan karena sesi berubah.'));
        this.role = 'guest'; this._seq = 0; this.remoteId = hostId.trim();
        this.conn = peer.connect(this.remoteId, { reliable: true });
        const connection = this.conn;
        this.attach(connection);
        connection.on('open', () => finish(null, true));
        connection.on('error', error => finish(error || new Error('Koneksi guest gagal.')));
        connection.on('close', () => { if (!settled) finish(new Error('Koneksi host ditutup sebelum terbuka.')); });
      });
      peer.on('error', error => finish(error || new Error('PeerJS signaling error.')));
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
