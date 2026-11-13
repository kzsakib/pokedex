/* Angling Station: five floating island dioramas, each a small pond you aim
   into and fish. The rasteriser lives in engine.js; this file owns the island
   art, the state machine, the audio and the HUD wiring.

   The diorama sits on the page's own pale steel with no panel behind it: the
   canvas is transparent and its edges dissolve into the chassis, the same way
   the archive sprites sit on the bench. */

import PixelEngine from "./engine.js";
import {
  BAIT,
  CASTS_PER_LEVEL,
  LEVELS,
  RARITY,
  RODS,
  SCORE,
  SPECIES,
  STORAGE_KEY,
  baitById,
  canUnlock,
  pickWeighted,
  poolFor,
  rodById,
  speciesInfo,
  starsFor,
  zoneFor,
} from "./data.js";
import {
  fetchPokemon,
  formatNumber,
  pixelSpriteFallbackUrl,
  pixelSpriteRawUrl,
  pixelSpriteUrl,
} from "../src/api.js";
import { isMuted } from "../src/audio.js";

const AnglingStation = (() => {
  const TAU = Math.PI * 2;
  const PROGRESS_RATE = 0.5;
  const TENSION_UP = 0.55;
  const TENSION_DOWN = 1.2;
  const SNAP_AT = 0.85;
  const SNAP_GRACE = 0.8;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (list) => list[(Math.random() * list.length) | 0];
  const mix = (a, b, t) => [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  ];

  /* Island geometry, shared by every stage so aiming always feels the same. */
  const ISLAND_R = 11.2;
  const GRASS_R = 8.2;
  const SAND_R = 7.1;
  const POND_R = 6.3;
  const PIER = { x0: -0.95, x1: 0.95, y0: 5.0, y1: 11.0 };
  const ANGLER = { x: 0, y: 5.15, yaw: -Math.PI / 2 };

  /* ---------------- persistence ---------------- */

  function blankProgress() {
    return {
      v: 1,
      coins: 0,
      rod: "old",
      bait: "none",
      baitStock: { oran: 0, pecha: 0, razz: 0 },
      caught: {},
      levels: {},
    };
  }

  function loadProgress() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return blankProgress();
      const parsed = JSON.parse(raw);
      const base = blankProgress();
      return {
        ...base,
        ...parsed,
        baitStock: { ...base.baitStock, ...(parsed.baitStock || {}) },
        caught: parsed.caught || {},
        levels: parsed.levels || {},
      };
    } catch {
      return blankProgress();
    }
  }

  function saveProgress(progress) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      /* private mode: still plays, just not past the tab */
    }
  }

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
      master.gain.value = 0.45;
      master.connect(audioCtx.destination);
      audioCtx.fishMaster = master;
    }
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    return audioCtx;
  }

  function tone({ from, to, type = "square", length = 0.08, level = 0.05, delay = 0 }) {
    const ctx = audio();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    if (to && to !== from) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, to), start + length);
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(level, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(gain).connect(ctx.fishMaster);
    osc.start(start);
    osc.stop(start + length + 0.03);
  }

  function noise({ length = 0.2, from = 2400, to = 300, level = 0.08, delay = 0 }) {
    const ctx = audio();
    if (!ctx) return;
    if (!noiseBuffer) {
      const frames = Math.floor(ctx.sampleRate * 0.5);
      noiseBuffer = ctx.createBuffer(1, frames, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
    }
    const start = ctx.currentTime + delay;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, to), start + length);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    source.connect(filter).connect(gain).connect(ctx.fishMaster);
    source.start(start);
    source.stop(start + length);
  }

  const sfx = {
    splash: () => {
      noise({ length: 0.22, from: 2600, to: 260, level: 0.09 });
      tone({ from: 240, to: 90, type: "sine", length: 0.18, level: 0.035 });
    },
    drop: () => noise({ length: 0.08, from: 1800, to: 500, level: 0.03 }),
    cast: () => {
      noise({ length: 0.15, from: 3200, to: 900, level: 0.045 });
      tone({ from: 640, to: 260, type: "triangle", length: 0.12, level: 0.025 });
    },
    bite: () => {
      tone({ from: 880, to: 880, type: "square", length: 0.05, level: 0.045 });
      tone({ from: 1320, to: 1320, type: "square", length: 0.06, level: 0.035, delay: 0.07 });
    },
    hook: () => tone({ from: 520, to: 960, type: "square", length: 0.09, level: 0.045 }),
    perfect: () => {
      tone({ from: 880, to: 880, type: "square", length: 0.06, level: 0.045 });
      tone({ from: 1320, to: 1320, type: "square", length: 0.1, level: 0.04, delay: 0.06 });
    },
    reel: () => tone({ from: 300, to: 340, type: "triangle", length: 0.03, level: 0.015 }),
    thrash: () => noise({ length: 0.14, from: 1200, to: 400, level: 0.05 }),
    snap: () => {
      noise({ length: 0.1, from: 4200, to: 1200, level: 0.09 });
      tone({ from: 500, to: 90, type: "sawtooth", length: 0.24, level: 0.045 });
    },
    miss: () => tone({ from: 300, to: 160, type: "triangle", length: 0.16, level: 0.035 }),
    caught: () => {
      [523, 659, 784, 1046].forEach((f, i) =>
        tone({ from: f, to: f, type: "square", length: 0.1, level: 0.04, delay: i * 0.09 }),
      );
    },
    shiny: () => {
      [1046, 1318, 1568, 2093].forEach((f, i) =>
        tone({ from: f, to: f, type: "sine", length: 0.16, level: 0.035, delay: i * 0.06 }),
      );
    },
    record: () => tone({ from: 1568, to: 2093, type: "sine", length: 0.22, level: 0.035 }),
    coin: () => tone({ from: 1046, to: 1568, type: "square", length: 0.08, level: 0.03 }),
    buy: () => {
      tone({ from: 660, to: 990, type: "square", length: 0.07, level: 0.035 });
      tone({ from: 990, to: 1320, type: "square", length: 0.09, level: 0.03, delay: 0.07 });
    },
    map: () => tone({ from: 420, to: 700, type: "triangle", length: 0.09, level: 0.03 }),
  };

  /* ---------------- sprites ---------------- */

  const spriteCache = new Map();

  function loadSprite(id) {
    if (spriteCache.has(id)) return spriteCache.get(id);
    const entry = { id, img: null, data: null, w: 0, h: 0, status: "loading" };
    spriteCache.set(id, entry);
    const plan = [
      [pixelSpriteUrl(id), true],
      [pixelSpriteUrl(id), false],
      [pixelSpriteRawUrl(id), false],
      [pixelSpriteFallbackUrl(id), false],
    ];
    let attempt = 0;
    const img = new Image();
    img.decoding = "async";
    const load = () => {
      const [url, cors] = plan[attempt];
      if (cors) img.crossOrigin = "anonymous";
      else img.removeAttribute("crossorigin");
      img.src = url;
    };
    img.onload = () => {
      entry.img = img;
      try {
        const scratch = document.createElement("canvas");
        scratch.width = img.naturalWidth;
        scratch.height = img.naturalHeight;
        const context = scratch.getContext("2d", { willReadFrequently: true });
        context.imageSmoothingEnabled = false;
        context.drawImage(img, 0, 0);
        const pixels = context.getImageData(0, 0, scratch.width, scratch.height);
        entry.data = new Uint32Array(pixels.data.buffer.slice(0));
        entry.w = scratch.width;
        entry.h = scratch.height;
      } catch {
        entry.data = null;
      }
      entry.status = "ready";
    };
    img.onerror = () => {
      attempt += 1;
      if (attempt < plan.length) load();
      else entry.status = "error";
    };
    load();
    return entry;
  }

  /* ---------------- island art ---------------- */

  function grassColor(p, x, y) {
    const n = Math.sin(x * 0.55 + y * 0.3) * 0.5 + Math.sin(y * 0.8 - x * 0.2) * 0.5;
    return mix(p.shore, p.grass ?? [126, 158, 74], 0.45 + n * 0.18);
  }

  function waterColor(p, x, y) {
    const r = Math.hypot(x, y) / POND_R;
    const ripple = Math.sin(x * 0.9 + y * 0.6) * 0.06;
    return mix(p.water, p.waterDeep, clamp(r * 0.85 + ripple, 0, 1));
  }

  function buildIsland(e, level, onTree) {
    const p = level.palette;
    e.field(-15, -15, 15, 15, 0.055, (x, y) => {
      const wob =
        e.noise(x * 0.32, y * 0.32) * 1.15 + e.noise(x * 0.95, y * 0.95) * 0.4;
      const r = Math.hypot(x, y) + wob - 0.85;
      if (r > ISLAND_R) return null;
      if (r > GRASS_R) {
        const shade = (e.hash(x * 3, y * 3) - 0.5) * 0.5;
        return {
          z: 0.66,
          color: grassColor(p, x, y),
          kind: e.KIND_GRASS,
          shade,
        };
      }
      if (r > SAND_R) {
        const shade = e.noise(x * 0.8, y * 0.8) * 0.35;
        return {
          z: 0.6,
          color: mix(p.sand, [250, 246, 232], 0.25 + shade * 0.4),
          kind: e.KIND_GROUND,
          shade,
        };
      }
      if (r > POND_R) {
        return { z: 0.4, color: mix(p.sand, p.shore, 0.3), shade: -0.15 };
      }
      return { z: 0, color: waterColor(p, x, y), kind: e.KIND_WATER, shade: 0.1 };
    });

    /* grassy lip so the island reads as a raised shelf, not a painted oval */
    for (let a = 0; a < TAU; a += 0.02) {
      const rr = ISLAND_R - 0.55;
      e.sphere(
        Math.cos(a) * rr,
        Math.sin(a) * rr,
        0.58,
        0.34,
        p.shore,
        "rough",
      );
    }

    /* pier */
    for (let i = 0; i < 15; i += 1) {
      const y = 10.9 - i * 0.42;
      e.box(PIER.x0, y - 0.34, 0.58, PIER.x1, y, 0.72, i % 2 ? [150, 108, 70] : [162, 118, 76], i);
    }
    e.box(PIER.x0 - 0.18, 4.7, 0, PIER.x0, 5.4, 0.9, [104, 74, 50], 1);
    e.box(PIER.x1, 4.7, 0, PIER.x1 + 0.18, 5.4, 0.9, [104, 74, 50], 2);
    e.box(PIER.x0 - 0.18, 10.6, 0, PIER.x0, 11.2, 0.9, [104, 74, 50], 3);
    e.box(PIER.x1, 10.6, 0, PIER.x1 + 0.18, 11.2, 0.9, [104, 74, 50], 4);

    const treeAt = (x, y, scale, seed) => {
      onTree?.(x, y, scale);
      e.growTree(x, y, scale, 240, seed, { ...p.leaf, bark: [74, 52, 38] });
      e.castShadow(x, y, 0, 0.55 * scale, 0.5, 0.3);
    };

    if (level.art === "cape") {
      e.box(5.4, -3.4, 0.6, 8.0, -0.4, 2.6, [126, 124, 112], 5);
      e.box(5.6, -3.2, 2.6, 7.8, -0.6, 2.62, [144, 140, 124], 6);
      e.capsule([6.7, -1.9, 2.5], [6.7, -1.9, 6.4], 0.4, 0.28, () => [232, 228, 214], "solid");
      e.sphere(6.7, -1.9, 6.5, 0.5, [250, 238, 190], "gloss");
      e.box(6.1, -2.5, 6.2, 7.3, -1.3, 6.3, [120, 112, 100], 7);
      treeAt(-6.6, 3.6, 1.0, 21);
      treeAt(3.6, 8.6, 0.78, 33);
    } else if (level.art === "dock") {
      e.box(3.6, 4.4, 0.6, 4.9, 5.7, 1.3, [146, 108, 68], 8);
      e.box(3.8, 4.6, 1.3, 4.7, 5.5, 1.86, [160, 120, 76], 9);
      e.box(4.9, 3.4, 0.6, 6.0, 4.5, 1.1, [132, 96, 62], 10);
      /* moored boat on the pond */
      e.capsule([-3.9, 0.6, 0.24], [-3.9, 2.9, 0.24], 0.5, 0.34, () => [150, 108, 68], "solid");
      e.box(-4.35, 0.7, 0.2, -3.45, 2.8, 0.44, [176, 132, 84], 11);
      e.capsule([-3.9, 1.9, 0.4], [-3.9, 1.9, 3.1], 0.09, 0.06, () => [110, 86, 64], "solid");
      e.box(-4.3, 1.8, 2.6, -3.5, 2.0, 3.35, [232, 224, 202], 0);
      treeAt(-7.0, 4.0, 0.88, 12);
      treeAt(4.2, 8.8, 0.74, 14);
    } else if (level.art === "cavern") {
      e.box(-5.4, -5.6, 0.6, -2.2, -2.6, 2.0, [136, 152, 164], 15);
      e.box(-5.2, -5.4, 2.0, -2.4, -2.8, 2.02, [176, 194, 204], 16);
      for (let i = 0; i < 5; i += 1) {
        const a = -1.9 + i * 0.5;
        e.box(Math.cos(a) * 3.6 - 0.5, Math.sin(a) * 3.6 - 0.4, 0, Math.cos(a) * 3.6 + 0.5, Math.sin(a) * 3.6 + 0.4, 0.14, [226, 240, 244], i);
      }
      e.capsule([-7.4, -6.6, 8], [-7.0, -6.4, 5.1], 0.26, 0.05, () => [214, 234, 240], "gloss");
      e.capsule([-6.4, -7.2, 7.4], [-6.1, -7.0, 5.4], 0.2, 0.05, () => [214, 234, 240], "gloss");
      treeAt(7.4, 1.6, 0.78, 18);
    } else if (level.art === "night") {
      for (let i = 0; i < 6; i += 1) {
        const a = i * 1.05 + 0.4;
        const rr = 2.6 + (i % 3) * 0.9;
        e.sphere(Math.cos(a) * rr, Math.sin(a) * rr, 0.4, 0.2, [150, 132, 200], "gloss");
      }
      treeAt(-7.0, 3.4, 0.95, 24);
      treeAt(7.2, 2.8, 0.75, 29);
    } else {
      treeAt(-6.8, 4.2, 1.05, 3);
      treeAt(6.8, 5.0, 0.86, 8);
      treeAt(-1.4, 8.4, 0.6, 17);
    }

    /* crate and lantern on the dock end: the one bit of human clutter */
    e.box(0.28, 9.15, 0.72, 0.94, 9.8, 1.34, [140, 102, 64], 19);
    e.box(0.28, 9.15, 1.34, 0.94, 9.8, 1.36, [168, 126, 82], 20);
    e.capsule([0.82, 10.45, 0.72], [0.82, 10.45, 2.3], 0.07, 0.045, () => [86, 70, 52], "solid");
    e.sphere(0.82, 10.45, 2.36, 0.19, [252, 214, 138], "gloss");
    e.castShadow(0.82, 10.45, 0.7, 0.3, 0.5, 0.25);

    /* bushes and ferns thicken the bank so the ring of grass is not bare */
    const bushAt = (x, y, s, seed) => {
      for (let i = 0; i < 5; i += 1) {
        const a = seed + i * 1.6;
        e.sphere(
          x + Math.cos(a) * 0.5 * s,
          y + Math.sin(a) * 0.42 * s,
          0.74 + (i % 2) * 0.14,
          (0.34 + (i % 3) * 0.1) * s,
          mix(p.leaf.mid, [64, 96, 54], i % 2 ? 0.45 : 0.1),
          "rough",
        );
      }
      e.castShadow(x, y, 0.6, 0.42 * s, 0.5, 0.3);
    };
    bushAt(-3.0, 8.3, 0.9, 1);
    bushAt(3.1, 8.0, 0.8, 2.4);
    bushAt(-7.4, 4.1, 0.85, 3.7);
    bushAt(7.6, 2.4, 0.75, 5.2);
    bushAt(2.2, -7.9, 0.8, 0.6);

    /* lily pads: flat discs laid straight into the water surface */
    const pad = (x, y, r) => {
      const q = e.project(x, y, 0.03);
      for (let rr = r; rr > 1; rr -= 2) e.ring(q.sx, q.sy, rr, 0.6, [92, 138, 76], 2);
      e.ring(q.sx - 1, q.sy - 1, Math.max(1, r - 4), 0.5, [122, 166, 96], 2);
    };
    pad(-2.1, 2.6, 7);
    pad(-1.2, 3.3, 5);
    pad(2.4, 2.0, 6);
    pad(1.5, 2.9, 4);
    pad(-2.8, -1.6, 5);

    /* rocks and reeds around the shore */
    for (let i = 0; i < 9; i += 1) {
      const a = i * 0.78 + level.art.length;
      const rr = ISLAND_R - 1.4 - (i % 3) * 0.5;
      e.sphere(Math.cos(a) * rr, Math.sin(a) * rr, 0.66, 0.26 + (i % 3) * 0.06, level.palette.rock ?? [138, 138, 126], "rough");
    }
    for (let i = 0; i < 16; i += 1) {
      const a = i * 0.42 + 0.3;
      const rr = POND_R + 0.5 + (i % 4) * 0.25;
      const rx = Math.cos(a) * rr;
      const ry = Math.sin(a) * rr;
      const top = 1.3 + (i % 3) * 0.22;
      e.capsule([rx, ry, 0.5], [rx + 0.05, ry - 0.05, top], 0.05, 0.03, () => mix(p.shore, [96, 138, 74], 0.5), "solid");
      e.sphere(rx + 0.05, ry - 0.05, top, 0.09, mix(p.shore, [76, 108, 58], 0.6), "rough");
    }

    /* long hard shadow of the island shelf, falling screen-right */
    for (let a = 0; a < TAU; a += 0.06) {
      const rr = ISLAND_R - 0.6;
      e.castShadow(Math.cos(a) * rr, Math.sin(a) * rr, 0.6, 0.5, 0.5, 0.4);
    }
    e.castShadow(ANGLER.x, ANGLER.y, 0.7, 0.34, 1, 0.25);
  }

  /* ---------------- instance ---------------- */

  let mounted = null;

  function mount(rootEl, options = {}) {
    if (!rootEl) return null;
    if (mounted && mounted.root === rootEl) {
      mounted.resume();
      return mounted.api;
    }

    const canvas = rootEl.querySelector(".fish-canvas");
    if (!canvas) return null;

    const engine = PixelEngine.createEngine(canvas, { originY: 12, scale: 13.5 });
    const q = (role) => rootEl.querySelector(`[data-fish="${role}"]`);
    const hud = {
      score: q("score"),
      casts: q("casts"),
      combo: q("combo"),
      level: q("level"),
      coins: q("coins"),
      status: q("status"),
      levels: q("levels"),
      card: q("card"),
      kit: q("kit"),
      log: q("log"),
    };

    const progress = loadProgress();
    const state = {
      phase: "ready",
      levelIndex: 0,
      level: LEVELS[0],
      score: 0,
      castsLeft: CASTS_PER_LEVEL,
      streak: 0,
      bestStreak: 0,
      caught: new Set(),
      survey: new Set(),
      surveyStamped: false,
      bossUsed: false,
      boss: null,
      cast: null,
      fish: null,
      result: null,
      aim: null,
      message: "",
      clock: 0,
      tension: 0.45,
      snapTimer: 0,
      reeling: false,
      thrashIn: 2,
      thrashing: 0,
      tell: 0,
      ripples: [],
      particles: [],
      popups: [],
      shadows: [],
      rain: false,
      paused: false,
      visible: true,
      pointerDown: false,
      treeMasks: [],
      lastFrame: 0,
      accumulator: 0,
      levelDone: false,
      goldPaid: false,
      wipe: 1,
      reelTime: 0,
      bandTime: 0,
      reelProgress: 0,
    };

    /* ---------- HUD ---------- */

    function comboMultiplier() {
      return Math.min(SCORE.comboCap, 1 + SCORE.comboStep * Math.max(0, state.streak - 1));
    }

    function paintHud() {
      if (hud.score) hud.score.textContent = Math.round(state.score).toLocaleString("en-GB");
      if (hud.casts) hud.casts.textContent = `${state.castsLeft}/${CASTS_PER_LEVEL}`;
      if (hud.combo) {
        const mult = comboMultiplier();
        hud.combo.textContent = `×${mult.toFixed(2)}`;
        hud.combo.classList.toggle("is-hot", mult >= 1.5);
      }
      if (hud.level) hud.level.textContent = state.level.short;
      if (hud.coins) hud.coins.textContent = Math.floor(progress.coins).toLocaleString("en-GB");
    }

    function say(message) {
      state.message = message;
      if (hud.status) hud.status.textContent = message;
    }

    /* ---------- map picker ---------- */

    const thumbUrls = new Map();

    function buildThumb(level) {
      if (thumbUrls.has(level.id)) return;
      const scratch = document.createElement("canvas");
      const preview = PixelEngine.createEngine(scratch, { originY: 12, scale: 13.5 });
      buildIsland(preview, level);
      preview.applyShadows();
      preview.bakeOcclusion();
      preview.bake();
      preview.growGrass();
      preview.resetFrame();
      /* canopies and tufts are painted each frame, not baked, so the thumb
         has to ask for them too or every tree comes out as a stump */
      preview.drawTufts(0);
      preview.drawLeaves(0);
      preview.present();
      thumbUrls.set(level.id, scratch.toDataURL("image/png"));
      paintMaps();
    }

    function paintMaps() {
      if (!hud.levels) return;
      hud.levels.innerHTML = LEVELS.map((level, index) => {
        const unlocked = canUnlock(index, progress);
        const best = progress.levels[level.id]?.stars ?? 0;
        const current = index === state.levelIndex;
        const thumb = thumbUrls.get(level.id);
        return `<button type="button" class="fish-map${current ? " is-current" : ""}" data-level="${index}"${
          unlocked ? "" : " disabled"
        } aria-pressed="${current}">
          <span class="fish-map__art"${thumb ? ` style="background-image:url('${thumb}')"` : ""}></span>
          <span class="fish-map__no">${String(index + 1).padStart(2, "0")}</span>
          <span class="fish-map__name">${level.name}</span>
          <span class="fish-map__stars" aria-label="${best} of 3 stars">${"★".repeat(best)}${"☆".repeat(3 - best)}</span>
        </button>`;
      }).join("");
    }

    if (hud.levels) {
      hud.levels.addEventListener("click", (event) => {
        const button = event.target.closest("[data-level]");
        if (!button) return;
        const index = Number(button.dataset.level);
        if (!canUnlock(index, progress)) return;
        startLevel(index);
        sfx.map();
      });
    }

    if (hud.card) {
      hud.card.addEventListener("click", (event) => {
        const action = event.target.closest("[data-action]");
        if (!action) return;
        const name = action.dataset.action;
        if (name === "next") nextCast();
        if (name === "retry") startLevel(state.levelIndex);
        if (name === "next-level") {
          const next = state.levelIndex + 1;
          if (next < LEVELS.length) startLevel(next);
        }
        if (name === "close") clearCard();
        if (name === "select") {
          const id = Number(action.dataset.id);
          options.onSelect?.(id);
          say(`Loaded ${SPECIES[id]?.name ?? "specimen"} into the specimen record.`);
        }
      });
    }

    if (hud.kit) {
      hud.kit.addEventListener("click", (event) => {
        const action = event.target.closest("[data-buy]");
        if (!action) return;
        buy(action.dataset.buy);
      });
    }

    /* ---------- bake ---------- */

    function bakeLevel() {
      engine.clear();
      state.shadows = [];
      state.treeMasks = [];
      buildIsland(engine, state.level, (x, y, scale) => {
        state.treeMasks.push(captureTree(engine, x, y, scale));
      });
      engine.applyShadows();
      engine.bakeOcclusion();
      engine.bake();
      engine.growGrass();
    }

    /* Each canopy is the one static thing that moves, so the pixels under it
       are captured before the tree is drawn and put back before the swaying
       leaves are repainted. Otherwise the rest pose bakes in and ghosts. */
    function captureTree(e, cx, cy, scale = 1) {
      const box = e.project(cx - 4.4 * scale, cy - 4.4 * scale, 0);
      const box2 = e.project(cx + 4.4 * scale, cy + 4.4 * scale, 7.2 * scale);
      const x0 = Math.max(0, Math.floor(Math.min(box.sx, box2.sx)) - 6);
      const x1 = Math.min(e.W - 1, Math.ceil(Math.max(box.sx, box2.sx)) + 6);
      const y0 = Math.max(0, Math.floor(Math.min(box.sy, box2.sy)) - 6);
      const y1 = Math.min(e.H - 1, Math.ceil(Math.max(box.sy, box2.sy)) + 6);
      const w = x1 - x0;
      const h = y1 - y0;
      const pixels = new Uint32Array(Math.max(0, w * h));
      const depth = new Float32Array(Math.max(0, w * h));
      for (let y = 0; y < h; y += 1)
        for (let x = 0; x < w; x += 1) {
          const i = (y0 + y) * e.W + x0 + x;
          pixels[y * w + x] = e.pix[i];
          depth[y * w + x] = e.zb[i];
        }
      return { x0, y0, w, h, pixels, depth };
    }

    function restoreTree() {
      for (const mask of state.treeMasks) {
        for (let y = 0; y < mask.h; y += 1)
          for (let x = 0; x < mask.w; x += 1) {
            const i = (mask.y0 + y) * engine.W + mask.x0 + x;
            engine.pix[i] = mask.pixels[y * mask.w + x];
            engine.zb[i] = mask.depth[y * mask.w + x];
          }
      }
    }

    /* ---------- level / cast lifecycle ---------- */

    function startLevel(index) {
      state.levelIndex = index;
      state.level = LEVELS[index];
      state.score = 0;
      state.castsLeft = CASTS_PER_LEVEL;
      state.streak = 0;
      state.bestStreak = 0;
      state.caught = new Set();
      state.survey = new Set();
      state.surveyStamped = false;
      state.bossUsed = false;
      state.boss = null;
      state.levelDone = false;
      state.goldPaid = false;
      state.phase = "ready";
      state.cast = null;
      state.fish = null;
      state.result = null;
      state.ripples = [];
      state.particles = [];
      state.popups = [];
      state.shadows = [];
      state.tension = 0.45;
      state.snapTimer = 0;
      state.reeling = false;
      state.reelTime = 0;
      state.bandTime = 0;
      state.reelProgress = 0;
      state.aim = null;
      state.wipe = 1;
      state.rain = state.level.id === "cerulean";
      if (hud.kit) hud.kit.hidden = true;
      clearCard();
      bakeLevel();
      LEVELS[index].pool.forEach((id) => loadSprite(id));
      loadSprite(130);
      paintMaps();
      paintHud();
      say("Pick a spot on the water and click to cast.");
    }

    function zoneAt(x, y) {
      const r = Math.hypot(x, y);
      if (r > POND_R - 0.4) return null;
      if (r > 4.4) return zoneFor(0.2);
      if (r > 2.6) return zoneFor(0.55);
      return zoneFor(0.9);
    }

    function castTo(x, y) {
      if (state.phase !== "ready") return;
      const zone = zoneAt(x, y);
      if (!zone) {
        say("That is dry land. Cast inside the pond.");
        return;
      }
      const bait = baitById(progress.bait);
      if (bait.id !== "none") {
        if ((progress.baitStock[bait.id] ?? 0) > 0) {
          progress.baitStock[bait.id] -= 1;
          if (progress.baitStock[bait.id] <= 0) progress.bait = "none";
        } else {
          progress.bait = "none";
        }
        saveProgress(progress);
      }
      state.cast = {
        zone,
        target: { x, y, z: 0.1 },
        t: 0,
        from: { x: ANGLER.x, y: ANGLER.y, z: 3.1 },
      };
      state.phase = "flight";
      state.aim = null;
      state.boss = null;
      if (state.levelIndex >= 2 && state.streak >= 3 && !state.bossUsed) {
        state.bossUsed = true;
        state.boss = { species: 130 };
      }
      sfx.cast();
      say(`Cast into ${zone.label.toLowerCase()} water.`);
      paintHud();
    }

    function addRipple(x, y, size) {
      state.ripples.push({ x, y, r: 0.25, max: size / 10, life: 1 });
    }

    function spawnDrops(x, y, count, spread) {
      if (engine.STILL) return;
      for (let i = 0; i < count; i += 1) {
        state.particles.push({
          x: x + rand(-spread, spread),
          y: y + rand(-spread, spread),
          z: 0.15,
          vz: rand(1.2, 3.4),
          vx: rand(-0.7, 0.7),
          vy: rand(-0.7, 0.7),
          life: rand(0.4, 0.9),
          tone: [214, 240, 242],
        });
      }
    }

    function land() {
      const cast = state.cast;
      state.phase = "wait";
      const bait = baitById(progress.bait);
      const rod = rodById(progress.rod);
      const wait = rand(1.4, 4.6) * rod.wait * bait.wait * (state.boss ? 0.7 : 1);
      cast.left = wait;
      cast.spook = false;
      addRipple(cast.target.x, cast.target.y, 34);
      spawnDrops(cast.target.x, cast.target.y, 16, 0.55);
      sfx.splash();
      state.shadows = Array.from({ length: 4 }, () => ({
        angle: rand(0, TAU),
        radius: rand(1.2, 4.6),
        speed: rand(0.18, 0.42) * (Math.random() > 0.5 ? 1 : -1),
        id: pick(state.level.pool),
        wobble: rand(0, TAU),
      }));
      say("Watch the bobber. Strike the moment it dips.");
    }

    function chooseFish() {
      const bait = baitById(progress.bait);
      if (state.boss) return { id: state.boss.species, rarity: "epic", boss: true };
      const pool = poolFor(state.level, state.cast.zone.id, bait.rare);
      const chosen = pickWeighted(pool, Math.random());
      return { id: chosen.id, rarity: chosen.rarity, boss: false };
    }

    function startBite() {
      const rod = rodById(progress.rod);
      const fish = chooseFish();
      const junk = !state.boss && Math.random() < SCORE.junkChance;
      state.fish = {
        ...fish,
        junk,
        shiny: !junk && Math.random() < SCORE.shinyChance,
        pull: { common: 0.04, uncommon: 0.09, rare: 0.14, epic: 0.2 }[fish.rarity] ?? 0.06,
        window: rod.window,
        biteAt: 0,
      };
      state.phase = "bite";
      sfx.bite();
      if (state.fish.id === 72 && Math.random() < SCORE.tentacoolSteal && progress.bait !== "none") {
        const stolen = progress.bait;
        progress.baitStock[stolen] = Math.max(0, (progress.baitStock[stolen] ?? 1) - 1);
        if (progress.baitStock[stolen] <= 0) progress.bait = "none";
        saveProgress(progress);
        state.phase = "recover";
        state.recoverLeft = 1.2;
        state.castsLeft = Math.max(0, state.castsLeft - 1);
        say("A Tentacool strips the bait and drifts off.");
        paintHud();
        if (state.castsLeft <= 0) endLevel();
        return;
      }
      say(junk ? "Something heavy is on the hook…" : state.boss ? "Something huge takes the bait." : "BITE — strike now!");
      if (state.boss) addRipple(state.cast.target.x, state.cast.target.y, 46);
    }

    function strike() {
      if (state.phase !== "bite") return;
      const fish = state.fish;
      fish.perfect = state.cast.biteAt * 1000 <= 150;
      fish.thrashRate = fish.boss ? 2 : fish.rarity === "epic" ? 1.4 : fish.rarity === "rare" ? 1.2 : 1;
      state.phase = "reel";
      state.tension = 0.45;
      state.snapTimer = 0;
      state.reeling = true;
      state.reelTime = 0;
      state.bandTime = 0;
      state.reelProgress = 0;
      state.thrashIn = rand(1.2, 2.6) / (baitById(progress.bait).thrash * fish.thrashRate);
      state.thrashing = 0;
      state.tell = 0;
      if (fish.perfect) sfx.perfect();
      else sfx.hook();
      say(fish.perfect ? "Perfect hook. Hold to reel, release when it thrashes." : "Hooked. Hold to reel, release when it thrashes.");
    }

    function failCast(reason) {
      state.phase = "recover";
      state.recoverLeft = 1.1;
      state.streak = 0;
      state.castsLeft = Math.max(0, state.castsLeft - 1);
      addRipple(state.cast?.target.x ?? 0, state.cast?.target.y ?? 0, 20);
      spawnDrops(state.cast?.target.x ?? 0, state.cast?.target.y ?? 0, 8, 0.4);
      say(reason);
      paintHud();
      sfx.miss();
      if (state.castsLeft <= 0) endLevel();
    }

    function snapLine() {
      state.phase = "recover";
      state.recoverLeft = 1.2;
      state.streak = 0;
      state.castsLeft = Math.max(0, state.castsLeft - 1);
      engine.shake(3, 1);
      sfx.snap();
      say("The line snapped. Fish and bait lost.");
      paintHud();
      if (state.castsLeft <= 0) endLevel();
    }

    function catchFish() {
      state.phase = "leap";
      state.leapT = 0;
      if (state.fish?.shiny) sfx.shiny();
      else sfx.caught();
      addRipple(state.cast.target.x, state.cast.target.y, 42);
      spawnDrops(state.cast.target.x, state.cast.target.y, state.fish?.boss ? 34 : 22, state.fish?.boss ? 1.3 : 0.8);
      state.leapFrom = { x: state.cast.target.x, y: state.cast.target.y };
      state.leapTo = { x: 0.6, y: 2.6 };
    }

    function finishCatch() {
      const fish = state.fish;
      const info = speciesInfo(fish.id);
      const level = state.level;
      const size = rand(SCORE.sizeMin, SCORE.sizeMax);
      const shiny = fish.shiny ? SCORE.shinyMultiplier : 1;
      const base = fish.boss ? SCORE.bossBase : RARITY[info.rarity].base;
      const perfect = state.reelTime ? clamp(state.bandTime / state.reelTime, 0, 1) : 0;
      const combo = comboMultiplier();
      const hook = fish.perfect ? SCORE.hookBonus : 1;
      const points = Math.round(base * size * (1 + SCORE.perfectMultiplier * perfect) * hook * combo * shiny);

      const recordKey = String(fish.id);
      const record = progress.caught[recordKey] || { count: 0, bestLength: 0, bestWeight: 0, shiny: false };
      const newCatch = record.count === 0;
      const previousBest = record.bestLength;
      progress.caught[recordKey] = {
        count: record.count + 1,
        bestLength: Math.max(record.bestLength, size),
        bestWeight: Math.max(record.bestWeight, size),
        shiny: record.shiny || !!fish.shiny,
      };
      const isRecord = previousBest > 0 && size > previousBest;
      state.score += points + (isRecord ? SCORE.recordBonus : 0);
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      state.caught.add(fish.id);
      if (level.targets.includes(fish.id)) state.survey.add(fish.id);

      let surveyBonus = 0;
      if (!state.surveyStamped && state.survey.size >= level.targets.length) {
        state.surveyStamped = true;
        surveyBonus = SCORE.surveyBonus;
        state.score += surveyBonus;
      }

      const lucky = !fish.boss && (info.rarity === "rare" || info.rarity === "epic");
      if (lucky) {
        state.castsLeft += 1;
        state.popups.push({ x: 204, y: 96, text: "+1 CAST", life: 1.6, max: 1.6 });
      }
      if (state.boss) state.boss = null;
      state.castsLeft = Math.max(0, state.castsLeft - 1);

      const stored = progress.levels[level.id] || { best: 0, stars: 0 };
      progress.levels[level.id] = {
        best: Math.max(stored.best, state.score),
        stars: Math.max(stored.stars, starsFor(level, state.score)),
      };
      saveProgress(progress);
      options.onCaught?.(Object.keys(progress.caught).map(Number));

      state.result = { fish, info, points, surveyBonus, size, perfect, isRecord, newCatch, types: [] };
      state.phase = "result";
      state.reelProgress = 0;
      renderResult();
      paintHud();
      renderLog();
      paintMaps();
      state.popups.push({ x: 190, y: 104, text: `+${points}`, life: 1.4, max: 1.4 });
      if (isRecord) sfx.record();
      if (state.castsLeft <= 0) {
        state.levelDone = true;
        setTimeout(() => showLevelEnd(), 1100);
      } else {
        say(`Caught ${info.name}. ${state.castsLeft} casts left.`);
      }
    }

    function nextCast() {
      if (state.levelDone) {
        showLevelEnd();
        return;
      }
      clearCard();
      state.fish = null;
      state.cast = null;
      state.phase = "ready";
      state.boss = null;
      state.shadows = [];
      state.aim = null;
      say("Pick a spot on the water and click to cast.");
      paintHud();
    }

    function endLevel() {
      state.levelDone = true;
      showLevelEnd();
    }

    /* ---------- HTML cards ---------- */

    const ACCENTS = {
      normal: "#6f7576",
      fire: "#cf451c",
      water: "#2c6ea8",
      electric: "#9a7200",
      grass: "#3f7a3c",
      ice: "#2f7f95",
      fighting: "#a3352c",
      poison: "#7b3a94",
      ground: "#86611f",
      flying: "#5f78a4",
      psychic: "#ad3468",
      bug: "#5d7a28",
      rock: "#77664a",
      ghost: "#56458a",
      dragon: "#3f53a3",
    };
    const typeAccent = (name) => ACCENTS[name] ?? "#f15b22";

    function typeChips(types = []) {
      return types
        .slice(0, 2)
        .map((type) => `<li style="--chip:${typeAccent(type)}">${type}</li>`)
        .join("");
    }

    function clearCard() {
      if (hud.card) {
        hud.card.hidden = true;
        hud.card.innerHTML = "";
      }
    }

    function renderLog() {
      if (!hud.log) return;
      const entries = Object.entries(progress.caught)
        .map(([id, record]) => ({ id: Number(id), record }))
        .sort((a, b) => b.id - a.id);
      if (!entries.length) {
        hud.log.innerHTML = `<p class="fish-log__empty">Nothing logged yet. The archive marks every species you land.</p>`;
        return;
      }
      hud.log.innerHTML = `<p class="fish-log__label">CATCH LOG · ${entries.length}</p><ul class="fish-log__list">${entries
        .map(
          ({ id, record }) =>
            `<li><button type="button" class="fish-log__item" data-select="${id}" title="${SPECIES[id]?.name ?? ""}">
              <img src="${pixelSpriteUrl(id)}" alt="${SPECIES[id]?.name ?? ""}" width="40" height="40" loading="lazy" />
              <span>${record.count}</span>
            </button></li>`,
        )
        .join("")}</ul>`;
      hud.log.querySelectorAll("[data-select]").forEach((button) =>
        button.addEventListener("click", () => options.onSelect?.(Number(button.dataset.select))),
      );
    }

    const speciesCache = new Map();
    async function loadSpecies(id) {
      if (speciesCache.has(id)) return speciesCache.get(id);
      const pending = fetchPokemon(id)
        .then((data) => ({
          types: (data.types ?? []).map((slot) => slot.type.name),
          height: data.height,
          weight: data.weight,
        }))
        .catch(() => null);
      speciesCache.set(id, pending);
      const value = await pending;
      if (!value) speciesCache.delete(id);
      return value;
    }

    let resultToken = 0;

    async function renderResult() {
      const result = state.result;
      const card = hud.card;
      if (!card || !result) return;
      const token = (resultToken += 1);
      const fish = result.fish;
      const name = result.info.name;
      const rarity = result.info.rarity;
      card.hidden = false;
      card.dataset.tone = rarity;
      card.innerHTML = `
        <div class="fish-card__head">
          <p class="fish-card__eyebrow">SPECIMEN RECORD</p>
          <p class="fish-card__no">${formatNumber(fish.id)}</p>
        </div>
        <div class="fish-card__body">
          <div class="fish-card__art${fish.shiny ? " is-shiny" : ""}">
            <img src="${pixelSpriteUrl(fish.id)}" alt="${name}" width="56" height="56" loading="lazy" />
          </div>
          <div class="fish-card__copy">
            <h4 class="fish-card__name">${name}${
              fish.boss ? ' <span class="fish-tag fish-tag--boss">RIPPLE</span>' : ""
            }</h4>
            <ul class="fish-card__types">${typeChips(result.types)}</ul>
            <p class="fish-card__line" data-fishline="meta">Reading measurements…</p>
            <p class="fish-card__tags">
              ${result.newCatch ? '<span class="fish-tag">NEW</span>' : ""}
              ${result.isRecord ? '<span class="fish-tag fish-tag--record">RECORD</span>' : ""}
              ${fish.shiny ? '<span class="fish-tag fish-tag--shiny">SHINY</span>' : ""}
              <span class="fish-tag fish-tag--rarity" data-tone="${rarity}">${RARITY[rarity].label}</span>
            </p>
          </div>
        </div>
        <dl class="fish-card__points">
          <div><dt>Base</dt><dd>${fish.boss ? SCORE.bossBase : RARITY[rarity].base}</dd></div>
          <div><dt>Size</dt><dd>×${result.size.toFixed(2)}</dd></div>
          <div><dt>Hold</dt><dd>×${(1 + SCORE.perfectMultiplier * result.perfect).toFixed(2)}</dd></div>
          <div><dt>Combo</dt><dd>×${comboMultiplier().toFixed(2)}</dd></div>
          ${fish.shiny ? "<div><dt>Shiny</dt><dd>×10</dd></div>" : ""}
          <div class="is-total"><dt>Points</dt><dd>+${Math.round(result.points).toLocaleString("en-GB")}</dd></div>
        </dl>
        ${result.surveyBonus ? `<p class="fish-card__note">Field survey complete · +${result.surveyBonus}</p>` : ""}
        ${result.isRecord ? `<p class="fish-card__note">New best length for ${name} · +${SCORE.recordBonus}</p>` : ""}
        <div class="fish-card__actions">
          <button type="button" class="fish-cta" data-action="next">${state.levelDone ? "LEVEL REPORT" : "CAST AGAIN"} <span aria-hidden="true">›</span></button>
          <button type="button" class="fish-ghost" data-action="select" data-id="${fish.id}">OPEN IN SPECIMEN RECORD</button>
        </div>`;

      const meta = card.querySelector('[data-fishline="meta"]');
      const loaded = await loadSpecies(fish.id);
      if (token !== resultToken) return;
      result.types = loaded?.types ?? [];
      const chips = card.querySelector(".fish-card__types");
      if (chips) chips.innerHTML = typeChips(result.types);
      if (meta) {
        if (!loaded) {
          meta.textContent = "Measurements unavailable · retries on the next catch";
        } else {
          const lengthCm = Math.round(loaded.height * 10 * result.size);
          const weightKg = (loaded.weight / 10) * result.size ** 3;
          meta.textContent = `${lengthCm} cm · ${weightKg.toFixed(1)} kg · ${
            result.perfect >= 0.5 ? "clean hold" : "scrappy hold"
          }`;
        }
      }
    }

    function showLevelEnd() {
      const level = state.level;
      const stars = starsFor(level, state.score);
      const stored = progress.levels[level.id] || { best: 0, stars: 0 };
      progress.levels[level.id] = {
        best: Math.max(stored.best, state.score),
        stars: Math.max(stored.stars, stars),
      };
      const coins = state.goldPaid ? 0 : Math.floor(state.score * SCORE.coinsPerPoint);
      state.goldPaid = true;
      progress.coins += coins;
      saveProgress(progress);
      state.phase = "levelEnd";
      paintMaps();
      paintHud();
      if (hud.card) {
        hud.card.hidden = false;
        hud.card.dataset.tone = stars > 0 ? "gold" : "muted";
        hud.card.innerHTML = `
          <div class="fish-card__head">
            <p class="fish-card__eyebrow">STAGE REPORT</p>
            <p class="fish-card__no">${level.short}</p>
          </div>
          <h4 class="fish-card__name">${level.name}</h4>
          <p class="fish-stars" aria-label="${stars} of 3 stars">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</p>
          <dl class="fish-card__points">
            <div><dt>Score</dt><dd>${Math.round(state.score).toLocaleString("en-GB")}</dd></div>
            <div><dt>Best</dt><dd>${Math.round(progress.levels[level.id].best).toLocaleString("en-GB")}</dd></div>
            <div><dt>Coins</dt><dd>+${coins}</dd></div>
            <div><dt>Streak</dt><dd>${state.bestStreak}</dd></div>
          </dl>
          <p class="fish-card__note">${
            state.surveyStamped
              ? "Field survey stamped · +1000"
              : `Field survey ${state.survey.size}/${level.targets.length} · ${level.targets
                  .map((id) => SPECIES[id].name)
                  .join(", ")}`
          }</p>
          <div class="fish-card__actions">
            ${
              stars > 0 && state.levelIndex < LEVELS.length - 1
                ? `<button type="button" class="fish-cta" data-action="next-level">NEXT STAGE <span aria-hidden="true">›</span></button>`
                : `<button type="button" class="fish-cta" data-action="retry">RUN IT AGAIN <span aria-hidden="true">›</span></button>`
            }
            <button type="button" class="fish-ghost" data-action="close">STAY HERE</button>
          </div>`;
      }
      renderKit();
      if (hud.kit) hud.kit.hidden = false;
    }

    function buy(key) {
      const [kind, id] = key.split(":");
      if (kind === "rod") {
        const rod = rodById(id);
        if (rod.id === progress.rod) return;
        if (progress.coins < rod.price) {
          sfx.miss();
          say(`${rod.name} costs ${rod.price} coins.`);
          return;
        }
        progress.coins -= rod.price;
        progress.rod = rod.id;
      } else if (kind === "bait") {
        const bait = baitById(id);
        if (progress.coins < bait.price) {
          sfx.miss();
          say(`${bait.name} costs ${bait.price} coins.`);
          return;
        }
        progress.coins -= bait.price;
        progress.baitStock[bait.id] = (progress.baitStock[bait.id] ?? 0) + 5;
        progress.bait = bait.id;
      } else if (kind === "equip") {
        progress.bait = id;
      } else if (kind === "reset") {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* nothing to clear */
        }
        Object.assign(progress, blankProgress());
        startLevel(0);
        renderKit();
        renderLog();
        return;
      }
      saveProgress(progress);
      sfx.buy();
      paintHud();
      renderKit();
      renderLog();
      say("Field kit updated.");
    }

    function renderKit() {
      if (!hud.kit) return;
      const rod = rodById(progress.rod);
      hud.kit.innerHTML = `
        <div class="fish-kit__head">
          <p class="fish-kit__eyebrow">FIELD KIT</p>
          <p class="fish-kit__coins">${Math.floor(progress.coins).toLocaleString("en-GB")} COINS</p>
        </div>
        <div class="fish-kit__cols">
          <div>
            <p class="fish-kit__label">RODS</p>
            <ul class="fish-kit__list">
              ${RODS.map(
                (item) => `<li class="${item.id === rod.id ? "is-equipped" : ""}">
                  <div><b>${item.name}</b><span>${item.blurb}</span></div>
                  ${
                    item.id === rod.id
                      ? '<span class="fish-kit__state">EQUIPPED</span>'
                      : `<button type="button" class="fish-buy" data-buy="rod:${item.id}"${
                          progress.coins < item.price ? " disabled" : ""
                        }>${item.price} c</button>`
                  }
                </li>`,
              ).join("")}
            </ul>
          </div>
          <div>
            <p class="fish-kit__label">BAIT · 5 PER PACK</p>
            <ul class="fish-kit__list">
              ${BAIT.map(
                (item) => `<li class="${item.id === progress.bait ? "is-equipped" : ""}">
                  <div><b>${item.name}</b><span>${item.blurb}</span></div>
                  ${
                    item.id === "none"
                      ? `<button type="button" class="fish-buy" data-buy="equip:none">USE</button>`
                      : `<span class="fish-kit__stock">${progress.baitStock[item.id] ?? 0}</span><button type="button" class="fish-buy" data-buy="bait:${item.id}"${
                          progress.coins < item.price ? " disabled" : ""
                        }>${item.price} c</button>`
                  }
                </li>`,
              ).join("")}
            </ul>
          </div>
        </div>
        <button type="button" class="fish-reset" data-buy="reset:all">RESET PROGRESS</button>`;
    }

    /* ---------- frame ---------- */

    function update(dt) {
      state.clock += dt;

      if (state.phase === "flight") {
        state.cast.t += dt / 0.55;
        if (state.cast.t >= 1) {
          state.cast.t = 1;
          land();
        }
      } else if (state.phase === "wait") {
        state.cast.left -= dt;
        for (const shadow of state.shadows) shadow.angle += dt * shadow.speed;
        if (state.cast.left <= 0) startBite();
      } else if (state.phase === "bite") {
        state.cast.biteAt += dt;
        if (state.cast.biteAt * 1000 > state.fish.window) {
          failCast("It slipped off before you struck. Cast spent.");
        }
      } else if (state.phase === "reel") {
        updateReel(dt);
      } else if (state.phase === "leap") {
        state.leapT += dt / 0.85;
        if (state.leapT >= 1) finishCatch();
      } else if (state.phase === "recover") {
        state.recoverLeft -= dt;
        if (state.recoverLeft <= 0) {
          if (state.levelDone) showLevelEnd();
          else nextCast();
        }
      }

      for (const ripple of state.ripples) {
        ripple.life -= dt * 0.8;
        ripple.r += dt * 5.4;
      }
      state.ripples = state.ripples.filter((ripple) => ripple.life > 0);
      for (const particle of state.particles) {
        particle.life -= dt;
        particle.vz -= dt * 5;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.z = Math.max(0.08, particle.z + particle.vz * dt);
      }
      state.particles = state.particles.filter((particle) => particle.life > 0);
      for (const popup of state.popups) {
        popup.life -= dt;
        popup.y -= dt * 10;
      }
      state.popups = state.popups.filter((popup) => popup.life > 0);
      if (state.wipe > 0) state.wipe = Math.max(0, state.wipe - dt * 1.8);
    }

    function updateReel(dt) {
      const fish = state.fish;
      const rod = rodById(progress.rod);
      const bait = baitById(progress.bait);
      const band = rod.band;
      state.reelTime += dt;
      const inBand = state.tension >= band[0] && state.tension <= band[1];
      if (inBand) state.bandTime += dt;

      if (state.thrashing > 0) {
        state.thrashing -= dt;
        state.tension += 0.25 * (dt / 0.4);
        if (state.thrashing <= 0) {
          state.thrashIn = rand(1.2, 3) / (bait.thrash * fish.thrashRate);
        }
      } else if (state.tell > 0) {
        state.tell -= dt;
        if (state.tell <= 0) state.thrashing = 0.4;
      } else {
        state.thrashIn -= dt;
        if (state.thrashIn <= 0) {
          state.tell = 0.3;
          sfx.thrash();
        }
      }

      if (state.reeling) {
        state.tension += (TENSION_UP + fish.pull) * dt;
        const gain = inBand ? 1 : state.tension < band[0] ? 0.4 : 0.15;
        state.reelProgress += PROGRESS_RATE * rod.progress * gain * dt;
        state.reelAccum = (state.reelAccum || 0) + dt;
        if (state.reelAccum > 0.14) {
          state.reelAccum = 0;
          sfx.reel();
        }
      } else {
        state.tension -= TENSION_DOWN * dt;
        state.reelProgress -= 0.06 * dt;
      }
      state.tension = clamp(state.tension, 0, 1.2);
      state.reelProgress = clamp(state.reelProgress, 0, 1);
      if (state.tension > SNAP_AT) {
        state.snapTimer += dt;
        if (state.snapTimer > SNAP_GRACE) {
          snapLine();
          return;
        }
      } else {
        state.snapTimer = Math.max(0, state.snapTimer - dt * 2);
      }
      if (state.reelProgress >= 1) catchFish();
    }

    function drawAngler() {
      const pose = { z: 0.7, stance: 0.22, scale: 1.26 };
      if (state.phase === "flight") {
        pose.lean = 0.45;
        pose.armR = 1.0;
      } else if (state.phase === "reel") {
        pose.lean = 0.32;
        pose.armR = 0.5;
        pose.crouch = 0.18;
      } else if (state.phase === "leap" || state.phase === "result") {
        pose.armR = -1.25;
        pose.lean = -0.18;
      } else if (state.aim) {
        pose.armR = 0.6;
        pose.lean = 0.2;
      }
      const hand = engine.figure(ANGLER.x, ANGLER.y, ANGLER.yaw, pose, {
        shirt: [216, 208, 186],
        stripe: [188, 96, 56],
        legs: [62, 74, 86],
        skin: [224, 180, 140],
        hair: [70, 50, 38],
      });
      engine.flushShadows();
      return hand;
    }

    function drawRod(hand) {
      const tip = engine.project(hand[0] + 0.5, hand[1] - 1.7, hand[2] + 1.5);
      const grip = engine.project(hand[0], hand[1], hand[2]);
      engine.line(grip.sx, grip.sy, tip.sx, tip.sy, engine.rgb(52, 42, 32), 1);
      return tip;
    }

    function bobberWorld() {
      if (state.phase === "flight") {
        const cast = state.cast;
        const t = cast.t;
        return {
          x: lerp(cast.from.x, cast.target.x, t),
          y: lerp(cast.from.y, cast.target.y, t),
          z: lerp(cast.from.z, 0.12, t) + Math.sin(Math.PI * t) * 1.9,
        };
      }
      if (state.phase === "wait" || state.phase === "bite" || state.phase === "reel") {
        const base = state.cast?.target ?? { x: 0, y: 0 };
        const bob =
          state.phase === "bite" ? -0.3 : Math.sin(state.clock * 3.2) * 0.06 + (state.phase === "reel" ? -0.16 : 0);
        return { x: base.x, y: base.y, z: 0.13 + bob };
      }
      return null;
    }

    function drawAim() {
      if (!state.aim) return;
      const p = engine.project(state.aim.x, state.aim.y, 0.02);
      const pulse = 0.5 + Math.sin(state.clock * 4) * 0.12;
      const ink = engine.rgb(46, 74, 74);
      engine.ring(p.sx, p.sy, 8 + pulse * 3, 0.45, ink, 2);
      engine.ring(p.sx, p.sy, 3, 0.45, ink, 0);
      engine.dot(p.sx - 1, p.sy, ink);
      engine.dot(p.sx + 1, p.sy, ink);
    }

    function drawWaterMarks() {
      for (const ripple of state.ripples) {
        const p = engine.project(ripple.x, ripple.y, 0.03);
        engine.ring(p.sx, p.sy, ripple.r * ripple.life * 10, 0.42, engine.rgb(232, 248, 246), 2);
        engine.ring(p.sx, p.sy, ripple.r * ripple.life * 6, 0.42, engine.rgb(190, 220, 216), 2);
      }
      for (const particle of state.particles) {
        const p = engine.project(particle.x, particle.y, particle.z);
        engine.dot(p.sx, p.sy, engine.rgb(...particle.tone));
      }

      const showShadows =
        state.phase === "wait" || state.phase === "bite" || state.phase === "reel";
      if (showShadows) {
        for (const shadow of state.shadows) {
          const x = Math.cos(shadow.angle) * shadow.radius;
          const y = Math.sin(shadow.angle) * shadow.radius;
          const p = engine.project(x, y, 0.02);
          const entry = loadSprite(shadow.id);
          const size = 17 + shadow.radius * 1.6;
          const wobble = Math.sin(state.clock * 1.7 + shadow.wobble) * 2;
          if (entry.status === "ready") {
            engine.drawSprite(entry, p.sx + wobble, p.sy + 5, size, {
              tint: [24, 74, 78],
              alpha: 0.62,
              dither: 0.3,
            });
          }
          if (Math.sin(state.clock * 0.9 + shadow.wobble) > 0.995) {
            engine.ring(p.sx + wobble, p.sy + 2, 5, 0.4, engine.rgb(214, 240, 236), 3);
          }
        }
      }

      if (state.phase === "reel" && state.fish) {
        const p = engine.project(state.cast.target.x, state.cast.target.y, 0.02);
        const entry = loadSprite(state.fish.id);
        const tell = state.tell > 0;
        if (entry.status === "ready") {
          engine.drawSprite(entry, p.sx, p.sy + 6, 17, {
            tint: tell ? [250, 236, 200] : [22, 62, 66],
            alpha: tell ? 0.55 : 0.8,
            dither: tell ? 0.15 : 0.4,
          });
        }
      }

      if (state.phase === "leap" && state.fish) {
        const t = clamp(state.leapT, 0, 1);
        const x = lerp(state.leapFrom.x, state.leapTo.x, t);
        const y = lerp(state.leapFrom.y, state.leapTo.y, t);
        const z = lerp(0.12, 2.4, t) + Math.sin(Math.PI * t) * 3.2;
        const p = engine.project(x, y, z);
        const entry = loadSprite(state.fish.id);
        if (entry.status === "ready") {
          engine.drawSprite(entry, p.sx, p.sy, 26, {
            tint: state.fish.shiny ? [255, 236, 200] : null,
            alpha: state.fish.shiny ? 0.16 : 0,
          });
        }
      }

      if (state.boss && (state.phase === "wait" || state.phase === "bite")) {
        const p = engine.project(state.cast.target.x, state.cast.target.y, 0);
        engine.ring(p.sx, p.sy, 20 + Math.sin(state.clock * 2) * 2, 0.42, engine.rgb(12, 40, 44), 3);
        engine.ring(p.sx, p.sy, 26 + Math.sin(state.clock * 2) * 2, 0.42, engine.rgb(20, 52, 56), 3);
      }
    }

    function drawBobber(tip) {
      const bob = bobberWorld();
      if (!bob) return;
      const p = engine.project(bob.x, bob.y, bob.z);
      const color =
        state.phase === "reel"
          ? state.snapTimer > 0.2
            ? engine.rgb(214, 62, 40)
            : state.tension > 0.7
              ? engine.rgb(206, 148, 22)
              : engine.rgb(248, 248, 240)
          : engine.rgb(248, 248, 240);
      const jitter = state.tell > 0 && !engine.STILL ? (Math.random() > 0.5 ? 1 : -1) : 0;
      engine.line(tip.sx + jitter, tip.sy, p.sx, p.sy, color, 1);
      engine.dot(p.sx, p.sy, engine.rgb(250, 250, 244));
      engine.dot(p.sx, p.sy + 1, engine.rgb(214, 74, 48));
      engine.dot(p.sx + 1, p.sy, engine.rgb(214, 74, 48));
      engine.dot(p.sx, p.sy - 1, engine.rgb(250, 250, 244));
      if (state.phase === "bite") {
        const ink = engine.rgb(40, 48, 44);
        engine.dot(p.sx, p.sy - 12, ink);
        engine.dot(p.sx, p.sy - 11, ink);
        engine.dot(p.sx, p.sy - 10, ink);
        engine.dot(p.sx, p.sy - 8, ink);
        engine.dot(p.sx, p.sy - 7, ink);
      }
    }

    const GLYPHS = {
      "0": ["111", "101", "101", "101", "111"],
      "1": ["010", "110", "010", "010", "111"],
      "2": ["111", "001", "111", "100", "111"],
      "3": ["111", "001", "111", "001", "111"],
      "4": ["101", "101", "111", "001", "001"],
      "5": ["111", "100", "111", "001", "111"],
      "6": ["111", "100", "111", "101", "111"],
      "7": ["111", "001", "010", "010", "010"],
      "8": ["111", "101", "111", "101", "111"],
      "9": ["111", "101", "111", "001", "111"],
      "+": ["000", "010", "111", "010", "000"],
      "×": ["000", "101", "010", "101", "000"],
    };

    function drawText(text, x, y, color) {
      let cursor = x;
      for (const character of String(text)) {
        const glyph = GLYPHS[character];
        if (!glyph) {
          cursor += 2;
          continue;
        }
        for (let row = 0; row < 5; row += 1)
          for (let col = 0; col < 3; col += 1) {
            if (glyph[row][col] === "1") engine.dot(cursor + col, y + row, color);
          }
        cursor += 4;
      }
    }

    function drawGauge() {
      if (state.phase !== "reel") return;
      const rod = rodById(progress.rod);
      const x = engine.W - 24;
      const top = 48;
      const height = 150;
      for (let i = 0; i < height; i += 1) {
        const value = 1 - i / height;
        const inBand = value >= rod.band[0] && value <= rod.band[1];
        engine.dot(x, top + i, inBand ? engine.rgb(196, 146, 26) : engine.rgb(216, 220, 214));
        engine.dot(x + 1, top + i, inBand ? engine.rgb(222, 178, 58) : engine.rgb(202, 208, 202));
      }
      const marker = top + Math.round((1 - state.tension) * height);
      engine.line(x - 3, marker, x + 4, marker, engine.rgb(40, 48, 44), 1);
      const py = engine.H - 34;
      for (let i = 0; i < 150; i += 1) {
        const filled = i / 150 <= state.reelProgress;
        engine.line(20 + i, py, 20 + i, py + 5, filled ? engine.rgb(196, 146, 26) : engine.rgb(226, 230, 224), 1);
      }
    }

    function drawFrame() {
      engine.resetFrame();
      restoreTree();
      engine.animateWater(state.clock, engine.KIND_WATER, 0.9);
      engine.drawTufts(state.clock);
      engine.drawLeaves(state.clock);
      if (state.rain && !engine.STILL) {
        for (let i = 0; i < 34; i += 1) {
          const x = (i * 73 + state.clock * 70) % engine.W;
          const y = (i * 41 + state.clock * 150) % (engine.H * 0.7);
          engine.dot(x, y, engine.rgb(176, 200, 208));
        }
      }
      drawAim();
      drawWaterMarks();
      const hand = drawAngler();
      const tip = drawRod(hand);
      drawBobber(tip);
      engine.applyShadows();
      engine.shadeEdges();
      if (state.wipe > 0) {
        for (let iy = 0; iy < engine.H; iy += 1)
          for (let ix = 0; ix < engine.W; ix += 1) {
            const i = iy * engine.W + ix;
            if (engine.zb[i] < -1e8) continue;
            const threshold = ((ix & 3) + (iy & 3) * 4) / 16;
            if (threshold < state.wipe) engine.pix[i] = 0;
          }
      }
      drawGauge();
      for (const popup of state.popups) {
        drawText(popup.text, popup.x, popup.y, engine.rgb(96, 74, 18));
      }
      engine.present();
    }

    function frame(now) {
      if (!mounted || mounted.root !== rootEl) return;
      const raw = Math.min(50, now - (state.lastFrame || now));
      state.lastFrame = now;
      if (!state.paused && state.visible) {
        state.accumulator += raw;
        let guard = 0;
        while (state.accumulator >= 1000 / 60 && guard < 4) {
          update(1 / 60);
          state.accumulator -= 1000 / 60;
          guard += 1;
        }
        drawFrame();
      }
      state.raf = requestAnimationFrame(frame);
    }

    /* ---------- input ---------- */

    function worldFromEvent(event) {
      const rect = canvas.getBoundingClientRect();
      const sx = ((event.clientX - rect.left) / rect.width) * engine.W;
      const sy = ((event.clientY - rect.top) / rect.height) * engine.H;
      return engine.unproject(sx, sy);
    }

    function onPointerMove(event) {
      if (event.pointerType === "touch") return;
      if (state.phase !== "ready") {
        state.aim = null;
        return;
      }
      const point = worldFromEvent(event);
      state.aim = zoneAt(point.x, point.y) ? point : null;
    }

    function onPointerLeave() {
      state.aim = null;
    }

    function onPointerDown(event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      try {
        canvas.setPointerCapture?.(event.pointerId);
      } catch {
        /* synthetic pointer */
      }
      audio();
      state.pointerDown = true;
      if (state.phase === "ready") {
        const point = worldFromEvent(event);
        castTo(point.x, point.y);
      } else if (state.phase === "wait") {
        failCast("Too early — the splash scared it off. Cast spent.");
        state.pointerDown = false;
      } else if (state.phase === "bite") {
        strike();
      } else if (state.phase === "reel") {
        state.reeling = true;
      }
    }

    function onPointerUp(event) {
      try {
        canvas.releasePointerCapture?.(event.pointerId);
      } catch {
        /* not captured */
      }
      state.pointerDown = false;
      if (state.phase === "reel") state.reeling = false;
    }

    function onKeyDown(event) {
      if (event.code === "Space" || event.key === " ") {
        event.preventDefault();
        if (event.repeat) return;
        if (state.phase === "ready") {
          const angle = rand(0, TAU);
          const radius = rand(0.8, POND_R - 0.8);
          castTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        } else if (state.phase === "bite") strike();
        else if (state.phase === "reel") state.reeling = true;
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        if (state.paused) resume();
        else pause();
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const delta = event.key === "ArrowRight" ? 1 : -1;
        const next = state.levelIndex + delta;
        if (next >= 0 && next < LEVELS.length && canUnlock(next, progress)) startLevel(next);
      }
    }

    function onKeyUp(event) {
      if (event.code === "Space" || event.key === " ") {
        if (state.phase === "reel") state.reeling = false;
      }
    }

    const bound = {
      pointermove: onPointerMove,
      pointerleave: onPointerLeave,
      pointerdown: onPointerDown,
      pointerup: onPointerUp,
      pointercancel: onPointerUp,
      keydown: onKeyDown,
      keyup: onKeyUp,
      blur: () => {
        state.reeling = false;
      },
    };
    Object.entries(bound).forEach(([type, handler]) =>
      canvas.addEventListener(type, handler, { passive: type === "pointermove" }),
    );

    function syncSize() {
      const width = Math.min(1160, rootEl.clientWidth || 360);
      engine.fit(width, 3);
    }

    const resizeObserver = new ResizeObserver(syncSize);
    resizeObserver.observe(rootEl);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        state.visible = !!entries[0]?.isIntersecting;
      },
      { threshold: 0.05 },
    );
    intersectionObserver.observe(canvas);

    function pause() {
      state.paused = true;
      say("Paused.");
    }

    function resume() {
      state.paused = false;
      state.lastFrame = 0;
      state.accumulator = 0;
    }

    function onVisibility() {
      if (document.hidden) pause();
      else resume();
    }
    document.addEventListener("visibilitychange", onVisibility);

    const api = { mount, pause, resume };

    mounted = {
      root: rootEl,
      api,
      resume,
      pause,
      destroy() {
        cancelAnimationFrame(state.raf);
        resizeObserver.disconnect();
        intersectionObserver.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
        Object.entries(bound).forEach(([type, handler]) =>
          canvas.removeEventListener(type, handler),
        );
        mounted = null;
      },
    };

    syncSize();
    renderLog();
    startLevel(0);
    LEVELS.forEach((level) => setTimeout(() => buildThumb(level), 80));
    clearCard();
    if (hud.kit) hud.kit.hidden = true;
    state.lastFrame = performance.now();
    state.raf = requestAnimationFrame(frame);
    return api;
  }

  return {
    mount,
    pause() {
      mounted?.pause();
    },
    resume() {
      mounted?.resume();
    },
    destroy() {
      mounted?.destroy();
    },
  };
})();

window.AnglingStation = AnglingStation;

export default AnglingStation;
