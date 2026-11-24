import * as THREE from 'three';

const MODES = new Set(['broadcast', 'follow', 'wide']);
export class CourtCamera {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'broadcast';
    this.target = new THREE.Vector3(0, 0, 0);
    this.initialized = false;
  }
  update(ball, controlled) {
    const ballPosition = ball?.position || this.target;
    const playerPosition = controlled?.position || ballPosition;
    let focus;
    if (this.mode === 'follow') focus = ballPosition;
    else if (this.mode === 'wide') focus = new THREE.Vector3(0, 0, 0);
    else focus = playerPosition;
    const desiredTarget = new THREE.Vector3(focus.x, 0, focus.z);
    if (!this.initialized) { this.target.copy(desiredTarget); this.initialized = true; }
    else this.target.lerp(desiredTarget, this.mode === 'follow' ? 0.09 : 0.055);
    const wide = this.mode === 'wide';
    const follow = this.mode === 'follow';
    const height = wide ? 43 : follow ? 25 : 31;
    const offset = wide ? 7 : follow ? 8 : 13;
    const desired = new THREE.Vector3(this.target.x, height, this.target.z + offset);
    this.camera.position.lerp(desired, wide ? 0.045 : 0.075);
    this.camera.lookAt(this.target.x, 0, this.target.z);
  }
  setMode(mode) {
    if (!MODES.has(mode)) return false;
    this.mode = mode;
    this.initialized = false;
    return true;
  }
}
