import { formationTarget } from './teamFormation.js';
import { dist2, norm, clamp } from '../utils/mathUtils.js';
const LEVEL = { Easy: { speed: .82, think: 1.35, press: .55, risk: .24 }, Normal: { speed: 1, think: 1, press: 1, risk: .42 }, Hard: { speed: 1.08, think: .72, press: 1.18, risk: .58 }, Expert: { speed: 1.14, think: .48, press: 1.35, risk: .7 } };
function closest(players, point) { return players.filter(p => !p.gk).reduce((best, p) => !best || dist2(p, point) < dist2(best, point) ? p : best, null); }
function steer(p, target, dt, speedScale = 1) {
  const dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz);
  const speed = clamp((p.stats?.speed ?? 70) / 100, .4, 1) * 4.35 * speedScale;
  const desiredX = d > .18 ? dx / d * Math.min(speed, d * 3.2) : 0;
  const desiredZ = d > .18 ? dz / d * Math.min(speed, d * 3.2) : 0;
  const blend = Math.min(1, dt * 7);
  p.vx = (p.vx || 0) + (desiredX - (p.vx || 0)) * blend;
  p.vz = (p.vz || 0) + (desiredZ - (p.vz || 0)) * blend;
  p.x = clamp(p.x + p.vx * dt, -9, 9); p.z = clamp(p.z + p.vz * dt, -17, 17);
  if (Math.hypot(p.vx, p.vz) > .2) p.facing = norm(p.vx, p.vz);
}
function laneIsBlocked(p, target, opponents) {
  const vx = target.x - p.x, vz = target.z - p.z, len2 = vx * vx + vz * vz || 1;
  return opponents.some(o => { const t = clamp(((o.x - p.x) * vx + (o.z - p.z) * vz) / len2, 0, 1); return Math.hypot(o.x - (p.x + vx * t), o.z - (p.z + vz * t)) < .9; });
}

/** Selects a safe attacking outlet; attackSign is the team's defensive-end sign. */
export function choosePassingOutlet(player, teammates, opponents, attackSign) {
  const forwardSign = -attackSign;
  const candidates = teammates.filter(p => p !== player && !p.gk && !laneIsBlocked(player, p, opponents));
  return candidates.sort((a, b) => {
    const score = p => {
      const distance = Math.hypot(p.x - player.x, p.z - player.z);
      const forwardProgress = (p.z - player.z) * forwardSign;
      const lateralSeparation = Math.abs(p.x - player.x);
      return distance * .28 - forwardProgress * .72 + lateralSeparation * .035;
    };
    return score(a) - score(b);
  })[0] || null;
}

