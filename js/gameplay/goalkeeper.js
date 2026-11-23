import { clamp, norm } from '../utils/mathUtils.js';
export function goalkeeperSave(gk, ball, dt) {
  const goalZ = gk.attackSign > 0 ? 16.1 : -16.1;
  const targetX = clamp(ball.x * .34, -1.45, 1.45);
  gk.x += clamp(targetX - gk.x, -4.8 * dt, 4.8 * dt);
  gk.z = goalZ;
  const incoming = Math.sign(ball.z - goalZ) === -Math.sign(ball.vz);
  if (Math.abs(ball.z - goalZ) < 1.15 && Math.abs(ball.x - gk.x) < .95 && Math.abs(ball.vz) > 2 && incoming) {
    const away = norm(ball.x - gk.x, goalZ - ball.z);
    ball.vx = away.x * Math.max(3, Math.abs(ball.vz) * .48);
    ball.vz = Math.sign(goalZ) * Math.max(3.5, Math.abs(ball.vz) * .58);
    return true;
  }
  return false;
}
