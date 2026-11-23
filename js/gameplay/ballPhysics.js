import { clamp } from '../utils/mathUtils.js';
const COURT_X = 9.55, COURT_Z = 17.55, GOAL_HALF = 1.5;
export function stepBall(ball, dt) {
  const drag = Math.pow(0.986, dt * 60);
  ball.vx *= drag; ball.vz *= drag;
  if (ball.spin) ball.vx += clamp(ball.spin, -2, 2) * dt * Math.min(1, Math.hypot(ball.vx, ball.vz) / 8);
  ball.x += ball.vx * dt; ball.z += ball.vz * dt;
  ball.spin *= Math.pow(.96, dt * 60);
  // Goal is checked at the goal plane before the ball is clamped or bounced.
  if (Math.abs(ball.z) >= COURT_Z && Math.abs(ball.x) <= GOAL_HALF) return 'goal';
  if (Math.abs(ball.x) >= COURT_X) {
    ball.x = Math.sign(ball.x) * COURT_X;
    ball.vx = -ball.vx * .42;
    if (Math.abs(ball.vx) < .12) ball.vx = 0;
    return 'touchline';
  }
  if (Math.abs(ball.z) >= COURT_Z) {
    ball.z = Math.sign(ball.z) * COURT_Z;
    ball.vz = -ball.vz * .42;
    if (Math.abs(ball.vz) < .12) ball.vz = 0;
    return 'goal-line';
  }
  if (![ball.x, ball.z, ball.vx, ball.vz].every(Number.isFinite)) {
    ball.x = clamp(Number.isFinite(ball.x) ? ball.x : 0, -COURT_X, COURT_X);
    ball.z = clamp(Number.isFinite(ball.z) ? ball.z : 0, -COURT_Z, COURT_Z);
    ball.vx = ball.vz = ball.spin = 0;
    return 'recovered';
  }
  return '';
}
export function kick(ball, dx, dz, power, curve = 0) {
  const l = Math.hypot(dx, dz) || 1;
  const p = clamp(Number.isFinite(power) ? power : 0, 0, 18);
  ball.vx = dx / l * p; ball.vz = dz / l * p;
  ball.spin = clamp(curve, -2.5, 2.5);
}
export function resolvePlayerBallCollision(player, ball, radius = .68) {
  const dx = ball.x - player.x, dz = ball.z - player.z, d = Math.hypot(dx, dz);
  if (d <= 0 || d >= radius) return false;
  const nx = dx / d, nz = dz / d;
  const overlap = radius - d;
  ball.x += nx * overlap; ball.z += nz * overlap;
  const relative = (ball.vx - (player.vx || 0)) * nx + (ball.vz - (player.vz || 0)) * nz;
  if (relative < 0) { ball.vx -= 1.35 * relative * nx; ball.vz -= 1.35 * relative * nz; }
  return true;
}
