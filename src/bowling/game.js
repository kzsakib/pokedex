/* Poké-Pins: ten-pin bowling on five small pixel dioramas.

   The rasteriser is the Pixel Plays engine (MIT, credited in the footer).
   This file owns the lane, ball and pin physics, the ten-frame scorecard, the
   rival bowler, five map configurations and the HUD wiring. */

import PixelEngine from "./engine.js";
import { isMuted } from "../audio.js";

const PokePins = (() => {
  const TAU = Math.PI * 2;
  const W = 360;
  const H = 280;

  const LANE = { half: 1.72, gutter: 0.62, foul: 7.6, head: -6.4, pit: -10.2 };
  const BALL_R = 0.34;
  const PIN_R = 0.22;
  const GRAVITY = 12;
  const MAX_SPEED = 14;
  const HOOK = 2.2;
  const SETTLE_LIMIT = 3;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const hypot = Math.hypot;

  /* ---------------- rack ---------------- */

  function buildRack() {
    const pins = [];
    for (let row = 0; row < 4; row += 1) {
      for (let i = 0; i <= row; i += 1) {
        pins.push({
          x: LANE.head - row * 0.87,
          y: (i - row / 2) * 1.0,
          row,
        });
      }
    }
    return pins;
  }
  const RACK = buildRack();

  /* ---------------- maps ---------------- */

  const MAPS = [
    {
      id: "tropical",
      blurb: "Sea breeze: a crosswind bends the ball through the oil, and the palms lean with it.",
      label: "Tropical Shore",
      decel: 0.5,
      decelName: "bamboo",
      railBounce: 0.45,
      hook: 1,
      pin: "exeggcute",
      ball: { top: [214, 62, 54], bottom: [246, 240, 226], band: [34, 32, 34], button: [246, 240, 226] },
      palette: {
        lane: [162, 120, 74],
        laneAlt: [150, 110, 66],
        gutter: [92, 78, 58],
        bank: [126, 164, 84],
        bankAlt: [104, 146, 72],
        sand: [232, 222, 190],
        rock: [150, 148, 132],
        leaf: { deep: [36, 74, 52], mid: [66, 112, 60], silver: [112, 152, 80], bark: [120, 94, 62] },
        sky: "water",
      },
      wind: true,
      rival: { name: "Kai", shirt: [58, 120, 140], stripe: [232, 224, 200], hair: [42, 40, 38], skin: [214, 164, 122] },
    },
    {
      id: "cave",
      blurb: "Dig-dodge: Diglett duck into their holes just as the ball comes through.",
      label: "Diglett's Cave",
      decel: 2.2,
      decelName: "packed dirt",
      railBounce: 0.4,
      hook: 1,
      pin: "diglett",
      ball: { top: [52, 96, 186], bottom: [240, 238, 230], band: [30, 32, 38], button: [240, 238, 230] },
      palette: {
        lane: [128, 96, 66],
        laneAlt: [116, 86, 58],
        gutter: [58, 46, 36],
        bank: [92, 82, 66],
        bankAlt: [76, 68, 56],
        sand: [140, 124, 96],
        rock: [120, 116, 108],
        leaf: { deep: [40, 56, 48], mid: [64, 86, 62], silver: [96, 118, 84], bark: [88, 68, 50] },
        sky: "cave",
      },
      wind: false,
      duck: true,
      rival: { name: "Rin", shirt: [96, 74, 120], stripe: [200, 190, 210], hair: [32, 30, 36], skin: [206, 158, 120] },
    },
    {
      id: "power-plant",
      blurb: "Overload: a struck Voltorb flashes, then blows every pin near it off the deck.",
      label: "Power Plant",
      decel: 0.3,
      decelName: "steel",
      railBounce: 0.55,
      hook: 1,
      pin: "voltorb",
      ball: { top: [40, 40, 46], bottom: [238, 196, 54], band: [230, 190, 48], button: [40, 40, 46] },
      palette: {
        lane: [128, 134, 140],
        laneAlt: [116, 122, 130],
        gutter: [72, 78, 86],
        bank: [96, 104, 112],
        bankAlt: [82, 90, 98],
        sand: [150, 156, 160],
        rock: [128, 136, 142],
        leaf: { deep: [52, 62, 58], mid: [80, 94, 86], silver: [112, 128, 112], bark: [96, 90, 78] },
        sky: "steel",
      },
      wind: false,
      volts: true,
      rival: { name: "Volk", shirt: [196, 168, 48], stripe: [60, 60, 64], hair: [40, 40, 42], skin: [218, 172, 130] },
    },
    {
      id: "lavender",
      blurb: "Phasing: the Gastly turn intangible on a cycle. Only solid pins stop the ball.",
      label: "Lavender Tower",
      decel: 0.6,
      decelName: "old boards",
      railBounce: 0.45,
      hook: 1,
      pin: "gastly",
      ball: { top: [52, 92, 72], bottom: [28, 34, 34], band: [200, 196, 170], button: [200, 196, 170] },
      palette: {
        lane: [110, 94, 78],
        laneAlt: [100, 84, 70],
        gutter: [58, 50, 44],
        bank: [78, 70, 82],
        bankAlt: [66, 60, 74],
        sand: [124, 114, 126],
        rock: [112, 106, 118],
        leaf: { deep: [42, 38, 56], mid: [66, 58, 82], silver: [96, 86, 110], bark: [78, 66, 58] },
        sky: "night",
      },
      wind: false,
      phase: true,
      rival: { name: "Mira", shirt: [122, 96, 146], stripe: [214, 206, 226], hair: [36, 32, 44], skin: [214, 178, 154] },
    },
    {
      id: "ice-cavern",
      blurb: "Black ice: spin bites 1.6x, pins slide, and the aim preview stops short.",
      label: "Ice Cavern",
      decel: 0.08,
      decelName: "ice",
      railBounce: 0.85,
      hook: 1.6,
      pin: "swinub",
      ball: { top: [244, 242, 236], bottom: [244, 242, 236], band: [196, 58, 58], button: [244, 242, 236] },
      palette: {
        lane: [170, 194, 208],
        laneAlt: [156, 182, 200],
        gutter: [96, 116, 132],
        bank: [224, 232, 238],
        bankAlt: [204, 218, 228],
        sand: [236, 242, 246],
        rock: [176, 192, 204],
        leaf: { deep: [42, 74, 74], mid: [70, 108, 104], silver: [116, 150, 148], bark: [96, 76, 60] },
        sky: "ice",
      },
      wind: false,
      ice: true,
      rival: { name: "Sora", shirt: [108, 148, 176], stripe: [238, 242, 246], hair: [60, 54, 52], skin: [224, 186, 154] },
    },
  ];

  /* ---------------- audio ---------------- */

  let audioCtx = null;
  let noiseBuffer = null;

  function audio() {
    if (isMuted()) return null;
    if (!audioCtx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      audioCtx = new Ctor();
      const master = audioCtx.createGain();
      master.gain.value = 0.38;
      master.connect(audioCtx.destination);
      audioCtx.ppMaster = master;
    }
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    return audioCtx;
  }

  function tone({ from, to, type = "square", length = 0.07, level = 0.04, delay = 0 }) {
    const ctx = audio();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    if (to && to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(30, to), start + length);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(level, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(gain).connect(ctx.ppMaster);
    osc.start(start);
    osc.stop(start + length + 0.02);
  }

  function noise({ length = 0.15, from = 1800, to = 300, level = 0.05, delay = 0 }) {
    const ctx = audio();
    if (!ctx) return;
    if (!noiseBuffer) {
      const frames = Math.floor(ctx.sampleRate * 0.5);
      noiseBuffer = ctx.createBuffer(1, frames, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
    }
    const start = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, to), start + length);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    src.connect(filter).connect(gain).connect(ctx.ppMaster);
    src.start(start);
    src.stop(start + length);
  }

  const sfx = {
    drop: () => {
      noise({ length: 0.09, from: 900, to: 240, level: 0.05 });
      tone({ from: 180, to: 90, type: "sine", length: 0.12, level: 0.04 });
    },
    clack: (n = 1) =>
      noise({ length: 0.07, from: 3400, to: 900, level: 0.035 + n * 0.004 }),
    strike: () => {
      for (let i = 0; i < 7; i += 1) {
        noise({ length: 0.06, from: 3800, to: 700, level: 0.03, delay: i * 0.028 });
      }
      [523, 659, 784, 1046].forEach((f, i) =>
        tone({ from: f, to: f, type: "square", length: 0.1, level: 0.035, delay: 0.12 + i * 0.08 }),
      );
    },
    spare: () => {
      tone({ from: 660, to: 990, type: "square", length: 0.1, level: 0.035 });
      tone({ from: 990, to: 1320, type: "square", length: 0.12, level: 0.03, delay: 0.09 });
    },
    gutter: () => {
      tone({ from: 220, to: 80, type: "sine", length: 0.28, level: 0.04 });
      noise({ length: 0.18, from: 600, to: 180, level: 0.03 });
    },
    roll: (speed) => tone({ from: 90 + speed * 8, to: 90 + speed * 8, type: "triangle", length: 0.05, level: 0.012 }),
    cry: (id) => {
      if (id === "diglett") tone({ from: 1200, to: 1800, type: "square", length: 0.07, level: 0.03 });
      else if (id === "voltorb") {
        tone({ from: 300, to: 1400, type: "sawtooth", length: 0.08, level: 0.03 });
      } else if (id === "gastly") tone({ from: 500, to: 180, type: "sine", length: 0.3, level: 0.03 });
      else if (id === "swinub") tone({ from: 900, to: 600, type: "triangle", length: 0.09, level: 0.025 });
      else tone({ from: 1400, to: 1900, type: "square", length: 0.06, level: 0.025 });
    },
    botAim: () => tone({ from: 420, to: 520, type: "triangle", length: 0.08, level: 0.02 }),
  };

  /* ---------------- scoring ---------------- */

  function scoreGame(frames) {
    const flat = [];
    for (const frame of frames) for (const roll of frame) flat.push(roll);
    const totals = [];
    let index = 0;
    let total = 0;
    let pending = false;
    for (let f = 0; f < 10; f += 1) {
      if (pending) {
        totals.push(null);
        continue;
      }
      if (f < 9) {
        if (frames[f].length === 0) {
          pending = true;
          totals.push(null);
          continue;
        }
        const a = flat[index];
        if (a === 10) {
          if (index + 2 >= flat.length) {
            pending = true;
            totals.push(null);
            continue;
          }
          total += 10 + flat[index + 1] + flat[index + 2];
          index += 1;
        } else if (frames[f].length < 2) {
          pending = true;
          totals.push(null);
          continue;
        } else {
          const b = flat[index + 1];
          if (a + b === 10) {
            if (index + 2 >= flat.length) {
              pending = true;
              totals.push(null);
              continue;
            }
            total += 10 + flat[index + 2];
          } else {
            total += a + b;
          }
          index += 2;
        }
        totals.push(total);
      } else {
        const tenth = frames[9];
        if (tenth.length === 0) {
          pending = true;
          totals.push(null);
          continue;
        }
        const needed = tenth[0] === 10 || tenth[0] + (tenth[1] ?? 0) === 10 ? 3 : 2;
        if (tenth.length < needed) {
          pending = true;
          totals.push(null);
          continue;
        }
        total += tenth.reduce((sum, roll) => sum + roll, 0);
        totals.push(total);
      }
    }
    return { totals, total: pending ? null : total };
  }

  function marksFor(frame, frameIndex, frames) {
    if (!frame || !frame.length) return [];
    const marks = [];
    const isTenth = frameIndex === 9;
    let cursor = 0;
    const add = (value) => marks.push(value === 10 ? "X" : value === 0 ? "-" : String(value));
    for (let r = 0; r < frame.length; r += 1) {
      const roll = frame[r];
      if (isTenth) {
        if (roll === 10) marks.push("X");
        else {
          const prev = r > 0 ? frame[r - 1] : null;
          const standing =
            r === 0 || (r > 0 && prev !== 10 && frame[r - 1] !== undefined && (r < 2 ? frame[0] + frame[1] < 10 : true));
          // spare when the two balls of this mini-rack total 10
          if (r % 2 === 1 && frame[r - 1] !== 10 && frame[r - 1] + roll === 10) marks.push("/");
          else if (r === 2 && frame[1] === 10 && frame[0] !== 10 && frame[0] + roll === 10) marks.push("/");
          else add(roll);
        }
      } else if (r === 0 && roll === 10) marks.push("X");
      else if (r === 1 && frame[0] + roll === 10) marks.push("/");
      else add(roll);
    }
    return marks;
  }

  /* ---------------- instance ---------------- */

  let mounted = null;

  function mount(rootEl) {
    if (!rootEl) return null;
    if (mounted && mounted.root === rootEl) {
      mounted.resume();
      return mounted.api;
    }

    const canvas = rootEl.querySelector(".pp-canvas");
    if (!canvas) return null;

    const engine = PixelEngine.createEngine(canvas, { originY: 10, scale: 16.5 });
    const q = (key) => rootEl.querySelector(`[data-bowl="${key}"]`);
    const hud = {
      you: q("you"),
      rival: q("rival"),
      pins: q("pins"),
      status: q("status"),
      total: q("total"),
      best: q("best"),
      spin: q("spin"),
      banner: q("banner"),
      merc: q("merc"),
      mute: q("mute"),
      maps: q("maps"),
      note: q("note"),
      rules: q("rules"),
    };

    const state = {
      mapIndex: 0,
      map: MAPS[0],
      mode: "solo",
      phase: "aim",
      turn: "you",
      frame: 0,
      roll: 0,
      frames: Array.from({ length: 10 }, () => []),
      rivalFrames: Array.from({ length: 10 }, () => []),
      framesDone: 0,
      rivalDone: 0,
      pins: [],
      ball: null,
      spin: 0,
      aim: 0,
      power: 0,
      dragging: false,
      dragStart: null,
      dragNow: null,
      bowlerX: 0,
      wind: 0,
      botTimer: 0,
      botPlan: null,
      settleTimer: 0,
      sweepTimer: 0,
      flash: 0,
      flashColor: [246, 240, 210],
      banner: "",
      bannerTimer: 0,
      arrow: null,
      clock: 0,
      visible: true,
      paused: false,
      raf: 0,
      lastFrame: 0,
      accumulator: 0,
      over: false,
      tie: false,
      rollCry: 0,
      phaseTimer: 0,
      ballRolled: false,
      rackStanding: 10,
      knockedThisRoll: 0,
      best: 0,
      message: "",
      reduced: false,
    };

    state.reduced = !!(engine.STILL || false);

    function loadBest() {
      try {
        state.best = Number(window.localStorage.getItem(`pixel-plays-${state.map.id}-best`)) || 0;
      } catch {
        state.best = 0;
      }
    }
    function saveBest() {
      try {
        const total = scoreGame(state.frames).total || 0;
        const stored = Number(window.localStorage.getItem(`pixel-plays-${state.map.id}-best`)) || 0;
        if (total > stored) window.localStorage.setItem(`pixel-plays-${state.map.id}-best`, String(total));
      } catch {
        /* private mode */
      }
    }

    /* ---------- HUD ---------- */

    function say(text) {
      state.message = text;
      if (hud.status) hud.status.textContent = text;
    }

    function frameCells(frames, activeFrame, totals) {
      let cells = "";
      for (let f = 0; f < 10; f += 1) {
        const marks = marksFor(frames[f], f, frames).join("");
        const total = totals[f];
        const current = f === activeFrame ? " is-current" : f > activeFrame ? " is-future" : "";
        cells += `<span class="pp-frame${current}" data-f="${f}"><span class="pp-frame__marks">${marks || "&nbsp;"}</span><span class="pp-frame__total">${total == null ? "" : total}</span></span>`;
      }
      return cells;
    }

    function paintHud() {
      const mine = scoreGame(state.frames);
      if (hud.you) {
        hud.you.innerHTML = `<span class="pp-score__label">You</span><span class="pp-score__frames">${frameCells(state.frames, state.frame, mine.totals)}</span><span class="pp-score__total">${mine.totals[state.frame] ?? 0}</span>`;
      }
      if (hud.rival) {
        const theirs = scoreGame(state.rivalFrames);
        const show = state.mode === "versus";
        hud.rival.hidden = !show;
        if (show) {
          hud.rival.innerHTML = `<span class="pp-score__label">${state.map.rival.name}</span><span class="pp-score__frames">${frameCells(state.rivalFrames, state.frame, theirs.totals)}</span><span class="pp-score__total">${theirs.totals[state.frame] ?? 0}</span>`;
        }
      }
      if (hud.pins) {
        const standing = state.pins.filter((pin) => !pin.down);
        hud.pins.innerHTML = Array.from({ length: 10 }, (_, i) => {
          const pin = state.pins[i];
          const up = pin && !pin.down;
          return `<i class="pp-pindot${up ? " is-up" : ""}" aria-hidden="true"></i>`;
        }).join("");
        hud.pins.setAttribute("aria-label", `${standing.length} pins standing`);
      }
      if (hud.total) hud.total.textContent = mine.total == null ? "" : String(mine.total);
      if (hud.best) hud.best.textContent = String(state.best);
      if (hud.spin) hud.spin.textContent = String(Math.round(state.spin * 10) / 10);
      if (hud.banner) {
        hud.banner.textContent = state.banner;
        hud.banner.hidden = !state.banner;
      }
    }

    function paintModes() {
      rootEl.querySelectorAll("[data-mode]").forEach((button) => {
        const active = button.dataset.mode === state.mode;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    }

    function paintMaps() {
      if (hud.note) hud.note.textContent = state.map.blurb || "";
      if (!hud.maps) return;
      hud.maps.innerHTML = MAPS.map(
        (map, i) =>
          `<button type="button" class="pp-map${i === state.mapIndex ? " is-current" : ""}" data-map="${i}">${map.label}</button>`,
      ).join("");
    }

    /* ---------- scene ---------- */

    function laneColor(map, x, y) {
      const board = Math.floor((y + LANE.half) / 0.22);
      return board % 2 ? map.palette.laneAlt : map.palette.lane;
    }

    function palm(e, x, y, h, seed) {
      const top = [x + 0.22, y, h];
      for (let i = 0; i < 4; i += 1) {
        const a = 0.3 + (i / 4) * (h - 0.3);
        const b = 0.3 + ((i + 1) / 4) * (h - 0.3);
        const ax = x + Math.sin(i * 0.4 + seed) * 0.06;
        const bx = x + Math.sin((i + 1) * 0.4 + seed) * 0.06;
        e.capsule([ax, y, a], [bx, y, b], 0.15 - i * 0.02, 0.13 - i * 0.02, () => (i % 2 ? [124, 92, 60] : [140, 106, 68]), "solid");
      }
      e.capsule([x, y, h - 0.25], [top[0], top[1], top[2]], 0.12, 0.09, () => [130, 98, 64], "solid");
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * TAU + seed;
        const mid = [top[0] + Math.cos(a) * 0.6, top[1] + Math.sin(a) * 0.6, h + 0.1];
        const end = [top[0] + Math.cos(a) * 1.25, top[1] + Math.sin(a) * 1.25, h - 0.28];
        e.capsule(top, mid, 0.14, 0.08, () => [58, 108, 60], "solid");
        e.capsule(mid, end, 0.08, 0.015, () => [74, 126, 66], "solid");
      }
      e.sphere(top[0] + 0.06, top[1] + 0.02, h - 0.12, 0.15, [104, 80, 52], "solid");
      e.sphere(top[0] - 0.12, top[1] + 0.08, h - 0.16, 0.12, [96, 74, 48], "solid");
    }

    function buildScene(e, map) {
      e.field(-14, -8, 11, 8, 0.07, (x, y) => {
        const ay = Math.abs(y);
        if (ay > 6.0 || x < -12.2 || x > 9.2) return null;
        if (ay < LANE.half) {
          return { z: 0.3, color: laneColor(map, x, y), kind: e.KIND_GROUND, shade: 0.1 };
        }
        if (ay < LANE.half + LANE.gutter) {
          return { z: 0.24, color: map.palette.gutter, kind: e.KIND_GROUND, shade: -0.25 };
        }
        if (map.id === "tropical") {
          if (y > 2.45) {
            const edge = y < 2.85;
            const foam = edge && e.noise(x * 1.7, y * 3.1) > 0.5;
            return {
              z: edge ? 0.2 : -0.06,
              color: foam ? [238, 246, 238] : y > 4 ? [56, 140, 152] : [80, 168, 172],
              kind: e.KIND_GROUND,
              shade: edge ? 0.1 : -0.15,
            };
          }
          const wet = y > 2.2 ? [214, 202, 172] : null;
          const grain = e.noise(x * 1.3, y * 1.3) > 0.62;
          return {
            z: 0.3,
            color: wet || (grain ? mix(map.palette.sand, [250, 242, 214], 0.6) : map.palette.sand),
            kind: e.KIND_GROUND,
            shade: 0.15,
          };
        }
        if (ay < 5.2) {
          const light = e.noise(x * 0.4, y * 0.4) > 0.55;
          return {
            z: 0.3,
            color: light ? map.palette.bankAlt : map.palette.bank,
            kind: e.KIND_GRASS,
            shade: 0.2,
          };
        }
        return { z: 0.3, color: mix(map.palette.bank, map.palette.sand, 0.4), kind: e.KIND_GROUND, shade: 0.1 };
      });

      /* rails */
      e.box(-9.9, -LANE.half - LANE.gutter - 0.18, 0.24, 9.0, -LANE.half - LANE.gutter, 0.52, mix(map.palette.gutter, [40, 38, 36], 0.3), 1);
      e.box(-9.9, LANE.half + LANE.gutter, 0.24, 9.0, LANE.half + LANE.gutter + 0.18, 0.52, mix(map.palette.gutter, [40, 38, 36], 0.3), 2);
      /* pit and back wall */
      e.box(-10.9, -2.5, 0, -9.7, 2.5, 0.24, mix(map.palette.gutter, [24, 22, 24], 0.55), 3);
      e.box(-11.2, -2.6, 0, -10.9, 2.6, 0.9, mix(map.palette.lane, map.palette.gutter, 0.4), 4);

      if (map.id === "tropical") {
        palm(e, -9.2, -4.6, 2.3, 0.4);
        palm(e, 4.9, -4.9, 2.0, 1.7);
        palm(e, 8.6, 4.6, 1.7, 2.9);
        /* tiki bar on the sand */
        e.box(2.6, -3.9, 0.3, 5.0, -2.9, 1.0, [146, 106, 68], 7);
        e.box(2.5, -4.0, 1.0, 5.1, -2.8, 1.12, [176, 138, 88], 8);
        for (let i = 0; i < 5; i += 1) {
          e.capsule([2.7 + i * 0.55, -2.4, 0.3], [2.7 + i * 0.55, -2.4, 1.5], 0.07, 0.05, () => [120, 92, 60], "solid");
        }
        e.box(2.4, -4.3, 1.95, 5.2, -2.5, 2.1, [198, 172, 104], 9);
        e.box(2.6, -4.1, 2.1, 5.0, -2.7, 2.2, [176, 150, 88], 10);
        /* parasol */
        e.capsule([6.5, -3.9, 0.3], [6.5, -3.9, 2.15], 0.05, 0.04, () => [226, 216, 196], "solid");
        for (let i = 0; i < 8; i += 1) {
          const a = (i / 8) * TAU;
          e.sphere(6.5 + Math.cos(a) * 0.62, -3.9 + Math.sin(a) * 0.62, 2.08, 0.3, i % 2 ? [210, 92, 80] : [242, 234, 216], "solid");
        }
        e.sphere(6.5, -3.9, 2.18, 0.26, [232, 224, 206], "solid");
        /* driftwood bench */
        e.box(0.6, -4.9, 0.3, 2.4, -4.4, 0.52, [156, 120, 80], 7);
        e.box(0.7, -4.6, 0.5, 2.3, -4.45, 0.62, [176, 140, 96], 8);
        /* sea breeze flag */
        e.capsule([7.4, 1.9, 0.3], [7.4, 1.9, 2.2], 0.05, 0.04, () => [236, 232, 218], "solid");
        e.box(7.4, 1.75, 1.9, 8.2 + state.wind * 0.5, 1.95, 2.15, [214, 96, 76], 11);
      } else if (map.id === "cave") {
        const rocks = [[-9.4, -4.4], [-6.2, 3.9], [-3.6, -4.7], [0.6, 4.2], [3.4, -4.2], [6.6, 4.4], [8.8, -4.5]];
        for (const [rx, ry] of rocks) {
          e.sphere(rx, ry, 0.4, rand(0.4, 0.75), map.palette.rock, "rough");
        }
        const crystals = [[-8.2, 3.0], [-4.8, -3.3], [-1.6, 3.4], [1.8, -3.5], [5.4, 3.1], [7.8, -3.1]];
        for (const [cx, cy] of crystals) {
          e.capsule([cx, cy, 0.3], [cx, cy, 1.9], 0.22, 0.05, () => [120, 200, 210], "gloss");
          e.capsule([cx + 0.35, cy + 0.2, 0.3], [cx + 0.35, cy + 0.2, 1.1], 0.12, 0.04, () => [92, 168, 184], "gloss");
        }
      } else if (map.id === "power-plant") {
        for (let i = 0; i < 3; i += 1) {
          const x = 5.4 - i * 4.2;
          e.box(x, 4.6, 0.3, x + 0.3, 4.9, 4.2, [104, 112, 118], i);
          e.capsule([x + 0.15, 4.75, 4.2], [x + 0.15, 4.75, 5.2], 0.12, 0.05, () => [140, 148, 152], "solid");
        }
        e.capsule([-2.4, -4.2, 0.3], [-2.4, -4.2, 2.6], 0.5, 0.3, () => [96, 108, 116], "rough");
        e.sphere(-2.4, -4.2, 2.8, 0.7, [70, 120, 140], "gloss");
      } else if (map.id === "lavender") {
        for (let i = 0; i < 5; i += 1) {
          const x = -8 + i * 4.2;
          e.box(x, 4.4, 0.3, x + 0.5, 4.9, 1.3, [104, 100, 112], i);
          e.sphere(x + 0.25, 4.65, 1.45, 0.2, [96, 90, 110], "solid");
        }
        for (let i = 0; i < 4; i += 1) {
          e.capsule([4 - i * 2.6, -4.4, 0.3], [4 - i * 2.6, -4.4, 0.9], 0.09, 0.07, () => [232, 226, 206], "solid");
          e.sphere(4 - i * 2.6, -4.4, 1.0, 0.08, [252, 216, 132], "gloss");
        }
      } else if (map.id === "ice-cavern") {
        for (let i = 0; i < 6; i += 1) {
          const x = -9 + i * 3.6;
          e.capsule([x, 4.6, 0.3], [x, 4.6, 2.4], 0.28, 0.1, () => [60, 92, 92], "solid");
          e.sphere(x, 4.6, 1.6, 0.7, [188, 216, 220], "rough");
        }
        for (let i = 0; i < 5; i += 1) {
          e.sphere(-6 + i * 3.1, -4.5, 0.4, 0.5, [224, 236, 240], "rough");
        }
      }

      if (map.id === "lavender" || map.id === "ice-cavern") e.growGrass();
      for (let a = 0; a < TAU; a += 0.1) {
        const rr = 6.7;
        e.castShadow(Math.cos(a) * rr, Math.sin(a) * rr, 0.3, 0.5, 0.5, 0.22);
      }
    }

    function bakeLevel() {
      engine.clear();
      buildScene(engine, state.map);
      engine.applyShadows();
      engine.bakeOcclusion();
      engine.bake();
    }

    /* ---------- game setup ---------- */

    function freshPins() {
      return RACK.map((pin, i) => ({
        id: i,
        x: pin.x,
        y: pin.y,
        baseX: pin.x,
        baseY: pin.y,
        vx: 0,
        vy: 0,
        vz: 0,
        z: state.map.pin === "gastly" ? 0.25 : 0,
        theta: 0,
        phi: 0,
        thetaVel: 0,
        down: false,
        lying: false,
        latched: false,
        exploded: false,
        duck: 0,
        duckCooldown: 0,
        willDuck: state.map.duck ? Math.random() < 0.1 : false,
        wobble: 0,
        rollAngle: 0,
      }));
    }

    function resetGame() {
      state.frames = Array.from({ length: 10 }, () => []);
      state.rivalFrames = Array.from({ length: 10 }, () => []);
      state.frame = 0;
      state.roll = 0;
      state.turn = "you";
      state.phase = "aim";
      state.over = false;
      state.tie = false;
      state.ball = null;
      state.pins = freshPins();
      state.power = 0;
      state.spin = 0;
      state.aim = 0;
      state.bowlerX = 0;
      state.wind = state.map.wind ? rand(-0.6, 0.6) : 0;
      state.banner = "";
      state.arrow = null;
      state.knockedThisRoll = 0;
      state.rackStanding = 10;
      state.phaseTimer = 0;
      loadBest();
      state.best = state.best || 0;
      paintHud();
      paintModes();
      say(state.mode === "versus" ? "you break · drag back and release" : "drag back and release to bowl");
      paintMaps();
    }

    function resetRack() {
      state.pins = freshPins();
      state.rackStanding = 10;
      state.ball = null;
      state.phase = "aim";
      state.roll = 0;
    }

    function startThrow(power, aim, spin) {
      if (state.phase !== "aim") return;
      const speed = 6 + clamp(power, 0, 1) * 8;
      state.ball = {
        x: 7.55,
        y: state.bowlerX,
        z: 0.5,
        vx: -speed * Math.cos(aim),
        vy: speed * Math.sin(aim),
        vz: 0,
        spin,
        phase: 0,
        stopped: false,
        gone: false,
        gutter: false,
      };
      state.spin = spin;
      state.aim = aim;
      state.power = power;
      state.phase = "roll";
      state.ballRolled = true;
      state.settleTimer = 0;
      state.rackStanding = state.pins.filter((p) => !p.down).length;
      sfx.drop();
      say("rolling");
      paintHud();
    }

    function throwBall() {
      const power = state.dragging ? clamp(state.power, 0.08, 1) : clamp(state.power || 0.65, 0.08, 1);
      startThrow(power, state.aim, state.spin);
    }

    /* ---------- physics ---------- */

    function pinActive(pin) {
      if (pin.down || pin.exploded) return false;
      if (pin.duck > 0) return false;
      if (state.map.phase && state.phaseSolid === false) return false;
      return true;
    }

    function tipPin(pin, relative, nx, ny) {
      if (state.map.pin === "voltorb") {
        pin.rolling = true;
        pin.vx += nx * relative * 0.9;
        pin.vy += ny * relative * 0.9;
        sfx.cry("voltorb");
        for (const other of state.pins) {
          if (other === pin || other.down || other.exploded || Math.abs(other.id - pin.id) > 3) continue;
          const ox = other.x - pin.x;
          const oy = other.y - pin.y;
          const od = hypot(ox, oy);
          if (od > 1.15) continue;
          pinBurst(other, 1.2, ox / od, oy / od);
        }
        return;
      }
      if (state.map.pin === "diglett") {
        pin.vz = rand(4, 6);
        pin.z = Math.max(pin.z, 0.05);
        pin.phi = Math.atan2(ny, nx);
        pin.launched = true;
        pin.down = true;
        sfx.cry("diglett");
        for (const other of state.pins) {
          if (other === pin || other.down || other.exploded) continue;
          const ox = other.x - pin.x;
          const oy = other.y - pin.y;
          const od = hypot(ox, oy);
          if (od > 1.3) continue;
          pinBurst(other, 2.0, ox / od, oy / od);
        }
        return;
      }
      pin.thetaVel = Math.max(pin.thetaVel, 3.2 * relative);
      pin.phi = Math.atan2(ny, nx);
      pin.latched = false;
      sfx.clack();
      if (state.map.pin === "gastly") sfx.cry("gastly");
    }

    function pinBurst(pin, speed, nx, ny) {
      pin.thetaVel = Math.max(pin.thetaVel, 4.2 * speed);
      pin.phi = Math.atan2(ny, nx);
      pin.latched = false;
      pin.vx += nx * speed * 1.6;
      pin.vy += ny * speed * 1.6;
    }

    function stepBall(dt) {
      const ball = state.ball;
      if (!ball || ball.gone) return;
      const map = state.map;
      if (ball.z > BALL_R) {
        ball.vz -= GRAVITY * dt;
        ball.z += ball.vz * dt;
        if (ball.z <= BALL_R) {
          ball.z = BALL_R;
          ball.vz = 0;
        }
      }
      let speed = hypot(ball.vx, ball.vy);
      if (Math.abs(ball.y) > LANE.half - BALL_R * 0.4 && !ball.gutter) {
        ball.gutter = true;
        ball.z = -0.15;
        ball.vy = 0;
      }
      if (!ball.gutter) {
        const oil = ball.x > 1.5 ? 0.15 : 1;
        ball.vy += ball.spin * HOOK * map.hook * (speed / MAX_SPEED) * oil * dt;
        if (map.wind) ball.vy += state.wind * (speed / MAX_SPEED) * oil * dt;
        if (map.ice) ball.vy += ball.spin * HOOK * 0.6 * (speed / MAX_SPEED) * dt;
        if (ball.x < 1.5 && Math.abs(ball.y) > LANE.half + LANE.gutter - BALL_R && map.railBounce) {
          ball.y = Math.sign(ball.y) * (LANE.half + LANE.gutter - BALL_R);
          ball.vy *= -map.railBounce;
        }
      }
      speed = hypot(ball.vx, ball.vy);
      if (speed > 0) {
        const drop = map.decel * dt;
        const factor = Math.max(0, (speed - drop) / speed);
        ball.vx *= factor;
        ball.vy *= factor;
      }
      if (speed < 0.04) ball.stopped = true;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      ball.phase += (speed * dt) / BALL_R;
      if (ball.x < LANE.pit) {
        ball.gone = true;
        if (ball.gutter) sfx.gutter();
      }
      if (state.map.volts && Math.random() < 0.004) state.zap = 0.2;
    }

    function stepPins(dt) {
      const map = state.map;
      for (const pin of state.pins) {
        if (pin.duck > 0) pin.duck = Math.max(0, pin.duck - dt);
        if (pin.launched) {
          pin.vz -= GRAVITY * dt;
          pin.z += pin.vz * dt;
          pin.x += pin.vx * dt;
          pin.y += pin.vy * dt;
          if (pin.z <= 0) {
            pin.z = 0;
            pin.launched = false;
            sfx.clack(2);
          }
          continue;
        }
        if (pin.down && !pin.rolling) continue;
        const friction = map.pin === "swinub" ? 1.4 : 2.6;
        const sp = hypot(pin.vx, pin.vy);
        if (sp > 0) {
          const f = Math.max(0, (sp - friction * dt) / sp);
          pin.vx *= f;
          pin.vy *= f;
        }
        const capped = hypot(pin.vx, pin.vy);
        if (capped > 12) {
          pin.vx *= 12 / capped;
          pin.vy *= 12 / capped;
        }
        pin.thetaVel = clamp(pin.thetaVel, -16, 16);
        pin.x += pin.vx * dt;
        pin.y += pin.vy * dt;
        if (Math.abs(pin.y) > LANE.half + LANE.gutter - PIN_R) {
          pin.y = Math.sign(pin.y) * (LANE.half + LANE.gutter - PIN_R);
          pin.vy *= -0.5;
        }
        if (pin.x < LANE.pit + 0.25) {
          pin.down = true;
          pin.exploded = true;
          continue;
        }
        if (pin.theta > 0 || pin.thetaVel !== 0) {
          if (!pin.latched && pin.theta < 0.42) {
            pin.thetaVel += (-16 * pin.theta - 4 * pin.thetaVel) * dt;
          } else {
            pin.latched = true;
            pin.thetaVel += 12 * dt;
          }
          pin.theta += pin.thetaVel * dt;
          if (pin.theta <= 0) {
            pin.theta = 0;
            pin.thetaVel = 0;
          }
          if (pin.theta >= 1.45) {
            pin.theta = 1.45;
            pin.thetaVel = 0;
            pin.down = true;
            pin.lying = true;
          }
        }
        if (map.pin === "voltorb" && pin.rolling) {
          pin.rollAngle += sp * dt;
          const moved = hypot(pin.x - pin.baseX, pin.y - pin.baseY);
          if (moved > 0.4) pin.down = true;
        }
      }

      /* pin-pin, including pins already toppling onto their neighbours */
      for (let i = 0; i < state.pins.length; i += 1) {
        const a = state.pins[i];
        if (a.exploded || a.launched || a.duck > 0) continue;
        const falling = !a.down && a.theta > 0.06;
        const lying = a.down && a.lying;
        const rolling = !a.down && a.rolling;
        if (!falling && !lying && !rolling) continue;
        if (map.pin === "voltorb" && !lying) continue;
        const reach = lying || rolling ? 0 : Math.sin(Math.min(1.5, a.theta)) * 0.78;
        const ax = a.x + Math.cos(a.phi) * reach;
        const ay = a.y + Math.sin(a.phi) * reach;
        const aSpeed = lying || rolling ? hypot(a.vx, a.vy) : Math.max(hypot(a.vx, a.vy), Math.abs(a.thetaVel) * 0.45);
        if (aSpeed < 0.5) continue;
        for (let j = 0; j < state.pins.length; j += 1) {
          if (i === j) continue;
          const b = state.pins[j];
          if (b.down || b.exploded || b.duck > 0 || b.launched) continue;
          const dx = b.x - ax;
          const dy = b.y - ay;
          const d = hypot(dx, dy) || 0.001;
          const min = 0.58;
          if (d >= min) continue;
          const nx = dx / d;
          const ny = dy / d;
          const push = min - d + 0.01;
          b.x += nx * push * 0.7;
          b.y += ny * push * 0.7;
          b.vx += nx * aSpeed * 0.45;
          b.vy += ny * aSpeed * 0.45;
          tipPin(b, Math.max(1, aSpeed * 0.8), nx, ny);
          if (!lying) {
            a.vx *= 0.8;
            a.vy *= 0.8;
            a.thetaVel *= 0.75;
          }
        }
      }

      /* ball-pin */
      const ball = state.ball;
      if (!ball || ball.gone || ball.gutter) return;
      for (const pin of state.pins) {
        if (!pinActive(pin)) continue;
        if (map.duck && pin.willDuck && pin.duck <= 0 && ball.x > pin.x && ball.x - pin.x < 1.7) {
          pin.duck = 0.6;
          pin.willDuck = false;
          sfx.cry("diglett");
          continue;
        }
        if (map.pin === "gastly" || map.pin === "diglett") {
          const dx = ball.x - pin.x;
          const dy = ball.y - pin.y;
          if (hypot(dx, dy) < BALL_R + PIN_R + 0.16) {
            tipPin(pin, Math.max(1, hypot(ball.vx, ball.vy)), -dx / (hypot(dx, dy) || 1), -dy / (hypot(dx, dy) || 1));
            pin.down = true;
            pin.theta = 1.45;
          }
          continue;
        }
        const dx = pin.x - ball.x;
        const dy = pin.y - ball.y;
        const d = hypot(dx, dy) || 0.001;
        const min = BALL_R + PIN_R;
        if (d >= min) continue;
        const nx = dx / d;
        const ny = dy / d;
        const rel = (ball.vx - pin.vx) * nx + (ball.vy - pin.vy) * ny;
        const push = min - d + 0.01;
        ball.x -= nx * push * 0.25;
        ball.y -= ny * push * 0.25;
        pin.x += nx * push * 0.75;
        pin.y += ny * push * 0.75;
        if (rel <= 0) continue;
        const impulse = rel * 1.05;
        ball.vx -= impulse * 0.18 * nx;
        ball.vy -= impulse * 0.18 * ny;
        pin.vx += impulse * nx;
        pin.vy += impulse * ny;
        pin.thetaVel = Math.max(pin.thetaVel, 4.2 * rel);
        pin.phi = Math.atan2(ny, nx);
        pin.latched = false;
        if (rel > 0.35) sfx.clack();
      }
    }

    function allAsleep() {
      const ball = state.ball;
      if (ball && !ball.gone && !ball.stopped) return false;
      for (const pin of state.pins) {
        if (pin.launched) return false;
        if (pin.duck > 0) return false;
        if (pin.theta > 0.12 && pin.theta < 1.44) return false;
        if (pin.theta > 0.05 && Math.abs(pin.thetaVel) > 0.35) return false;
        if (Math.abs(pin.thetaVel) > 0.06) return false;
        if (hypot(pin.vx, pin.vy) > 0.04) return false;
      }
      return true;
    }

    /* ---------- roll and frame resolution ---------- */

    function finishRoll() {
      const standing = state.pins.filter((pin) => !pin.down).length;
      const knocked = clamp(state.rackStanding - standing, 0, 10);
      state.knockedThisRoll = knocked;
      const frames = state.turn === "you" ? state.frames : state.rivalFrames;
      frames[state.frame].push(knocked);

      const frame = frames[state.frame];
      if (state.frame === 9) {
        const tenth = frame;
        const firstStrike = tenth[0] === 10;
        const spare = tenth.length === 2 && tenth[0] !== 10 && tenth[0] + tenth[1] === 10;
        const done = (firstStrike || spare) ? tenth.length >= 3 : tenth.length >= 2;
        if (done) endFrame();
        else {
          if (firstStrike || spare) resetRack();
          else sweepRack(false);
        }
      } else if (knocked === 10 && frame.length === 1) {
        state.banner = "strike!";
        state.bannerTimer = 1.1;
        sfx.strike();
        flash(0.3, [252, 244, 206]);
        endFrame();
      } else if (frame.length >= 2) {
        const total = frame[0] + frame[1];
        if (total === 10) {
          state.banner = "spare";
          state.bannerTimer = 1.1;
          sfx.spare();
          flash(0.22, [206, 238, 228]);
        }
        endFrame();
      } else {
        state.banner = knocked === 0 ? "gutter" : `${knocked} down`;
        state.bannerTimer = 1;
        if (knocked === 0) sfx.gutter();
        state.arrow = state.pins.find((pin) => !pin.down) || null;
        sweepRack(false);
      }
      paintHud();
    }

    function sweepRack(full) {
      state.phase = "sweep";
      state.sweepTimer = full ? 0.9 : 0.65;
      state.sweepFull = full;
    }

    function endFrame() {
      const frames = state.turn === "you" ? state.frames : state.rivalFrames;
      if (state.turn === "you") state.framesDone = state.frame + 1;
      else state.rivalDone = state.frame + 1;
      state.phase = "sweep";
      state.sweepTimer = 0.9;
      state.sweepFull = true;
      if (state.mode === "versus" && state.turn === "you") {
        state.turn = "rival";
      } else {
        state.turn = "you";
        if (state.frame < 9) state.frame += 1;
      }
      if (state.frame > 9) state.frame = 9;
      paintHud();
    }

    function afterSweep() {
      if (state.sweepFull) {
        resetRack();
        state.arrow = null;
      } else {
        state.pins = state.pins.filter((pin) => !pin.down);
        state.ball = null;
        state.phase = "aim";
        state.ballRolled = false;
        say(state.turn === "you" ? "second roll · drag and release" : "rival's second roll");
      }
      if (state.sweepFull) {
        const mineDone = state.frames.every((f) => f.length > 0);
        const rivalDone = state.rivalFrames.every((f) => f.length > 0);
        const both = state.mode === "versus" ? mineDone && rivalDone : mineDone;
        if (both) {
          finishGame();
          return;
        }
        if (state.turn === "rival") {
          beginRivalTurn();
        } else {
          say(state.mode === "versus" ? "your frame · drag and release" : "drag back and release");
        }
      }
    }

    function finishGame() {
      state.phase = "over";
      state.over = true;
      const mine = scoreGame(state.frames);
      const theirs = scoreGame(state.rivalFrames);
      saveBest();
      loadBest();
      const win = state.mode === "versus" ? (mine.total || 0) > (theirs.total || 0) : false;
      state.banner = state.mode === "versus" ? (win ? "you win" : (mine.total || 0) === (theirs.total || 0) ? "tie" : "rival wins") : `game · ${mine.total || 0}`;
      state.bannerTimer = 999;
      say(`game over · ${mine.total || 0}${state.mode === "versus" ? ` to ${theirs.total || 0}` : ""} · tap to play again`);
      paintHud();
    }

    /* ---------- rival ---------- */

    function planRival() {
      const standing = state.pins.filter((pin) => !pin.down);
      const target = standing.length === 10 ? { x: LANE.head, y: 0.3 } : standing[standing.length - 1] || { x: LANE.head, y: 0 };
      const first = state.frames[state.frame] || [];
      const secondShot = first.length > 0 || state.roll === 1;
      const dx = target.x - 7.55;
      const dy = target.y - state.bowlerX;
      let aim = Math.atan2(dy, dx) - Math.PI;
      aim += (Math.random() - 0.5) * 0.05;
      const power = clamp(0.7 + (Math.random() - 0.5) * 0.12, 0.4, 1);
      const spin = secondShot ? rand(-0.2, 0.2) : rand(-0.35, 0.35);
      return { aim, power, spin };
    }

    function beginRivalTurn() {
      const fresh = (state.rivalFrames[state.frame] || []).length === 0;
      state.turn = "rival";
      state.phase = "aim";
      if (fresh) state.pins = freshPins();
      state.ball = null;
      state.botTimer = 1.4;
      state.botPlan = planRival();
      say(`${state.map.rival.name} is lining up`);
      sfx.botAim();
    }

    function stepRival(dt) {
      if (state.phase !== "aim" || state.turn !== "rival") return;
      state.botTimer -= dt;
      const plan = state.botPlan;
      if (plan) {
        state.bowlerX = lerp(state.bowlerX, 0, dt * 2);
        state.aim = lerp(state.aim, plan.aim, dt * 3.2);
        state.power = lerp(state.power, plan.power, dt * 2.4);
        state.spin = plan.spin;
      }
      if (state.botTimer <= 0) {
        state.roll = (state.rivalFrames[state.frame] || []).length;
        startThrow(plan.power, plan.aim, plan.spin);
        state.turn = "rival";
      }
    }

    /* ---------- effects ---------- */

    function flash(duration, color) {
      state.flash = duration;
      state.flashMax = duration;
      state.flashColor = color;
    }

    function update(dt) {
      state.clock += dt;
      if (state.flash > 0) state.flash = Math.max(0, state.flash - dt);
      if (state.bannerTimer > 0 && state.bannerTimer < 900) {
        state.bannerTimer -= dt;
        if (state.bannerTimer <= 0) {
          state.banner = "";
          paintHud();
        }
      }
      if (state.map.phase) {
        const cycle = state.clock % 2.4;
        state.phaseSolid = cycle < 1.25 || cycle > 1.65;
      } else {
        state.phaseSolid = true;
      }

      if (state.phase === "aim") stepRival(dt);
      if (state.phase === "roll" || state.phase === "settle") {
        const substeps = 6;
        const h = Math.min(dt, 0.04) / substeps;
        for (let i = 0; i < substeps; i += 1) {
          stepBall(h);
          stepPins(h);
        }
        state.settleTimer += dt;
        if (state.phase === "roll") {
          if (allAsleep() || state.settleTimer > SETTLE_LIMIT) {
            state.phase = "settle";
            state.settleTimer = 0;
          }
        } else if (allAsleep() || state.settleTimer > 0.7) {
          finishRoll();
        }
      } else if (state.phase === "sweep") {
        state.sweepTimer -= dt;
        if (state.sweepTimer <= 0) afterSweep();
      }
    }

    /* ---------- drawing ---------- */

    function paintBall(e, x, y, z, phase) {
      const p = e.project(x, y, z);
      const rp = BALL_R * e.camera.s * 1.18;
      const map = state.map;
      const cos = Math.cos(phase);
      const sin = Math.sin(phase);
      const y0 = Math.max(0, Math.floor(p.sy - rp));
      const y1 = Math.min(e.H - 1, Math.ceil(p.sy + rp));
      const x0 = Math.max(0, Math.floor(p.sx - rp));
      const x1 = Math.min(e.W - 1, Math.ceil(p.sx + rp));
      for (let iy = y0; iy <= y1; iy += 1) {
        for (let ix = x0; ix <= x1; ix += 1) {
          const dx = (ix + 0.5 - p.sx) / rp;
          const dy = (iy + 0.5 - p.sy) / rp;
          const nn = dx * dx + dy * dy;
          if (nn > 1) continue;
          const nz = Math.sqrt(1 - nn);
          const d = p.d + BALL_R * nz;
          const i = iy * e.W + ix;
          if (d <= e.zb[i]) continue;
          const band = dy * cos + nz * sin;
          let color;
          if (Math.abs(band) < 0.1) color = map.ball.band;
          else if (band > 0) color = map.ball.top;
          else color = map.ball.bottom;
          if (dx * dx + band * band < 0.045) color = map.ball.button;
          const light = 0.82 + nz * 0.3;
          e.zb[i] = d;
          e.pix[i] = e.rgb(color[0] * light, color[1] * light, color[2] * light);
        }
      }
    }

  const EGG = [250, 238, 206];
  const EGG_SPOT = [198, 108, 92];
  const INK = [40, 36, 34];

  function faceAt(e, x, y, z, spread, eye, mouth) {
    const p = e.project(x, y, z);
    const c = e.rgb(eye[0], eye[1], eye[2]);
    for (const ox of [-spread, spread]) {
      e.dot(p.sx + ox, p.sy, c);
      e.dot(p.sx + ox + 1, p.sy, c);
      e.dot(p.sx + ox, p.sy + 1, c);
      e.dot(p.sx + ox + 1, p.sy + 1, c);
    }
    if (mouth) {
      const m = e.rgb(mouth[0], mouth[1], mouth[2]);
      e.dot(p.sx, p.sy + 3, m);
      e.dot(p.sx + 1, p.sy + 3, m);
    }
  }

  function drawPin(e, pin) {
    const map = state.map;
    const kind = map.pin;
    const tilt = pin.theta;
    const dx = Math.cos(pin.phi) * Math.sin(tilt);
    const dy = Math.sin(pin.phi) * Math.sin(tilt);
    const lift = pin.z || 0;
    const height = kind === "gastly" ? 1.3 : kind === "swinub" ? 1.0 : 1.18;
    const tip = [pin.x + dx * height, pin.y + dy * height, lift + Math.cos(tilt) * height];
    const solid = "solid";

    if (kind === "exeggcute") {
      const cz = lift + 0.62 * Math.cos(tilt);
      const cx = pin.x + dx * 0.55;
      const cy = pin.y + dy * 0.55;
      /* the big egg carries the face, two smaller ones ride at its base */
      e.sphere(cx, cy, cz, 0.42, EGG, solid);
      e.sphere(cx + dx * 0.18, cy + dy * 0.18, cz + 0.05, 0.3, [242, 226, 190], solid);
      e.sphere(pin.x - 0.3 + dx * 0.16, pin.y + 0.12 + dy * 0.16, lift + 0.3, 0.28, EGG, solid);
      e.sphere(pin.x + 0.3 + dx * 0.16, pin.y - 0.1 + dy * 0.16, lift + 0.3, 0.27, [244, 228, 194], solid);
      for (const [sx, sy, sz, r] of [
        [cx + 0.18, cy + 0.16, cz + 0.22, 0.11],
        [cx - 0.16, cy - 0.1, cz + 0.24, 0.09],
        [pin.x - 0.34, pin.y + 0.2, lift + 0.42, 0.08],
        [pin.x + 0.36, pin.y - 0.02, lift + 0.4, 0.07],
      ]) {
        e.sphere(sx, sy, sz, r, EGG_SPOT, solid);
      }
      const fp = e.project(cx + 0.27, cy + 0.21, cz + 0.08);
      e.dot(fp.sx - 3, fp.sy, e.rgb(INK[0], INK[1], INK[2]));
      e.dot(fp.sx - 2, fp.sy, e.rgb(INK[0], INK[1], INK[2]));
      e.dot(fp.sx + 3, fp.sy, e.rgb(INK[0], INK[1], INK[2]));
      e.dot(fp.sx + 4, fp.sy, e.rgb(INK[0], INK[1], INK[2]));
      e.dot(fp.sx, fp.sy + 3, e.rgb(168, 96, 84));
      e.dot(fp.sx + 1, fp.sy + 3, e.rgb(168, 96, 84));
      e.capsule([pin.x, pin.y, lift + 1.04], [pin.x + 0.18, pin.y - 0.04, lift + 1.3], 0.1, 0.025, () => [82, 148, 76], solid);
      e.capsule([pin.x + 0.12, pin.y + 0.02, lift + 1.02], [pin.x + 0.34, pin.y + 0.1, lift + 1.16], 0.07, 0.02, () => [70, 132, 66], solid);
    } else if (kind === "diglett") {
      e.sphere(pin.x, pin.y, lift + 0.04, 0.44, [96, 70, 48], "rough");
      e.sphere(pin.x, pin.y, lift + 0.1, 0.34, [112, 82, 56], "rough");
      const hz = lift + 0.62 * Math.cos(tilt);
      const hxp = pin.x + dx * 0.62;
      const hyp = pin.y + dy * 0.62;
      e.sphere(hxp, hyp, hz, 0.4, [148, 104, 74], solid);
      e.sphere(hxp + 0.26, hyp + 0.2, hz - 0.02, 0.13, [236, 162, 158], solid);
      const f = e.project(hxp + 0.2, hyp + 0.16, hz + 0.16);
      e.dot(f.sx - 5, f.sy, e.rgb(34, 30, 28));
      e.dot(f.sx - 4, f.sy, e.rgb(34, 30, 28));
      e.dot(f.sx + 4, f.sy, e.rgb(34, 30, 28));
      e.dot(f.sx + 5, f.sy, e.rgb(34, 30, 28));
      e.capsule([hxp + 0.1, hyp + 0.2, hz - 0.12], [hxp + 0.3, hyp + 0.24, hz - 0.16], 0.05, 0.02, () => [90, 60, 40], solid);
    } else if (kind === "voltorb") {
      const electrode = pin.id === 5 || pin.id === 8;
      const top = electrode ? [242, 240, 232] : [212, 62, 52];
      const bottom = electrode ? [212, 62, 52] : [242, 240, 232];
      const cx = pin.x + dx * 0.34;
      const cy = pin.y + dy * 0.34;
      const cz = lift + 0.47 + (pin.rolling ? Math.sin(pin.rollAngle) * 0.02 : 0);
      e.sphere(cx, cy, cz, 0.43, top, solid);
      e.sphere(cx, cy, cz - 0.17, 0.37, bottom, solid);
      e.capsule([cx - 0.35, cy, cz - 0.02], [cx + 0.35, cy, cz - 0.02], 0.055, 0.055, () => [34, 32, 34], solid);
      faceAt(e, cx + 0.14, cy + 0.1, cz + 0.17, 3, INK, [120, 40, 40]);
    } else if (kind === "gastly") {
      const cz = lift + 0.55 + Math.sin(state.clock * 2 + pin.id) * 0.03;
      e.sphere(pin.x + dx * 0.4, pin.y + dy * 0.4, cz, 0.45, [96, 66, 136], solid);
      for (let i = 0; i < 6; i += 1) {
        const a = state.clock * 0.8 + i * 1.05 + pin.id;
        e.sphere(
          pin.x + dx * 0.4 + Math.cos(a) * 0.4,
          pin.y + dy * 0.4 + Math.sin(a) * 0.4,
          cz + Math.sin(a * 2) * 0.08,
          0.17,
          [116, 84, 154],
          solid,
        );
      }
      faceAt(e, pin.x + 0.2, pin.y + 0.14, cz + 0.08, 3, [244, 240, 228]);
      const m = e.project(pin.x + 0.22, pin.y + 0.16, cz + 0.02);
      e.dot(m.sx, m.sy + 2, e.rgb(196, 104, 108));
    } else {
      const snorunt = pin.id % 3 === 0;
      if (snorunt) {
        e.capsule([pin.x, pin.y, lift + 0.06], [tip[0], tip[1], tip[2] * 0.9], 0.26, 0.17, () => [228, 236, 242], solid);
        e.sphere(tip[0], tip[1], tip[2] * 0.92, 0.24, [238, 244, 248], solid);
        e.capsule([tip[0] - 0.2, tip[1] - 0.02, tip[2] * 0.92], [tip[0] + 0.2, tip[1] - 0.02, tip[2] * 0.92], 0.1, 0.1, () => [96, 152, 196], solid);
        faceAt(e, tip[0] + 0.1, tip[1] + 0.05, tip[2] * 0.92 + 0.08, 3, [250, 200, 84]);
      } else {
        e.sphere(pin.x + dx * 0.08, pin.y + dy * 0.08, lift + 0.3, 0.38, [156, 112, 88], solid);
        e.sphere(pin.x + dx * 0.24 + 0.02, pin.y + dy * 0.24 + 0.02, lift + 0.46, 0.28, [176, 128, 100], solid);
        e.capsule([pin.x + 0.1, pin.y + 0.05, lift + 0.42], [pin.x + 0.36, pin.y + 0.2, lift + 0.38], 0.13, 0.11, () => [196, 148, 116], solid);
        faceAt(e, pin.x + 0.3, pin.y + 0.16, lift + 0.52, 3, INK);
        e.capsule([pin.x + 0.12, pin.y + 0.02, lift + 0.2], [pin.x + 0.12, pin.y + 0.02, lift + 0.08], 0.04, 0.02, () => [240, 240, 230], solid);
      }
    }
  }

    function drawBowler(e) {
      const pal = state.turn === "rival" ? state.map.rival : null;
      const shirt = pal ? pal.shirt : [238, 234, 220];
      const stripe = pal ? pal.stripe : [182, 72, 52];
      const skin = pal ? pal.skin : [228, 178, 132];
      const cap = pal ? pal.hair : [178, 56, 44];
      const shorts = [46, 50, 62];
      const shoe = [32, 30, 32];
      const x = 8.05;
      const y = state.bowlerX;
      const z = 0.12;
      const swinging = state.phase === "roll";
      const arm = swinging ? 2.35 : state.turn === "rival" ? 1.0 : 0.32 + state.power * 1.25;
      const lean = swinging ? 0.34 : 0.12;
      const hip = z + 0.78;
      const chest = z + 1.3;

      e.castShadow(x - 0.08, y, 0.05, 0.7, 0.75, 0.55);
      /* legs */
      e.capsule([x, y - 0.16, z + 0.02], [x + 0.02, y - 0.17, hip], 0.13, 0.11, () => shorts, "solid");
      e.capsule([x, y + 0.16, z + 0.02], [x + 0.02, y + 0.17, hip], 0.13, 0.11, () => shorts, "solid");
      /* shoes */
      e.box(x - 0.1, y - 0.27, z, x + 0.34, y - 0.05, z + 0.12, shoe, 8);
      e.box(x - 0.1, y + 0.05, z, x + 0.34, y + 0.27, z + 0.12, shoe, 9);
      /* shorts then shirt, so both read */
      e.capsule([x + 0.02, y, z + 0.5], [x + 0.02, y, z + 0.92], 0.26, 0.24, () => shorts, "solid");
      e.capsule([x + 0.02, y, z + 0.88], [x + 0.02 + lean * 0.3, y, chest], 0.25, 0.2, () => shirt, "solid");
      e.box(x + 0.12, y - 0.17, z + 1.02, x + 0.24, y + 0.17, z + 1.16, stripe, 10);
      e.capsule([x + 0.02, y, chest - 0.02], [x + 0.02, y, chest + 0.1], 0.1, 0.08, () => skin, "solid");
      /* off arm: sleeve then bare forearm */
      e.capsule([x + 0.02, y - 0.24, chest - 0.08], [x + 0.06, y - 0.3, z + 1.02], 0.09, 0.075, () => shirt, "solid");
      e.capsule([x + 0.06, y - 0.3, z + 1.02], [x + 0.12, y - 0.34, z + 0.76], 0.065, 0.055, () => skin, "solid");
      e.sphere(x + 0.12, y - 0.34, z + 0.73, 0.075, skin, "solid");
      /* head */
      const hx = x + 0.02 + lean * 0.32;
      e.capsule([hx, y, chest], [hx + 0.01, y, chest + 0.08], 0.1, 0.1, () => skin, "solid");
      e.sphere(hx, y, chest + 0.2, 0.2, skin, "solid");
      /* cap dome and brim */
      e.sphere(hx - 0.02, y, chest + 0.28, 0.19, cap, "solid");
      e.box(hx + 0.12, y - 0.15, chest + 0.22, hx + 0.28, y + 0.15, chest + 0.29, cap, 11);
      const eye = e.project(hx + 0.17, y + 0.07, chest + 0.18);
      e.dot(eye.sx, eye.sy, e.rgb(30, 28, 28));
      e.dot(eye.sx + 1, eye.sy, e.rgb(30, 28, 28));
      const eye2 = e.project(hx + 0.16, y - 0.07, chest + 0.18);
      e.dot(eye2.sx, eye2.sy, e.rgb(30, 28, 28));
      const mouth = e.project(hx + 0.19, y + 0.0, chest + 0.11);
      e.dot(mouth.sx, mouth.sy, e.rgb(150, 96, 78));
      /* throwing arm */
      const shoulder = [hx, y + 0.26, chest - 0.06];
      const hand = [
        hx + Math.sin(arm) * 0.42,
        y + 0.34 + Math.cos(arm) * 0.08,
        z + 0.72 + Math.cos(arm) * 0.56,
      ];
      const elbow = [shoulder[0] + Math.sin(arm) * 0.2, shoulder[1] + 0.06, shoulder[2] - 0.22];
      e.capsule(shoulder, elbow, 0.09, 0.07, () => shirt, "solid");
      e.capsule(elbow, hand, 0.065, 0.055, () => skin, "solid");
      e.sphere(hand[0], hand[1], hand[2], 0.08, skin, "solid");
      e.flushShadows();
      return { x: hand[0] + 0.02, y: hand[1], z: hand[2] };
    }

    function drawAim(e) {
      if (state.phase !== "aim" || state.turn === "rival") return;
      if (state.dragging) {
        const from = e.project(7.55, state.bowlerX, 0.4);
        const back = 14 + state.power * 46;
        for (let i = 2; i < back; i += 4) {
          e.dot(from.sx + i * 0.55, from.sy + i * 0.5, e.rgb(244, 238, 220));
        }
        const barX = e.W - 16;
        const barTop = e.H - 70;
        for (let i = 0; i < 10; i += 1) {
          const filled = i < Math.round(state.power * 10);
          e.dot(barX, barTop + i * 4, filled ? e.rgb(214, 92, 64) : e.rgb(120, 116, 108));
          e.dot(barX + 1, barTop + i * 4, filled ? e.rgb(196, 78, 54) : e.rgb(120, 116, 108));
        }
      }
      const speed = 6 + state.power * 8;
      let x = 7.55;
      let y = state.bowlerX;
      let vx = -speed * Math.cos(state.aim);
      let vy = speed * Math.sin(state.aim);
      for (let i = 0; i < 60; i += 1) {
        const dt = 0.02;
        if (x < 1.5) vy += state.spin * HOOK * state.map.hook * (hypot(vx, vy) / MAX_SPEED) * dt;
        x += vx * dt;
        y += vy * dt;
        if (x < LANE.head + 0.4) break;
        if (i % 4 === 0) {
          const p = e.project(x, y, 0.18);
          e.dot(p.sx, p.sy, e.rgb(250, 248, 240));
        }
      }
      const cross = e.project(x, y, 0.2);
      e.ring(cross.sx, cross.sy, 4, 0.45, e.rgb(250, 248, 240), 2);
      e.ring(cross.sx, cross.sy, 8, 0.45, e.rgb(70, 66, 60), 3);
    }

    function drawEffects(e) {
      if (state.arrow) {
        const p = e.project(state.arrow.x, state.arrow.y, 1.5);
        const bob = Math.sin(state.clock * 6) * 2;
        const ink = e.rgb(250, 214, 90);
        for (let i = 0; i < 4; i += 1) {
          e.dot(p.sx - i, p.sy - 8 + i + bob, ink);
          e.dot(p.sx + i, p.sy - 8 + i + bob, ink);
        }
        e.dot(p.sx, p.sy - 1 + bob, ink);
        e.dot(p.sx, p.sy + bob, ink);
      }
      if (state.flash > 0) {
        const k = state.flash / 0.3;
        for (let i = 0; i < e.pix.length; i += 7) {
          if (e.zb[i] < -1e8) continue;
          e.pix[i] = e.rgb(state.flashColor[0] * (0.6 + k * 0.4), state.flashColor[1] * (0.6 + k * 0.4), state.flashColor[2] * (0.6 + k * 0.4));
        }
      }
    }

    function draw() {
      engine.resetFrame();
      engine.drawTufts(state.clock);
      engine.drawLeaves(state.clock);
      const hand = drawBowler(engine);
      const ball = state.ball;
      if (ball && !ball.gone) paintBall(engine, ball.x, ball.y, Math.max(ball.z, BALL_R * 0.5), ball.phase);
      else if (state.phase === "aim") {
        paintBall(engine, hand.x + 0.16, hand.y + 0.3, hand.z + 0.12, state.clock * 2);
      }
      for (const pin of state.pins) {
        if (pin.down && !pin.lying && !pin.launched) continue;
        if (!pin.down) engine.castShadow(pin.x, pin.y, 0, 0.26, 0.8, 0.4);
        drawPin(engine, pin);
      }
      drawAim(engine);
      engine.applyShadows();
      engine.shadeEdges();
      drawEffects(engine);
      engine.present();
    }

    /* ---------- input ---------- */

    function pointerWorld(event) {
      const rect = canvas.getBoundingClientRect();
      const sx = ((event.clientX - rect.left) / rect.width) * W;
      const sy = ((event.clientY - rect.top) / rect.height) * H;
      return engine.unproject(sx, sy);
    }

    function onPointerDown(event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      try {
        canvas.setPointerCapture?.(event.pointerId);
      } catch {
        /* synthetic */
      }
      try {
        canvas.focus({ preventScroll: true });
      } catch {
        /* old browsers */
      }
      if (state.phase === "over") {
        resetGame();
        return;
      }
      if (state.phase !== "aim" || state.turn === "rival") return;
      audio();
      state.dragging = true;
      state.dragStart = { x: event.clientX, y: event.clientY };
    }

    function onPointerMove(event) {
      if (!state.dragging || state.phase !== "aim") return;
      const dx = event.clientX - state.dragStart.x;
      const dy = event.clientY - state.dragStart.y;
      const pull = Math.hypot(dx, dy);
      state.power = clamp(pull / 130, 0, 1);
      state.aim = clamp(-dx * 0.0022, -0.2, 0.2);
      say(`power ${Math.round(state.power * 100)} · spin ${state.spin.toFixed(1)}`);
    }

    function onPointerUp(event) {
      try {
        canvas.releasePointerCapture?.(event.pointerId);
      } catch {
        /* not captured */
      }
      if (!state.dragging) return;
      state.dragging = false;
      if (state.phase === "aim" && state.turn === "you") throwBall();
    }

    function onKeyDown(event) {
      if (event.code === "Space" || event.key === " " || event.key === "Enter") {
        event.preventDefault();
        if (event.repeat) return;
        if (state.phase === "over") {
          resetGame();
          return;
        }
        if (state.phase === "aim" && state.turn === "you") {
          state.power = state.power || 0.65;
          throwBall();
        }
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        state.aim = clamp(state.aim + (event.key === "ArrowRight" ? 0.02 : -0.02), -0.22, 0.22);
      }
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        state.power = clamp(state.power + (event.key === "ArrowUp" ? 0.05 : -0.05), 0, 1);
      }
      if (event.key === "a" || event.key === "A" || event.key === "d" || event.key === "D") {
        state.bowlerX = clamp(state.bowlerX + (event.key.toLowerCase() === "a" ? -0.15 : 0.15), -1.2, 1.2);
      }
      if (event.key === "q" || event.key === "Q" || event.key === "e" || event.key === "E") {
        state.spin = clamp(state.spin + (event.key.toLowerCase() === "q" ? -0.2 : 0.2), -1, 1);
      }
    }

    /* ---------- loop ---------- */

    function frame(now) {
      if (!mounted || mounted.root !== rootEl) return;
      const raw = Math.min(50, now - (state.lastFrame || now));
      state.lastFrame = now;
      if (!state.paused) {
        state.accumulator += raw;
        let guard = 0;
        while (state.accumulator >= 1000 / 60 && guard < 4) {
          update(1 / 60);
          state.accumulator -= 1000 / 60;
          guard += 1;
        }
        draw();
      }
      state.raf = requestAnimationFrame(frame);
    }

    function syncSize() {
      const width = Math.min(1160, rootEl.clientWidth || 360);
      engine.fit(width, 3);
    }

    const resizeObserver = new ResizeObserver(syncSize);
    resizeObserver.observe(rootEl);
    const intersectionObserver = new IntersectionObserver((entries) => {
      state.visible = !!entries[0]?.isIntersecting;
    }, { threshold: 0.05 });
    intersectionObserver.observe(canvas);

    function onVisibility() {
      if (document.hidden) state.paused = true;
      else {
        state.paused = false;
        state.lastFrame = 0;
        state.accumulator = 0;
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    function onMapClick(event) {
      const button = event.target.closest("[data-map]");
      if (!button) return;
      const index = Number(button.dataset.map);
      if (Number.isNaN(index) || index === state.mapIndex) return;
      state.mapIndex = index;
      state.map = MAPS[index];
      bakeLevel();
      resetGame();
      paintMaps();
      say(`${state.map.label} · drag back and release`);
    }
    hud.maps?.addEventListener("click", onMapClick);

    function onModeClick(event) {
      const button = event.target.closest("[data-mode]");
      if (!button) return;
      state.mode = button.dataset.mode;
      resetGame();
      paintMaps();
    }
    rootEl.addEventListener("click", onModeClick);

    function onNudge(event) {
      const button = event.target.closest("[data-nudge]");
      if (!button || state.phase !== "aim") return;
      const step = button.dataset.nudge;
      if (step === "pos-left") state.bowlerX = clamp(state.bowlerX - 0.15, -1.2, 1.2);
      if (step === "pos-right") state.bowlerX = clamp(state.bowlerX + 0.15, -1.2, 1.2);
      if (step === "spin-left") state.spin = clamp(state.spin - 0.2, -1, 1);
      if (step === "spin-right") state.spin = clamp(state.spin + 0.2, -1, 1);
      paintHud();
    }
    rootEl.addEventListener("click", onNudge);

    function onMute() {
      window.dispatchEvent(new CustomEvent("pokedex:sound-toggle"));
      if (hud.mute) {
        hud.mute.setAttribute("aria-pressed", String(isMuted()));
        hud.mute.textContent = isMuted() ? "Sound off" : "Sound on";
      }
    }
    hud.mute?.addEventListener("click", onMute);

    const bound = {
      pointerdown: onPointerDown,
      pointermove: onPointerMove,
      pointerup: onPointerUp,
      pointercancel: onPointerUp,
      keydown: onKeyDown,
    };
    Object.entries(bound).forEach(([type, handler]) =>
      canvas.addEventListener(type, handler, { passive: type === "pointermove" || type === "keydown" }),
    );

    syncSize();
    bakeLevel();
    resetGame();
    if (hud.mute) {
      hud.mute.setAttribute("aria-pressed", String(isMuted()));
      hud.mute.textContent = isMuted() ? "Sound off" : "Sound on";
    }
    state.lastFrame = performance.now();
    state.raf = requestAnimationFrame(frame);

    const api = {
      pause: () => {
        state.paused = true;
      },
      resume: () => {
        state.paused = false;
        state.lastFrame = 0;
      },
      step(seconds) {
        let left = Math.max(0, seconds);
        while (left > 0) {
          update(1 / 60);
          left -= 1 / 60;
        }
        draw();
      },
    };

    mounted = {
      root: rootEl,
      api,
      state,
      destroy() {
        cancelAnimationFrame(state.raf);
        resizeObserver.disconnect();
        intersectionObserver.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
        Object.entries(bound).forEach(([type, handler]) => canvas.removeEventListener(type, handler));
        hud.maps?.removeEventListener("click", onMapClick);
        rootEl.removeEventListener("click", onModeClick);
        hud.mute?.removeEventListener("click", onMute);
        mounted = null;
      },
      resume: api.resume,
      pause: api.pause,
    };

    window.__bowl = {
      G: state,
      step: api.step,
      score: scoreGame,
      maps: MAPS,
      throwBall: (power, aim, spin) => startThrow(power, aim, spin),
      reset: resetGame,
    };
    return api;
  }

  return {
    mount,
    destroy() {
      mounted?.destroy();
    },
    pause() {
      mounted?.pause();
    },
    resume() {
      mounted?.resume();
    },
    get state() {
      return mounted?.state ?? null;
    },
  };
})();

window.PokePins = PokePins;

export default PokePins;
