import assert from 'node:assert/strict';
import { MatchManager } from '../js/gameplay/matchManager.js';
import { stepBall, kick } from '../js/gameplay/ballPhysics.js';
import { registerFoul, resetHalfFouls } from '../js/gameplay/futsalRules.js';
import { SetPiece } from '../js/gameplay/setPieces.js';
const makeTeam = (team, sign, human = false) => Array.from({ length: 5 }, (_, i) => ({
  id: `${team}-${i}`, name: `${team}${i}`, number: i + 1, slot: i, gk: i === 4,
  human: human && i === 1, x: [0, 0, 5, -5, 0][i], z: [5, -7, -2, -2, 15][i] * sign,
  vx: 0, vz: 0, facing: { x: 0, z: -sign }, attackSign: sign,
  stats: { speed: 75, shooting: 72, passing: 70, dribbling: 70, defense: 65, gkHandling: i === 4 ? 88 : 10 }
}));
const home = makeTeam('H', 1, true), away = makeTeam('A', -1);
const m = new MatchManager({ home, away, duration: 3, difficulty: 'Normal' });
assert.equal(m.remaining, 90, '3-minute total match must allocate 90 seconds per half');
assert.equal(m.restart.type, 'KICKOFF');
for (let i = 0; i < 300; i++) m.update(1 / 60, { x: 0, z: 0 });
assert.equal(m.restart.wait, 0, 'set piece countdown reaches zero');
assert.equal(m.restart.active, true, 'set piece must wait for player input');
m.update(1 / 60, { pass: true, direction: { x: 0, z: -1 } });
assert.equal(m.restart.active, false, 'set piece executes only after input');
assert.ok(Math.hypot(m.ball.vx, m.ball.vz) > 0, 'restart produces ball velocity');
const b = { x: 0, z: 16.0, vx: 0, vz: 20, spin: 0 };
assert.equal(stepBall(b, .1), 'goal', 'ball crossing goal mouth is a goal');
const shot = { x: 0, z: 0, vx: 0, vz: 0, spin: 0 }; kick(shot, 0, -1, 12, .8); assert.ok(shot.vz < -11);
const fouls = resetHalfFouls(); for (let i = 0; i < 4; i++) assert.equal(registerFoul(fouls, 0, 1).secondPenalty, false);
assert.equal(registerFoul(fouls, 0, 1).secondPenalty, true, 'fifth foul triggers second penalty');
const sp = new SetPiece('KICKIN', 0, 0, 0); assert.equal(sp.execute({}, 0, -1, 8), false, 'set piece cannot execute before five seconds');
console.log('Gameplay tests passed.');

// Deterministic match-clock test: no AI movement, but both halves must complete once restarts are taken.
const quietHome = makeTeam('QH', 1, true).map(p => ({ ...p, human: true }));
const quietAway = makeTeam('QA', -1).map(p => ({ ...p, human: true }));
const timed = new MatchManager({ home: quietHome, away: quietAway, duration: 3 });
for (let i = 0; i < 13000 && !timed.finished; i++) {
  const restartInput = timed.restart?.active && timed.restart.wait <= 0
    ? { pass: true, direction: { x: 0, z: -1 } }
    : { x: 0, z: 0 };
  timed.update(1 / 60, restartInput);
}
assert.equal(timed.finished, true, 'both halves finish using the match clock');
assert.ok(timed.events.some(e => e.type === 'halftime'), 'halftime event is emitted');
assert.deepEqual(timed.fouls, [0, 0], 'foul totals reset at halftime');

// AI carrier decision test: a clear close-range lane produces a real shot action.
import { updateAI, chooseGoalkeeperOutlet, choosePassingOutlet } from '../js/gameplay/aiController.js';
const aiTeam = makeTeam('AI', 1);
const defenders = makeTeam('OP', -1).map((p, i) => ({ ...p, x: 8, z: 10 + i }));
const carrier = aiTeam[1]; carrier.x = 0; carrier.z = -10; carrier.aiCooldown = 0;
const aiBall = { x: 0, z: -10, vx: 0, vz: 0, spin: 0 };
let aiShot = false;
updateAI(aiTeam, defenders, aiBall, 1 / 60, 'Normal', 1, { carrier, onShot: () => { aiShot = true; } });
assert.equal(aiShot, true, 'AI shoots when close to goal with a clear lane');
assert.ok(aiBall.vz < 0, 'AI shot travels toward the attacking goal');


// Attacking AI should prefer a forward safe outlet over a closer backward option.
const outletCarrier = { id: 'carrier', x: 0, z: -4, gk: false };
const backwardOutlet = { id: 'back', x: .2, z: -2.5, gk: false };
const forwardOutlet = { id: 'forward', x: 2.2, z: -8, gk: false };
const outletChoice = choosePassingOutlet(outletCarrier, [outletCarrier, backwardOutlet, forwardOutlet], [], 1);
assert.equal(outletChoice, forwardOutlet, 'AI prefers a safe forward outlet to a backward outlet');
const blockingDefender = { id: 'blocker', x: 1.1, z: -6, gk: false };
const blockedChoice = choosePassingOutlet(outletCarrier, [outletCarrier, forwardOutlet, backwardOutlet], [blockingDefender], 1);
assert.equal(blockedChoice, backwardOutlet, 'AI avoids a blocked forward passing lane');

