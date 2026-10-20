import type { TimeOfDay } from "./scene3d";

/**
 * An optional, user-started soundscape built from noise and oscillators:
 * wind always, crickets after dusk, a crackle near the fire. Never autoplays.
 */
export class Ambient {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private crickets: GainNode | null = null;
  private crackleTimer = 0;
  private chirpTimer = 0;
  private time: TimeOfDay = "day";

  start(time: TimeOfDay) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 1.5);
    this.master.connect(ctx.destination);

    // wind: filtered brown-ish noise with a slow gust LFO
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + (Math.random() * 2 - 1) * 0.02) / 1.02;
      data[i] = last * 3.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 420;
    filter.Q.value = 0.6;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(filter.frequency);
    noise.connect(filter).connect(windGain).connect(this.master);
    noise.start();
    lfo.start();

    this.crickets = ctx.createGain();
    this.crickets.gain.value = 0;
    this.crickets.connect(this.master);
    this.setTime(time);
    this.chirpTimer = window.setInterval(() => this.chirp(), 900);
    this.crackleTimer = window.setInterval(() => this.crackle(), 260);
    return true;
  }

  setTime(time: TimeOfDay) {
    this.time = time;
    if (!this.ctx || !this.crickets) return;
    const night = time === "night" || time === "dusk";
    this.crickets.gain.linearRampToValueAtTime(night ? 0.12 : 0, this.ctx.currentTime + 1.5);
  }

  private chirp() {
    if (!this.ctx || !this.crickets || !(this.time === "night" || this.time === "dusk")) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    for (let k = 0; k < 3; k++) {
      const o = ctx.createOscillator();
      o.frequency.value = 4300 + Math.random() * 300;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + k * 0.06);
      g.gain.linearRampToValueAtTime(0.5, t + k * 0.06 + 0.01);
      g.gain.linearRampToValueAtTime(0, t + k * 0.06 + 0.04);
      o.connect(g).connect(this.crickets);
      o.start(t + k * 0.06);
      o.stop(t + k * 0.06 + 0.05);
    }
  }

  private crackle() {
    if (!this.ctx || !this.master || this.time === "day") return;
    if (Math.random() > 0.35) return;
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * 0.02);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource();
    s.buffer = b;
    const g = ctx.createGain();
    g.gain.value = 0.08 + Math.random() * 0.1;
    s.connect(g).connect(this.master);
    s.start();
  }

  stop() {
    window.clearInterval(this.chirpTimer);
    window.clearInterval(this.crackleTimer);
    if (this.ctx && this.master) {
      const ctx = this.ctx;
      this.master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      window.setTimeout(() => void ctx.close(), 500);
    }
    this.ctx = null;
    this.master = null;
    this.crickets = null;
  }
}
