/* All sound is synthesised with Web Audio; no audio files. */
export class KantoAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.beamNodes = null;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);
    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.55;
  }

  tone({ freq = 440, dur = 0.12, type = "square", gain = 0.18, slide = 0, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noiseBurst({ dur = 0.12, gain = 0.16, freq = 2400, q = 1, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(freq, t0);
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  crinkle() {
    this.noiseBurst({ dur: 0.09, gain: 0.06, freq: 3200 + Math.random() * 2200, q: 0.8 });
  }

  tear(p) {
    this.noiseBurst({ dur: 0.1, gain: 0.05 + p * 0.05, freq: 1200 + p * 2600, q: 3 });
  }

  rip() {
    this.noiseBurst({ dur: 0.22, gain: 0.22, freq: 1800, q: 0.7 });
    this.tone({ freq: 180, dur: 0.18, type: "sawtooth", gain: 0.1, slide: -90 });
  }

  flash() {
    this.tone({ freq: 1200, dur: 0.16, type: "square", gain: 0.12, slide: -700 });
    this.noiseBurst({ dur: 0.3, gain: 0.12, freq: 5200, q: 0.6 });
  }

  beam() {
    if (!this.ctx || this.muted || this.beamNodes) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    osc.type = "triangle";
    osc.frequency.value = 110;
    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.07, this.ctx.currentTime + 0.2);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    osc.start();
    this.beamNodes = { osc, g };
  }

  stopBeam() {
    if (!this.beamNodes) return;
    const { osc, g } = this.beamNodes;
    const t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.stop(t + 0.25);
    this.beamNodes = null;
  }

  whoosh(index) {
    this.noiseBurst({ dur: 0.16, gain: 0.09, freq: 700 + index * 180, q: 1.2, delay: index * 0.07 });
    this.tone({ freq: 320 + index * 70, dur: 0.12, type: "triangle", gain: 0.05, slide: 220, delay: index * 0.07 });
  }

  flipTick() {
    this.tone({ freq: 520, dur: 0.05, type: "square", gain: 0.09, slide: 260 });
  }

  flipLand() {
    this.tone({ freq: 140, dur: 0.11, type: "triangle", gain: 0.1, slide: -40 });
    this.noiseBurst({ dur: 0.07, gain: 0.05, freq: 900, q: 1 });
  }

  sparkle(rarity) {
    if (rarity === "rare") {
      [660, 880, 1320].forEach((f, i) => this.tone({ freq: f, dur: 0.1, type: "square", gain: 0.07, delay: i * 0.06 }));
    } else if (rarity === "holo") {
      for (let i = 0; i < 6; i += 1) {
        this.tone({ freq: 900 + i * 180, dur: 0.12, type: "square", gain: 0.05, delay: i * 0.045 });
      }
    } else if (rarity === "legend") {
      [523, 659, 784, 1046, 1318].forEach((f, i) => {
        this.tone({ freq: f, dur: 0.22, type: "square", gain: 0.075, delay: i * 0.09 });
      });
      this.noiseBurst({ dur: 0.5, gain: 0.06, freq: 4200, q: 0.5, delay: 0.1 });
    }
  }

  shiny() {
    for (let i = 0; i < 5; i += 1) this.tone({ freq: 1600 + i * 220, dur: 0.09, type: "triangle", gain: 0.05, delay: i * 0.05 });
  }

  suspense() {
    for (let i = 0; i < 4; i += 1) this.tone({ freq: 200 + i * 90, dur: 0.08, type: "square", gain: 0.05, delay: i * 0.09 });
  }

  click() {
    this.tone({ freq: 760, dur: 0.04, type: "square", gain: 0.06 });
  }
}