console.log('Extended match and AI tests passed.');


// Defensive gameplay tests: force both clean and failed tackle outcomes.
const tackleHome = makeTeam('TH', 1, true), tackleAway = makeTeam('TA', -1);
const tackleMatch = new MatchManager({ home: tackleHome, away: tackleAway, duration: 3 });
tackleMatch.restart = null;
tackleMatch.controlled.x = 0; tackleMatch.controlled.z = 0;
const opponentCarrier = tackleMatch.teams[1][1]; opponentCarrier.x = 0.45; opponentCarrier.z = 0;
tackleMatch.owner = opponentCarrier;
const originalRandom = Math.random;
Math.random = () => 0;
assert.equal(tackleMatch.tackle(), true, 'clean tackle wins possession');
assert.equal(tackleMatch.owner, tackleMatch.controlled, 'tackler becomes ball owner');
assert.equal(tackleMatch.stats[0].tackles, 1, 'successful tackle is counted');

// A failed close challenge awards a free kick and increments the foul counter.
tackleMatch.owner = opponentCarrier;
tackleMatch.tackleCooldown = 0;
tackleMatch.controlled.x = 0; tackleMatch.controlled.z = 0;
opponentCarrier.x = 0.4; opponentCarrier.z = 0;
Math.random = () => 0.999;
assert.equal(tackleMatch.tackle(), false, 'failed challenge does not steal possession');
assert.equal(tackleMatch.fouls[0], 1, 'failed close challenge increments team fouls');
assert.equal(tackleMatch.restart.type, 'FREEKICK', 'first accumulated foul creates free kick');
assert.equal(tackleMatch.restart.team, 1, 'opponent receives the free kick');
Math.random = originalRandom;
console.log('Defensive gameplay tests passed.');


// The fifth accumulated foul must switch from a direct free kick to the 10 m mark.
const fifthHome = makeTeam('FH', 1, true), fifthAway = makeTeam('FA', -1);
const fifthMatch = new MatchManager({ home: fifthHome, away: fifthAway, duration: 3 });
fifthMatch.restart = null;
const fifthCarrier = fifthMatch.teams[1][1];
fifthMatch.controlled.x = 0; fifthMatch.controlled.z = 0;
fifthCarrier.x = 0.4; fifthCarrier.z = 0;
Math.random = () => 0.999;
for (let i = 1; i <= 5; i++) {
  fifthMatch.restart = null; fifthMatch.tackleCooldown = 0;
  fifthMatch.owner = fifthCarrier;
  fifthMatch.tackle();
  assert.equal(fifthMatch.fouls[0], i, `foul ${i} is accumulated`);
}
assert.equal(fifthMatch.restart.type, 'PENALTY', 'fifth foul produces second-penalty restart');
assert.equal(fifthMatch.restart.team, 1, 'attacking team receives second penalty');
assert.ok(Math.abs(Math.abs(fifthMatch.restart.z) - 7.55) < 1e-9, 'second penalty is placed 10 m from goal line');
Math.random = originalRandom;
console.log('Accumulated foul and second-penalty tests passed.');

// Goalkeeper four-second limit: holding the ball in the keeper's own half awards an indirect free kick.
const keeperHome = makeTeam('KH', 1, true), keeperAway = makeTeam('KA', -1).map(p => ({ ...p, human: true }));
const keeperMatch = new MatchManager({ home: keeperHome, away: keeperAway, duration: 3 });
keeperMatch.restart = null;
const homeKeeper = keeperMatch.teams[0].find(p => p.gk);
homeKeeper.x = 0; homeKeeper.z = 15; homeKeeper.aiCooldown = 100; keeperMatch.owner = homeKeeper;
for (let i = 0; i < 245 && !keeperMatch.restart?.active; i++) keeperMatch.update(1 / 60, { x: 0, z: 0 });
assert.equal(keeperMatch.restart?.type, 'FREEKICK', 'keeper holding beyond four seconds creates free kick');
assert.equal(keeperMatch.restart?.team, 1, 'opponent receives the goalkeeper infringement free kick');
assert.ok(keeperMatch.events.some(e => e.type === 'keeper-four-seconds'), 'goalkeeper infringement event is recorded');

// A foul inside the defending penalty area awards a penalty at the 6 m mark.
const boxHome = makeTeam('BH', 1, true), boxAway = makeTeam('BA', -1);
const boxMatch = new MatchManager({ home: boxHome, away: boxAway, duration: 3 });
boxMatch.restart = null;
boxMatch.controlled.x = 0; boxMatch.controlled.z = 12;
const boxCarrier = boxMatch.teams[1][1]; boxCarrier.x = .4; boxCarrier.z = 12;
boxMatch.owner = boxCarrier;
Math.random = () => .999;
boxMatch.tackle();
assert.equal(boxMatch.restart.type, 'PENALTY', 'foul inside penalty area creates penalty');
assert.ok(Math.abs(boxMatch.restart.z - 11.55) < 1e-9, 'penalty is placed at the 6 m mark');
assert.ok(boxMatch.events.some(e => e.type === 'penalty-awarded' && e.mark === 6), '6 m penalty is recorded');
Math.random = originalRandom;
console.log('Goalkeeper and 6 m penalty tests passed.');

