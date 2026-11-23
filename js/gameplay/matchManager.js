import { SetPiece } from './setPieces.js';
import { registerFoul } from './futsalRules.js';
import { stepBall, kick, resolvePlayerBallCollision } from './ballPhysics.js';
import { movePlayer } from './playerController.js';
import { updateAI } from './aiController.js';
import { clamp, dist2, norm } from '../utils/mathUtils.js';

const HALF_COURT_Z = 17.55;
const PLAYER_ROLES = ['Anchor', 'Pivot', 'Flank Kanan', 'Flank Kiri', 'Goalkeeper'];
const makeStats = () => ({ shots: 0, onTarget: 0, passes: 0, completed: 0, saves: 0, possession: 0, tackles: 0, interceptions: 0, goals: 0, turnovers: 0, fouls: 0, scorers: [] });

export class MatchManager {
  constructor({ home, away, duration = 3, difficulty = 'Normal', onEvent }) {
    this.teams = [home, away];
    // User-selected duration is the TOTAL match length; each half gets half.
    this.duration = clamp(Number(duration) || 3, 3, 7) * 30;
    this.remaining = this.duration;
    this.half = 1;
    this.score = [0, 0];
    this.fouls = [0, 0];
    this.stats = [makeStats(), makeStats()];
    this.difficulty = difficulty;
    this.onEvent = onEvent || (() => {});
    this.ball = { x: 0, z: 0, vx: 0, vz: 0, spin: 0 };
    this.controlled = home.find(p => p.human) || home.find(p => !p.gk) || home[0];
    // In a two-peer room the guest controls one outfield player on team 1.
    this.remoteControlled = away.find(p => !p.gk) || null;
    if (this.remoteControlled) this.remoteControlled.networkHuman = true;
    this.owner = null;
    this.lastTouch = 0;
    this.lastTouchPlayer = null;
    this.pendingPass = null;
    this.tackleCooldown = 0;
    this.keeperPossessionTime = 0;
    this.keeperPossessionId = null;
    this.keeperReleasedTeam = null;
    this.elapsed = 0;
    this.finished = false;
    this.events = [];
    this.possessionTeam = 0;
    this.attackSigns = [1, -1];
    this.restart = null;
    this.kickoffTeam = 0;
    this.startRestart('KICKOFF', 0, 0, 0);
  }

  emit(type, payload = {}) {
    this.events.push({ type, time: this.elapsed, half: this.half, ...payload });
    this.onEvent(type, payload);
  }

  startRestart(type, team, x, z) {
    this.owner = null;
    this.keeperPossessionTime = 0;
    this.keeperPossessionId = null;
    this.keeperReleasedTeam = null;
    this.restart = new SetPiece(type, team, clamp(x, -9.3, 9.3), clamp(z, -17.2, 17.2));
    this.ball.x = this.restart.x; this.ball.z = this.restart.z;
    this.ball.vx = this.ball.vz = this.ball.spin = 0;
    this.emit('restart', this.restart);
  }

