export class RoomManager {
  constructor(peer) { this.peer = peer; this.ready = false; this.remoteReady = false; }
  async create() { this.resetReadyState(); return this.peer.create(); }
  async join(id) { this.resetReadyState(); return this.peer.join(id); }
  setReady(value) { this.ready = !!value; this.peer.send('ready', { ready: this.ready }); }
  resetReadyState() { this.ready = false; this.remoteReady = false; }
  leave() { this.peer.close(); this.resetReadyState(); }
}