// Rolling substitutions preserve the slot/control and reject incompatible roles or duplicate IDs.
const subHome = makeTeam('SH', 1, true), subAway = makeTeam('SA', -1);
const subMatch = new MatchManager({ home: subHome, away: subAway, duration: 3 });
subMatch.restart = null;
const outgoing = subMatch.controlled;
subMatch.owner = outgoing;
const benchForward = { id: 'bench-forward', name: 'Bench Forward', number: 21, position: 'Outfield', attributes: { speed: 80, passing: 75 } };
const subResult = subMatch.substitute(0, outgoing.id, benchForward);
assert.ok(subResult, 'valid outfield substitution succeeds');
assert.equal(subMatch.controlled, subResult.incoming, 'controlled player reference follows substitution');
assert.equal(subMatch.owner, subResult.incoming, 'ball owner reference follows substitution');
assert.equal(subResult.incoming.slot, outgoing.slot, 'replacement inherits court slot');
assert.equal(subResult.incoming.x, outgoing.x, 'replacement inherits court position');
assert.equal(subMatch.substitute(0, subResult.incoming.id, benchForward), null, 'duplicate active player is rejected');
const wrongRole = { id: 'bench-keeper', name: 'Bench Keeper', position: 'Goalkeeper', attributes: {} };
assert.equal(subMatch.substitute(0, subResult.incoming.id, wrongRole), null, 'goalkeeper cannot replace outfielder');
assert.equal(subMatch.substitute(0, 'SH-4', benchForward), null, 'outfielder cannot replace goalkeeper');
subMatch.restart = { active: true };
assert.equal(subMatch.substitute(0, subResult.incoming.id, { id: 'bench-forward-2', position: 'Outfield' }), null, 'substitution is blocked during restart');
console.log('Rolling substitution tests passed.');


// Goalkeeper second-touch restriction after releasing the ball.
const bpHome = makeTeam('BPH', 1, true), bpAway = makeTeam('BPA', -1).map(p => ({ ...p, human: true }));
const bpMatch = new MatchManager({ home: bpHome, away: bpAway, duration: 3 });
bpMatch.restart = null;
const bpKeeper = bpMatch.teams[0].find(p => p.gk);
bpKeeper.x = 0; bpKeeper.z = 15; bpMatch.keeperReleasedTeam = 0;
bpMatch.ball.x = 0; bpMatch.ball.z = 15; bpMatch.ball.vx = bpMatch.ball.vz = 0;
bpMatch.acquirePossession();
assert.equal(bpMatch.restart?.type, 'FREEKICK', 'keeper second touch after release awards indirect free kick');
assert.equal(bpMatch.restart?.team, 1, 'opponent receives the back-pass free kick');
assert.ok(bpMatch.events.some(e => e.type === 'keeper-backpass'), 'back-pass infringement is recorded');
console.log('Goalkeeper back-pass tests passed.');

// Goalkeeper distribution prefers a safe forward outlet and rejects blocked passing lanes.
const distributionKeeper = { x: 0, z: 14, gk: true };
const safeOutlet = { id: 'safe', x: 3, z: 5, gk: false };
const blockedOutlet = { id: 'blocked', x: -2, z: 2, gk: false };
const distributionOpponents = [{ x: -1, z: 8 }];
assert.equal(chooseGoalkeeperOutlet(distributionKeeper, [distributionKeeper, safeOutlet, blockedOutlet], distributionOpponents, 1), safeOutlet, 'keeper selects an unblocked outlet');
assert.equal(chooseGoalkeeperOutlet(distributionKeeper, [distributionKeeper, blockedOutlet], [{ x: -1, z: 8 }], 1), null, 'keeper reports no safe outlet when every lane is blocked');
console.log('Goalkeeper distribution tests passed.');


// Team identity normalization protects fixed team IDs and validates theme colors.
import { normalizeTeam } from '../js/core/storage.js';
const normalizedTeam = normalizeTeam({ id: 'EVR', name: '  EVR Custom  ', primary: '#12abef', accent: 'red' }, { id: 'EVR', name: 'EVERSION', primary: '#c4f35b', accent: '#17251a' });
assert.deepEqual(normalizedTeam, { id: 'EVR', name: 'EVR Custom', primary: '#12abef', accent: '#17251a' });
const fallbackTeam = normalizeTeam({ name: '   ', primary: 'not-a-color' }, { id: 'VDL', name: 'Vaedalation', primary: '#54b7e8', accent: '#10263a' });
assert.deepEqual(fallbackTeam, { id: 'VDL', name: 'Vaedalation', primary: '#54b7e8', accent: '#10263a' });
console.log('Admin and team customization tests passed.');


