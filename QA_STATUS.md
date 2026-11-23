# QA / Verification Status — Build 0.25.0

## Completed in this continuation
- [x] Reworked role-based AI positioning for Anchor, Pivot, Flanks and Goalkeeper.
- [x] Added difficulty profiles that change AI pace, pressure, decision interval and passing risk.
- [x] Added AI passing decisions, close-range shooting decisions and goalkeeper save/distribution behavior.
- [x] Added ball spin/curve force, drag, goal-mouth detection, boundary classification and finite-number recovery.
- [x] Added player-to-ball collision response and teammate/opponent separation.
- [x] Reworked possession acquisition so a pass can travel to a receiver instead of immediately snapping back to the passer.
- [x] Added event-driven shot/pass/save/goal statistics and receiver-confirmed completed passes.
- [x] Added halftime foul counter reset and a reusable accumulated-foul/second-penalty helper.
- [x] Kept kick-off/set-piece play input-gated after the five-second setup period.
- [x] Added Node test suite in `tests/gameplay.test.js` and `npm test` command.

## Automated checks performed
- [x] `npm test` passes, including restart gating, goal-mouth physics, ball kick power, fifth-foul threshold helper, match clock/halftime/fulltime, and AI close-range shooting.
- [x] All project JavaScript files pass syntax parsing (`node --check`).
- [x] All relative ES-module imports resolve to existing project files.
- [x] Initial roster remains 17 players and the required four teams remain present.

## Not verified in this environment
- [ ] Runtime browser launch / actual WebGL rendering.
- [ ] Actual desktop keyboard gameplay in Chrome/Firefox/Safari/Edge.
- [ ] Actual iOS Safari / Android Chrome touch behavior and orientation changes.
- [ ] PeerJS connection across real networks, TURN fallback, reconnect and latency behavior.
- [ ] Browser-level match balance and sustained FPS on mid-range phones.

## Still incomplete
- [ ] Full official foul detection, handball edge cases, accumulated-foul second-penalty placement/execution, penalty kick, substitution and goalkeeper four-second enforcement.
- [ ] All set-piece variants and exact official placement validation.
- [ ] Complete 5v5 two-peer authoritative network simulation, state reconciliation and robust reconnect.
- [ ] Extra-time, penalty shootout and Golden Ball Suit flow.
- [ ] Full 3D animation blending for run/kick/tackle/save.
- [ ] Complete audio playback and service-worker offline caching.
- [ ] Real-device and cross-browser QA.

## Important scope note
The bot match now has a stronger playable simulation foundation, but it is not yet a certified or fully rules-complete futsal simulation. Automated tests validate selected deterministic gameplay logic only; they do not replace browser/device playtesting.


## Build 0.3.0 — Defensive gameplay checkpoint

- [x] Manual tackle action wired to keyboard and touch controls.
- [x] AI pressure players can attempt tackles.
- [x] Tackle probability uses defender Defense and carrier Dribbling.
- [x] Close failed tackle can trigger one foul event with cooldown protection.
- [x] Fifth accumulated foul produces a second-penalty restart at 10 m.
- [x] Earlier fouls produce a free-kick restart.
- [x] Tackle, interception, and foul statistics are tracked.
- [x] Goalkeeper save reach uses GK Handling.
- [ ] Official foul taxonomy, handball, goalkeeper four-second rule, and full referee positioning remain incomplete.
- [ ] Real browser/device playtesting remains outstanding.

### Build 0.3.0 additional verification
- [x] Manual clean tackle test transfers possession and increments tackle statistics.
- [x] Failed close tackle test awards a direct free kick to the opponent.
- [x] Five sequential accumulated fouls test switches restart to the 10 m second-penalty mark.
- [x] AI tackle callback is connected to the match manager.
- [x] Goalkeeper save reach is influenced by GK Handling.
- [x] Desktop F/V and mobile TACKLE controls are wired.
- [ ] Tackling balance and foul frequency require playtesting in an actual browser.


## Build 0.4.0 — goalkeeper and penalty-area rules
- [x] Four-second goalkeeper possession limit in own half; opponent free kick.
- [x] Penalty-area foul awards a 6 m penalty.
- [x] Accumulated-foul penalty remains at 10 m.
- [x] Automated tests for goalkeeper infringement and 6 m penalty.
- [ ] Browser/WebGL and physical-device testing (not run).


