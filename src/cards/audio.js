/* All sound is synthesised with Web Audio; no audio files.
   Chain: source -> bus -> master gain -> compressor -> out, with a shared
   reverb send. Everything is voiced with sines/triangles and filtered noise so
   nothing buzzes at the top end. */
export class KantoAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.beamNodes = null;
    this.musicPlaying = false;
    this.musicStep = 0;
    this.musicTimer = null;
    this.nextNoteTime = 0;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 24;
    comp.ratio.value = 3;
    comp.attack.value = 0.008;
    comp.release.value = 0.22;
    comp.connect(ctx.destination);
    this.comp = comp;

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(comp);

    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);

    this.music = ctx.createGain();
    this.music.gain.value = 0.0;
    this.music.connect(this.master);

    /* one shared plate: short noise tail, no files */
    const len = Math.floor(ctx.sampleRate * 1.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch += 1) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < len; i += 1) {
        const t = i / len;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) * 0.5;
      }
    }
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = ir;
    this.send = ctx.createGain();
    this.send.gain.value = 0.22;
    this.send.connect(this.reverb);
    this.reverb.connect(this.master);

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, t, 0.05);
    }
  }

  /* ---------- voices ---------- */

  tone({ freq = 440, dur = 0.12, type = "triangle", gain = 0.12, slide = 0, delay = 0, send = 0.12, attack = 0.006 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = Math.min(7000, freq * (type === "sine" ? 8 : 5));
    lp.Q.value = 0.3;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(lp);
    lp.connect(g);
    g.connect(this.sfx);
    if (send > 0) {
      const s = this.ctx.createGain();
      s.gain.value = send;
      g.connect(s);
      s.connect(this.send);
    }
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noiseBurst({ dur = 0.12, gain = 0.1, freq = 2400, freqEnd = 0, q = 1, delay = 0, send = 0.08 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(freq, t0);
    if (freqEnd) filter.frequency.exponentialRampToValueAtTime(Math.max(80, freqEnd), t0 + dur);
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfx);
    if (send > 0) {
      const s = this.ctx.createGain();
      s.gain.value = send;
      g.connect(s);
      s.connect(this.send);
    }
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /* ---------- pack handling ---------- */

  crinkle() {
    this.noiseBurst({ dur: 0.07, gain: 0.028, freq: 2600 + Math.random() * 2400, freqEnd: 1400, q: 1.4, send: 0.05 });
  }

  tear(p) {
    this.noiseBurst({
      dur: 0.09,
      gain: 0.03 + p * 0.03,
      freq: 1600 + p * 2200,
      freqEnd: 900 + p * 600,
      q: 2.2,
      send: 0.06,
    });
  }

  rip() {
    this.noiseBurst({ dur: 0.34, gain: 0.11, freq: 2600, freqEnd: 260, q: 0.8, send: 0.3 });
    this.tone({ freq: 96, dur: 0.26, type: "sine", gain: 0.1, slide: -34, send: 0.2 });
    this.tone({ freq: 196, dur: 0.18, type: "triangle", gain: 0.03, slide: -80, send: 0.3, delay: 0.02 });
  }

  flash() {
    this.tone({ freq: 1046, dur: 0.22, type: "sine", gain: 0.07, send: 0.45 });
    this.tone({ freq: 1568, dur: 0.3, type: "sine", gain: 0.05, send: 0.5, delay: 0.05 });
    this.noiseBurst({ dur: 0.42, gain: 0.05, freq: 5200, freqEnd: 2200, q: 0.5, send: 0.5 });
  }

  beam() {
    if (!this.ctx || this.muted || this.beamNodes) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 700;
    osc.type = "triangle";
    osc.frequency.value = 110;
    /* slow shimmer from a second, gently detuned voice */
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = 220;
    const g2 = ctx.createGain();
    g2.gain.value = 0.4;
    g.gain.value = 0.0001;
    g.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.3);
    osc.connect(filter);
    osc2.connect(g2);
    g2.connect(filter);
    filter.connect(g);
    g.connect(this.sfx);
    osc.start();
    osc2.start();
    this.beamNodes = { osc, osc2, g };
  }

  stopBeam() {
    if (!this.beamNodes) return;
    const { osc, osc2, g } = this.beamNodes;
    const t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    osc.stop(t + 0.3);
    osc2.stop(t + 0.3);
    this.beamNodes = null;
  }

  whoosh(index) {
    this.noiseBurst({ dur: 0.2, gain: 0.045, freq: 500 + index * 220, freqEnd: 1600 + index * 260, q: 1, delay: index * 0.06, send: 0.25 });
    this.tone({ freq: 392 + index * 60, dur: 0.16, type: "sine", gain: 0.03, slide: 120, delay: index * 0.06, send: 0.2 });
  }

  flipTick() {
    this.tone({ freq: 1320, dur: 0.035, type: "sine", gain: 0.045, send: 0.1 });
  }

  flipLand() {
    this.tone({ freq: 124, dur: 0.14, type: "sine", gain: 0.08, slide: -26, send: 0.16 });
    this.noiseBurst({ dur: 0.06, gain: 0.025, freq: 1200, freqEnd: 700, q: 1.2, send: 0.1 });
  }

  /* ---------- reveal flourishes ---------- */

  sparkle(rarity) {
    const bell = (f, i, gain = 0.05) => this.tone({ freq: f, dur: 0.34, type: "sine", gain, delay: i * 0.055, send: 0.5 });
    if (rarity === "rare") {
      [784, 988, 1175].forEach((f, i) => bell(f, i, 0.045));
    } else if (rarity === "holo") {
      [784, 880, 988, 1175, 1319, 1568].forEach((f, i) => bell(f, i, 0.038));
      this.noiseBurst({ dur: 0.5, gain: 0.02, freq: 6200, freqEnd: 3800, q: 0.4, send: 0.6 });
    } else if (rarity === "legend") {
      [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => bell(f, i, 0.05));
      this.tone({ freq: 261, dur: 0.9, type: "triangle", gain: 0.05, send: 0.35 });
      this.tone({ freq: 392, dur: 0.9, type: "sine", gain: 0.03, send: 0.4, delay: 0.03 });
      this.noiseBurst({ dur: 0.9, gain: 0.03, freq: 4800, freqEnd: 2600, q: 0.4, send: 0.6, delay: 0.08 });
    } else if (rarity === "chroma") {
      [1046, 1175, 1397, 1760].forEach((f, i) => bell(f, i, 0.04));
    }
  }

  shiny() {
    [1760, 2093, 2349, 2637].forEach((f, i) => this.tone({ freq: f, dur: 0.22, type: "sine", gain: 0.035, delay: i * 0.05, send: 0.5 }));
  }

  suspense() {
    for (let i = 0; i < 3; i += 1) {
      this.tone({ freq: 98 + i * 16, dur: 0.26, type: "sine", gain: 0.05, delay: i * 0.12, send: 0.25, attack: 0.03 });
    }
  }

  click() {
    this.tone({ freq: 880, dur: 0.04, type: "sine", gain: 0.04, send: 0.08 });
    this.noiseBurst({ dur: 0.03, gain: 0.015, freq: 3200, q: 1.6, send: 0.04 });
  }

  /* ---------- music bed ---------- */

  startMusic() {
    if (!this.ctx || this.musicPlaying) return;
    this.musicPlaying = true;
    this.musicStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.15;
    if (this.music) this.music.gain.setTargetAtTime(1.5, this.ctx.currentTime, 1.2);
    this.musicTimer = setInterval(() => this.scheduleMusic(), 25);
  }

  stopMusic(fade = 1.2) {
    this.musicPlaying = false;
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    if (this.music && this.ctx) this.music.gain.setTargetAtTime(0, this.ctx.currentTime, fade / 3);
  }

  scheduleMusic() {
    if (!this.ctx || !this.musicPlaying) return;
    const bpm = 92;
    const stepDur = 60 / bpm / 2;
    while (this.nextNoteTime < this.ctx.currentTime + 0.25) {
      this.musicStepAt(this.musicStep, this.nextNoteTime, stepDur);
      this.nextNoteTime += stepDur;
      this.musicStep += 1;
    }
  }

  musicVoice(freq, t, dur, gain, type = "triangle", attack = 0.02) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2200;
    lp.Q.value = 0.2;
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(lp);
    lp.connect(g);
    g.connect(this.music);
    const s = ctx.createGain();
    s.gain.value = 0.3;
    g.connect(s);
    s.connect(this.send);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /* i - VI - III - VII in A minor, eight steps a bar */
  musicStepAt(step, t, stepDur) {
    const bar = Math.floor(step / 8) % 4;
    const beat = step % 8;
    const roots = [110, 87.31, 130.81, 98];
    const third = [130.81, 104.6, 155.56, 117.66];
    const fifth = [164.81, 130.81, 196, 146.83];
    const arp = [440, 523.25, 587.33, 659.25, 587.33, 523.25, 493.88, 440];
    if (beat === 0) {
      this.musicVoice(roots[bar], t, stepDur * 7.4, 0.085, "sine", 0.04);
      this.musicVoice(third[bar], t, stepDur * 7.4, 0.028, "triangle", 0.25);
      this.musicVoice(fifth[bar] * 2, t, stepDur * 6.5, 0.012, "sine", 0.5);
    }
    if (beat % 2 === 0) {
      const f = arp[(Math.floor(step / 1) + bar * 2) % arp.length] * (beat === 4 ? 1 : 1);
      this.musicVoice(f, t, stepDur * 1.6, 0.026, "triangle", 0.01);
    }
    if (beat === 2 || beat === 6) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 6800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.016, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + stepDur * 0.6);
      src.connect(hp);
      hp.connect(g);
      g.connect(this.music);
      src.start(t);
      src.stop(t + stepDur);
    }
  }
}