// Admin import validation is atomic, bounded and lineup-safe.
import { validateAdminImport } from '../js/utils/adminData.js';
import { defaults as defaultSave } from '../js/core/storage.js';
const validImport = defaultSave();
const acceptedImport = validateAdminImport(validImport);
assert.equal(acceptedImport.players.length, 17, 'valid save imports all default players');
assert.equal(acceptedImport.teams.length, 4, 'valid save retains all four official teams');
assert.throws(() => validateAdminImport({ ...validImport, players: [...validImport.players, { ...validImport.players[0] }] }), /ID pemain tidak boleh duplikat/);
assert.throws(() => validateAdminImport({ ...validImport, lineups: { ...validImport.lineups, EVR: ['missing', ...validImport.lineups.EVR.slice(1)] } }), /Pemain tidak tersedia/);
assert.throws(() => validateAdminImport({ ...validImport, teams: validImport.teams.slice(1) }), /tepat empat ID tim resmi/);
const boundedSettings = validateAdminImport({ ...validImport, settings: { volume: 8, camera: 'invalid' }, history: Array.from({ length: 600 }, (_, i) => i) });
assert.equal(boundedSettings.settings.volume, 1, 'imported volume is clamped');
assert.equal(boundedSettings.settings.camera, 'broadcast', 'unsupported camera mode falls back safely');
assert.equal(boundedSettings.history.length, 500, 'history is bounded to the latest 500 entries');
console.log('Admin import validation tests passed.');

// Network protocol rejects malformed/replayed packets and clamps remote controls.
import { NetworkSync, normalizeNetworkInput } from '../js/network/networkSync.js';
const networkHandlers = {};
const sentPackets = [];
const fakePeer = { role: 'host', on: (type, fn) => { networkHandlers[type] = fn; }, send: (type, payload) => { sentPackets.push({ type, payload }); return sentPackets.length; } };
let remoteInput = null, remoteInputMeta = null, remoteState = null, remoteReady = null;
const network = new NetworkSync(fakePeer, { onInput: (value, meta) => { remoteInput = value; remoteInputMeta = meta; }, onState: value => { remoteState = value; }, onReady: value => { remoteReady = value; } });
assert.equal(network.receive({ type: 'hello', seq: 1, payload: { protocol: 1, role: 'guest' } }), true, 'valid guest hello is accepted');
assert.equal(network.receive({ type: 'helloAck', seq: 2, payload: { protocol: 1, role: 'guest' } }), true, 'valid guest acknowledgement completes the handshake');
assert.equal(network.getDiagnostics().sessionReady, true, 'session becomes ready after mutual handshake');
assert.equal(network.receive({ type: 'hello', seq: 20, payload: { protocol: 1, role: 'guest' } }), false, 'handshake replay is rejected after session readiness');
assert.equal(network.receive({ type: 'input', seq: 3, payload: { x: 4, z: -4, direction: { x: 2, z: -2 }, sprint: true } }), true);
assert.deepEqual(remoteInput, { x: 1, z: -1, sprint: true, pass: false, shoot: false, through: false, tackle: false, direction: { x: 1, z: -1 } });
assert.deepEqual(remoteInputMeta, { seq: 3 }, 'host receives the sequence number for input acknowledgement');
assert.equal(network.receive({ type: 'input', seq: 3, payload: { x: 0, z: 0 } }), false, 'replayed sequence is rejected');
assert.equal(network.receive({ type: 'input', seq: 4, payload: { x: NaN, z: 0 } }), false, 'non-finite input is rejected');
assert.equal(network.receive({ type: 'ready', seq: 4, payload: { ready: true } }), true);
assert.equal(remoteReady, true);
network.role = 'guest';
assert.equal(network.receive({ type: 'state', seq: 5, payload: { tick: 1, score: [1, 0], remaining: 42 } }), true);
assert.deepEqual(remoteState, { tick: 1, score: [1, 0], remaining: 42 });
assert.equal(network.receive({ type: 'state', seq: 6, payload: { tick: 1, score: [9, 9] } }), false, 'duplicate authoritative snapshot tick is rejected');
assert.equal(network.receive({ type: 'state', seq: 7, payload: { tick: -1 } }), false, 'negative snapshot tick is rejected');
assert.ok(network.sendInput({ x: 5, z: 0 }), 'valid outgoing input is sent');
assert.equal(sentPackets.at(-1).payload.x, 1, 'outgoing input is clamped');
assert.equal(network.sendInput({ x: 'bad', z: 0 }), false, 'invalid outgoing input is blocked');
assert.equal(network.sendState({ unsafe: Infinity }), false, 'non-finite state is blocked');
network.role = 'host';
assert.equal(network.receive({ type: 'input', seq: 8, payload: { x: 0, z: 0 } }), true, 'later valid packet is accepted');
const networkDiagnostics = network.getDiagnostics();
assert.equal(networkDiagnostics.sequenceGaps, 2, 'sequence gaps are exposed as possible packet-loss/reorder diagnostics');
assert.equal(networkDiagnostics.receivedPackets, 6);
assert.ok(networkDiagnostics.rejectedPackets >= 2, 'rejected packet count is observable');
assert.equal(network.receive({ type: 'ping', seq: 9, payload: { sentAt: 1000 } }), true, 'valid heartbeat ping is accepted');
assert.equal(sentPackets.at(-1).type, 'pong', 'ping receives a pong response');
assert.equal(sentPackets.at(-1).payload.sentAt, 1000, 'pong echoes the sender timestamp');
assert.equal(network.receive({ type: 'pong', seq: 10, payload: { sentAt: Date.now() - 30 } }), true, 'valid heartbeat pong is accepted');
assert.ok(network.getDiagnostics().roundTripMs >= 0, 'round-trip time is exposed');
assert.equal(network.receive({ type: 'ping', seq: 11, payload: { sentAt: 'invalid' } }), false, 'malformed heartbeat is rejected');
assert.equal(network.ping(2000), true, 'heartbeat can be sent');
assert.equal(network.ping(2500), false, 'heartbeat is rate limited');
assert.equal(network.ping(3000), true, 'heartbeat can be sent after the interval');
const watchdogNow = Date.now();
assert.equal(network.getDiagnostics(watchdogNow + 4000).heartbeatStale, true, 'heartbeat is marked stale when no pong arrives within the watchdog window');
assert.equal(network.receive({ type: 'pong', seq: 12, payload: { sentAt: watchdogNow - 10 } }), true, 'a later pong is accepted');
assert.equal(network.getDiagnostics().heartbeatStale, false, 'a fresh pong clears stale heartbeat state');
const wrongRolePeer = { role: 'host', on() {}, send: () => 1 };
const wrongRoleSync = new NetworkSync(wrongRolePeer);
assert.equal(wrongRoleSync.receive({ type: 'hello', seq: 1, payload: { protocol: 99, role: 'guest' } }), false, 'unsupported protocol version is rejected');
assert.equal(wrongRoleSync.receive({ type: 'hello', seq: 2, payload: { protocol: 1, role: 'host' } }), false, 'same-role peer is rejected');
assert.equal(wrongRoleSync.receive({ type: 'input', seq: 1, payload: { x: 0, z: 0 } }), false, 'gameplay input is rejected before handshake');
assert.equal(wrongRoleSync.getDiagnostics().sessionReady, false, 'invalid handshake cannot activate a session');
// Reconnect session reset must clear prior readiness, replay/tick gates and diagnostics, then restart hello.
const resetPackets = [];
const resetPeer = { role: 'guest', on() {}, send: (type, payload) => { resetPackets.push({ type, payload }); return resetPackets.length; } };
const resetSync = new NetworkSync(resetPeer);
assert.equal(resetSync.receive({ type: 'hello', seq: 1, payload: { protocol: 1, role: 'host' } }), true);
assert.equal(resetSync.receive({ type: 'helloAck', seq: 2, payload: { protocol: 1, role: 'host' } }), true);
assert.equal(resetSync.sessionReady, true);
resetSync.lastStateTick = 50;
assert.equal(resetSync.resetSession(), true, 'reset starts hello for a new transport session');
assert.equal(resetSync.sessionReady, false, 'old readiness is invalidated on reconnect');
assert.equal(resetSync.lastSeq, -1, 'sequence acceptance restarts for the new protocol session');
assert.equal(resetSync.lastStateTick, -1, 'snapshot tick gate is cleared for new session');
assert.equal(resetPackets.at(-1).type, 'hello', 'reconnect sends a fresh hello');
assert.equal(resetSync.sendInput({ x: 1, z: 0 }), false, 'guest input is blocked until new handshake');
assert.equal(resetSync.receive({ type: 'hello', seq: 3, payload: { protocol: 1, role: 'host' } }), true);
assert.equal(resetSync.receive({ type: 'helloAck', seq: 4, payload: { protocol: 1, role: 'host' } }), true);
assert.equal(resetSync.sessionReady, true, 'new handshake can restore readiness');
console.log('Network protocol validation, handshake, heartbeat and diagnostics tests passed.');

