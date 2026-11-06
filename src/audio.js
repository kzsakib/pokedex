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
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ctx.destination);
  return ctx;
}

export function unlockAudio() {
  const audio = context();
  if (!audio) return;
  if (audio.state === "suspended") audio.resume().catch(() => {});
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

const VOICES = {
  /* Soft detent as the pointer crosses a control. */
  hover: () => blip({ from: 1180, to: 1420, type: "triangle", length: 0.035, level: 0.018 }),
  /* Mechanical key press. */
  click: () => {
    blip({ from: 620, to: 380, type: "square", length: 0.055, level: 0.045 });
    blip({ from: 1560, to: 1200, type: "sine", length: 0.03, level: 0.02 });
  },
  /* Record loaded: a two-note confirm. */
  reveal: () => {
    blip({ from: 523, to: 660, type: "sine", length: 0.11, level: 0.038 });
    blip({ from: 784, to: 988, type: "sine", length: 0.14, level: 0.03, delay: 0.085 });
  },
  /* Filter chip engaged. */
  filter: () => blip({ from: 880, to: 660, type: "triangle", length: 0.07, level: 0.032 }),
};

export function playSfx(name) {
  const voice = VOICES[name];
  if (voice) voice();
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
  if (master) master.gain.value = next ? 0 : 0.5;
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