export function chooseGoalkeeperOutlet(keeper, teammates, opponents, attackSign) {
  const candidates = teammates.filter(p => p !== keeper && !p.gk && !laneIsBlocked(keeper, p, opponents));
  return candidates.sort((a, b) => {
    const score = p => Math.hypot(p.x - keeper.x, p.z - keeper.z) * .42 - (keeper.z - p.z) * attackSign * .38 - Math.abs(p.x) * .025;
    return score(a) - score(b);
  })[0] || null;
}
export function updateAI(team, opponents, ball, dt, difficulty = 'Normal', defendSign = 1, context = {}) {
  const cfg = LEVEL[difficulty] || LEVEL.Normal;
  const carrier = context.carrier || null;
  const teamHasBall = carrier && team.includes(carrier);
  const opponentHasBall = carrier && opponents.includes(carrier);
  const chaser = closest(team, teamHasBall ? carrier : ball);
  for (const p of team) {
    if (p.human || p === context.remotePlayer) continue;
    if (p.gk) {
      const goalZ = defendSign * 16.15;
      const target = { x: clamp(ball.x * .32, -1.35, 1.35), z: goalZ };
      steer(p, target, dt, cfg.speed * 1.02);
      p.x = clamp(p.x, -2.0, 2.0);
      if (p.saveCooldown > 0) p.saveCooldown = Math.max(0, p.saveCooldown - dt);
      const handling = clamp((p.stats?.gkHandling ?? 65) / 100, .35, 1);
      const reach = .62 + handling * .48;
      if ((p.saveCooldown || 0) <= 0 && Math.abs(ball.z - goalZ) < 1.15 && Math.abs(ball.x - p.x) < reach && Math.hypot(ball.vx, ball.vz) > 2.2) {
        ball.vx = (ball.x - p.x) * 3.4; ball.vz = -Math.sign(goalZ) * Math.max(3.5, Math.abs(ball.vz) * .58);
        p.saveCooldown = .7 - handling * .12; context.onSave?.(p);
      }
      if (carrier === p && (p.aiCooldown || 0) <= 0) {
        const outlet = chooseGoalkeeperOutlet(p, team, opponents, defendSign);
        if (outlet) {
          const d = norm(outlet.x - p.x, outlet.z - p.z);
          ball.vx = d.x * 8.2; ball.vz = d.z * 8.2; ball.spin = 0;
          p.aiCooldown = cfg.think * 1.5; context.onPass?.(p, outlet);
        } else {
          // No safe passing lane: clear toward the less crowded flank and advance.
          const leftPressure = opponents.filter(o => o.x < p.x).length;
          const rightPressure = opponents.length - leftPressure;
          const side = leftPressure <= rightPressure ? -1 : 1;
          const d = norm(side * .72, -defendSign);
          ball.vx = d.x * 10.5; ball.vz = d.z * 10.5; ball.spin = 0;
          p.aiCooldown = cfg.think * 1.8; context.onClearance?.(p);
        }
      }
      continue;
    }
    const base = formationTarget(p.slot, defendSign);
    const forward = -defendSign;
    let target = { x: base.x + clamp(ball.x * .16, -2.2, 2.2), z: base.z + clamp((ball.z - base.z) * .18, -3.0, 3.0) };
    if (opponentHasBall && p === chaser) {
      target = { x: ball.x - ball.vx * .12, z: ball.z - ball.vz * .12 };
      const challengeDistance = carrier ? dist2(p, carrier) : 99;
      if (carrier && challengeDistance < 1.18 && (p.tackleCooldown || 0) <= 0) {
        p.tackleCooldown = cfg.think * 0.9;
        context.onTackle?.(p, carrier);
      }
    } else if (teamHasBall) {
      if (p.slot === 1) target = { x: clamp(ball.x * .55, -5.2, 5.2), z: ball.z + forward * 3.2 };
      if (p.slot === 2 || p.slot === 3) target = { x: base.x * .9 + ball.x * .1, z: base.z + forward * 1.8 };
      if (p.slot === 0) target = { x: clamp(ball.x * .35, -3.2, 3.2), z: base.z + forward * 1.0 };
    } else if (!opponentHasBall && p === chaser) {
      target = { x: ball.x - ball.vx * .18, z: ball.z - ball.vz * .18 };
    }
    steer(p, target, dt, cfg.speed * (p === chaser && !teamHasBall ? cfg.press : 1));
    // Separation: keep teammates from occupying the same tactical point.
    for (const mate of team) if (mate !== p && !mate.gk) {
      const dx = p.x - mate.x, dz = p.z - mate.z, d = Math.hypot(dx, dz);
      if (d > .001 && d < .82) { p.x += dx / d * .35 * dt * 8; p.z += dz / d * .35 * dt * 8; }
    }
    if (p.aiCooldown > 0) p.aiCooldown = Math.max(0, p.aiCooldown - dt);
    if (p.tackleCooldown > 0) p.tackleCooldown = Math.max(0, p.tackleCooldown - dt);
    if (carrier === p && (p.aiCooldown || 0) <= 0) {
      const goal = { x: 0, z: -defendSign * 18 };
      const distance = Math.hypot(goal.x - p.x, goal.z - p.z);
      const shootingLane = !laneIsBlocked(p, goal, opponents);
      const shooting = distance < 13.8 && (shootingLane || distance < 9.5) && Math.abs(p.x) < 6.5;
      if (shooting || (distance < 8 && Math.abs(p.x) < 3.2)) {
        const dir = norm(goal.x - p.x, goal.z - p.z);
        const accuracy = clamp((p.stats?.shooting ?? 65) / 100, .45, .96);
        ball.vx = dir.x * (9.0 + accuracy * 3.2) + (Math.random() - .5) * (1 - accuracy) * 2.2;
        ball.vz = dir.z * (9.0 + accuracy * 3.2); ball.spin = 0;
        p.aiCooldown = cfg.think * 1.6; context.onShot?.(p, distance);
      } else {
        const mate = choosePassingOutlet(p, team, opponents, defendSign);
        if (mate && Math.random() < cfg.risk + .12) {
          const dir = norm(mate.x - p.x, mate.z - p.z);
          ball.vx = dir.x * 7.8; ball.vz = dir.z * 7.8; ball.spin = 0;
          p.aiCooldown = cfg.think * 1.2; context.onPass?.(p, mate);
        } else p.aiCooldown = .22;
      }
    }
  }
}