// NetworkSync disposal removes old listeners so room changes cannot leak protocol handlers.
class SyncEventPeer {
  constructor() { this.handlers = new Map(); this.sent = []; }
  on(type, fn) { const set = this.handlers.get(type) || new Set(); set.add(fn); this.handlers.set(type, set); return () => set.delete(fn); }
  off(type, fn) { this.handlers.get(type)?.delete(fn); }
  send(type, payload) { this.sent.push({ type, payload }); return this.sent.length; }
  emit(type, data) { for (const fn of [...(this.handlers.get(type) || [])]) fn(data); }
}
const disposalPeer = new SyncEventPeer();
const disposalSync = new NetworkSync(disposalPeer, { role: 'guest' });
assert.equal(disposalPeer.handlers.get('message').size, 1, 'sync instance attaches one message listener');
assert.equal(disposalSync.dispose(), true, 'dispose detaches active listener');
assert.equal(disposalPeer.handlers.get('message').size, 0, 'disposed sync does not remain subscribed');
assert.equal(disposalSync.dispose(), false, 'dispose is idempotent');
assert.equal(disposalSync.receive({ type: 'hello', seq: 1, payload: { protocol: 1, role: 'host' } }), false, 'disposed sync rejects direct stale message handling');

import { RoomManager } from '../js/network/roomManager.js';
const roomPeer = { send: () => 1, close() {} };
const roomLifecycle = new RoomManager(roomPeer);
roomLifecycle.ready = true; roomLifecycle.remoteReady = true;
roomLifecycle.resetReadyState();
assert.equal(roomLifecycle.ready, false, 'session reset clears local ready state');
assert.equal(roomLifecycle.remoteReady, false, 'session reset clears remote ready state');
console.log('NetworkSync disposal and room readiness lifecycle tests passed.');

