import { movePlayer } from '../gameplay/playerController.js';

/** Replays unacknowledged local movement over the latest authoritative player state. */
export class InputReconciler {
  constructor({ maxPending = 120 } = {}) {
    this.maxPending = Math.max(1, Math.min(300, Math.floor(maxPending)));
    this.pending = [];
    this.lastAck = 0;
    this.lastSeq = 0;
  }

  record(seq, input, dt) {
    if (!Number.isSafeInteger(seq) || seq <= this.lastSeq || !input || !Number.isFinite(dt) || dt <= 0) return false;
    // Never discard an older unacknowledged input: doing so would make replay incomplete.
    if (this.pending.length >= this.maxPending) return false;
    this.pending.push({ seq, input: { ...input, direction: input.direction ? { ...input.direction } : undefined }, dt: Math.min(dt, 1 / 20) });
    this.lastSeq = seq;
    return true;
  }

  reconcile(player, acknowledgedSeq) {
    if (!player || !Number.isSafeInteger(acknowledgedSeq) || acknowledgedSeq < this.lastAck || acknowledgedSeq > this.lastSeq) return false;
    this.lastAck = Math.max(this.lastAck, acknowledgedSeq);
    this.pending = this.pending.filter(item => item.seq > this.lastAck);
    for (const item of this.pending) movePlayer(player, item.input, item.dt, !!item.input.sprint);
    return true;
  }

  reset() { this.pending.length = 0; this.lastAck = 0; this.lastSeq = 0; }
  get pendingCount() { return this.pending.length; }
}
