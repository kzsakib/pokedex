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

  const LANE = { half: 1.72, gutter: 0.62, foul: 7.6, head: -6.4, pit: -9.6 };
  const BALL_R = 0.34;
  const PIN_R = 0.22;
  const GRAVITY = 12;
  const MAX_SPEED = 14;
  const HOOK = 2.2;
  const SETTLE_LIMIT = 6;

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

    const engine = PixelEngine.createEngine(canvas, { originY: 18, scale: 15 });
    const q = (key) => rootEl.querySelector(`[data-bowl="${key}"]`);
    const hud = {
      you: q("you"),
      rival: q("rival"),
      pins: q("pins"),
      status: q("status"),
      total: q("total"),
      best: q("best"),
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
      e.capsule([x, y, 0.3], [x + 0.18, y, h * 0.62], 0.17, 0.11, () => [138, 104, 64], "solid");
      e.capsule([x + 0.18, y, h * 0.62], [x + 0.34, y, h], 0.12, 0.08, () => [122, 92, 58], "solid");
      for (let i = 0; i < 7; i += 1) {
        const a = (i / 7) * TAU + seed;
        const tx = x + 0.34 + Math.cos(a) * 1.15;
        const ty = y + Math.sin(a) * 1.15;
        e.capsule([x + 0.34, y, h + 0.12], [tx, ty, h + 0.05 + Math.sin(a * 2) * 0.18], 0.22, 0.02, () => [64, 116, 62], "solid");
      }
      e.sphere(x + 0.34, y, h + 0.16, 0.15, [112, 86, 54], "solid");
    }

    function buildScene(e, map) {
      e.field(-14, -8, 11, 8, 0.07, (x, y) => {
        const ay = Math.abs(y);
        if (ay > 6.2 || x < -12.6 || x > 9.6) return null;
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
        e.castShadow(Math.cos(a) * rr, Math.sin(a) * rr, 0.3, 0.5, 0.5, 0.35);
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
        return;
      }
      if (state.map.pin === "diglett") {
        pin.vz = rand(4, 6);
        pin.z = Math.max(pin.z, 0.05);
        pin.phi = Math.atan2(ny, nx);
        pin.launched = true;
        pin.down = true;
        sfx.cry("diglett");
        return;
      }
      pin.thetaVel = Math.max(pin.thetaVel, 3.2 * relative);
      pin.phi = Math.atan2(ny, nx);
      pin.latched = false;
      sfx.clack();
      if (state.map.pin === "gastly") sfx.cry("gastly");
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
        const friction = map.pin === "swinub" ? 1.6 : 3.5;
        const sp = hypot(pin.vx, pin.vy);
        if (sp > 0) {
          const f = Math.max(0, (sp - friction * dt) / sp);
          pin.vx *= f;
          pin.vy *= f;
        }
        pin.x += pin.vx * dt;
        pin.y += pin.vy * dt;
        if (Math.abs(pin.y) > LANE.half + LANE.gutter - PIN_R) {
          pin.y = Math.sign(pin.y) * (LANE.half + LANE.gutter - PIN_R);
          pin.vy *= -0.5;
        }
        if (pin.x < LANE.pit + 0.6) {
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

      /* pin-pin */
      for (let i = 0; i < state.pins.length; i += 1) {
        const a = state.pins[i];
        if (a.down || a.exploded || a.duck > 0) continue;
        for (let j = i + 1; j < state.pins.length; j += 1) {
          const b = state.pins[j];
          if (b.down || b.exploded || b.duck > 0) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = hypot(dx, dy) || 0.001;
          const min = PIN_R * 2;
          if (d >= min) continue;
          const nx = dx / d;
          const ny = dy / d;
          const overlap = (min - d) / 2;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
          const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (rel > 0) {
            const impulse = rel * 1.6 * 0.5;
            a.vx -= impulse * nx;
            a.vy -= impulse * ny;
            b.vx += impulse * nx;
            b.vy += impulse * ny;
            if (rel > 0.7) tipPin(b, rel * 0.8, nx, ny);
          }
        }
      }

      /* ball-pin */
      const ball = state.ball;
      if (!ball || ball.gone || ball.gutter) return;
      for (const pin of state.pins) {
        if (!pinActive(pin)) continue;
        if (map.duck && pin.duck <= 0 && ball.x > pin.x && ball.x - pin.x < 2.2 && Math.random() < 0.01) {
          pin.duck = 0.6;
          sfx.cry("diglett");
          continue;
        }
        if (map.pin === "gastly" || map.pin === "diglett") {
          const dx = ball.x - pin.x;
          const dy = ball.y - pin.y;
          if (hypot(dx, dy) < BALL_R + PIN_R) {
            tipPin(pin, Math.max(1, hypot(ball.vx, ball.vy)), -dx, -dy);
            pin.down = true;
            pin.theta = 1.45;
          }
          continue;
        }
        const dx = ball.x - pin.x;
        const dy = ball.y - pin.y;
        const d = hypot(dx, dy) || 0.001;
        const min = BALL_R + PIN_R;
        if (d >= min) continue;
        const nx = dx / d;
        const ny = dy / d;
        const rel = (ball.vx - pin.vx) * nx + (ball.vy - pin.vy) * ny;
        if (rel <= 0) continue;
        const impulse = (rel * 1.75) / 1.18;
        ball.vx -= impulse * 0.18 * nx;
        ball.vy -= impulse * 0.18 * ny;
        pin.vx += impulse * nx;
        pin.vy += impulse * ny;
        pin.x += nx * (min - d) * 0.4;
        pin.y += ny * (min - d) * 0.4;
        if (rel > 0.6) tipPin(pin, rel, nx, ny);
      }
    }

    function allAsleep() {
      const ball = state.ball;
      if (ball && !ball.gone && !ball.stopped) return false;
      for (const pin of state.pins) {
        if (pin.launched) return false;
        if (pin.duck > 0) return false;
        if (pin.theta > 0.02 && pin.theta < 1.44) return false;
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
      const rp = BALL_R * e.camera.s;
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

  const EGG = [246, 232, 200];
  const EGG_SPOT = [214, 138, 120];

  function drawPin(e, pin) {
      const map = state.map;
      const kind = map.pin;
      const tilt = pin.theta;
      const dx = Math.cos(pin.phi) * Math.sin(tilt);
      const dy = Math.sin(pin.phi) * Math.sin(tilt);
      const lift = pin.z || 0;
      const base = [pin.x, pin.y, lift];
      const height = kind === "gastly" ? 1.2 : kind === "swinub" ? 0.92 : 1.12;
      const tip = [pin.x + dx * height, pin.y + dy * height, lift + Math.cos(tilt) * height];
      const solid = "solid";

      if (kind === "exeggcute") {
        const k = 1;
        const eggs = [
          [-0.16, 0, 0.22], [0.16, 0.02, 0.22], [0, -0.18, 0.22],
          [-0.08, 0.04, 0.52], [0.12, -0.02, 0.5], [0.02, 0.02, 0.8],
        ];
        for (const [ox, oy, oz] of eggs) {
          e.sphere(pin.x + ox * k + dx * oz * 0.9, pin.y + oy * k + dy * oz * 0.9, lift + oz * Math.cos(tilt), 0.22 * k, EGG, solid);
          e.sphere(pin.x + ox * k + dx * oz * 0.9 + 0.06, pin.y + oy * k + dy * oz * 0.9, lift + oz * Math.cos(tilt) + 0.08, 0.085, EGG_SPOT, solid);
        }
        e.capsule([pin.x, pin.y, lift + 0.9], [pin.x + 0.1, pin.y, lift + 1.08], 0.09, 0.03, () => [92, 150, 80], solid);
      } else if (kind === "diglett") {
        e.sphere(pin.x, pin.y, lift + 0.04, 0.3, [118, 86, 58], "rough");
        e.capsule([pin.x, pin.y, lift + 0.1], [tip[0], tip[1], tip[2] * 0.8], 0.24, 0.2, () => [122, 82, 58], solid);
        e.sphere(tip[0], tip[1], tip[2] * 0.82, 0.23, [128, 88, 62], solid);
        const nose = e.project(tip[0] + dx * 0.16, tip[1] + dy * 0.16, tip[2] * 0.82 + 0.05);
        e.dot(nose.sx, nose.sy, e.rgb(232, 150, 150));
      } else if (kind === "voltorb") {
        const red = pin.id === 5 || pin.id === 8;
        const top = red ? [214, 62, 54] : [206, 66, 58];
        const ballZ = lift + 0.42 + (pin.rolling ? 0 : 0);
        e.sphere(pin.x + dx * 0.35, pin.y + dy * 0.35, ballZ, 0.4, top, solid);
        e.sphere(pin.x + dx * 0.35, pin.y + dy * 0.35, ballZ - 0.12, 0.34, [240, 238, 230], solid);
        e.capsule([pin.x + dx * 0.35 - 0.32, pin.y + dy * 0.35, ballZ], [pin.x + dx * 0.35 + 0.32, pin.y + dy * 0.35, ballZ], 0.05, 0.05, () => [36, 34, 38], solid);
        const eye = e.project(pin.x + dx * 0.35 + 0.1, pin.y + dy * 0.35, ballZ + 0.14);
        e.dot(eye.sx, eye.sy, e.rgb(32, 30, 34));
        e.dot(eye.sx + 2, eye.sy, e.rgb(32, 30, 34));
      } else if (kind === "gastly") {
        e.sphere(pin.x + dx * 0.4, pin.y + dy * 0.4, lift + 0.5 + Math.sin(state.clock * 2 + pin.id) * 0.03, 0.4, [104, 74, 148], solid);
        e.ring(0, 0, 0, 0, e.rgb(0, 0, 0), 0);
        for (let i = 0; i < 5; i += 1) {
          const a = state.clock * 1.4 + i * 1.25;
          e.sphere(pin.x + Math.cos(a) * 0.42, pin.y + Math.sin(a) * 0.42, lift + 0.5, 0.16, [128, 96, 168], solid);
        }
        const eye = e.project(pin.x + 0.1, pin.y + 0.04, lift + 0.62);
        e.dot(eye.sx, eye.sy, e.rgb(240, 238, 230));
        e.dot(eye.sx, eye.sy + 1, e.rgb(240, 238, 230));
        const eye2 = e.project(pin.x - 0.1, pin.y + 0.04, lift + 0.62);
        e.dot(eye2.sx, eye2.sy, e.rgb(240, 238, 230));
      } else {
        const tall = pin.id % 3 !== 0;
        if (tall) {
          e.capsule([pin.x, pin.y, lift + 0.1], [tip[0], tip[1], tip[2]], 0.26, 0.16, () => [228, 236, 240], solid);
          e.sphere(tip[0], tip[1], tip[2], 0.22, [236, 242, 244], solid);
          e.capsule([pin.x - 0.12, pin.y, lift + 0.9], [pin.x + 0.1, pin.y, lift + 1.18], 0.07, 0.04, () => [196, 128, 74], solid);
        } else {
          e.sphere(pin.x + dx * 0.2, pin.y + dy * 0.2, lift + 0.28, 0.36, [176, 130, 100], solid);
          e.sphere(pin.x + dx * 0.34, pin.y + dy * 0.34, lift + 0.34, 0.22, [198, 150, 114], solid);
          e.dot(e.project(pin.x + 0.2, pin.y, lift + 0.4).sx, e.project(pin.x + 0.2, pin.y, lift + 0.4).sy, e.rgb(46, 40, 40));
        }
      }
    }

    function drawBowler(e) {
      const map = state.map;
      const pal = map.rival;
      const pose = { z: 0.1, stance: 0.22, scale: 1.2 };
      if (state.turn === "rival") {
        if (state.phase === "aim") {
          pose.armR = 0.9;
          pose.lean = 0.2;
        } else if (state.phase === "roll") {
          pose.armR = 1.8;
          pose.lean = 0.5;
        }
      } else if (state.phase === "aim") {
        pose.armR = 0.2 + state.power * 1.5;
        pose.lean = 0.1 + state.power * 0.15;
      } else if (state.phase === "roll") {
        pose.armR = 1.9;
        pose.lean = 0.55;
      } else {
        pose.armR = 0.5;
      }
      const palette = state.turn === "rival"
        ? { shirt: pal.shirt, stripe: pal.stripe, legs: [58, 64, 72], skin: pal.skin, hair: pal.hair }
        : { shirt: [230, 224, 204], stripe: [188, 92, 56], legs: [56, 62, 70], skin: [226, 182, 142], hair: [70, 50, 38] };
      const hand = e.figure(8.0, state.bowlerX, Math.PI, pose, palette);
      e.flushShadows();
      return hand;
    }

    function drawAim(e) {
      if (state.phase !== "aim" || state.turn === "rival") return;
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
        paintBall(engine, 7.25, state.bowlerX, 0.5, state.clock * 2);
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
      state.aim = clamp(dx * 0.0028, -0.22, 0.22);
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