// Host/guest permissions and buffered interpolation for authoritative snapshots.
import { SnapshotBuffer } from '../js/network/snapshotBuffer.js';
const hostSent = [];
const hostPeer = { role: 'host', on() {}, send: (type, payload) => hostSent.push({ type, payload }) };
const hostSync = new NetworkSync(hostPeer);
assert.equal(hostSync.sendState({ tick: 0 }), false, 'host cannot publish state before handshake');
assert.equal(hostSync.receive({ type: 'hello', seq: 1, payload: { protocol: 1, role: 'guest' } }), true);
assert.equal(hostSync.receive({ type: 'helloAck', seq: 2, payload: { protocol: 1, role: 'guest' } }), true);
assert.equal(hostSync.sendInput({ x: 0, z: 0 }), false, 'host cannot submit guest input');
assert.equal(hostSync.sendState({ tick: 1, inputAckSeq: 7 }), true, 'host may publish authoritative state');
assert.equal(hostSent.at(-1).payload.inputAckSeq, 7, 'authoritative snapshots can acknowledge the latest guest input');
assert.equal(hostSync.receive({ type: 'state', seq: 3, payload: { tick: 1 } }), false, 'host rejects guest state authority');
assert.equal(hostSync.receive({ type: 'ready', seq: 3, payload: { ready: true } }), true, 'host accepts guest readiness');
const guestPeer = { role: 'guest', on() {}, send: (type, payload) => hostSent.push({ type, payload }) };
const guestSync = new NetworkSync(guestPeer);
assert.equal(guestSync.sendInput({ x: 0, z: 0 }), false, 'guest input is blocked before handshake');
assert.equal(guestSync.receive({ type: 'hello', seq: 1, payload: { protocol: 1, role: 'host' } }), true);
assert.equal(guestSync.receive({ type: 'helloAck', seq: 2, payload: { protocol: 1, role: 'host' } }), true);
assert.equal(guestSync.receive({ type: 'ready', seq: 3, payload: { ready: true } }), false, 'guest rejects host-originated ready packet');
assert.equal(guestSync.receive({ type: 'state', seq: 4, payload: { tick: 1 } }), true, 'guest accepts authoritative host snapshot');
assert.equal(guestSync.sendState({ tick: 1 }), false, 'guest cannot publish authoritative state');
assert.ok(guestSync.sendInput({ x: 0.2, z: -0.3 }), 'guest may submit normalized input');
const snapshot = (tick, x) => ({ tick, score: [0, 0], remaining: 90, half: 1,
  ball: { x, z: 0, vx: 2, vz: 0 },
  players: [[{ id: 'h1', x, z: 1, vx: 1, vz: 0 }], [{ id: 'a1', x: 2, z: 2, vx: 0, vz: 0 }]] });
const buffer = new SnapshotBuffer({ interpolationDelay: 0 });
assert.equal(buffer.push(snapshot(10, 0)), true);
assert.equal(buffer.push(snapshot(12, 4)), true);
assert.equal(buffer.push(snapshot(12, 8)), false, 'duplicate snapshot ticks are rejected');
assert.equal(buffer.push({ tick: 13, players: [] }), false, 'malformed snapshot is rejected');
const interpolated = buffer.sample(11);
assert.equal(interpolated.ball.x, 2, 'ball position interpolates between host snapshots');
assert.equal(interpolated.players[0][0].x, 2, 'player position interpolates between host snapshots');
buffer.clear();
assert.equal(buffer.sample(11), null, 'cleared buffer has no render state');
console.log('Authoritative networking and snapshot interpolation tests passed.');

// Network snapshot application: validate the whole payload before mutating the live match.
const replica = new MatchManager({ home: makeTeam('RH', 1, true), away: makeTeam('RA', -1), duration: 3 });
const authoritative = replica.snapshot();
authoritative.tick = 1;
authoritative.ball.x = 3.25;
authoritative.players[0][1].x = 4.5;
authoritative.score = [2, 1];
assert.equal(replica.applySnapshot(authoritative), true, 'valid host snapshot applies to guest replica');
assert.equal(replica.ball.x, 3.25);
assert.equal(replica.teams[0][1].x, 4.5);
assert.deepEqual(replica.score, [2, 1]);
const invalidSnapshot = structuredClone(authoritative);
invalidSnapshot.players[1][0].id = 'unknown-player';
assert.equal(replica.applySnapshot(invalidSnapshot), false, 'unknown player rejects entire snapshot');
assert.equal(replica.ball.x, 3.25, 'rejected snapshot does not partially mutate the match');
const applyBuffer = new SnapshotBuffer({ interpolationDelay: 0 });
assert.equal(applyBuffer.push(authoritative), true);
const later = structuredClone(authoritative); later.tick = 2; later.ball.x = 5.25;
assert.equal(applyBuffer.push(later), true);
assert.equal(applyBuffer.push(later), false, 'duplicate snapshot tick is rejected');
assert.equal(applyBuffer.sample(1.5).ball.x, 4.25, 'buffer interpolates ball position between host snapshots');
console.log('Network snapshot integration tests passed.');


