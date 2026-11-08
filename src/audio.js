/* Interface sound. Every effect is synthesised here from oscillators, so
   nothing is ripped from a game or carried as an audio asset; the only
   sample the page ever plays is the cry PokéAPI serves per species.

   Browsers refuse to start an AudioContext before a gesture, so the context
   is created lazily and resumed from the first pointer/key event. Until then
   playback calls are silent no-ops rather than errors. */

import { useEffect, useState } from "react";

const STORAGE_KEY = "pokedex.muted";

function readMuted() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

let muted = readMuted();
let ctx = null;
let master = null;
let cry = null;
const listeners = new Set();

function context() {
  if (ctx) return ctx;
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.72;
  master.connect(ctx.destination);
  return ctx;
}

/* A voice asked for in the same gesture that creates the context would
   otherwise be dropped while the context is still suspended, which is why
   the very first click used to be silent. Hold the last one and play it the
   moment the context starts running. */
let queued = null;

export function unlockAudio() {
  const audio = context();
  if (!audio) return;
  if (audio.state === "suspended") {
    audio
      .resume()
      .then(() => {
        const pending = queued;
        queued = null;
        if (pending) pending();
      })
      .catch(() => {});
  }
}

/* The context is only allowed to exist once the visitor has interacted. */
if (typeof window !== "undefined") {
  const unlock = () => unlockAudio();
  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true });
}

function ready() {
  if (muted) return null;
  const audio = context();
  if (!audio || audio.state !== "running") return null;
  return audio;
}

/* Runs a voice now if the context is live, keeps it for the next unlock if
   the page has not been touched yet. */
function schedule(voice) {
  if (muted) return;
  if (ready()) {
    voice();
    return;
  }
  if (ctx && ctx.state === "suspended") {
    queued = voice;
    unlockAudio();
  }
}

