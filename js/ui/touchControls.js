import { isTouchDevice } from '../utils/deviceDetection.js';

export class TouchControls {
  constructor(onInput) {
    this.onInput = onInput;
    this.enabled = isTouchDevice();
    this.el = document.getElementById('touch-controls');
    this.joy = document.getElementById('joystick');
    this.knob = this.joy?.querySelector('.joy-knob');
    this.axis = { x: 0, z: 0 };
    this.activePointers = new Map();
    if (!this.enabled || !this.joy) return;
    let joystickPointer = null;
    const move = e => {
      if (e.pointerId !== joystickPointer) return;
      const r = this.joy.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = e.clientX - cx, dy = e.clientY - cy;
      const max = r.width * .34, length = Math.hypot(dx, dy), scale = Math.min(1, max / (length || 1));
      this.axis = { x: dx * scale / max, z: -dy * scale / max };
      if (length < max * .16) this.axis = { x: 0, z: 0 };
      if (this.knob) { this.knob.style.left = `${50 + this.axis.x * 34}%`; this.knob.style.top = `${50 - this.axis.z * 34}%`; }
    };
    this.joy.addEventListener('pointerdown', e => {
      e.preventDefault(); joystickPointer = e.pointerId;
      try { this.joy.setPointerCapture(e.pointerId); } catch {}
      move(e);
    });
    this.joy.addEventListener('pointermove', move);
    const endJoy = e => {
      if (e.pointerId !== joystickPointer) return;
      joystickPointer = null; this.axis = { x: 0, z: 0 };
      if (this.knob) { this.knob.style.left = '50%'; this.knob.style.top = '50%'; }
    };
    this.joy.addEventListener('pointerup', endJoy);
    this.joy.addEventListener('pointercancel', endJoy);
    this.joy.addEventListener('lostpointercapture', endJoy);
    document.querySelectorAll('#touch-controls [data-action]').forEach(button => {
      const action = button.dataset.action;
      const release = e => {
        const id = e?.pointerId;
        if (id != null && this.activePointers.get(id) !== action) return;
        if (id != null) this.activePointers.delete(id);
        this.onInput({ type: action, down: false });
      };
      button.addEventListener('pointerdown', e => {
        e.preventDefault();
        if (this.activePointers.has(e.pointerId)) return;
        this.activePointers.set(e.pointerId, action);
        try { button.setPointerCapture(e.pointerId); } catch {}
        this.onInput({ type: action, down: true });
      });
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
    });
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.reset(); });
  }
  reset() {
    for (const action of this.activePointers.values()) this.onInput({ type: action, down: false });
    this.activePointers.clear(); this.axis = { x: 0, z: 0 };
    if (this.knob) { this.knob.style.left = '50%'; this.knob.style.top = '50%'; }
  }
  get() { return { ...this.axis }; }
}
