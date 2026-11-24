# EFUTSAAL 3D

Browser-based 5v5 futsal project built with vanilla ES modules and Three.js r160. Designed for static hosting (including GitHub Pages).

## Run locally

ES modules require HTTP(S), not `file://`. From this directory run `python3 -m http.server 8000`, then open `http://localhost:8000`.

For automated gameplay logic checks (Node.js 18+): run `npm test`. Node is only needed for this test command; the deployed game remains client-side and static-hosting compatible.

## Deploy to GitHub Pages

1. Push the complete folder contents to a repository.
2. In **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`.
3. Wait for the Pages URL, then open it over HTTPS. All project paths are relative and support repository subpaths.

## Multiplayer configuration

The P2P module uses PeerJS from a CDN and its public cloud signaling service by default. Create Room exposes the host Peer ID; the guest enters that ID to connect. Public signaling is a convenience service, not a production SLA. Some NAT/firewall combinations require TURN; configure ICE servers in `js/network/peerManager.js`. A TURN provider may charge for relay bandwidth. The current build validates host/guest message direction, applies guest movement/actions to a host-authoritative away-team outfield player, and sends live match snapshots for guest-side interpolation. Host snapshots now acknowledge the latest accepted guest input sequence, and stale remote controls are cleared after 350 ms without fresh input. Client-side movement prediction and acknowledgement-based reconciliation are implemented in build 0.18.0; adaptive snapshot jitter buffering and network sequence-gap diagnostics were added in build 0.19.0; bidirectional heartbeat/pong round-trip diagnostics were added in build 0.20.0; build 0.21.0 adds a 3.5-second heartbeat watchdog and visible stale/recovered connection status; build 0.22.0 hardens transport lifecycle handling, ignores late events from superseded connections, and coalesces concurrent reconnect requests; build 0.23.0 invalidates in-flight reconnect attempts when a room closes and prevents late connection events from reviving a closed session; build 0.24.0 adds a protocol-versioned host/guest handshake, validates the remote role, and blocks gameplay inputs, snapshots and heartbeat traffic until the session is mutually acknowledged; build 0.25.0 tightens message authorization by accepting readiness only from the guest at the host, rejecting handshake replay after readiness, and requiring strictly increasing non-negative authoritative snapshot ticks; real-network testing remains outstanding. Production competitive play needs a dedicated trusted backend, anti-cheat, protocol hardening, and extensive latency testing. Static GitHub Pages cannot host a persistent authoritative game server.

## Player and team database

The initial roster and four teams live in `js/data/teamsAndPlayers.js`. Local changes are saved in versioned localStorage (`efutsaal3d.save.v1`). Open Admin using the gear icon, enter the local UI password, then add/edit/delete players or export/import JSON. The password gate is client-side only and is not secure authentication.

## Assets

Procedural low-poly players, court, goals and ball are generated in Three.js. Put optional GLB/GLTF models, textures and audio in `assets/`; update the relevant world modules to load them. No external copyrighted game assets are included. Three.js and PeerJS are CDN dependencies; first load needs internet. The bot mode works offline only after the app and Three.js have been cached by the browser (a service worker/offline cache is not included in this build).

## Controls

Desktop: WASD/arrows move, J/Z/Space pass, K/X through pass, hold L/Enter to charge shot, Shift sprint, C curve, F/V tackle, Q/E switch player. Mobile: left joystick and on-screen action buttons including TACKLE.

## Current implementation scope

The bot gameplay foundation has been iteratively strengthened through build 0.7.0: role-based tactical movement, difficulty profiles, AI passing and shooting decisions, goalkeeper positioning/saves/distribution, momentum-based ball movement with curve spin, goal/boundary detection, collision response, input-gated restart execution, match-clock halftime flow, and event-driven match statistics are implemented in the local simulation. Automated logic tests are available through `npm test`.

This is still an in-progress arcade futsal simulation, not a production-complete or official-rules-certified game. Full foul detection, handball edge cases, second-penalty execution/placement, goalkeeper four-second enforcement, substitutions, all official restart placement, full animation blending, complete authoritative two-peer 5v5 networking, guest input prediction/reconciliation, robust reconnect guarantees, extra-time/shootout/GKS, audio playback, service-worker offline caching, and real device/browser QA remain incomplete. The multiplayer data channel is wired to one guest-controlled away-team outfield player while remaining players use AI; complete two-sided 5v5 control and real-network acceptance testing remain incomplete.

## Development checklist

- [x] Stage 1 — Modular architecture audit and system design.
- [x] Stage 2 — Project structure and main menu foundation.
- [x] Stage 3 — Procedural 3D arena, player/ball models and camera foundation.
- [~] Stage 4 — Desktop/mobile controls (implemented foundation; real-device QA pending).
- [~] Stage 5 — Gameplay, AI and futsal rules (goalkeeper distribution/back-pass foundation added; full official rule enforcement remains incomplete).
- [~] Stage 6 — Team customization and local admin (foundation implemented; additional lineup/team workflows remain).
- [~] Stage 7 — P2P multiplayer (host-authoritative guest player movement/actions and live snapshot interpolation integrated; real-network QA and prediction/reconciliation pending).
- [~] Stage 8 — Tie-breaker, statistics, audio and PWA (statistics foundation; other features incomplete).
- [~] Stage 9 — Automated checks pass for selected logic; browser/device QA pending.
- [ ] Stage 10 — Final release packaging and deployment acceptance (not final until all required features and tests are complete).

## QA status

See `QA_STATUS.md` for checks actually performed and known gaps. Browser/device testing is not performed by the packaging environment; Android/iOS/Desktop acceptance tests remain pending until tested on real devices.


## Build 0.4.0 — Defensive gameplay

- Added manual tackle action (F/V desktop, TACKLE touch button).
- Added AI close-pressure tackle attempts.
- Added defense-versus-dribbling tackle probability and cooldown.
- Added foul events for close failed challenges, per-half team foul counters,
  direct free-kick restart, and second-penalty restart from the 10 m mark
  after the fifth accumulated foul.
- Added tackle/interception/foul match statistics.
- Goalkeeper save reach and cooldown now scale with GK Handling.
- This is an arcade foul model, not a complete official referee/handball model.


### Build 0.4.0 — goalkeeper and penalty-area rules
- Goalkeeper four-second possession limit while controlling the ball in their own half; infringement awards an opponent free kick at the offence location.
- Fouls committed inside the defending penalty area award a 6 m penalty. Accumulated-foul penalties remain at the 10 m mark.
- Added in-game notifications and automated regression coverage for both rule paths.


### Build 0.6.0 — Goalkeeper back-pass restriction
- Tracks when a goalkeeper deliberately releases the ball.
- If the same team's goalkeeper receives the ball again before an opponent touch, an indirect-free-kick restart is awarded.
- Adds a match event and HUD notification for the infringement.
- Automated regression test covers the second-touch violation.


### Build 0.7.0 — Safer AI goalkeeper distribution
- AI goalkeepers score available passing outlets by distance, forward progress and passing-lane safety.
- If every outlet is blocked, the goalkeeper clears toward the less crowded flank and emits a dedicated clearance event.
- Added deterministic tests for safe outlet selection and blocked-lane fallback.


## Build 0.9.0 — Admin & team identity
- Admin dapat mengubah nama, warna utama, dan warna aksen untuk empat tim bawaan.
- Identitas tim tersimpan di local storage dan ikut dalam ekspor/impor JSON.
- Import membatasi jumlah pemain dan memvalidasi ID tim; penghapusan pemain juga membersihkan referensi lineup.
- Normalisasi penyimpanan menjaga struktur data lama tetap kompatibel dan memulihkan data tim dari default bila field tidak valid.


### Build 0.9.0 — validasi integritas data admin
Impor JSON kini divalidasi sebelum mengganti data aktif: empat ID tim wajib lengkap dan unik, ID pemain tidak boleh ganda, lineup harus berisi lima pemain valid (satu kiper dan empat outfield), pengaturan dibatasi ke nilai aman, dan riwayat dibatasi 500 entri terakhir.

### Build 0.10.0 — fondasi protokol multiplayer
Pesan jaringan kini melewati validasi tipe, nomor urut anti-replay, pembatasan ukuran/kedalaman payload, serta normalisasi input pemain. Ini baru fondasi keamanan protokol; simulasi pertandingan host-authoritative, prediksi guest, rekonsiliasi state, dan pengujian jaringan nyata belum tersedia.


### Build 0.11.0 — host/guest network roles and snapshot interpolation
- Network message direction is role-gated: guests submit input and hosts publish match state.
- Incoming peer connections are limited to one guest per host room; outgoing sequence numbers reset on new sessions.
- Added bounded snapshot buffering, monotonic tick validation, malformed snapshot rejection, and linear interpolation for ball/player positions.
- Added automated tests for role permissions, duplicate/out-of-order snapshots, invalid payloads, and interpolation.
- Live MatchManager authority, state application/render integration, prediction/reconciliation, and real PeerJS network QA remain outstanding.

### Build 0.12.0 — live match snapshot integration
- Host publishes authoritative `MatchManager.snapshot()` packets at approximately 10 Hz while a match is active.
- Guest buffers incoming host snapshots, interpolates player/ball transforms, and applies validated snapshots to its local match replica.
- Guest replica no longer advances its own AI/physics simulation between authoritative snapshots, avoiding independent simulation drift.
- Snapshot application validates both teams and every player ID before mutating any live state; score, clock, fouls, stats, possession, restart and full-time state are synchronized.
- Guest input packets are transmitted and validated, but remote player control/actions are not yet applied by the host simulation; this remains a multiplayer integration task.
- Real PeerJS network, browser rendering and two-device QA have not been performed.


### Build 0.13.0 — guest input integration
Guest movement, sprint, pass, through-pass, shot and tackle inputs are now applied by the host to one assigned away-team outfield player. The AI skips that player, guest actions are attributed to team 1, team-1 restarts can be executed by the guest, and the guest camera follows its assigned player. Disconnect clears the last remote input.


### Multiplayer recovery (v0.14.0)

- Guest can request a bounded reconnect to the previous host Peer ID from the online room screen.
- Reconnect attempts use exponential backoff and stop after a configurable maximum.
- On reconnect, the guest clears stale interpolation snapshots and waits for fresh authoritative host state.
- A successful reconnect still requires the host room to remain available; this is not a server-backed room recovery guarantee.

### Gameplay AI refinement (v0.15.0)
- Outfield AI now chooses passing outlets using forward progress, distance and passing-lane safety.
- Blocked forward lanes are avoided; a safe lateral/backward outlet may be selected instead.
- Player collision separation keeps corrected positions within court boundaries.
- Automated tests cover forward outlet preference and blocked-lane avoidance.


## Build 0.18.0 — guest movement prediction and reconciliation

- [x] Guest records bounded, ordered local movement inputs with their transport sequence numbers.
- [x] Host snapshot acknowledgements remove inputs already processed by the authoritative simulation.
- [x] Remaining unacknowledged movement inputs are replayed over the latest authoritative guest-player position using the same player movement function as the host.
- [x] Invalid acknowledgements, duplicate sequences and invalid time steps are rejected; pending history is bounded and reset on new match/room lifecycle.
- [x] Automated tests cover prediction replay, acknowledgement pruning, invalid acknowledgements and reset.
- [ ] Real two-device latency, packet-loss, reconnect continuity and browser/WebGL QA remain outstanding.


Build 0.18.0 memperketat rekonsiliasi input guest: antrean prediksi tidak membuang input lama yang belum diakui, ACK di luar rentang ditolak, dan snapshot memvalidasi tick serta ACK monoton.


### Build 0.19.0 — latency/jitter diagnostics
- [x] SnapshotBuffer estimates inter-arrival jitter and adaptively increases interpolation delay within a bounded 2–6 tick range.
- [x] Buffer reset clears jitter history; invalid arrival timestamps are rejected.
- [x] NetworkSync exposes accepted packet count, sequence gaps (possible loss/reordering indicator), rejected packet count, and age of last valid message.
- [x] Automated tests cover stable and jittery arrivals, bounded adaptive delay, reset behavior, and sequence-gap diagnostics.
- [ ] Sequence gaps are diagnostic only: PeerJS reliable ordered data channels are not an application-level packet-loss recovery protocol. Real WAN latency/loss and two-device testing remain outstanding.


### Build 0.20.0 — P2P heartbeat and round-trip diagnostics
- [x] Added sequenced ping/pong messages to monitor bidirectional peer responsiveness.
- [x] Guest and host send a heartbeat at most once per second during an active match.
- [x] Network diagnostics expose measured round-trip time and age of the last pong.
- [x] Malformed heartbeat timestamps are rejected; heartbeat responses preserve the sender timestamp.
- [x] Automated tests cover ping response, pong RTT measurement, malformed heartbeat rejection and send-rate limiting.
- [ ] Real WAN latency, browser suspension, TURN relay, two-device and physical-device QA remain outstanding.

### Build 0.21.0 — Heartbeat watchdog

- Detects a missing pong after 3.5 seconds and exposes `heartbeatStale` through network diagnostics.
- Updates the room status when heartbeat health becomes stale and when it recovers.
- This is a transport-health warning, not proof that the peer is permanently disconnected; real WAN/TURN testing is still required.


### Build 0.22.0 — reconnect lifecycle hardening

- [x] Concurrent guest reconnect requests share one in-flight transport attempt.
- [x] Reconnect attempts have a bounded timeout and settle once on open, close, or error.
- [x] Late open/data/close/error events from superseded connections are ignored so an old transport cannot clear or overwrite the active connection state.
- [x] Automated regression tests cover stale transport events and concurrent reconnect coalescing.
- [ ] Actual PeerJS reconnection across two devices, signaling interruption, TURN relay and mobile background/foreground transitions remain NOT TESTED.


### Build 0.23.0 — reconnect cancellation and session lifecycle

- Reconnect attempts capture a session lifecycle generation and reject if the room is closed or the session changes before the transport opens.
- Closing a room invalidates pending reconnect work; late transport events cannot restore the old connection.
- Reconnect promise cleanup is identity-checked so a completed older attempt cannot clear a newer attempt.
- Automated regression tests cover close-during-reconnect and late-open behavior. Real two-device/network testing remains outstanding.

### Build 0.24.0 — multiplayer session handshake

- Added protocol version 1 hello / helloAck exchange after the data channel becomes available.
- Rejects unsupported protocol versions and peers claiming the same role.
- Gameplay input, authoritative snapshots and heartbeat messages are blocked until both sides validate the handshake.
- Exposes `sessionReady` and `remoteHello` in network diagnostics and updates the room status when the handshake completes.
- Automated tests cover valid handshake, invalid protocol, role mismatch, pre-handshake gating and host/guest direction permissions.
- PeerJS two-device / real-network acceptance testing remains outstanding.


### Build 0.25.0 — session authorization and snapshot replay protection

- Readiness messages are accepted only by the host, where guest readiness is authoritative for the room UI.
- Handshake hello/helloAck messages are rejected after the session has become ready, preventing a late handshake replay from mutating an active session.
- Guest replicas accept authoritative state snapshots only when `tick` is a non-negative safe integer strictly greater than the last accepted tick. Duplicate, stale and malformed snapshot ticks are rejected before the snapshot callback runs.
- Automated tests cover role-direction enforcement, handshake replay, monotonic snapshot ticks, and malformed/negative ticks.
- Actual PeerJS two-device, NAT/TURN, browser and device testing remains outstanding.

### Build 0.26.0 — reconnect handshake integration (Tahap 7)
- A transport reconnect now invalidates the active protocol session on both sides and restarts the hello/helloAck handshake.
- Clears old snapshot interpolation, guest prediction/reconciliation queue, input acknowledgement and remote input/action latches when a peer transport reports connected.
- NetworkSync reset clears sequence/tick gates and heartbeat/session diagnostics; fresh guest inputs remain blocked until the new handshake is ready.
- PeerManager event subscriptions now support multiple listeners, preventing status observers from silently overwriting each other.
- Automated tests cover a completed session reset, fresh hello, input gating before readiness, and handshake completion after reset.
- Real two-device reconnect and stale events across actual PeerJS transport changes remain NOT TESTED.


## Build 0.27.0 — Final multiplayer lifecycle integration checkpoint
This checkpoint prevents stale `NetworkSync` listeners from surviving room changes, resets local/remote READY state at room lifecycle boundaries, and clears session gameplay/network buffers on disconnect/reconnect. It remains an integration checkpoint; two-device acceptance, real-network reconnect, NAT/TURN and browser/device QA have not been performed.
