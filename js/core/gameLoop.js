import { CONFIG } from '../data/gameConfig.js';

export class GameLoop {
  constructor(update, render, onError = null) {
    this.update = update;
    this.render = render;
    this.onError = onError;
    this.running = false;
    this.last = 0;
    this.acc = 0;
    this.raf = 0;
    this.frameCount = 0;
    this.simulationTicks = 0;
    this.lastError = null;
    this._reported = new Set();
    this.frame = this.frame.bind(this);
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    this.raf = requestAnimationFrame(this.frame);
  }
  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.acc = 0;
  }
  report(error, phase) {
    this.lastError = { phase, message: error?.message || String(error), time: performance.now() };
    const key = `${phase}:${this.lastError.message}`;
    if (!this._reported.has(key)) {
      this._reported.add(key);
      try { this.onError?.(error, phase); } catch (callbackError) { console.error('[EFUTSAAL loop error callback]', callbackError); }
      console.error(`[EFUTSAAL ${phase}]`, error);
    }
  }
  frame(now) {
    if (!this.running) return;
    try {
      const rawDt = Math.max(0, (now - this.last) / 1000);
      const dt = Math.min(rawDt, CONFIG.physics.maxFrame);
      this.last = now;
      this.acc += dt;
      let steps = 0;
      while (this.acc >= CONFIG.physics.fixedStep && steps < 8) {
        try {
          this.update(CONFIG.physics.fixedStep);
          this.simulationTicks++;
        } catch (error) {
          this.report(error, 'simulation-update');
          this.acc = 0;
          break;
        }
        this.acc -= CONFIG.physics.fixedStep;
        steps++;
      }
      if (steps >= 8) this.acc = 0;
      try { this.render(this.acc / CONFIG.physics.fixedStep); }
      catch (error) { this.report(error, 'render'); }
      this.frameCount++;
    } finally {
      if (this.running) this.raf = requestAnimationFrame(this.frame);
    }
  }
  getDiagnostics() {
    return { running: this.running, frames: this.frameCount, simulationTicks: this.simulationTicks, lastError: this.lastError };
  }
}
