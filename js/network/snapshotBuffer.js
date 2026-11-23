const MAX_SNAPSHOTS = 32;

function validSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || !Number.isSafeInteger(snapshot.tick) || snapshot.tick < 0) return false;
  if (snapshot.inputAckSeq !== undefined && (!Number.isSafeInteger(snapshot.inputAckSeq) || snapshot.inputAckSeq < 0)) return false;
  if (!Array.isArray(snapshot.players) || snapshot.players.length !== 2) return false;
  if (!snapshot.players.every(team => Array.isArray(team) && team.length <= 5 && team.every(p =>
    p && typeof p.id === 'string' && p.id.length <= 64 &&
    ['x', 'z', 'vx', 'vz'].every(k => Number.isFinite(p[k]))))) return false;
  if (!snapshot.ball || !['x', 'z', 'vx', 'vz'].every(k => Number.isFinite(snapshot.ball[k]))) return false;
  return true;
}

const lerp = (a, b, t) => a + (b - a) * t;

/** Buffers host snapshots and interpolates remote entities at a delayed render tick. */
export class SnapshotBuffer {
  constructor({ maxSnapshots = MAX_SNAPSHOTS, interpolationDelay = 2 } = {}) {
    this.maxSnapshots = Math.max(2, Math.min(128, Math.floor(maxSnapshots)));
    this.interpolationDelay = Math.max(0, Math.min(10, interpolationDelay));
    this.snapshots = [];
    this.jitterMs = 0;
    this.lastArrival = null;
    this.adaptiveDelay = this.interpolationDelay;
  }

  push(snapshot, receivedAt = null) {
    if (!validSnapshot(snapshot)) return false;
    const last = this.snapshots.at(-1);
    if (last && snapshot.tick <= last.tick) return false;
    if (last && Number.isSafeInteger(last.inputAckSeq) && Number.isSafeInteger(snapshot.inputAckSeq) && snapshot.inputAckSeq < last.inputAckSeq) return false;
    if (receivedAt !== null && !Number.isFinite(receivedAt)) return false;
    if (receivedAt !== null && last && this.lastArrival !== null) {
      const tickDelta = Math.max(1, snapshot.tick - last.tick);
      const expectedMs = 100 * tickDelta;
      const deviation = Math.abs((receivedAt - this.lastArrival) - expectedMs);
      this.jitterMs = this.jitterMs * 0.8 + deviation * 0.2;
      this.adaptiveDelay = Math.max(this.interpolationDelay, Math.min(6, this.interpolationDelay + this.jitterMs / 100));
    }
    if (receivedAt !== null) this.lastArrival = receivedAt;
    this.snapshots.push(structuredClone(snapshot));
    if (this.snapshots.length > this.maxSnapshots) this.snapshots.splice(0, this.snapshots.length - this.maxSnapshots);
    return true;
  }

  sample(renderTick) {
    if (!this.snapshots.length || !Number.isFinite(renderTick)) return null;
    const target = renderTick - this.adaptiveDelay;
    if (this.snapshots.length === 1 || target <= this.snapshots[0].tick) return structuredClone(this.snapshots[0]);
    let rightIndex = this.snapshots.findIndex(s => s.tick >= target);
    if (rightIndex < 0) return structuredClone(this.snapshots.at(-1));
    const a = this.snapshots[rightIndex - 1], b = this.snapshots[rightIndex];
    const t = Math.max(0, Math.min(1, (target - a.tick) / (b.tick - a.tick)));
    const result = structuredClone(a);
    result.tick = target;
    result.ball = Object.fromEntries(['x', 'z', 'vx', 'vz'].map(k => [k, lerp(a.ball[k], b.ball[k], t)]));
    result.players = a.players.map((team, ti) => team.map((player, pi) => {
      const next = b.players[ti]?.[pi];
      if (!next || next.id !== player.id) return { ...player };
      return { ...player, ...Object.fromEntries(['x', 'z', 'vx', 'vz'].map(k => [k, lerp(player[k], next[k], t)])) };
    }));
    if (t >= 1) { result.score = b.score; result.remaining = b.remaining; result.half = b.half; result.fouls = b.fouls; result.owner = b.owner; result.restart = b.restart; result.inputAckSeq = b.inputAckSeq; }
    return result;
  }

  getDiagnostics() { return { bufferedSnapshots: this.snapshots.length, jitterMs: Math.round(this.jitterMs), interpolationDelayTicks: Number(this.adaptiveDelay.toFixed(2)) }; }

  clear() { this.snapshots.length = 0; this.jitterMs = 0; this.lastArrival = null; this.adaptiveDelay = this.interpolationDelay; }
}
