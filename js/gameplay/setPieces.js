export const SET_PIECE_WAIT_SECONDS = 5;
export class SetPiece {
  constructor(type, team, x, z) {
    this.type = type; this.team = team; this.x = x; this.z = z;
    this.wait = SET_PIECE_WAIT_SECONDS; this.active = true;
  }
  tick(dt) { if (this.active) this.wait = Math.max(0, this.wait - Math.max(0, dt));
    if (this.wait < 1e-8) this.wait = 0; }
  execute(ball, dx, dz, power) {
    if (!this.active || this.wait > 0) return false;
    const length = Math.hypot(dx, dz) || 1;
    ball.x = this.x; ball.z = this.z;
    ball.vx = dx / length * Math.max(0, Math.min(18, power));
    ball.vz = dz / length * Math.max(0, Math.min(18, power));
    ball.spin = 0; this.active = false;
    return true;
  }
}