  update(dt, input = {}, remoteInput = null) {
    if (this.finished || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 1 / 20);
    if (this.restart?.active) {
      this.restart.tick(dt);
      const restartInput = this.restart.team === 1 && remoteInput ? remoteInput : input;
      if (this.restart.wait <= 0 && (restartInput.pass || restartInput.shoot)) {
        const dir = restartInput.direction || { x: 0, z: this.restart.team === 0 ? -1 : 1 };
        this.restart.execute(this.ball, dir.x, dir.z, restartInput.shoot ? 10 : 7.5);
        this.lastTouch = this.restart.team;
        this.possessionTeam = this.restart.team;
        this.emit('restart-executed', { type: this.restart.type, team: this.restart.team });
      }
      return;
    }

    this.elapsed += dt;
    this.remaining = Math.max(0, this.remaining - dt);
    if (this.remaining <= 0) {
      if (this.half === 1) {
        this.half = 2; this.remaining = this.duration; this.fouls = [0, 0];
        this.attackSigns = this.attackSigns.map(v => -v);
        for (let ti = 0; ti < 2; ti++) for (const p of this.teams[ti]) {
          p.z = clamp(-p.z, -16.8, 16.8); p.vx = p.vz = 0;
        }
        this.emit('halftime');
        this.startRestart('KICKOFF', 1, 0, 0);
      } else {
        this.finished = true; this.emit('fulltime', { score: this.score.slice() });
      }
      return;
    }

    const home = this.teams[0], away = this.teams[1];
    movePlayer(this.controlled, input, dt, !!input.sprint);
    if (this.remoteControlled && remoteInput) movePlayer(this.remoteControlled, remoteInput, dt, !!remoteInput.sprint);
    for (const team of this.teams) for (const p of team) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) { p.x = 0; p.z = p.gk ? p.attackSign * 15 : 0; }
      if (!Number.isFinite(p.vx)) p.vx = 0;
      if (!Number.isFinite(p.vz)) p.vz = 0;
    }

    this.acquirePossession();
    this.tackleCooldown = Math.max(0, this.tackleCooldown - dt);
    const context = {
      carrier: this.owner,
      onSave: keeper => { const ti = this.teams[0].includes(keeper) ? 0 : 1; this.stats[ti].saves++; this.lastTouch = ti; this.lastTouchPlayer = keeper.name; this.emit('save', { team: ti, player: keeper.name }); },
      onShot: (p) => { const ti = this.teams[0].includes(p) ? 0 : 1; this.stats[ti].shots++; if (Math.abs(this.ball.x + this.ball.vx * 1.35) < 1.55) this.stats[ti].onTarget++; this.lastTouch = ti; this.lastTouchPlayer = p.name; if (p.gk) this.keeperReleasedTeam = ti; this.owner = null; this.emit('shot', { team: ti, player: p.name }); },
      onPass: (p, target) => { const ti = this.teams[0].includes(p) ? 0 : 1; this.stats[ti].passes++; this.pendingPass = { team: ti, targetId: target.id, expires: this.elapsed + 3.5 }; this.lastTouch = ti; this.lastTouchPlayer = p.name; if (p.gk) this.keeperReleasedTeam = ti; this.owner = null; this.emit('pass', { team: ti, from: p.name, to: target.name }); },
      onClearance: p => { const ti = this.teams[0].includes(p) ? 0 : 1; this.lastTouch = ti; this.lastTouchPlayer = p.name; this.keeperReleasedTeam = ti; this.pendingPass = null; this.owner = null; this.emit('keeper-clearance', { team: ti, player: p.name }); },
      onTackle: (p, target) => this.resolveTackle(p, target, true)
    };
    context.remotePlayer = this.remoteControlled;
    updateAI(home, away, this.ball, dt, this.difficulty, this.attackSigns[0], context);
    updateAI(away, home, this.ball, dt, this.difficulty, this.attackSigns[1], context);
    if (this.restart?.active) return;

    // Futsal goalkeeper four-second limit while controlling the ball in their own half.
    if (this.owner?.gk) {
      const keeperTeam = this.teams[0].includes(this.owner) ? 0 : 1;
      const inOwnHalf = this.owner.z * this.attackSigns[keeperTeam] > 0;
      if (inOwnHalf) {
        if (this.keeperPossessionId !== this.owner.id) {
          this.keeperPossessionId = this.owner.id;
          this.keeperPossessionTime = 0;
        }
        this.keeperPossessionTime += dt;
        if (this.keeperPossessionTime >= 4) {
          const spotX = this.owner.x, spotZ = this.owner.z;
          this.emit('keeper-four-seconds', { team: keeperTeam, player: this.owner.name });
          this.startRestart('FREEKICK', 1 - keeperTeam, spotX, spotZ);
          return;
        }
      } else {
        this.keeperPossessionId = null;
        this.keeperPossessionTime = 0;
      }
    } else {
      this.keeperPossessionId = null;
      this.keeperPossessionTime = 0;
    }

    // Human possession is kept close to the lead foot; AI releases it when it kicks.
    if (this.owner && Math.hypot(this.ball.vx, this.ball.vz) < 1.1) this.attachBall(this.owner);
    else if (this.owner && Math.hypot(this.ball.vx, this.ball.vz) >= 1.1) this.owner = null;

    // Player-to-player separation and player/ball collision response.
    const allPlayers = [...home, ...away];
    for (let i = 0; i < allPlayers.length; i++) {
      const p = allPlayers[i];
      for (let j = i + 1; j < allPlayers.length; j++) {
        const q = allPlayers[j], dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
        if (d > .001 && d < .72) {
          const push = (.72 - d) * .5;
          p.x = clamp(p.x - dx / d * push, -9, 9);
          p.z = clamp(p.z - dz / d * push, -17, 17);
          q.x = clamp(q.x + dx / d * push, -9, 9);
          q.z = clamp(q.z + dz / d * push, -17, 17);
        }
      }
      if (p !== this.owner) resolvePlayerBallCollision(p, this.ball);
    }

    if (!this.owner) {
      const result = stepBall(this.ball, dt);
      if (result === 'goal') this.handleGoal(Math.sign(this.ball.z));
      else if (result === 'touchline') {
        const team = 1 - this.lastTouch;
        this.startRestart('KICKIN', team, this.ball.x, clamp(this.ball.z, -17, 17));
      } else if (result === 'goal-line') this.handleGoalLine(Math.sign(this.ball.z));
      else this.acquirePossession();
    }
    if (this.owner) {
      const ti = this.teams[0].includes(this.owner) ? 0 : 1;
      this.possessionTeam = ti; this.stats[ti].possession += dt;
    }
  }

  resolveTackle(tackler, carrier, fromAI = false) {
    if (!tackler || !carrier || tackler === carrier || this.tackleCooldown > 0) return false;
    const tacklerTeam = this.teams[0].includes(tackler) ? 0 : 1;
    const carrierTeam = 1 - tacklerTeam;
    const distance = dist2(tackler, carrier);
    if (distance > 1.28) return false;
    this.tackleCooldown = fromAI ? 0.72 : 0.58;
    const defense = clamp((tackler.stats?.defense ?? 60) / 100, 0.25, 1);
    const dribbling = clamp((carrier.stats?.dribbling ?? 60) / 100, 0.25, 1);
    const cleanChance = clamp(0.48 + (defense - dribbling) * 0.48 - Math.max(0, distance - 0.72) * 0.12, 0.18, 0.82);
    if (Math.random() < cleanChance) {
      this.owner = tackler; this.lastTouch = tacklerTeam; this.lastTouchPlayer = tackler.name;
      this.pendingPass = null; this.stats[tacklerTeam].tackles++;
      if (carrierTeam !== tacklerTeam) this.stats[tacklerTeam].interceptions++;
      this.attachBall(tackler); this.emit('tackle', { team: tacklerTeam, player: tackler.name, won: true });
      return true;
    }
    if (distance < 0.92) {
      this.stats[tacklerTeam].fouls++;
      const foul = registerFoul(this.fouls, tacklerTeam, this.half);
      this.emit('foul', { team: tacklerTeam, player: tackler.name, victim: carrier.name, count: foul.count, secondPenalty: foul.secondPenalty });
      const ownGoalSign = this.attackSigns[tacklerTeam];
      const foulInsidePenaltyArea = Math.abs(carrier.x) <= 6 && carrier.z * ownGoalSign >= 11.55;
      if (foulInsidePenaltyArea) {
        this.startRestart('PENALTY', carrierTeam, 0, ownGoalSign * 11.55);
        this.emit('penalty-awarded', { team: carrierTeam, mark: 6, reason: 'foul-in-penalty-area' });
      } else if (foul.secondPenalty) {
        const spot = ownGoalSign * (17.55 - 10);
        this.startRestart('PENALTY', carrierTeam, 0, spot);
        this.emit('penalty-awarded', { team: carrierTeam, mark: 10, reason: 'accumulated-fouls' });
      } else this.startRestart('FREEKICK', carrierTeam, carrier.x, carrier.z);
    } else this.emit('tackle', { team: tacklerTeam, player: tackler.name, won: false });
    return false;
  }

  tackle(player = this.controlled) {
    if (this.finished || this.restart?.active || !player) return false;
    const teamIndex = this.teams[0].includes(player) ? 0 : this.teams[1].includes(player) ? 1 : -1;
    if (teamIndex < 0) return false;
    const opponents = this.teams[1 - teamIndex];
    const carrier = this.owner && opponents.includes(this.owner) ? this.owner : opponents.filter(p => !p.gk).sort((a, b) => dist2(a, player) - dist2(b, player))[0];
    if (!carrier) return false;
    return this.resolveTackle(player, carrier, false);
  }

  acquirePossession() {
    if (this.owner && this.teams.some(t => t.includes(this.owner))) return;
    const candidates = this.teams.flat().filter(p => !p.gk || Math.abs(this.ball.z - p.z) < 2.2);
    const nearest = candidates.reduce((best, p) => !best || dist2(p, this.ball) < dist2(best, this.ball) ? p : best, null);
    if (nearest && dist2(nearest, this.ball) < .82 && Math.hypot(this.ball.vx, this.ball.vz) < 3.2) {
      const previousTouch = this.lastTouch;
      const receivingTeam = this.teams[0].includes(nearest) ? 0 : 1;
      if (nearest.gk && this.keeperReleasedTeam === receivingTeam) {
        const spotX = nearest.x, spotZ = nearest.z;
        this.emit('keeper-backpass', { team: receivingTeam, player: nearest.name });
        this.startRestart('FREEKICK', 1 - receivingTeam, spotX, spotZ);
        return;
      }
      this.owner = nearest;
      this.lastTouch = receivingTeam;
      if (receivingTeam !== this.keeperReleasedTeam) this.keeperReleasedTeam = null;
      this.lastTouchPlayer = nearest.name;
      if (previousTouch !== this.lastTouch) this.stats[this.lastTouch].interceptions++;
      this.possessionTeam = this.lastTouch;
      if (this.pendingPass) {
        if (this.elapsed <= this.pendingPass.expires && this.lastTouch === this.pendingPass.team && nearest.id === this.pendingPass.targetId) this.stats[this.lastTouch].completed++;
        else if (this.lastTouch !== this.pendingPass.team) this.stats[this.pendingPass.team].turnovers++;
        this.pendingPass = null;
      }
      this.attachBall(nearest);
    }
  }

  attachBall(player) {
    const f = player.facing || { x: 0, z: player.gk ? -player.attackSign : -player.attackSign };
    this.ball.x = clamp(player.x + f.x * .58, -9.3, 9.3);
    this.ball.z = clamp(player.z + f.z * .58, -17.3, 17.3);
    this.ball.vx = (player.vx || 0) * .72;
    this.ball.vz = (player.vz || 0) * .72;
  }

  handleGoal(goalEndSign) {
    const scorer = goalEndSign === -this.attackSigns[0] ? 0 : 1;
    this.score[scorer]++;
    this.stats[scorer].goals++;
    if (this.lastTouchPlayer) this.stats[scorer].scorers.push(this.lastTouchPlayer);
    this.emit('goal', { team: scorer, score: this.score.slice(), scorer: this.lastTouchPlayer });
    this.startRestart('KICKOFF', 1 - scorer, 0, 0);
  }

  handleGoalLine(endSign) {
    // The team defending this goal receives clearance unless its last touch sent it out.
    const defendingTeam = this.attackSigns[0] === endSign ? 0 : 1;
    if (this.lastTouch === defendingTeam) {
      const attackingTeam = 1 - defendingTeam;
      const x = Math.sign(this.ball.x || 1) * 9.15;
      this.startRestart('CORNER', attackingTeam, x, endSign * 17.0);
    } else {
      this.startRestart('GOALKICK', defendingTeam, 0, endSign * 14.2);
    }
  }

  pass(through = false, direction = null, player = this.controlled) {
    if (this.finished || this.restart?.active || !player) return false;
    const teamIndex = this.teams[0].includes(player) ? 0 : this.teams[1].includes(player) ? 1 : -1;
    if (teamIndex < 0) return false;
    const p = player;
    const team = this.teams[teamIndex];
    const target = team.filter(q => q !== p && !q.gk).sort((a, b) => dist2(a, this.ball) - dist2(b, this.ball))[0];
    let d = direction && Math.hypot(direction.x, direction.z) > .15 ? norm(direction.x, direction.z) : target ? norm(target.x - p.x, target.z - p.z) : { x: 0, z: -1 };
    if (through) d = norm(d.x * 1.08, d.z * 1.12);
    const passing = clamp((p.stats?.passing ?? 65) / 100, .4, 1);
    const power = (through ? 9.2 : 7.1) * (.82 + passing * .18);
    kick(this.ball, d.x, d.z, power);
    if (p.gk) this.keeperReleasedTeam = teamIndex;
    this.owner = null; this.lastTouch = teamIndex; this.lastTouchPlayer = p.name;
    this.stats[teamIndex].passes++;
    this.pendingPass = target ? { team: teamIndex, targetId: target.id, expires: this.elapsed + 3.5 } : null;
    this.emit('pass', { team: teamIndex, player: p.name, through });
    return true;
  }

  shoot(power = 10, curve = 0, direction = null, player = this.controlled) {
    if (this.finished || this.restart?.active || !player) return false;
    const teamIndex = this.teams[0].includes(player) ? 0 : this.teams[1].includes(player) ? 1 : -1;
    if (teamIndex < 0) return false;
    const p = player;
    const goalZ = -this.attackSigns[teamIndex] * 18;
    let d = direction && Math.hypot(direction.x, direction.z) > .15 ? norm(direction.x, direction.z) : norm(-this.ball.x * .65, goalZ - this.ball.z);
    const shooting = clamp((p.stats?.shooting ?? 65) / 100, .4, 1);
    const pressure = this.teams[1 - teamIndex].filter(q => !q.gk).reduce((m, q) => Math.min(m, dist2(q, p)), 99);
    const accuracyPenalty = pressure < 1.5 ? .16 : pressure < 3 ? .08 : 0;
    const error = (1 - shooting + accuracyPenalty) * .9;
    d = norm(d.x + (Math.random() - .5) * error, d.z + (Math.random() - .5) * error);
    kick(this.ball, d.x, d.z, clamp(power, 5, 17), curve);
    if (p.gk) this.keeperReleasedTeam = teamIndex;
    this.owner = null; this.lastTouch = teamIndex; this.lastTouchPlayer = p.name;
    this.stats[teamIndex].shots++;
    if (Math.abs(this.ball.x + d.x * 3) < 1.8) this.stats[teamIndex].onTarget++;
    this.emit('shot', { team: teamIndex, player: p.name, power: clamp(power, 5, 17) });
    return true;
  }

  substitute(teamIndex, outgoingId, incomingPlayer) {
    if (this.finished || this.restart?.active || ![0, 1].includes(teamIndex) || !incomingPlayer) return null;
    const team = this.teams[teamIndex];
    const index = team.findIndex(p => p.id === outgoingId);
    if (index < 0 || team.some(p => p.id === incomingPlayer.id)) return null;
    const outgoing = team[index];
    const incomingIsKeeper = incomingPlayer.position === 'Goalkeeper' || incomingPlayer.gk === true;
    if (!!outgoing.gk !== incomingIsKeeper) return null;
    const replacement = { ...incomingPlayer, stats: incomingPlayer.attributes || incomingPlayer.stats || {}, gk: !!outgoing.gk,
      role: outgoing.role, slot: outgoing.slot, human: outgoing.human, x: outgoing.x, z: outgoing.z, vx: 0, vz: 0,
      facing: { ...(outgoing.facing || { x: 0, z: -outgoing.attackSign }) }, attackSign: outgoing.attackSign, mesh: null };
    if (this.owner === outgoing) { this.owner = replacement; this.attachBall(replacement); }
    if (this.controlled === outgoing) this.controlled = replacement;
    team[index] = replacement;
    this.emit('substitution', { team: teamIndex, outgoing: outgoing.name, incoming: replacement.name });
    return { outgoing, incoming: replacement };
  }

  switchPlayer() {
    const candidates = this.teams[0].filter(p => !p.gk);
    this.controlled = candidates.sort((a, b) => dist2(a, this.ball) - dist2(b, this.ball))[0] || this.controlled;
    this.teams[0].forEach(p => { p.human = p === this.controlled; });
    this.emit('switch', { player: this.controlled.name });
    return this.controlled;
  }

  applySnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.players) || snapshot.players.length !== 2 ||
        !snapshot.ball || !['x', 'z', 'vx', 'vz'].every(k => Number.isFinite(snapshot.ball[k]))) return false;
    const updates = [];
    for (let ti = 0; ti < 2; ti++) {
      if (!Array.isArray(snapshot.players[ti]) || snapshot.players[ti].length !== this.teams[ti].length) return false;
      for (const incoming of snapshot.players[ti]) {
        const player = this.teams[ti].find(p => p.id === incoming?.id);
        if (!player || !['x', 'z', 'vx', 'vz'].every(k => Number.isFinite(incoming[k]))) return false;
        updates.push([player, incoming]);
      }
    }
    if (snapshot.score && (!Array.isArray(snapshot.score) || snapshot.score.length !== 2 || !snapshot.score.every(Number.isFinite))) return false;
    if (snapshot.fouls && (!Array.isArray(snapshot.fouls) || snapshot.fouls.length !== 2 || !snapshot.fouls.every(Number.isFinite))) return false;
    if (snapshot.remaining !== undefined && !Number.isFinite(snapshot.remaining)) return false;
    for (const [player, incoming] of updates) Object.assign(player, { x: incoming.x, z: incoming.z, vx: incoming.vx, vz: incoming.vz });
    Object.assign(this.ball, { x: snapshot.ball.x, z: snapshot.ball.z, vx: snapshot.ball.vx, vz: snapshot.ball.vz });
    if (snapshot.score) this.score = snapshot.score.slice();
    if (snapshot.fouls) this.fouls = snapshot.fouls.slice();
    if (snapshot.remaining !== undefined) this.remaining = snapshot.remaining;
    if (Number.isFinite(snapshot.half)) this.half = snapshot.half;
    if (snapshot.stats && Array.isArray(snapshot.stats) && snapshot.stats.length === 2) this.stats = structuredClone(snapshot.stats);
    this.owner = snapshot.owner ? this.teams.flat().find(p => p.id === snapshot.owner) || null : null;
    this.restart = snapshot.restart ? { ...snapshot.restart, active: true } : null;
    if (snapshot.finished === true && !this.finished) { this.finished = true; this.emit('fulltime', { score: this.score.slice() }); }
    this.keeperPossessionTime = Number.isFinite(snapshot.keeperPossessionTime) ? snapshot.keeperPossessionTime : 0;
    this.keeperReleasedTeam = Number.isInteger(snapshot.keeperReleasedTeam) ? snapshot.keeperReleasedTeam : null;
    return true;
  }

  snapshot() {
    return {
      score: this.score.slice(), remaining: this.remaining, half: this.half, finished: this.finished,
      ball: { ...this.ball },
      players: this.teams.map(t => t.map(p => ({ id: p.id, x: p.x, z: p.z, vx: p.vx, vz: p.vz }))),
      fouls: this.fouls.slice(), stats: this.stats.map(s => ({ ...s, scorers: s.scorers.slice() })), owner: this.owner?.id || null,
      keeperPossessionTime: this.keeperPossessionTime, keeperReleasedTeam: this.keeperReleasedTeam,
      restart: this.restart?.active ? { type: this.restart.type, team: this.restart.team, wait: this.restart.wait } : null
    };
  }
}
