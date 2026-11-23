import { clamp, norm } from '../utils/mathUtils.js';
export function movePlayer(p, input, dt, sprint = false) {
  const d = norm(input.x || 0, input.z || 0);
  const moving = Math.hypot(input.x || 0, input.z || 0) > .08;
  const speedStat = clamp((p.stats?.speed ?? 70) / 100, .35, 1);
  const speed = speedStat * (sprint ? 7.1 : 4.7);
  p.vx = moving ? d.x * speed : (p.vx || 0) * Math.pow(.001, dt);
  p.vz = moving ? d.z * speed : (p.vz || 0) * Math.pow(.001, dt);
  p.x = clamp(p.x + p.vx * dt, -9.0, 9.0);
  p.z = clamp(p.z + p.vz * dt, -17.0, 17.0);
  if (moving) p.facing = { x: d.x, z: d.z };
}