// Guest-owned outfield player is moved by host simulation and excluded from AI steering.
const remoteMatch = new MatchManager({ home: makeTeam('NH', 1, true), away: makeTeam('NA', -1), duration: 3 });
const guestPlayer = remoteMatch.remoteControlled;
assert.ok(guestPlayer && !guestPlayer.gk, 'a guest-controlled outfield player is assigned');
const remoteStartX = guestPlayer.x;
remoteMatch.restart = null; // begin deterministic open-play test
remoteMatch.update(0.05, { x: 0, z: 0 }, { x: 1, z: 0, sprint: false, direction: { x: 1, z: 0 } });
assert.ok(guestPlayer.x > remoteStartX, 'host applies guest movement to the assigned away player');
const guestPassesBefore = remoteMatch.stats[1].passes;
assert.equal(remoteMatch.pass(false, { x: 0, z: 1 }, guestPlayer), true, 'guest-controlled player can pass');
assert.equal(remoteMatch.stats[1].passes, guestPassesBefore + 1, 'guest pass is attributed to team 1');
const guestShotsBefore = remoteMatch.stats[1].shots;
assert.equal(remoteMatch.shoot(9, 0, { x: 0, z: 1 }, guestPlayer), true, 'guest-controlled player can shoot');
assert.equal(remoteMatch.stats[1].shots, guestShotsBefore + 1, 'guest shot is attributed to team 1');
console.log('Guest-controlled player simulation tests passed.');

// Bounded reconnect helper retries transient guest transport failures.
import { reconnectGuest } from '../js/network/connectionRecovery.js';
let reconnectAttempts = 0;
const reconnectPeer = { reconnect: async () => { reconnectAttempts++; return reconnectAttempts >= 2; } };
const reconnected = await reconnectGuest(reconnectPeer, { attempts: 3, baseDelay: 0, wait: async () => {} });
assert.equal(reconnected, true, 'reconnect helper succeeds after a transient failure');
assert.equal(reconnectAttempts, 2, 'reconnect helper stops after success');
let failedAttempts = 0;
const failedReconnect = await reconnectGuest({ reconnect: async () => { failedAttempts++; return false; } }, { attempts: 2, baseDelay: 0, wait: async () => {} });
assert.equal(failedReconnect, false, 'reconnect helper reports exhausted retries');
assert.equal(failedAttempts, 2, 'reconnect retries are bounded');
console.log('Network reconnection recovery tests passed.');

// Guest prediction replays only inputs not yet acknowledged by the host.
import { InputReconciler } from '../js/network/inputReconciler.js';
const reconciler = new InputReconciler();
const predictedPlayer = { x: 0, z: 0, vx: 0, vz: 0, stats: { speed: 75 }, facing: { x: 0, z: 1 } };
assert.equal(reconciler.record(1, { x: 1, z: 0, sprint: false }, 1 / 60), true);
assert.equal(reconciler.record(2, { x: 0, z: -1, sprint: true }, 1 / 60), true);
assert.equal(reconciler.record(2, { x: 1, z: 1 }, 1 / 60), false, 'duplicate input sequence is rejected');
assert.equal(reconciler.reconcile(predictedPlayer, 1), true);
assert.equal(reconciler.pendingCount, 1, 'acknowledged input is removed from replay queue');
assert.ok(predictedPlayer.z < 0, 'unacknowledged movement is replayed over authoritative position');
const beforeInvalidAck = { x: predictedPlayer.x, z: predictedPlayer.z };
assert.equal(reconciler.reconcile(predictedPlayer, -1), false, 'invalid acknowledgement is rejected');
assert.deepEqual({ x: predictedPlayer.x, z: predictedPlayer.z }, beforeInvalidAck, 'invalid ack does not mutate player');
reconciler.reset();
assert.equal(reconciler.pendingCount, 0, 'reset clears prediction history');
console.log('Guest input prediction and reconciliation tests passed.');

// Prediction queue remains complete under pressure and rejects impossible host acknowledgements.
const boundedReconciler = new InputReconciler({ maxPending: 2 });
assert.equal(boundedReconciler.record(1, { x: 1, z: 0 }, 1 / 60), true);
assert.equal(boundedReconciler.record(2, { x: 0, z: 1 }, 1 / 60), true);
assert.equal(boundedReconciler.record(3, { x: -1, z: 0 }, 1 / 60), false, 'full queue rejects newest prediction instead of dropping older history');
const boundedPlayer = { x: 0, z: 0, vx: 0, vz: 0, stats: { speed: 70 } };
assert.equal(boundedReconciler.reconcile(boundedPlayer, 3), false, 'ack beyond last sent input is rejected');
assert.equal(boundedReconciler.pendingCount, 2, 'invalid ack cannot clear pending input');
assert.equal(boundedReconciler.reconcile(boundedPlayer, 1), true);
assert.equal(boundedReconciler.pendingCount, 1);
console.log('Bounded prediction queue and acknowledgement validation tests passed.');