## Build 0.6.0 — Goalkeeper back-pass restriction
- [x] Track goalkeeper release after pass or shot.
- [x] Detect same-team goalkeeper second touch before opponent touch.
- [x] Award indirect free kick to opponent and emit match event.
- [x] Automated back-pass regression test.
- [ ] Browser/WebGL and physical-device verification remains outstanding.


## Build 0.7.0 — AI goalkeeper distribution
- [x] Added deterministic safe-outlet selection using distance, forward progress and passing-lane obstruction.
- [x] AI goalkeeper uses the selected outlet when a safe lane exists.
- [x] If no safe outlet exists, goalkeeper clears toward the less crowded flank.
- [x] Clearance updates last-touch/back-pass tracking and emits `keeper-clearance`.
- [x] Automated tests cover an available safe outlet and the no-safe-outlet case.
- [x] `npm test` and JavaScript syntax checks pass.
- [ ] Browser/WebGL and physical-device verification remains outstanding.


## Build 0.8.0 — Admin & team identity
- [x] Editor nama dan warna tim untuk EVR, VDL, AWFA, dan ZVR.
- [x] Identitas tim dinormalisasi dan kompatibel dengan data tersimpan sebelumnya.
- [x] Ekspor/impor JSON membawa data tim, lineup, pengaturan, dan riwayat; impor memvalidasi ID tim serta batas jumlah pemain.
- [x] Penghapusan pemain membersihkan referensi lineup.
- [ ] Uji interaksi panel admin di browser nyata.


## Build 0.9.0 — Admin data integrity
- [x] JSON import is validated before replacing live data.
- [x] Imports require the four known team IDs exactly once.
- [x] Player IDs must be unique; names and jersey numbers are validated.
- [x] All four team lineups are checked for five valid unique players, one goalkeeper and four outfield players.
- [x] Imported settings are normalized and bounded; history is capped at 500 entries.
- [x] Import storage is written before live in-memory state is replaced.
- [x] Automated tests cover valid import, duplicate IDs, invalid lineup, missing teams and bounded settings/history.
- [x] `npm test` and all JavaScript syntax checks pass.
- [ ] Browser-level admin workflow and physical-device QA remain outstanding.

## Build 0.10.0 — Network protocol foundation
- [x] Added validated network input normalization with finite-number checks and axis clamping.
- [x] Added sequence replay rejection for incoming messages.
- [x] Added ready/input/state message type validation and bounded payload checks (depth, collection size and 64 KiB limit).
- [x] Added deterministic tests for valid input, malformed values, replayed sequences, ready messages and state payloads.
- [ ] Host-authoritative match simulation, guest prediction/interpolation and reconciliation are not implemented.
- [ ] PeerJS real-network, reconnect, latency and browser integration tests have not been run.


## Build 0.11.0 — host/guest roles and snapshot buffer
- [x] Guest-only input sending and host-only state publishing enforced by NetworkSync role.
- [x] Host rejects guest-originated state; guest rejects host-originated input.
- [x] PeerManager rejects additional guest connections while one peer is attached and resets sequence state on a new session.
- [x] SnapshotBuffer validates two-team player/ball snapshots, rejects duplicate/out-of-order ticks, bounds retained snapshots, and interpolates entity positions.
- [x] Automated tests cover role permissions, malformed snapshots, monotonic ticks, and interpolation.
- [x] `npm test` and all JavaScript syntax checks pass.
- [ ] SnapshotBuffer is not yet connected to the live renderer/MatchManager; host-authoritative simulation, prediction/reconciliation and real-network/browser/device QA remain incomplete.

## Build 0.12.0 — live match snapshot integration
- [x] Host sends authoritative MatchManager snapshots at a bounded ~10 Hz cadence during active matches.
- [x] Guest receives snapshots into SnapshotBuffer and applies interpolated state to its local match replica.
- [x] Guest replica pauses its local gameplay simulation and renders host-driven state between snapshots.
- [x] Snapshot application validates all player IDs/coordinates before mutating live state; malformed snapshots do not partially apply.
- [x] Score, remaining time, half, fouls, stats, possession, restart and full-time state are included/applied.
- [x] Automated tests cover valid application, unknown player rejection, atomic rejection and interpolation.
- [x] `npm test` and JavaScript syntax checks pass.
- [ ] Guest input is transported/validated but not yet mapped to remote-controlled player actions in the host simulation.
- [ ] Real PeerJS two-device networking, latency, reconnect, browser/WebGL and device QA remain outstanding.