/* One short voiced blip with a percussive envelope. */
function blip({ from, to, type = "square", length = 0.06, level = 0.05, delay = 0 }) {
  const audio = ready();
  if (!audio) return;
  const start = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, to), start + length);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(level, start + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(master);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

/* Short filtered noise burst: the body of a ball hitting something, which a
   plain oscillator cannot give. */
function thud({ length = 0.08, level = 0.05, from = 1800, to = 320 }) {
  const audio = ready();
  if (!audio) return;
  const frames = Math.max(1, Math.floor(audio.sampleRate * length));
  const buffer = audio.createBuffer(1, frames, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    const falloff = (1 - i / frames) ** 2;
    data[i] = (Math.random() * 2 - 1) * falloff;
  }
  const source = audio.createBufferSource();
  source.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(from, audio.currentTime);
  filter.frequency.exponentialRampToValueAtTime(Math.max(80, to), audio.currentTime + length);
  const gain = audio.createGain();
  gain.gain.value = level;
  source.connect(filter).connect(gain).connect(master);
  source.start();
}

const VOICES = {
  /* Soft detent as the pointer crosses a control. */
  hover: () => blip({ from: 1180, to: 1420, type: "triangle", length: 0.035, level: 0.03 }),
  /* Mechanical key press. */
  click: () => {
    blip({ from: 620, to: 380, type: "square", length: 0.055, level: 0.06 });
    blip({ from: 1560, to: 1200, type: "sine", length: 0.03, level: 0.028 });
  },
  /* Crossing a sprite in the wall: the short, dry cursor tick a handheld
     menu makes, quiet enough that sweeping 151 cells stays a texture. */
  sprite: () => {
    blip({ from: 1320, to: 990, type: "square", length: 0.026, level: 0.022 });
    blip({ from: 660, to: 660, type: "triangle", length: 0.02, level: 0.012 });
  },
  /* Sprite picked: the rising two-step confirm of a menu select. */
  pick: () => {
    blip({ from: 784, to: 784, type: "square", length: 0.045, level: 0.045 });
    blip({ from: 1046, to: 1046, type: "square", length: 0.07, level: 0.04, delay: 0.05 });
  },
  /* Record loaded: a three-note fanfare. */
  reveal: () => {
    blip({ from: 523, to: 523, type: "square", length: 0.06, level: 0.04 });
    blip({ from: 659, to: 659, type: "square", length: 0.06, level: 0.04, delay: 0.065 });
    blip({ from: 784, to: 1046, type: "square", length: 0.16, level: 0.042, delay: 0.13 });
  },
  /* Filter chip engaged. */
  filter: () => blip({ from: 880, to: 660, type: "triangle", length: 0.07, level: 0.038 }),

  /* --- catch arena ------------------------------------------------- */
  /* Ball picked up off the rack. */
  grab: () => blip({ from: 520, to: 760, type: "triangle", length: 0.05, level: 0.04 }),
  /* Released with a swipe: a whoosh over the wrist snap. */
  throw: () => {
    thud({ length: 0.14, level: 0.05, from: 2800, to: 700 });
    blip({ from: 300, to: 660, type: "sine", length: 0.09, level: 0.03 });
  },
  /* Ball meets a specimen. */
  impact: () => {
    thud({ length: 0.1, level: 0.1, from: 1900, to: 180 });
    blip({ from: 250, to: 110, type: "square", length: 0.07, level: 0.05 });
  },
  /* Drawn into the ball. */
  absorb: () => {
    blip({ from: 940, to: 170, type: "sawtooth", length: 0.3, level: 0.032 });
    blip({ from: 470, to: 120, type: "triangle", length: 0.26, level: 0.03, delay: 0.03 });
  },
  /* Ball snaps shut. */
  close: () => {
    thud({ length: 0.06, level: 0.07, from: 2400, to: 400 });
    blip({ from: 720, to: 320, type: "square", length: 0.07, level: 0.045 });
  },
  /* Three shakes, each a step higher. */
  shake: () => blip({ from: 400, to: 300, type: "triangle", length: 0.075, level: 0.045 }),
  shake2: () => blip({ from: 460, to: 330, type: "triangle", length: 0.075, level: 0.045 }),
  shake3: () => blip({ from: 520, to: 370, type: "triangle", length: 0.075, level: 0.045 }),
  /* Gotcha: the four-note flourish. */
  caught: () => {
    blip({ from: 523, to: 523, type: "square", length: 0.09, level: 0.045 });
    blip({ from: 659, to: 659, type: "square", length: 0.09, level: 0.045, delay: 0.1 });
    blip({ from: 784, to: 784, type: "square", length: 0.09, level: 0.045, delay: 0.2 });
    blip({ from: 1046, to: 1046, type: "square", length: 0.26, level: 0.05, delay: 0.3 });
    blip({ from: 1568, to: 1568, type: "sine", length: 0.26, level: 0.025, delay: 0.3 });
  },
  /* Nothing reached. */
  miss: () => {
    blip({ from: 330, to: 240, type: "triangle", length: 0.1, level: 0.04 });
    blip({ from: 240, to: 170, type: "triangle", length: 0.14, level: 0.035, delay: 0.1 });
  },
};

export function playSfx(name) {
  const voice = VOICES[name];
  if (voice) schedule(voice);
}

export function playCry(url) {
  if (!url || muted) return;
  unlockAudio();
  if (!cry) cry = new Audio();
  cry.pause();
  cry.currentTime = 0;
  cry.src = url;
  cry.volume = 0.55;
  const attempt = cry.play();
  if (attempt?.catch) attempt.catch(() => {});
}

export function isMuted() {
  return muted;
}

export function setMuted(next) {
  muted = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    /* private mode: the toggle still works for this session */
  }
  if (master) master.gain.value = next ? 0 : 0.72;
  if (next && cry) cry.pause();
  listeners.forEach((listener) => listener(muted));
}

export function toggleMuted() {
  setMuted(!muted);
  if (!muted) {
    unlockAudio();
    /* The context resumes asynchronously; wait a beat so the confirmation
       blip is actually audible on the turn sound comes back on. */
    window.setTimeout(() => playSfx("click"), 80);
  }
  return muted;
}

export function useSound() {
  const [value, setValue] = useState(muted);
  useEffect(() => {
    const listener = (next) => setValue(next);
    listeners.add(listener);
    setValue(muted);
    return () => listeners.delete(listener);
  }, []);
  return value;
}
