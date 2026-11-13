/* Angling Station: a five-stage fishing diorama drawn on a 360×280 software
   rasteriser. The renderer lives in engine.js; this file owns the state
   machine, the level bakes, the audio and the HUD wiring.

   Only one name is exposed to the page — window.AnglingStation — and the
   React section mounts it. Everything else is closed over. */

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
  ZONE_DEPTH,
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
  /* Tension has to be feather-able: at 0.9/s a held line left the sweet band
     in a quarter second, which read as a broken reel rather than a tense one. */
  const TENSION_UP = 0.55;
  const TENSION_DOWN = 1.2;
  const SNAP_AT = 0.85;
  const SNAP_GRACE = 0.8;
  const INSTANT = 1.2;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (list) => list[(Math.random() * list.length) | 0];
  const mix = (a, b, t) => [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  ];

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
      /* private mode: the run still plays, it just will not outlive the tab */
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
      master.gain.value = 0.5;
      master.connect(audioCtx.destination);
      audioCtx.fishMaster = master;
    }
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    return audioCtx;
  }

  function tone({ from, to, type = "square", length = 0.08, level = 0.06, delay = 0 }) {
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

  function noise({ length = 0.2, from = 2400, to = 300, level = 0.09, delay = 0 }) {
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
    charge: () => tone({ from: 320, to: 520, type: "sine", length: 0.1, level: 0.03 }),
    cast: () => {
      noise({ length: 0.16, from: 3200, to: 900, level: 0.05 });
      tone({ from: 640, to: 260, type: "triangle", length: 0.12, level: 0.03 });
    },
    splash: () => {
      noise({ length: 0.22, from: 2600, to: 260, level: 0.1 });
      tone({ from: 220, to: 90, type: "sine", length: 0.18, level: 0.04 });
    },
    bite: () => {
      tone({ from: 880, to: 880, type: "square", length: 0.05, level: 0.05 });
      tone({ from: 1320, to: 1320, type: "square", length: 0.06, level: 0.04, delay: 0.07 });
    },
    hook: () => tone({ from: 520, to: 960, type: "square", length: 0.09, level: 0.05 }),
    perfect: () => {
      tone({ from: 880, to: 880, type: "square", length: 0.06, level: 0.05 });
      tone({ from: 1320, to: 1320, type: "square", length: 0.1, level: 0.045, delay: 0.06 });
    },
    reel: () => tone({ from: 300, to: 340, type: "triangle", length: 0.03, level: 0.018 }),
    thrash: () => noise({ length: 0.14, from: 1200, to: 400, level: 0.06 }),
    snap: () => {
      noise({ length: 0.1, from: 4200, to: 1200, level: 0.1 });
      tone({ from: 500, to: 90, type: "sawtooth", length: 0.24, level: 0.05 });
    },
    miss: () => tone({ from: 300, to: 160, type: "triangle", length: 0.16, level: 0.04 }),
    caught: () => {
      [523, 659, 784, 1046].forEach((f, i) =>
        tone({ from: f, to: f, type: "square", length: 0.1, level: 0.045, delay: i * 0.09 }),
      );
    },
    shiny: () => {
      [1046, 1318, 1568, 2093].forEach((f, i) =>
        tone({ from: f, to: f, type: "sine", length: 0.16, level: 0.04, delay: i * 0.06 }),
      );
    },
    record: () => tone({ from: 1568, to: 2093, type: "sine", length: 0.22, level: 0.04 }),
    coin: () => tone({ from: 1046, to: 1568, type: "square", length: 0.08, level: 0.035 }),
    buy: () => {
      tone({ from: 660, to: 990, type: "square", length: 0.07, level: 0.04 });
      tone({ from: 990, to: 1320, type: "square", length: 0.09, level: 0.035, delay: 0.07 });
    },
  };

  /* ---------------- sprites ---------------- */

  const spriteCache = new Map();

  function loadSprite(id) {
    if (spriteCache.has(id)) return spriteCache.get(id);
    const entry = { id, img: null, data: null, w: 0, h: 0, status: "loading" };
    spriteCache.set(id, entry);
    /* First ask for CORS so the pixels can be read for silhouettes. The sprite
       host does not always answer with the header, and a CORS-rejected image
       would otherwise leave a hole, so the same file is retried without it and
       the canvas taint path draws it unmodified instead. */
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
        /* A tainted canvas only costs the pixel-read path; the <img> is still
           drawn unmodified over the diorama instead. */
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

    const engine = PixelEngine.createEngine(canvas, { originY: -6 });
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
      hint: q("hint"),
    };

    const progress = loadProgress();
    const state = {
      phase: "idle",
      levelIndex: 0,
      level: LEVELS[0],
      score: 0,
      castsLeft: CASTS_PER_LEVEL,
      streak: 0,
      bestStreak: 0,
      perfectRatio: 0,
      caught: new Set(),
      survey: new Set(),
      surveyStamped: false,
      bossUsed: false,
      boss: null,
      cast: null,
      fish: null,
      result: null,
      message: "",
      clock: 0,
      power: 0,
      chargeDir: 1,
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
      treeMask: null,
      flash: 0,
      lastFrame: 0,
      accumulator: 0,
      levelDone: false,
    };

    /* ---------- HUD ---------- */

    function paintHud() {
      if (hud.score) hud.score.textContent = Math.round(state.score).toLocaleString("en-GB");
      if (hud.casts) hud.casts.textContent = `${state.castsLeft}/${CASTS_PER_LEVEL}`;
      if (hud.combo) {
        const mult = comboMultiplier();
        hud.combo.textContent = state.streak > 1 ? `×${mult.toFixed(2)}` : "×1.00";
        hud.combo.classList.toggle("is-hot", mult >= 1.5);
      }
      if (hud.level) hud.level.textContent = state.level.short;
      if (hud.coins) hud.coins.textContent = Math.floor(progress.coins).toLocaleString("en-GB");
      if (hud.status && state.message) hud.status.textContent = state.message;
    }

    function say(message) {
      state.message = message;
      if (hud.status) hud.status.textContent = message;
    }

    function comboMultiplier() {
      return Math.min(SCORE.comboCap, 1 + SCORE.comboStep * Math.max(0, state.streak - 1));
    }

    function renderRail() {
      if (!hud.levels) return;
      hud.levels.innerHTML = LEVELS.map((level, index) => {
        const unlocked = canUnlock(index, progress);
        const best = progress.levels[level.id]?.stars ?? 0;
        const current = index === state.levelIndex;
        return `<button type="button" class="fish-level${current ? " is-current" : ""}" data-level="${index}"${
          unlocked ? "" : " disabled"
        }><span class="fish-level__no">${String(index + 1).padStart(2, "0")}</span><span class="fish-level__name">${level.name}</span><span class="fish-level__stars" aria-label="${best} of 3 stars">${"★".repeat(best)}${"☆".repeat(3 - best)}</span></button>`;
      }).join("");
    }

    if (hud.levels) {
      hud.levels.addEventListener("click", (event) => {
        const button = event.target.closest("[data-level]");
        if (!button) return;
        const index = Number(button.dataset.level);
        if (!canUnlock(index, progress)) return;
        startLevel(index);
        sfx.coin();
      });
    }

    if (hud.card) {
      hud.card.addEventListener("click", (event) => {
        const action = event.target.closest("[data-action]");
        if (!action) return;
        const name = action.dataset.action;
        if (name === "next") nextCast();
        if (name === "retry") startLevel(state.levelIndex);
        if (name === "select") {
          const id = Number(action.dataset.id);
          options.onSelect?.(id);
          say(`Loaded ${SPECIES[id]?.name ?? "specimen"} into the specimen record above.`);
        }
        if (name === "close") clearCard();
      });
    }

    if (hud.kit) {
      hud.kit.addEventListener("click", (event) => {
        const action = event.target.closest("[data-buy]");
        if (!action) return;
        const [kind, id] = action.dataset.buy.split(":");
        buy(kind, id);
      });
    }

    /* ---------- world ---------- */

    const ORIGIN = { x: 4.6, y: 7.2 };
    const WATER_EDGE = 1.9;
    const ANGLER = {
      x: ORIGIN.x,
      y: ORIGIN.y,
      yaw: Math.PI * 0.78,
      palette: {
        shirt: [214, 206, 182],
        stripe: [176, 92, 54],
        legs: [58, 70, 82],
        skin: [222, 178, 138],
        hair: [72, 52, 40],
      },
    };

    function targetFor(zone) {
      const distance = ZONE_DEPTH[zone.id] ?? 0;
      const x = zone.id === "deep" ? 1.4 : zone.id === "mid" ? 3.4 : 5.4;
      return { x, y: distance, z: 0.1 };
    }

    function markGrass(probability) {
      for (let i = 0; i < engine.pix.length; i += 1) {
        if (engine.kinds[i] !== engine.KIND_GROUND) continue;
        if (Math.random() < probability) engine.kinds[i] = engine.KIND_GRASS;
      }
    }

    function leafShadow(points, strength = 1) {
      for (const [x, y, z, r] of points) engine.castShadow(x, y, z, r, strength);
    }

    function pond() {
      const p = state.level.palette;
      engine.plane(-26, -26, 26, WATER_EDGE, 0, (x, y) => {
        const depth = clamp((WATER_EDGE - y) / 15, 0, 1);
        const ripple = engine.noise(x * 0.5, y * 0.8) * 0.14;
        return mix(mix(p.water, p.waterDeep, depth), [170, 196, 190], ripple * 0.2);
      }, engine.KIND_WATER);
      engine.plane(-26, WATER_EDGE, 26, 26, 0.55, (x, y) =>
        mix(p.shore, p.sand, clamp(engine.noise(x * 0.4, y * 0.4) * 0.7, 0, 1) * 0.5),
      );
      markGrass(0.3);
      engine.box(-24, WATER_EDGE - 0.2, 0, 24, WATER_EDGE + 0.35, 0.6, p.sand, 3);
      for (let i = 0; i < 9; i += 1) {
        const x = -11 + i * 2.6 + engine.hash(i, 3) * 0.8;
        engine.box(x, 0.2 + engine.hash(i, 5) * 1.2, 0, x + 0.85, 1.0, 0.06, [64, 112, 70], i);
      }
      snapshotTree(-4.2, 8.4, 1.05);
      engine.growTree(-4.2, 8.4, 1.05, 340, 0, p.leaf);
      for (let i = 0; i < 12; i += 1) {
        const x = -12 + i * 2.1;
        const z = 0;
        const y = WATER_EDGE - 0.1;
        engine.capsule([x, y, z], [x + 0.12, y - 0.1, 1.6 + engine.hash(i, 2) * 0.7], 0.05, 0.03, () => [96, 138, 72], "solid");
      }
      for (let i = 0; i < 7; i += 1) {
        const x = -8 + i * 2.4;
        const y = 0.6 + engine.hash(i, 9) * 2;
        engine.sphere(x, y, 0.05, 0.55, [78, 116, 72], "solid");
      }
      leafShadow([[-4.2, 8.4, 3.6, 0.6], [-11, 1.9, 1.2, 0.2], [-3, 1.9, 1.2, 0.2]], 0.42);
    }

    function cape() {
      const p = state.level.palette;
      engine.plane(-26, -26, 26, WATER_EDGE, 0, (x, y) => {
        const depth = clamp((WATER_EDGE - y) / 16, 0, 1);
        const foam = engine.noise(x * 0.7, y * 1.4 + 2) > 0.78 ? 0.22 : 0;
        return mix(mix(p.water, p.waterDeep, depth), [210, 230, 236], foam);
      }, engine.KIND_WATER);
      engine.plane(-26, WATER_EDGE, 26, 26, 0.55, () => p.shore);
      markGrass(0.22);
      engine.box(3.4, 2.0, 0, 24, 26, 2.4, [104, 104, 96], 7);
      engine.box(4.4, 2.4, 0, 23, 25, 2.42, [120, 118, 106], 9);
      engine.box(8.0, 3.0, 0, 9.6, 4.4, 0.7, [96, 88, 74], 11);
      engine.capsule([8.8, 3.7, 0.6], [8.8, 3.7, 4.6], 0.42, 0.3, () => [218, 214, 200], "solid");
      engine.sphere(8.8, 3.7, 4.7, 0.55, [242, 226, 178], "gloss");
      engine.box(7.9, 2.9, 4.3, 9.7, 4.5, 4.5, [86, 82, 76], 13);
      engine.box(8.2, 3.2, 4.55, 9.4, 4.2, 4.62, [250, 238, 190], 0);
      for (let i = 0; i < 6; i += 1) {
        const x = -10 + i * 3.4;
        engine.capsule([x, 3.1, 0], [x - 0.2, 3.0, 1.1 + engine.hash(i, 4)], 0.07, 0.03, () => [88, 126, 82], "solid");
      }
      leafShadow([[8.8, 3.7, 4.7, 0.45], [5, 3.0, 2.4, 0.8]], 0.6);
    }

    function dock() {
      const p = state.level.palette;
      engine.plane(-26, -26, 26, WATER_EDGE, 0, (x, y) => {
        const depth = clamp((WATER_EDGE - y) / 15, 0, 1);
        const glow = clamp((x + 13) / 26, 0, 1) * 0.3;
        return mix(mix(p.water, p.waterDeep, depth), [206, 138, 92], glow);
      }, engine.KIND_WATER);
      engine.plane(-26, WATER_EDGE, 26, 26, 0.55, (x) => mix(p.shore, p.sand, clamp((x + 13) / 26, 0, 1) * 0.4));
      markGrass(0.12);
      for (let i = 0; i < 22; i += 1) {
        const y = 1.2 - i * 0.62;
        engine.box(2.4, y - 0.46, 0.5, 6.4, y, 0.62, i % 2 ? [118, 88, 58] : [128, 96, 64], i);
      }
      engine.box(2.2, -3.4, 0, 2.8, 1.4, 1.0, [86, 64, 44], 3);
      engine.box(6.0, -3.4, 0, 6.6, 1.4, 1.0, [86, 64, 44], 4);
      engine.box(7.2, 4.6, 0, 8.6, 5.8, 0.8, [132, 100, 62], 5);
      engine.box(7.4, 4.8, 0.8, 8.4, 5.6, 1.5, [148, 112, 70], 6);
      engine.box(8.9, 4.2, 0, 10.1, 5.4, 0.6, [120, 92, 60], 8);
      engine.box(9.1, 4.4, 0.6, 9.9, 5.2, 1.2, [138, 104, 66], 9);
      engine.capsule([-4.4, -1.6, 0.1], [-4.4, -1.6, 1.5], 0.5, 0.42, () => [96, 66, 46], "solid");
      engine.box(-6.2, -2.2, 0.4, -2.6, -1.0, 0.9, [110, 76, 52], 12);
      engine.box(-5.6, -1.8, 0.9, -3.0, -1.2, 1.3, [122, 86, 58], 13);
      engine.capsule([-4.4, -1.6, 1.2], [-4.4, -1.6, 4.2], 0.1, 0.07, () => [92, 74, 60], "solid");
      engine.box(-4.9, -1.7, 3.6, -3.9, -1.5, 4.4, [206, 198, 178], 0);
      engine.capsule([8.2, 2.6, 0], [8.2, 2.6, 2.4], 0.1, 0.08, () => [90, 74, 56], "solid");
      engine.sphere(8.2, 2.6, 2.55, 0.35, [252, 206, 118], "gloss");
      for (let i = 0; i < 7; i += 1) {
        engine.sphere(-11 + i * 3.4, -4 + engine.hash(i, 2) * 3, 0.4, 0.12, [240, 196, 120], "solid");
      }
      leafShadow([[-4.4, -1.6, 3.4, 0.8], [7.8, 4.8, 1.2, 0.5], [9.4, 4.6, 1.0, 0.5]]);
    }

    function cavern() {
      const p = state.level.palette;
      engine.plane(-26, -26, 26, WATER_EDGE, 0, (x, y) => {
        const depth = clamp((WATER_EDGE - y) / 15, 0, 1);
        return mix(p.water, p.waterDeep, depth);
      }, engine.KIND_WATER);
      engine.plane(-26, WATER_EDGE, 26, 26, 0.55, () => p.sand);
      markGrass(0.05);
      engine.box(-24, 2.4, 0, 24, 26, 3.6, [58, 64, 76], 2);
      engine.box(-24, 2.2, 0, 24, 3.0, 1.0, p.shore, 4);
      for (let i = 0; i < 6; i += 1) {
        const x = -11 + i * 3.6;
        engine.capsule([x, 9.6, 5.4], [x + 0.4, 9.4, 3.1], 0.3, 0.05, () => [196, 220, 226], "gloss");
      }
      for (let i = 0; i < 7; i += 1) {
        const x = -10 + i * 3.2;
        const y = -1 - engine.hash(i, 7) * 4;
        engine.box(x, y, 0, x + 2.2, y + 2.0, 0.18, [176, 202, 208], i);
        engine.sphere(x + 0.5, y + 0.4, 0.16, 0.22, [206, 230, 234], "solid");
      }
      engine.box(-11, 4.4, 0, -7.6, 8.2, 2.0, [74, 82, 96], 6);
      engine.box(-11, 4.6, 2.0, -7.8, 8.0, 2.02, [88, 98, 112], 7);
      leafShadow([[5, 2.4, 3.6, 1.6], [-9, 6, 2.0, 0.9]]);
    }

    function night() {
      const p = state.level.palette;
      engine.plane(-26, -26, 26, WATER_EDGE, 0, (x, y) => {
        const depth = clamp((WATER_EDGE - y) / 15, 0, 1);
        const moon = x > 2 && x < 5 ? 0.2 : 0;
        return mix(mix(p.water, p.waterDeep, depth), [190, 176, 214], moon);
      }, engine.KIND_WATER);
      engine.plane(-26, WATER_EDGE, 26, 26, 0.55, () => p.shore);
      markGrass(0.08);
      for (let i = 0; i < 26; i += 1) {
        const y = 1.8 - i * 0.42;
        engine.box(3.0, y, 0, 4.6, y + 0.3, 0.03, [196, 186, 226], i);
      }
      engine.sphere(3.8, -9.6, 4.6, 0.7, [238, 236, 220], "gloss");
      for (let i = 0; i < 8; i += 1) {
        const x = -10 + i * 2.9;
        const y = -2 - engine.hash(i, 3) * 5;
        engine.capsule([x, y, 0.4 + engine.hash(i, 4) * 1.2], [x, y, 1.6 + engine.hash(i, 4) * 1.4], 0.42, 0.18, () => [116, 96, 168], "solid");
        engine.sphere(x, y, 1.05, 0.18, [196, 168, 236], "gloss");
      }
      snapshotTree(-8.6, 9.4, 0.9);
      engine.growTree(-8.6, 9.4, 0.9, 240, 3, p.leaf);
      engine.box(-11.6, 7.8, 0, -10.4, 9.2, 0.6, [46, 48, 58], 2);
      leafShadow([[-8.6, 9.4, 3.2, 0.7]], 0.55);
    }

    const ART = { pond, cape, dock, cavern, night };

    /* A dithered line of foam where the ground meets the water, so the shore
       is a texture rather than a straight seam. */
    function shoreFoam() {
      const sand = state.level.palette.sand;
      const tone = [
        Math.min(255, sand[0] + 70),
        Math.min(255, sand[1] + 62),
        Math.min(255, sand[2] + 52),
      ];
      for (let x = -24; x <= 24; x += 0.09) {
        const y = WATER_EDGE - 0.18 + engine.noise(x * 0.7, 2.4) * 0.5;
        if (engine.hash(x * 11.3, 4.2) < 0.4) {
          engine.plot(x, y, 0.03, engine.rgb(...tone));
        }
      }
    }

    function bakeLevel() {
      engine.clear();
      state.shadows = [];
      state.treeMask = null;
      (ART[state.level.art] ?? pond)();
      shoreFoam();
      engine.castShadow(ANGLER.x, ANGLER.y, 0, 0.42, 1, 0.2);
      engine.applyShadows();
      engine.bakeOcclusion();
      engine.bake();
      engine.growGrass();
    }

    /* The canopy is the one static thing that moves, so the pixels under it
       are kept aside and restored before the swaying leaves are redrawn.
       Captured before the tree is drawn, otherwise the rest pose is baked in
       and every sway leaves a ghost behind. */
    function snapshotTree(cx, cy, scale = 1) {
      const box = engine.project(cx - 3.4 * scale, cy - 3.4 * scale, 0);
      const box2 = engine.project(cx + 3.4 * scale, cy + 3.4 * scale, 6.6 * scale);
      const x0 = Math.max(0, Math.floor(Math.min(box.sx, box2.sx)) - 8);
      const x1 = Math.min(engine.W - 1, Math.ceil(Math.max(box.sx, box2.sx)) + 8);
      const y0 = Math.max(0, Math.floor(Math.min(box.sy, box2.sy)) - 8);
      const y1 = Math.min(engine.H - 1, Math.ceil(Math.max(box.sy, box2.sy)) + 8);
      const w = x1 - x0;
      const h = y1 - y0;
      if (w <= 0 || h <= 0) return;
      const pixels = new Uint32Array(w * h);
      const depth = new Float32Array(w * h);
      for (let y = 0; y < h; y += 1)
        for (let x = 0; x < w; x += 1) {
          const i = (y0 + y) * engine.W + x0 + x;
          pixels[y * w + x] = engine.pix[i];
          depth[y * w + x] = engine.zb[i];
        }
      state.treeMask = { x0, y0, w, h, pixels, depth };
    }

    function restoreTree() {
      const mask = state.treeMask;
      if (!mask) return;
      for (let y = 0; y < mask.h; y += 1)
        for (let x = 0; x < mask.w; x += 1) {
          const i = (mask.y0 + y) * engine.W + mask.x0 + x;
          engine.pix[i] = mask.pixels[y * mask.w + x];
          engine.zb[i] = mask.depth[y * mask.w + x];
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
      state.phase = "ready";
      state.wipe = 1;
      state.cast = null;
      state.fish = null;
      state.result = null;
      state.ripples = [];
      state.particles = [];
      state.popups = [];
      state.power = 0;
      state.chargeDir = 1;
      state.tension = 0.45;
      state.snapTimer = 0;
      state.reeling = false;
      state.reelTime = 0;
      state.bandTime = 0;
      state.reelProgress = 0;
      state.goldPaid = false;
      state.rain = state.level.id === "cerulean";
      if (hud.kit) hud.kit.hidden = true;
      clearCard();
      bakeLevel();
      LEVELS[index].pool.forEach((id) => loadSprite(id));
      loadSprite(130);
      say("Hold to charge a cast, release to throw.");
      paintHud();
      renderRail();
    }

    function beginCharge() {
      if (state.phase !== "ready") return;
      state.phase = "charging";
      state.clock = 0;
      state.power = 0;
      state.chargeDir = 1;
      sfx.charge();
      say("Hold to charge. Release to throw.");
    }

    function releaseCharge() {
      if (state.phase !== "charging") return;
      const zone = zoneFor(state.power);
      const target = targetFor(zone);
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
        target,
        t: 0,
        from: { x: ANGLER.x + 0.6, y: ANGLER.y - 0.4, z: 2.7 },
        power: state.power,
      };
      state.phase = "flight";
      state.boss = null;
      if (state.levelIndex >= 2 && state.streak >= 3 && !state.bossUsed) {
        state.bossUsed = true;
        state.boss = { species: 130, t: 0 };
      }
      sfx.cast();
      say(`Cast at ${Math.round(state.power * 100)}% — ${zone.label.toLowerCase()} water.`);
      paintHud();
    }

    function land() {
      const cast = state.cast;
      state.phase = "wait";
      const bait = baitById(progress.bait);
      const rod = rodById(progress.rod);
      const wait = rand(1.5, 5) * rod.wait * bait.wait * (state.boss ? 0.7 : 1);
      state.cast.wait = wait;
      state.cast.left = wait;
      state.cast.biteAt = wait;
      state.cast.spook = false;
      addRipple(cast.target.x, cast.target.y, 0.1, 30);
      spawnDrops(cast.target.x, cast.target.y, 14, 0.6);
      sfx.splash();
      state.shadows = Array.from({ length: 3 }, () => ({
        x: cast.target.x + rand(-3, 3),
        y: cast.target.y + rand(-2.5, 2.5),
        r: rand(0.28, 0.55),
        phase: rand(0, TAU),
        speed: rand(0.5, 1.1) * (Math.random() > 0.5 ? 1 : -1),
        id: pick(state.level.pool),
      }));
      say("Watch the bobber. Strike the moment it dips.");
    }

    function addRipple(x, y, z, size) {
      state.ripples.push({ x, y, z, r: 0.2, max: size / 10, life: 1 });
    }

    function spawnDrops(x, y, count, spread) {
      if (engine.STILL) return;
      for (let i = 0; i < count; i += 1) {
        state.particles.push({
          x: x + rand(-spread, spread),
          y: y + rand(-spread, spread),
          z: 0.1,
          vz: rand(1.2, 3.2),
          vx: rand(-0.9, 0.9),
          vy: rand(-0.9, 0.9),
          life: rand(0.4, 0.9),
          tone: [200, 226, 232],
        });
      }
    }

    function chooseFish() {
      const bait = baitById(progress.bait);
      const cast = state.cast;
      const pool = poolFor(state.level, cast.zone.id, bait.rare);
      if (state.boss) {
        return { id: state.boss.species, rarity: "epic", boss: true };
      }
      const chosen = pickWeighted(pool, Math.random());
      return {
        id: chosen.id,
        rarity: chosen.rarity,
        boss: false,
      };
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
        struck: false,
      };
      state.phase = "bite";
      state.cast.biteAt = 0;
      sfx.bite();
      if (state.fish.id === 72 && Math.random() < SCORE.tentacoolSteal && progress.bait !== "none") {
        const stolen = progress.bait;
        progress.baitStock[stolen] = Math.max(0, (progress.baitStock[stolen] ?? 1) - 1);
        if (progress.baitStock[stolen] <= 0) progress.bait = "none";
        saveProgress(progress);
        say("A Tentacool strips the bait off the hook and drifts away.");
        state.phase = "recover";
        state.recoverLeft = 1.2;
        state.castsLeft = Math.max(0, state.castsLeft - 1);
        paintHud();
        if (state.castsLeft <= 0) endLevel();
        return;
      }
      say(junk ? "Something heavy is on the hook…" : state.boss ? "Something huge takes the bait." : "BITE — strike now!");
      if (state.boss) addRipple(state.cast.target.x, state.cast.target.y, 0.1, 44);
    }

    function strike() {
      if (state.phase !== "bite") return;
      const fish = state.fish;
      state.fish.biteAt = state.cast.biteAt;
      fish.struck = true;
      fish.perfect = state.cast.biteAt * 1000 <= 150;
      fish.thrashRate = fish.boss ? 2 : fish.rarity === "epic" ? 1.4 : fish.rarity === "rare" ? 1.2 : 1;
      state.phase = "reel";
      state.tension = 0.45;
      state.snapTimer = 0;
      state.reeling = true;
      state.thrashIn = rand(1.2, 2.6) / (baitById(progress.bait).thrash * fish.thrashRate);
      state.thrashing = 0;
      state.tell = 0;
      state.reelTime = 0;
      state.bandTime = 0;
      state.reelProgress = 0;
      state.reelAccum = 0;
      if (fish.perfect) sfx.perfect();
      else sfx.hook();
      say(fish.perfect ? "Perfect hook. Hold to reel, release when it thrashes." : "Hooked. Hold to reel, release when it thrashes.");
    }

    function failCast(reason) {
      state.phase = "recover";
      state.recoverLeft = 1.1;
      state.streak = 0;
      state.castsLeft = Math.max(0, state.castsLeft - 1);
      addRipple(state.cast?.target.x ?? 3, state.cast?.target.y ?? 0, 0.1, 22);
      spawnDrops(state.cast?.target.x ?? 3, state.cast?.target.y ?? 0, 8, 0.4);
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
      const fish = state.fish;
      if (!fish) return;
      state.phase = "leap";
      state.leapT = 0;
      animalSplash();
      sfx.splash();
      addRipple(state.cast.target.x, state.cast.target.y, 0.1, 40);
      spawnDrops(state.cast.target.x, state.cast.target.y, fish.boss ? 34 : 20, fish.boss ? 1.4 : 0.8);
      state.leapFrom = { x: state.cast.target.x, y: state.cast.target.y, z: 0.1 };
      state.leapTo = { x: 2.6, y: 2.4, z: 2.4 };
    }

    function animalSplash() {
      if (state.fish?.shiny) sfx.shiny();
      else sfx.caught();
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
      const points = Math.round(
        base * size * (1 + SCORE.perfectMultiplier * perfect) * hook * combo * shiny,
      );

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
      const bonus = isRecord ? SCORE.recordBonus : 0;
      state.score += points + bonus;
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
      if (lucky && Math.random() < SCORE.luckyRefundChance) {
        state.castsLeft += 1;
        state.popups.push({ x: 200, y: 70, text: "+1 CAST", life: 1.6 });
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
      state.result = {
        fish,
        info,
        points,
        bonus,
        surveyBonus,
        size,
        perfect,
        isRecord,
        newCatch,
        record: progress.caught[recordKey],
        lucky,
      };
      state.phase = "result";
      state.reelProgress = 0;
      state.paused = false;
      renderResult();
      paintHud();
      addPopup(`+${points + bonus}`, 1.4);
      if (isRecord) sfx.record();
      if (state.castsLeft <= 0) state.levelDone = true;
      if (state.levelDone) setTimeout(() => showLevelEnd(), 900);
      else say(`Caught ${info.name}. ${state.castsLeft} casts left.`);
    }

    function addPopup(text, life = 1.2) {
      state.popups.push({ x: 196, y: 120, text, life, max: life });
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
      state.power = 0;
      state.boss = null;
      state.shadows = [];
      say("Hold to charge a cast, release to throw.");
      paintHud();
    }

    function endLevel() {
      state.levelDone = true;
      showLevelEnd();
    }

    /* ---------- HTML cards ---------- */

    function clearCard() {
      if (hud.card) {
        hud.card.hidden = true;
        hud.card.innerHTML = "";
      }
    }

    function typeChips(types = []) {
      return types
        .slice(0, 2)
        .map(
          (type) =>
            `<li style="--chip:${typeAccent(type)}">${type}</li>`,
        )
        .join("");
    }

    let accentCache = new Map();
    function typeAccent(name) {
      if (accentCache.has(name)) return accentCache.get(name);
      const palette = {
        normal: "#8b8f90",
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
      const value = palette[name] ?? "#f15b22";
      accentCache.set(name, value);
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
            <img src="${pixelSpriteUrl(fish.id)}" alt="${name}" width="56" height="56" loading="lazy" crossorigin="anonymous" />
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
          <div class="is-total"><dt>Points</dt><dd>+${formatPoints(result.points + result.bonus)}</dd></div>
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

    function formatPoints(value) {
      return Math.round(value).toLocaleString("en-GB");
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

    function showLevelEnd() {
      const level = state.level;
      const stars = starsFor(level, state.score);
      const stored = progress.levels[level.id] || { best: 0, stars: 0 };
      progress.levels[level.id] = {
        best: Math.max(stored.best, state.score),
        stars: Math.max(stored.stars, stars),
      };
      /* The report can be reached from the result card and from the timer, so
         the payout only ever lands once. */
      const coins = state.goldPaid ? 0 : Math.floor(state.score * SCORE.coinsPerPoint);
      state.goldPaid = true;
      progress.coins += coins;
      saveProgress(progress);
      state.phase = "levelEnd";
      renderRail();
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
            <div><dt>Score</dt><dd>${formatPoints(state.score)}</dd></div>
            <div><dt>Best</dt><dd>${formatPoints(progress.levels[level.id].best)}</dd></div>
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
        hud.card.querySelector("[data-action='next-level']")?.addEventListener("click", () => {
          const next = state.levelIndex + 1;
          if (next < LEVELS.length) startLevel(next);
        });
      }
      renderKit();
      if (hud.kit) hud.kit.hidden = false;
    }

    function buy(kind, id) {
      if (kind === "rod") {
        const rod = rodById(id);
        if (rod.id === progress.rod) return;
        if (progress.coins < rod.price) {
          sfx.miss();
          say(`${rod.name} costs ${rod.price} coins. Keep fishing.`);
          return;
        }
        progress.coins -= rod.price;
        progress.rod = rod.id;
      } else if (kind === "bait") {
        const bait = baitById(id);
        const price = bait.price;
        if (progress.coins < price) {
          sfx.miss();
          say(`${bait.name} costs ${price} coins. Keep fishing.`);
          return;
        }
        progress.coins -= price;
        progress.baitStock[bait.id] = (progress.baitStock[bait.id] ?? 0) + 5;
        progress.bait = bait.id;
      } else if (kind === "equip") {
        progress.bait = id;
      }
      saveProgress(progress);
      sfx.buy();
      paintHud();
      renderKit();
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

      hud.kit.querySelector("[data-buy='reset:all']")?.addEventListener("click", () => {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* nothing to clear */
        }
        Object.assign(progress, blankProgress());
        startLevel(0);
        renderKit();
      });
    }

    /* ---------- frame ---------- */

    function update(dt) {
      state.clock += dt;
      if (state.phase === "charging") {
        state.power += state.chargeDir * (dt / INSTANT);
        if (state.power >= 1) {
          state.power = 1;
          state.chargeDir = -1;
        } else if (state.power <= 0) {
          state.power = 0;
          state.chargeDir = 1;
        }
      }

      if (state.phase === "flight") {
        state.cast.t += dt / 0.62;
        if (state.cast.t >= 1) {
          state.cast.t = 1;
          land();
        }
      } else if (state.phase === "wait") {
        state.cast.left -= dt;
        for (const shadow of state.shadows) {
          shadow.phase += dt * shadow.speed;
          shadow.x = state.cast.target.x + Math.cos(shadow.phase) * (1.6 + shadow.r);
          shadow.y = state.cast.target.y + Math.sin(shadow.phase) * (1.2 + shadow.r * 0.6);
        }
        if (state.cast.left <= 0) startBite();
      } else if (state.phase === "bite") {
        state.cast.biteAt += dt;
        if (state.cast.biteAt * 1000 > state.fish.window) {
          state.streak = 0;
          failCast("It slipped off before you struck. The cast is spent.");
        }
      } else if (state.phase === "reel") {
        updateReel(dt);
      } else if (state.phase === "leap") {
        state.leapT += dt / 0.9;
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
        ripple.r += dt * 6;
      }
      state.ripples = state.ripples.filter((ripple) => ripple.life > 0);
      for (const particle of state.particles) {
        particle.life -= dt;
        particle.vz -= dt * 5;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.z = Math.max(0.1, particle.z + particle.vz * dt);
      }
      state.particles = state.particles.filter((particle) => particle.life > 0);
      for (const popup of state.popups) {
        popup.life -= dt;
        popup.y -= dt * 12;
      }
      state.popups = state.popups.filter((popup) => popup.life > 0);
      if (state.flash > 0) state.flash -= dt * 4;
      if (state.wipe > 0) state.wipe = Math.max(0, state.wipe - dt * 1.6);
    }

    function updateReel(dt) {
      const fish = state.fish;
      const rod = rodById(progress.rod);
      const bait = baitById(progress.bait);
      const band = rod.band;
      state.reelTime += dt;
      const inBand = state.tension >= band[0] && state.tension <= band[1];
      if (inBand) state.bandTime += dt;
      /* The tell is the whole minigame: a 300 ms flash, then the pull. */
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
        state.reelAccum += dt;
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
      state.perfectRatio = state.reelTime ? state.bandTime / state.reelTime : 0;
    }

    function drawAngler() {
      const pose = { z: 0, stance: 0.24, scale: 1.22 };
      if (state.phase === "charging") {
        pose.lean = -0.55;
        pose.armR = -1.05;
        pose.crouch = 0.1;
      } else if (state.phase === "flight") {
        pose.lean = 0.5;
        pose.armR = 1.1;
      } else if (state.phase === "reel") {
        pose.lean = 0.35;
        pose.armR = 0.5;
        pose.crouch = 0.18;
        pose.stance = 0.34;
      } else if (state.phase === "leap" || state.phase === "result") {
        pose.armR = -1.3;
        pose.lean = -0.2;
      }
      const hand = engine.figure(ANGLER.x, ANGLER.y, ANGLER.yaw, pose, ANGLER.palette);
      engine.flushShadows();
      return hand;
    }

    function drawRod(hand) {
      const tip = engine.project(hand[0] + 0.9, hand[1] - 0.5, hand[2] + 2.3);
      const grip = engine.project(hand[0], hand[1], hand[2]);
      const ink = engine.rgb(44, 36, 28);
      engine.line(grip.sx, grip.sy, tip.sx, tip.sy, ink, 1);
      return tip;
    }

    function bobberWorld() {
      if (state.phase === "flight" || state.phase === "charging") {
        const cast = state.cast;
        if (!cast) return null;
        const t = state.phase === "charging" ? 0 : cast.t;
        const from = cast.from;
        const to = cast.target;
        return {
          x: lerp(from.x, to.x, t),
          y: lerp(from.y, to.y, t),
          z: lerp(from.z, to.z, t) + Math.sin(Math.PI * t) * 2.4,
        };
      }
      if (state.phase === "wait" || state.phase === "bite" || state.phase === "reel") {
        const base = state.cast?.target ?? { x: 3, y: 0, z: 0.1 };
        const bob =
          state.phase === "bite"
            ? -0.35
            : Math.sin(state.clock * 3.2) * 0.06 + (state.phase === "reel" ? -0.2 : 0);
        return { x: base.x, y: base.y, z: 0.12 + bob };
      }
      return null;
    }

    function drawWaterMarks() {
      const t = state.clock;
      for (const ripple of state.ripples) {
        const p = engine.project(ripple.x, ripple.y, 0.02);
        engine.ring(p.sx, p.sy, ripple.r * ripple.life * 10, 0.42, engine.rgb(206, 224, 226), 2);
        engine.ring(p.sx, p.sy, ripple.r * ripple.life * 6, 0.42, engine.rgb(178, 200, 206), 2);
      }
      for (const particle of state.particles) {
        const p = engine.project(particle.x, particle.y, particle.z);
        engine.dot(p.sx, p.sy, engine.rgb(...particle.tone));
      }
      if (state.phase === "wait" || state.phase === "bite") {
        for (const shadow of state.shadows) {
          const p = engine.project(shadow.x, shadow.y, 0.02);
          const entry = loadSprite(shadow.id);
          const height = 14 + shadow.r * 16;
          if (entry.data) {
            engine.drawSprite(entry, p.sx, p.sy + 4, height, {
              tint: [8, 24, 28],
              alpha: 0.8,
              dither: 0.42,
            });
          }
        }
      }
      if (state.phase === "reel" && state.fish) {
        const p = engine.project(state.cast.target.x, state.cast.target.y, 0.02);
        const entry = loadSprite(state.fish.id);
        const tell = state.tell > 0;
        if (entry.data) {
          engine.drawSprite(entry, p.sx, p.sy + 6, 18, {
            tint: tell ? [250, 226, 190] : [10, 26, 30],
            alpha: tell ? 0.55 : 0.82,
            dither: tell ? 0.1 : 0.35,
          });
        }
      }
      if (state.phase === "leap" && state.fish) {
        const from = state.leapFrom;
        const to = state.leapTo;
        const t = clamp(state.leapT, 0, 1);
        const x = lerp(from.x, to.x, t);
        const y = lerp(from.y, to.y, t);
        const z = lerp(0.1, to.z, t) + Math.sin(Math.PI * t) * 3;
        const p = engine.project(x, y, z);
        const entry = loadSprite(state.fish.id);
        if (entry.data) {
          engine.drawSprite(entry, p.sx, p.sy, 26, {
            tint: state.fish.shiny ? [255, 232, 190] : null,
            alpha: state.fish.shiny ? 0.2 : 0,
          });
        }
      }
      if (state.boss && state.phase === "wait") {
        const p = engine.project(state.cast.target.x, state.cast.target.y, 0);
        engine.ring(p.sx, p.sy, 18 + Math.sin(t * 2) * 2, 0.4, engine.rgb(8, 18, 22), 3);
        engine.ring(p.sx, p.sy, 23 + Math.sin(t * 2) * 2, 0.4, engine.rgb(12, 24, 28), 3);
      }
    }

    function drawBobber(tip) {
      const bob = bobberWorld();
      if (!bob) return;
      const p = engine.project(bob.x, bob.y, bob.z);
      const tensionColor =
        state.phase === "reel"
          ? state.snapTimer > 0.2
            ? engine.rgb(240, 96, 72)
            : state.tension > 0.7
              ? engine.rgb(242, 201, 76)
              : engine.rgb(240, 244, 242)
          : engine.rgb(240, 244, 242);
      const jitter = state.tell > 0 && !engine.STILL ? (Math.random() > 0.5 ? 1 : -1) : 0;
      engine.line(tip.sx + jitter, tip.sy, p.sx, p.sy, tensionColor, 1);
      engine.dot(p.sx, p.sy, engine.rgb(244, 246, 244));
      engine.dot(p.sx, p.sy + 1, engine.rgb(212, 70, 48));
      engine.dot(p.sx + 1, p.sy, engine.rgb(212, 70, 48));
      engine.dot(p.sx, p.sy - 1, engine.rgb(244, 246, 244));
      if (state.phase === "bite") {
        engine.dot(p.sx - 1, p.sy - 9, engine.rgb(255, 226, 92));
        engine.dot(p.sx, p.sy - 9, engine.rgb(255, 226, 92));
        engine.dot(p.sx, p.sy - 8, engine.rgb(255, 226, 92));
        engine.dot(p.sx, p.sy - 6, engine.rgb(255, 226, 92));
        engine.dot(p.sx, p.sy - 5, engine.rgb(255, 226, 92));
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
      "-": ["000", "000", "111", "000", "000"],
      "!": ["010", "010", "010", "000", "010"],
      "C": ["111", "100", "100", "100", "111"],
      "A": ["111", "101", "111", "101", "101"],
      "S": ["111", "100", "111", "001", "111"],
      "T": ["111", "010", "010", "010", "010"],
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

    function drawGauges() {
      const ink = engine.rgb(12, 18, 20);
      if (state.phase === "charging") {
        const w = 150;
        const x = 20;
        const y = engine.H - 42;
        for (let i = 0; i < w; i += 1) {
          const value = i / w;
          const zoneColor =
            value < 0.4
              ? [86, 148, 140]
              : value < 0.75
                ? [72, 120, 168]
                : [92, 86, 150];
          engine.line(x + i, y, x + i, y + 9, engine.rgb(...zoneColor), 1);
        }
        const marker = x + Math.round(state.power * w);
        engine.line(marker, y - 3, marker, y + 12, engine.rgb(255, 240, 190), 2);
        drawText(`${Math.round(state.power * 100)}`, x, y - 10, engine.rgb(242, 232, 208));
      }
      if (state.phase === "reel") {
        const rod = rodById(progress.rod);
        const x = engine.W - 26;
        const top = 44;
        const height = 150;
        for (let i = 0; i < height; i += 1) {
          const value = 1 - i / height;
          const inBand = value >= rod.band[0] && value <= rod.band[1];
          engine.dot(x, top + i, inBand ? engine.rgb(242, 201, 76) : engine.rgb(40, 52, 56));
          engine.dot(x + 1, top + i, inBand ? engine.rgb(210, 168, 62) : engine.rgb(30, 40, 44));
        }
        const marker = top + Math.round((1 - state.tension) * height);
        engine.dot(x - 2, marker, engine.rgb(246, 246, 240));
        engine.dot(x - 1, marker, engine.rgb(246, 246, 240));
        engine.dot(x, marker, engine.rgb(246, 246, 240));
        engine.dot(x + 1, marker, engine.rgb(246, 246, 240));
        engine.dot(x + 2, marker, engine.rgb(246, 246, 240));
        drawText("T", x - 8, top - 8, engine.rgb(210, 220, 224));
        const progressWidth = 150;
        const px = 20;
        const py = engine.H - 38;
        for (let i = 0; i < progressWidth; i += 1) {
          const filled = i / progressWidth <= state.reelProgress;
          engine.line(px + i, py, px + i, py + 6, filled ? engine.rgb(242, 201, 76) : ink, 1);
        }
      }
    }

    function drawFrame() {
      engine.resetFrame();
      restoreTree();
      engine.animateWater(state.clock, engine.KIND_WATER, 1);
      if (!engine.STILL) {
        engine.drawTufts(state.clock);
        engine.drawLeaves(state.clock);
      }
      if (state.rain && !engine.STILL) {
        for (let i = 0; i < 40; i += 1) {
          const x = (i * 73 + state.clock * 90) % engine.W;
          const y = (i * 41 + state.clock * 190) % engine.H;
          engine.dot(x, y, engine.rgb(168, 190, 206));
          engine.dot(x, y + 2, engine.rgb(140, 166, 184));
        }
      }
      drawWaterMarks();
      const hand = drawAngler();
      const tip = drawRod(hand);
      drawBobber(tip);
      engine.applyShadows();
      engine.shadeEdges();
      if (state.wipe > 0) {
        /* A 4x4-Bayer dissolve, not a fade: whole pixels drop out in the
           pattern the bevelled edge already uses. */
        for (let iy = 0; iy < engine.H; iy += 1)
          for (let ix = 0; ix < engine.W; ix += 1) {
            const i = iy * engine.W + ix;
            if (engine.zb[i] < -1e8) continue;
            const threshold = ((ix & 3) + (iy & 3) * 4) / 16;
            if (threshold < state.wipe) engine.pix[i] = 0;
          }
      }
      drawGauges();
      for (const popup of state.popups) {
        drawText(popup.text, popup.x, popup.y, engine.rgb(246, 226, 150));
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

    function press() {
      audio();
      state.pointerDown = true;
      if (state.phase === "ready") beginCharge();
      else if (state.phase === "charging") {
        /* the release handler throws; a second press does nothing */
      } else if (state.phase === "wait") {
        failCast("Too early — the splash scared it off. Cast spent.");
        state.pointerDown = false;
      } else if (state.phase === "bite") strike();
      else if (state.phase === "reel") state.reeling = true;
      else if (state.phase === "result") {
        /* the card carries its own buttons */
      }
    }

    function release() {
      state.pointerDown = false;
      if (state.phase === "charging") releaseCharge();
      if (state.phase === "reel") state.reeling = false;
    }

    function onPointerDown(event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      canvas.focus({ preventScroll: true });
      try {
        canvas.setPointerCapture?.(event.pointerId);
      } catch {
        /* synthetic or already-released pointer: capture is a nicety */
      }
      press();
    }
    function onPointerUp(event) {
      try {
        canvas.releasePointerCapture?.(event.pointerId);
      } catch {
        /* not captured */
      }
      release();
    }
    function onKeyDown(event) {
      if (event.code === "Space" || event.key === " ") {
        event.preventDefault();
        if (!event.repeat) press();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        if (state.paused) resume();
        else pause();
      }
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        const next =
          state.levelIndex + (event.key === "ArrowDown" ? 1 : -1);
        if (next >= 0 && next < LEVELS.length && canUnlock(next, progress)) {
          startLevel(next);
        }
      }
    }
    function onKeyUp(event) {
      if (event.code === "Space" || event.key === " ") release();
    }
    function onBlur() {
      release();
    }

    const bound = {
      pointerdown: onPointerDown,
      pointerup: onPointerUp,
      pointercancel: onPointerUp,
      keydown: onKeyDown,
      keyup: onKeyUp,
      blur: onBlur,
    };
    /* Not passive: the charge gesture has to cancel the browser's own drag
       and selection behaviour on the canvas. */
    Object.entries(bound).forEach(([type, handler]) =>
      canvas.addEventListener(type, handler, { passive: false }),
    );

    function syncSize() {
      const width = Math.min(720, rootEl.clientWidth || 360);
      const scale = engine.fit(width, 3);
      canvas.dataset.scale = String(scale);
    }

    const resizeObserver = new ResizeObserver(syncSize);
    resizeObserver.observe(rootEl);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        state.visible = !!entry?.isIntersecting;
      },
      { threshold: 0.05 },
    );
    intersectionObserver.observe(canvas);

    function onVisibility() {
      if (document.hidden) pause();
      else resume();
    }
    document.addEventListener("visibilitychange", onVisibility);

    function pause() {
      state.paused = true;
      if (hud.status) say("Paused.");
    }

    function resume() {
      state.paused = false;
      state.lastFrame = 0;
      state.accumulator = 0;
      if (state.phase === "ready") say("Hold to charge a cast, release to throw.");
    }

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
    startLevel(0);
    options.onCaught?.(Object.keys(progress.caught).map(Number));
    renderKit();
    if (hud.kit) hud.kit.hidden = true;
    clearCard();
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