// Snapshot acknowledgements must be monotonic and ticks must be safe integers.
const strictBuffer = new SnapshotBuffer({ interpolationDelay: 0 });
const strictSnapshot = tick => ({ tick, inputAckSeq: tick, players: [[], []], ball: { x: 0, z: 0, vx: 0, vz: 0 } });
assert.equal(strictBuffer.push(strictSnapshot(1)), true);
assert.equal(strictBuffer.push({ ...strictSnapshot(2), inputAckSeq: 0 }), false, 'ack regression is rejected');
assert.equal(strictBuffer.push({ ...strictSnapshot(2), tick: 2.5 }), false, 'fractional tick is rejected');
const jitterBuffer = new SnapshotBuffer({ interpolationDelay: 2 });
const jitterSnapshot = tick => ({ tick, players: [[], []], ball: { x: 0, z: 0, vx: 0, vz: 0 } });
assert.equal(jitterBuffer.push(jitterSnapshot(1), 1000), true);
assert.equal(jitterBuffer.push(jitterSnapshot(2), 1100), true);
const stableDelay = jitterBuffer.getDiagnostics().interpolationDelayTicks;
assert.equal(jitterBuffer.push(jitterSnapshot(3), 1450), true);
assert.ok(jitterBuffer.getDiagnostics().interpolationDelayTicks > stableDelay, 'jitter increases interpolation buffer delay');
assert.ok(jitterBuffer.getDiagnostics().interpolationDelayTicks <= 6, 'adaptive delay remains bounded');
jitterBuffer.clear();
assert.equal(jitterBuffer.getDiagnostics().jitterMs, 0, 'clearing buffer resets jitter history');
console.log('Strict snapshot validation and adaptive jitter-buffer tests passed.');

// PeerManager ignores late lifecycle events from superseded transports.
import { PeerManager } from '../js/network/peerManager.js';
class FakeConnection {
  constructor() { this.handlers = {}; this.open = false; this.sent = []; }
  on(type, fn) { (this.handlers[type] ||= []).push(fn); }
  emit(type, value) { for (const fn of this.handlers[type] || []) fn(value); }
  close() { this.open = false; this.emit('close'); }
  send(value) { this.sent.push(value); }
}
const multiListenerPeer = new PeerManager();
let firstStatusListener = 0, secondStatusListener = 0;
multiListenerPeer.on('status', () => firstStatusListener++);
multiListenerPeer.on('status', () => secondStatusListener++);
multiListenerPeer.emit('status', 'test');
assert.equal(firstStatusListener, 1, 'status event supports multiple subscribers');
assert.equal(secondStatusListener, 1, 'later status subscriber does not replace earlier subscriber');
const lifecyclePeer = new PeerManager();
const lifecycleStatuses = [], lifecycleMessages = [];
lifecyclePeer.on('status', value => lifecycleStatuses.push(value));
lifecyclePeer.on('message', value => lifecycleMessages.push(value));
const oldTransport = new FakeConnection(), activeTransport = new FakeConnection();
lifecyclePeer.attach(oldTransport);
lifecyclePeer.attach(activeTransport);
oldTransport.emit('close');
oldTransport.emit('data', { stale: true });
assert.equal(lifecyclePeer.conn, activeTransport, 'late close from an old transport cannot clear the active connection');
assert.deepEqual(lifecycleStatuses, [], 'late close from an old transport cannot publish a false disconnect');
assert.deepEqual(lifecycleMessages, [], 'late data from an old transport is ignored');
activeTransport.emit('open');
activeTransport.emit('data', { current: true });
assert.deepEqual(lifecycleStatuses, ['Peer connected']);
assert.deepEqual(lifecycleMessages, [{ current: true }]);
activeTransport.close();
assert.equal(lifecyclePeer.conn, null, 'closing the active transport clears the current connection');
assert.deepEqual(lifecycleStatuses, ['Peer connected', 'Peer disconnected']);
console.log('Peer transport lifecycle regression tests passed.');

const reconnectManager = new PeerManager();
let transportAttempts = 0;
let reconnectConnection;
reconnectManager.peer = { disconnected: false, connect: () => { transportAttempts++; reconnectConnection = new FakeConnection(); return reconnectConnection; } };
reconnectManager.role = 'guest';
reconnectManager.remoteId = 'host-peer';
const reconnectOne = reconnectManager.reconnect({ timeoutMs: 1500 });
const reconnectTwo = reconnectManager.reconnect({ timeoutMs: 1500 });
assert.equal(transportAttempts, 1, 'concurrent reconnect requests share one transport attempt');
reconnectConnection.open = true;
reconnectConnection.emit('open');
assert.equal(await reconnectOne, true);
assert.equal(await reconnectTwo, true);
assert.equal(reconnectManager.conn, reconnectConnection, 'successful reconnect retains the active transport');

// Closing a room invalidates any in-flight reconnect; a late open cannot revive it.
const cancelledManager = new PeerManager();
let cancelledConnection;
cancelledManager.peer = { disconnected: false, connect: () => { cancelledConnection = new FakeConnection(); return cancelledConnection; }, destroy() {} };
cancelledManager.role = 'guest';
cancelledManager.remoteId = 'host-peer';
const cancelledReconnect = cancelledManager.reconnect({ timeoutMs: 1500 });
cancelledManager.close();
cancelledConnection.open = true;
cancelledConnection.emit('open');
await assert.rejects(cancelledReconnect, /(Reconnect closed|sesi telah berubah)/, 'late reconnect open is rejected after room close');
assert.equal(cancelledManager.conn, null, 'cancelled reconnect cannot restore a closed room connection');
assert.equal(cancelledManager.peer, null, 'room close clears the peer while reconnect settles');
console.log('Reconnect cancellation and session-generation tests passed.');