## Build 0.13.0 — guest input applied to host simulation
- [x] MatchManager assigns one away-team outfield player as the guest-controlled player.
- [x] Host simulation applies normalized guest movement and sprint input to that player.
- [x] AI steering skips the guest-controlled player while other away-team players remain AI-controlled.
- [x] Guest pass, through-pass, shot and tackle actions are routed to the assigned player and attributed to team 1 statistics/events.
- [x] Guest can execute team-1 restarts through the host-authoritative simulation.
- [x] Guest camera follows the guest-controlled player.
- [x] Remote control state is cleared when the peer disconnects.
- [x] Automated tests cover remote movement and team-attributed pass/shot actions.
- [ ] Real PeerJS two-device connectivity, packet loss, latency, reconnect and browser/WebGL QA remain outstanding.


## Build 0.14.0 — Multiplayer reconnection

- Added guest reconnect using the retained host Peer ID and existing PeerJS peer.
- Added bounded exponential-backoff retry helper and RECONNECT control.
- Guest snapshot interpolation buffer is cleared after transport recovery to avoid rendering stale state.
- Automated reconnect retry tests pass.
- Real two-device PeerJS reconnect, signaling outage, host refresh, and browser/WebGL QA remain NOT TESTED.

## Build 0.15.0 — Gameplay/AI refinement while continuing Stage 7

- [x] AI outfield passing now scores safe outlets using forward progress, pass distance and lateral separation instead of selecting only the teammate nearest the attacking goal.
- [x] AI excludes blocked passing lanes and can choose a safe backward/lateral outlet when the forward lane is obstructed.
- [x] Player-to-player collision separation clamps both players back inside the court after positional correction.
- [x] Removed a duplicated tackle guard without changing tackle behavior.
- [x] Added deterministic tests for forward outlet preference and blocked-lane avoidance.
- [x] `npm test` passes.
- [x] All project JavaScript files pass `node --check`.
- [ ] Full browser gameplay balance, animation, and sustained performance still require playtesting.
- [ ] Stage 7 still requires real two-device PeerJS validation, packet-loss/latency testing, and robust session recovery before it can be marked complete.


## Build 0.16.0 — multiplayer input acknowledgement and stale-input safety

- Host records the sequence number of each accepted guest input.
- Authoritative snapshots carry `inputAckSeq` so the guest can identify the latest input acknowledged by the host.
- Host clears remote movement/action state after 350 ms without fresh guest input, preventing stuck movement after packet loss or disconnect.
- Automated tests cover input sequence metadata and acknowledgement propagation.
- Full client-side prediction/reconciliation, browser/WebGL QA, and two-device real-network testing remain outstanding.


## Build 0.18.0 — guest movement prediction and reconciliation

- [x] Added bounded InputReconciler queue for sequenced guest movement inputs.
- [x] Guest records each successfully sent input with its frame delta.
- [x] Host snapshot `inputAckSeq` prunes acknowledged inputs from the guest replay queue.
- [x] Guest replays only unacknowledged movement over the authoritative guest-player state after applying an interpolated snapshot, using the same `movePlayer` routine as host simulation.
- [x] Snapshot interpolation carries the acknowledged input sequence when the later snapshot becomes authoritative.
- [x] Tests cover ordered input capture, duplicate rejection, acknowledgement pruning, replay, invalid acknowledgement rejection and reset.
- [x] `npm test` passes; all JavaScript files pass `node --check`.
- [ ] Real PeerJS two-device tests for latency, packet loss, reconnect continuity, browser/WebGL and physical-device performance remain NOT TESTED.


## Build 0.18.0 — Tahap 7
- Validasi acknowledgement host: ACK tidak boleh mundur atau melampaui input terakhir yang dikirim.
- Antrean prediksi dibatasi tanpa membuang input lama yang belum diakui.
- Snapshot mensyaratkan tick integer aman dan acknowledgement monoton.
- Tes otomatis untuk antrean penuh, ACK di luar rentang, tick pecahan, dan ACK snapshot mundur.
- Pengujian dua perangkat/browser nyata tetap belum dilakukan.


