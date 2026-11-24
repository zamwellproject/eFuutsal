export class RoomManager {
  constructor(peer) { this.peer = peer; this.ready = false; this.remoteReady = false; }
  async create(options = {}) { this.resetReadyState(); return this.peer.create(options); }
  async join(id, options = {}) { this.resetReadyState(); return this.peer.join(id, options); }
  setReady(value) { this.ready = !!value; this.peer.send('ready', { ready: this.ready }); }
  resetReadyState() { this.ready = false; this.remoteReady = false; }
  leave() { this.peer.close(); this.resetReadyState(); }
}