## Build 0.19.0 — Tahap 7 latency/jitter handling
- [x] Snapshot arrival jitter is estimated using inter-arrival timing versus snapshot tick spacing.
- [x] Interpolation delay adapts upward within a bounded range to smooth uneven snapshot delivery.
- [x] NetworkSync reports accepted packet count, sequence gaps, rejected packets and last-message age.
- [x] Tests cover stable/jittery arrival patterns, bounded delay, buffer reset and sequence-gap diagnostics.
- [ ] Sequence gaps are only a diagnostic signal; PeerJS uses a reliable ordered data channel, and actual network impairment testing remains necessary.
- [ ] Two-device PeerJS tests, browser/WebGL and physical-device QA remain NOT TESTED.


## Build 0.20.0 — P2P heartbeat and round-trip diagnostics
- [x] Added sequenced ping/pong messages to measure peer round-trip time without relying on synchronized device clocks.
- [x] Active-match host and guest send heartbeat messages at most once per second.
- [x] Network diagnostics expose RTT and age of the last pong alongside packet/sequence diagnostics.
- [x] Invalid heartbeat timestamps are rejected; pong echoes the originating timestamp.
- [x] Automated tests cover ping/pong handling, RTT measurement, malformed payload rejection and heartbeat rate limiting.
- [ ] Real WAN, TURN relay, background-tab suspension, two-device and browser/WebGL testing remain NOT TESTED.


## Build 0.21.0 — Heartbeat watchdog
- [x] Added a 3.5-second heartbeat freshness threshold to network diagnostics.
- [x] Added room status transitions for stale heartbeat and recovered heartbeat.
- [x] Added automated coverage for watchdog timeout and recovery after a valid pong.
- [ ] Real WAN, TURN relay, background-tab suspension, two-device and browser/WebGL testing remain NOT TESTED.


## Build 0.22.0 — Reconnect lifecycle hardening (Tahap 7)
- [x] Concurrent reconnect requests are coalesced into one in-flight attempt.
- [x] Reconnect attempt has a bounded timeout and settles once for open/close/error.
- [x] Superseded transport lifecycle/data events are ignored; a stale close cannot clear the current connection.
- [x] Automated tests cover stale transport event isolation and concurrent reconnect coalescing.
- [x] `npm test` passes, including all prior gameplay, protocol, snapshot, prediction, heartbeat and recovery tests.
- [ ] Real PeerJS two-device reconnect, signaling outage, TURN relay, browser background suspension and WebGL/device QA remain NOT TESTED.


## Build 0.23.0 — Reconnect cancellation and session lifecycle (Tahap 7)
- [x] Added a lifecycle generation guard to reconnect attempts.
- [x] Closing a room invalidates an in-flight reconnect; late transport-open events cannot report a successful restored session.
- [x] Reconnect completion only clears its own promise, so an older attempt cannot clear a newer reconnect operation.
- [x] Automated tests cover room close during reconnect, late open events and connection state remaining cleared.
- [x] `npm test` and all project JavaScript syntax checks pass.
- [ ] Real PeerJS two-device reconnect, signaling outage, TURN relay, browser background suspension and WebGL/device QA remain NOT TESTED.


## Build 0.24.0 — Multiplayer session handshake (Tahap 7)
- [x] Added protocol-versioned hello / helloAck handshake.
- [x] Rejects unsupported protocol versions and same-role peers.
- [x] Blocks input, state snapshots and heartbeat traffic until mutual session acknowledgement.
- [x] Exposes session readiness diagnostics and room status update.
- [x] Automated handshake, invalid-peer, pre-handshake gating and role-direction tests pass.
- [ ] Real PeerJS two-device, NAT/TURN and network interruption acceptance tests remain outstanding.


## Build 0.25.0 — Session authorization and snapshot replay protection (Tahap 7)
- [x] Readiness packets are accepted only by the host (guest-originated readiness).
- [x] Duplicate hello/helloAck handshake messages are rejected after session readiness.
- [x] Guest accepts authoritative snapshots only with non-negative, strictly increasing safe-integer ticks.
- [x] Automated tests cover role direction, handshake replay, duplicate/stale snapshot ticks and malformed tick values.
- [x] `npm test` passes across the accumulated gameplay and multiplayer regression suite.
- [ ] Actual PeerJS two-device, NAT/TURN, reconnect under real network loss, browser/WebGL and physical-device acceptance tests remain NOT TESTED.
