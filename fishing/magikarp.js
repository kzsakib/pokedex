/* Magikarp Cast: one calm pond, five casts, one action.

   Hold to fill the power meter, release to cast at the ripple patch, then
   strike when the float dips. Everything is drawn by the shared rasteriser in
   engine.js; the fish and the trainer are built from primitives, no sprites. */

import PixelEngine from "./engine.js";
import { isMuted } from "../src/audio.js";
import {
  pixelSpriteFallbackUrl,
  pixelSpriteRawUrl,
  pixelSpriteUrl,
} from "../src/api.js";

const MagikarpCast = (() => {
  const TAU = Math.PI * 2;
  const CASTS = 5;
  const STORAGE_KEY = "pixel-plays:magikarp-cast:best";

  /* island, in world units; the pier runs from the south bank into the pond */
  const ISLAND_R = 11.6;
  const GRASS_R = 8.8;
  const SAND_R = 7.15;
  const POND_R = 6.5;
  const PIER = { x0: -1.95, x1: -0.15, y0: 5.3, y1: 10.9 };
  const ANGLER = { x: -1.05, y: 5.6, yaw: -Math.PI / 2 };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const mix = (a, b, t) => [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  ];

  const PALETTE = {
    water: [62, 142, 138],
    waterDeep: [38, 104, 118],
    sand: [204, 212, 196],
    sandWet: [178, 192, 184],
    shore: [84, 126, 56],
    grass: [130, 172, 80],
    grassLight: [166, 192, 100],
    rock: [152, 158, 148],
    leaf: { deep: [34, 66, 48], mid: [62, 104, 58], silver: [104, 142, 76], bark: [150, 134, 106] },
  };

  /* The pond holds real registry fish: a common carp, three uncommon pond
     dwellers, and one very long serpent for a perfect cast and hook. */
  const SPECIES = {
    magikarp: { id: 129, name: "Magikarp", min: 42, max: 96 },
    poliwag: { id: 60, name: "Poliwag", min: 26, max: 54 },
    goldeen: { id: 118, name: "Goldeen", min: 34, max: 72 },
    psyduck: { id: 54, name: "Psyduck", min: 40, max: 78 },
    tentacool: { id: 72, name: "Tentacool", min: 44, max: 86 },
    gyarados: { id: 130, name: "Gyarados", min: 340, max: 520 },
  };
  const UNCOMMON = ["poliwag", "goldeen", "psyduck", "tentacool"];

  const CARP = [232, 96, 60];
  const CARP_DARK = [186, 66, 46];
  const CARP_LIGHT = [246, 140, 92];
  const CREAM = [246, 228, 184];
  const SERPENT = [58, 96, 190];
  const SERPENT_LIGHT = [102, 150, 226];
  const INK = [42, 46, 42];

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
      master.gain.value = 0.4;
      master.connect(audioCtx.destination);
      audioCtx.ppMaster = master;
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
    osc.connect(gain).connect(ctx.ppMaster);
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
    source.connect(filter).connect(gain).connect(ctx.ppMaster);
    source.start(start);
    source.stop(start + length);
  }

  const sfx = {
    whoosh: () => {
      noise({ length: 0.16, from: 3200, to: 700, level: 0.05 });
      tone({ from: 620, to: 240, type: "triangle", length: 0.13, level: 0.025 });
    },
    plop: () => {
      noise({ length: 0.12, from: 1800, to: 400, level: 0.045 });
      tone({ from: 260, to: 110, type: "sine", length: 0.14, level: 0.035 });
    },
    tick: () => {
      tone({ from: 880, to: 880, type: "square", length: 0.05, level: 0.04 });
      tone({ from: 1240, to: 1240, type: "square", length: 0.06, level: 0.03, delay: 0.07 });
    },
    hook: () => tone({ from: 520, to: 980, type: "square", length: 0.09, level: 0.04 }),
    reel: () => tone({ from: 320, to: 360, type: "triangle", length: 0.03, level: 0.014 }),
    splash: () => {
      noise({ length: 0.24, from: 2600, to: 240, level: 0.09 });
      tone({ from: 220, to: 80, type: "sine", length: 0.2, level: 0.03 });
    },
    catch: () => {
      [523, 659, 784, 1046].forEach((f, i) =>
        tone({ from: f, to: f, type: "square", length: 0.1, level: 0.035, delay: i * 0.09 }),
      );
    },
    cheer: () => {
      [784, 988, 1175, 1568].forEach((f, i) =>
        tone({ from: f, to: f, type: "triangle", length: 0.18, level: 0.04, delay: i * 0.07 }),
      );
    },
    miss: () => tone({ from: 300, to: 150, type: "triangle", length: 0.18, level: 0.03 }),
  };

  /* ---------------- registry sprites ---------------- */

  const sprites = new Map();

  function loadSprite(id) {
    if (sprites.has(id)) return sprites.get(id);
    const entry = { id, img: null, data: null, w: 0, h: 0, status: "loading" };
    sprites.set(id, entry);
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

  function drawFishSprite(e, key, x, y, z, height, opts = {}) {
    const entry = loadSprite(SPECIES[key].id);
    const p = e.project(x, y, z);
    if (entry.status === "ready") {
      e.drawSprite(entry, p.sx, p.sy, height, opts);
    } else {
      drawCarp(e, x, y, z, 1.6, e.hash(x, y) * 6, { dark: true });
    }
    return entry;
  }

  /* ---------------- island art ---------------- */

  function buildIsland(e, onTree) {
    const p = PALETTE;
    e.field(-15, -15, 15, 15, 0.055, (x, y) => {
      const wob =
        e.noise(x * 0.26, y * 0.26) * 1.5 +
        e.noise(x * 0.62, y * 0.62) * 0.7 +
        e.noise(x * 1.3, y * 1.3) * 0.25;
      const r = Math.hypot(x, y) + wob - 1.15;
      if (r > ISLAND_R) return null;
      if (r > GRASS_R) {
        const shade = (e.hash(x * 3, y * 3) - 0.5) * 0.6;
        const patch = e.noise(x * 0.9 + 2.5, y * 0.9 - 1.5);
        const tone = Math.sin(x * 0.5 + y * 0.3) * 0.5 + Math.sin(y * 0.7 - x * 0.2) * 0.5;
        const base = mix(p.shore, p.grass, 0.55 + tone * 0.15 + patch * 0.2);
        return {
          z: 0.68,
          color: patch > 0.62 ? mix(base, p.grassLight, 0.4) : base,
          kind: e.KIND_GRASS,
          shade,
        };
      }
      if (r > SAND_R) {
        const shade = e.noise(x * 0.8, y * 0.8) * 0.35;
        return { z: 0.6, color: mix(p.sand, [248, 248, 240], 0.15 + shade * 0.4), kind: e.KIND_GROUND, shade };
      }
      if (r > POND_R) {
        return { z: 0.4, color: mix(p.sandWet, p.shore, 0.18), shade: -0.1 };
      }
      const deep = Math.hypot(x, y) / POND_R;
      return {
        z: 0,
        color: mix(p.water, p.waterDeep, 0.16 + deep * 0.5),
        kind: e.KIND_WATER,
        shade: 0.1,
      };
    });

    /* raised grassy lip around the shelf */
    for (let a = 0; a < TAU; a += 0.02) {
      const rr = ISLAND_R - 0.5;
      e.sphere(Math.cos(a) * rr, Math.sin(a) * rr, 0.56, 0.4, p.shore, "rough");
    }
    /* pale stones edging the sand, as in the reference */
    for (let i = 0; i < 12; i += 1) {
      const a = i * 0.53 + 0.7;
      const rr = POND_R + 0.55 + (i % 3) * 0.18;
      const r = 0.22 + (i % 2) * 0.06;
      e.sphere(Math.cos(a) * rr, Math.sin(a) * rr, 0.44, r, p.rock, "solid");
    }

    /* pier: planks, posts, a crate and a lantern */
    for (let i = 0; i < 15; i += 1) {
      const y = PIER.y1 - i * 0.42;
      e.box(PIER.x0, y - 0.34, 0.58, PIER.x1, y, 0.72, i % 2 ? [150, 108, 70] : [164, 120, 78], i);
    }
    [
      [PIER.x0 - 0.18, 4.8],
      [PIER.x1, 4.8],
      [PIER.x0 - 0.18, 10.7],
      [PIER.x1, 10.7],
    ].forEach(([x, y], i) => e.box(x, y, 0, x + 0.18, y + 0.7, 0.92, [106, 76, 52], i));
    e.box(0.24, 9.1, 0.72, 0.9, 9.75, 1.32, [140, 102, 64], 19);
    e.capsule([0.8, 10.6, 0.72], [0.8, 10.6, 2.28], 0.07, 0.045, () => [86, 70, 52], "solid");
    e.sphere(0.8, 10.6, 2.34, 0.18, [252, 214, 138], "gloss");

    const treeAt = (x, y, scale, seed) => {
      onTree?.(x, y, scale);
      e.growTree(x, y, scale, 240, seed, p.leaf);
      e.castShadow(x, y, 0, 0.55 * scale, 0.5, 0.3);
    };
    treeAt(-1.1, -7.7, 1.3, 7);
    treeAt(-7.2, 1.9, 1.05, 14);
    treeAt(6.9, 1.6, 1.12, 23);

    /* bushes, lily pads, reeds, stones */
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
    bushAt(-5.2, 6.9, 0.9, 1);
    bushAt(4.6, 6.6, 0.82, 2.4);
    bushAt(-9.0, -2.4, 0.8, 3.7);
    bushAt(8.8, -3.2, 0.78, 5.2);
    bushAt(0.4, 8.9, 0.66, 6.3);

    const pad = (x, y, r) => {
      const q = e.project(x, y, 0.03);
      for (let rr = r; rr > 1; rr -= 2) e.ring(q.sx, q.sy, rr, 0.6, e.rgb(92, 138, 76), 2);
      e.ring(q.sx - 1, q.sy - 1, Math.max(1, r - 4), 0.5, e.rgb(122, 166, 96), 2);
    };
    pad(-2.2, 2.7, 7);
    pad(-1.3, 3.4, 5);
    pad(2.5, 2.1, 6);
    pad(-2.9, -1.5, 5);

    for (let i = 0; i < 10; i += 1) {
      const a = i * 0.72 + 1.2;
      const rr = ISLAND_R - 1.6 - (i % 3) * 0.5;
      e.sphere(Math.cos(a) * rr, Math.sin(a) * rr, 0.66, 0.26 + (i % 3) * 0.06, p.rock, "solid");
    }
    for (let i = 0; i < 14; i += 1) {
      const a = i * 0.44 + 0.3;
      const rr = POND_R + 0.45 + (i % 4) * 0.22;
      const rx = Math.cos(a) * rr;
      const ry = Math.sin(a) * rr;
      const top = 1.3 + (i % 3) * 0.22;
      e.capsule([rx, ry, 0.5], [rx + 0.05, ry - 0.05, top], 0.05, 0.03, () => mix(p.shore, [96, 138, 74], 0.5), "solid");
      e.sphere(rx + 0.05, ry - 0.05, top, 0.09, mix(p.shore, [76, 108, 58], 0.6), "rough");
    }

    for (let a = 0; a < TAU; a += 0.06) {
      const rr = ISLAND_R - 0.6;
      e.castShadow(Math.cos(a) * rr, Math.sin(a) * rr, 0.6, 0.5, 0.5, 0.4);
    }
    e.castShadow(ANGLER.x, ANGLER.y, 0.7, 0.34, 1, 0.25);
  }

  /* ---------------- fish models ---------------- */

  function drawCarp(e, wx, wy, wz, length, wiggle, options = {}) {
    const k = length / 2.6;
    const dark = options.dark;
    const body = dark ? [26, 66, 70] : CARP;
    const light = dark ? [34, 82, 84] : CARP_LIGHT;
    const belly = dark ? [30, 74, 76] : CREAM;
    const flop = wiggle;
    const base = [wx, wy, wz];
    e.sphere(base[0], base[1], base[2] + 0.06 * k, 0.46 * k, body, "solid");
    e.sphere(base[0], base[1] + 0.02, base[2] + 0.2 * k, 0.34 * k, light, "solid");
    e.sphere(base[0] - 0.52 * k, base[1], base[2] + 0.05 * k, 0.3 * k, body, "solid");
    e.sphere(base[0] + 0.42 * k, base[1], base[2] + 0.02 * k, 0.22 * k, belly, "solid");
    /* dorsal crest and fan tail */
    e.capsule(
      [base[0] - 0.1 * k, base[1], base[2] + 0.36 * k],
      [base[0] + 0.45 * k, base[1], base[2] + 0.34 * k],
      0.16 * k,
      0.08 * k,
      () => (dark ? [30, 74, 76] : CARP_DARK),
      "solid",
    );
    const tailWave = Math.sin(flop) * 0.18 * k;
    e.capsule(
      [base[0] - 0.72 * k, base[1], base[2] + 0.06 * k],
      [base[0] - 1.08 * k, base[1] + tailWave, base[2] + 0.22 * k],
      0.18 * k,
      0.05 * k,
      () => (dark ? [26, 66, 70] : CARP_DARK),
      "solid",
    );
    e.capsule(
      [base[0] - 0.72 * k, base[1], base[2] + 0.06 * k],
      [base[0] - 1.02 * k, base[1] - tailWave, base[2] - 0.1 * k],
      0.16 * k,
      0.05 * k,
      () => (dark ? [26, 66, 70] : CARP_LIGHT),
      "solid",
    );
    if (!dark) {
      /* whiskers and eye read even at 360x280 */
      e.capsule(
        [base[0] + 0.5 * k, base[1] + 0.1 * k, base[2] + 0.04 * k],
        [base[0] + 0.82 * k, base[1] + 0.34 * k, base[2] + 0.26 * k],
        0.05 * k,
        0.02 * k,
        () => CREAM,
        "solid",
      );
      e.capsule(
        [base[0] + 0.5 * k, base[1] - 0.12 * k, base[2] + 0.04 * k],
        [base[0] + 0.8 * k, base[1] - 0.32 * k, base[2] + 0.2 * k],
        0.05 * k,
        0.02 * k,
        () => CREAM,
        "solid",
      );
      const eye = e.project(base[0] + 0.34 * k, base[1] - 0.2 * k, base[2] + 0.24 * k);
      e.dot(eye.sx, eye.sy, e.rgb(...INK));
      e.dot(eye.sx, eye.sy + 1, e.rgb(...INK));
    }
  }

  function drawSerpent(e, wx, wy, wz, length, t) {
    const k = length / 8;
    for (let i = 0; i < 7; i += 1) {
      const f = i / 6;
      const x = wx + Math.sin(t * 2 + f * 5) * 0.5 * k;
      const y = wy + (f - 0.5) * 0.6 * k;
      const z = wz + Math.sin(f * Math.PI) * 3.2 * k;
      e.sphere(x, y, z, (0.62 - f * 0.3) * k, SERPENT, "solid");
      if (i < 6) {
        const f2 = (i + 1) / 6;
        e.capsule(
          [x, y, z],
          [
            wx + Math.sin(t * 2 + f2 * 5) * 0.5 * k,
            wy + (f2 - 0.5) * 0.6 * k,
            wz + Math.sin(f2 * Math.PI) * 3.2 * k,
          ],
          (0.62 - f * 0.3) * k,
          (0.62 - f2 * 0.3) * k,
          () => SERPENT,
          "solid",
        );
      }
    }
    const head = e.project(wx, wy, wz + 3.2 * k);
    e.dot(head.sx - 3, head.sy, e.rgb(...CREAM));
    e.dot(head.sx + 3, head.sy, e.rgb(...CREAM));
  }

  /* ---------------- instance ---------------- */

  let mounted = null;

  function mount(rootEl) {
    if (!rootEl) return null;
    if (mounted && mounted.root === rootEl) {
      mounted.resume();
      return mounted.api;
    }

    const canvas = rootEl.querySelector(".mc-canvas");
    if (!canvas) return null;

    const engine = PixelEngine.createEngine(canvas, { originY: 12, scale: 13.5 });
    const q = (role) => rootEl.querySelector(`[data-mc="${role}"]`);
    const hud = {
      score: q("score"),
      best: q("best"),
      casts: q("casts"),
      status: q("status"),
      card: q("card"),
      mute: q("mute"),
    };

    const state = {
      phase: "ready",
      score: 0,
      round: 0,
      castsLeft: CASTS,
      pow: 0,
      charging: false,
      sweetD: 4.2,
      cast: null,
      powerRatio: 0,
      current: 0,
      waitLeft: 0,
      biteAt: 0,
      hooked: false,
      perfectHook: false,
      perfectCast: false,
      fish: null,
      reelT: 0,
      leapT: 0,
      result: null,
      best: 0,
      clock: 0,
      wipe: 1,
      ripples: [],
      particles: [],
      treeMasks: [],
      shadows: [],
      visible: true,
      paused: false,
      raf: 0,
      lastFrame: 0,
      accumulator: 0,
      pointerId: null,
    };

    try {
      state.best = Number(window.localStorage.getItem(STORAGE_KEY)) || 0;
    } catch {
      state.best = 0;
    }

    /* ---------- text ---------- */

    function say(text) {
      if (hud.status) hud.status.textContent = text;
    }

    function castLine(power) {
      return `hold, then release to cast${power > 0 ? ` · ${Math.round(power * 100)}%` : ""}`;
    }

    function currentLine() {
      if (state.current > 0.3) return "light current to the right";
      if (state.current < -0.3) return "light current to the left";
      return "still water";
    }

    function paintHud() {
      if (hud.score) hud.score.textContent = Math.round(state.score).toLocaleString("en-GB");
      if (hud.best) hud.best.textContent = Math.round(state.best).toLocaleString("en-GB");
      if (hud.casts) {
        const dots = [];
        for (let i = 0; i < CASTS; i += 1) {
          dots.push(`<i class="mc-pip${i < state.castsLeft ? " is-live" : ""}"></i>`);
        }
        hud.casts.innerHTML = dots.join("");
        hud.casts.setAttribute("aria-label", `${state.castsLeft} of ${CASTS} casts left`);
      }
    }

    function saveBest() {
      if (state.score <= state.best) return false;
      state.best = state.score;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(Math.round(state.best)));
      } catch {
        /* private mode */
      }
      return true;
    }

    /* ---------- scene ---------- */

    function captureTree(e, cx, cy, scale = 1) {
      const a = e.project(cx - 4.4 * scale, cy - 4.4 * scale, 0);
      const b = e.project(cx + 4.4 * scale, cy + 4.4 * scale, 7.2 * scale);
      const x0 = Math.max(0, Math.floor(Math.min(a.sx, b.sx)) - 6);
      const x1 = Math.min(e.W - 1, Math.ceil(Math.max(a.sx, b.sx)) + 6);
      const y0 = Math.max(0, Math.floor(Math.min(a.sy, b.sy)) - 6);
      const y1 = Math.min(e.H - 1, Math.ceil(Math.max(a.sy, b.sy)) + 6);
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

    function bakeScene() {
      engine.clear();
      state.treeMasks = [];
      buildIsland(engine, (x, y, scale) => {
        state.treeMasks.push(captureTree(engine, x, y, scale));
      });
      engine.applyShadows();
      engine.bakeOcclusion();
      engine.bake();
      engine.growGrass();
    }

    function restoreTrees() {
      for (const mask of state.treeMasks) {
        for (let y = 0; y < mask.h; y += 1)
          for (let x = 0; x < mask.w; x += 1) {
            const i = (mask.y0 + y) * engine.W + mask.x0 + x;
            engine.pix[i] = mask.pixels[y * mask.w + x];
            engine.zb[i] = mask.depth[y * mask.w + x];
          }
      }
    }

    /* ---------- round flow ---------- */

    function resetRound() {
      state.phase = "ready";
      state.score = 0;
      state.castsLeft = CASTS;
      state.round += 1;
      state.cast = null;
      state.fish = null;
      state.result = null;
      state.ripples = [];
      state.particles = [];
      state.shadows = [];
      state.pow = 0;
      state.charging = false;
      state.perfectCast = false;
      state.perfectHook = false;
      state.hooked = false;
      if (hud.card) {
        hud.card.hidden = true;
        hud.card.innerHTML = "";
      }
      paintHud();
      say(`Five casts. ${currentLine()} · hold, then release to cast`);
      rollCurrent();
      rollSweetSpot();
    }

    function rollCurrent() {
      const roll = Math.random();
      state.current = roll < 0.3 ? -rand(0.35, 0.8) : roll > 0.7 ? rand(0.35, 0.8) : 0;
    }

    function rollSweetSpot() {
      state.sweetD = rand(2.4, 6.6);
    }

    function startCharge() {
      state.phase = "charge";
      state.charging = true;
      state.pow = 0;
      audio();
    }

    function releaseCharge() {
      if (state.phase !== "charge") return;
      state.charging = false;
      const power = clamp(state.pow, 0.08, 1);
      const dist = 1.1 + power * 7.4;
      const target = {
        x: ANGLER.x + rand(-0.12, 0.12),
        y: clamp(ANGLER.y - dist, -POND_R + 0.7, POND_R - 0.7),
        z: 0.1,
      };
      state.powerRatio = power;
      state.perfectCast = Math.abs(dist - state.sweetD) <= 0.9;
      state.cast = {
        target,
        from: { x: ANGLER.x, y: ANGLER.y, z: 3.2 },
        t: 0,
        biteAt: 0,
      };
      state.phase = "cast";
      sfx.whoosh();
      say(state.perfectCast ? "dead centre on the ripple · wait for the dip" : `${power > 0.8 ? "long" : power < 0.35 ? "short" : "steady"} cast · wait for the dip`);
    }

    function land() {
      const cast = state.cast;
      state.phase = "wait";
      state.waitLeft = rand(1.5, 4);
      state.ripples.push({ x: cast.target.x, y: cast.target.y, r: 0.3, max: 2.6, life: 1 });
      spawnDrops(cast.target.x, cast.target.y, 14, 0.5);
      sfx.plop();
      const angle = rand(0, TAU);
      const radius = rand(1.4, 4.2);
      const swimmers = ["magikarp", ...UNCOMMON];
      state.shadows = [
        { species: swimmers[(Math.random() * swimmers.length) | 0], angle, radius, speed: rand(0.5, 0.9), wobble: rand(0, TAU) },
        { species: swimmers[(Math.random() * swimmers.length) | 0], angle: angle + Math.PI, radius: radius + rand(-0.5, 0.5), speed: rand(0.35, 0.7), wobble: rand(0, TAU) },
      ];
      say(`watch the float · ${currentLine()}`);
    }

    function startBite() {
      state.phase = "bite";
      state.biteAt = 0;
      sfx.tick();
      say("dip! strike now");
    }

    function missBite(reason) {
      state.phase = "recover";
      state.recover = 1.25;
      state.castsLeft = Math.max(0, state.castsLeft - 1);
      state.bobberGone = true;
      spawnDrops(state.cast?.target.x ?? 0, state.cast?.target.y ?? 0, 8, 0.4);
      sfx.miss();
      say(reason);
      paintHud();
    }

    function hook() {
      if (state.phase !== "bite") return;
      state.perfectHook = state.biteAt <= 0.25;
      state.perfectCast = state.perfectCast;
      state.hooked = true;
      state.phase = "reel";
      state.reelT = 0;
      state.sweetD = rand(2.4, 6.6);
      let key = "magikarp";
      if (state.perfectCast) key = UNCOMMON[(Math.random() * UNCOMMON.length) | 0];
      if (state.perfectCast && state.perfectHook && Math.random() < 0.25) key = "gyarados";
      const species = SPECIES[key];
      const size = rand(species.min, species.max);
      const bonus = key === "gyarados" ? 90 + Math.round(size / 12) : Math.round(size / 10) * (state.perfectHook ? 1.5 : 1) * (state.perfectCast ? 1.25 : 1);
      state.fish = {
        species: key,
        name: species.name,
        serpent: key === "gyarados",
        size,
        points: bonus,
      };
      loadSprite(species.id);
      sfx.hook();
      say(state.perfectHook ? "perfect hook · hold on" : "hooked · hold on");
    }

    function finishCatch() {
      const fish = state.fish;
      const points = Math.round(fish.points);
      state.score += points;
      state.castsLeft = Math.max(0, state.castsLeft - 1);
      state.phase = "result";
      state.result = { ...fish, points };
      sfx.catch();
      if (fish.serpent) sfx.cheer();
      renderCard();
      paintHud();
      say(
        fish.serpent
          ? `serpent splash · ${fish.name.toLowerCase()} ${Math.round(fish.size)} cm · +${points}`
          : `${state.perfectHook ? "perfect" : "clean"} hook · ${fish.name.toLowerCase()} ${Math.round(fish.size)} cm · +${points}`,
      );
    }

    function nextCast() {
      if (state.castsLeft <= 0) {
        resetRound();
        return;
      }
      if (hud.card) {
        hud.card.hidden = true;
        hud.card.innerHTML = "";
      }
      state.phase = "ready";
      state.cast = null;
      state.fish = null;
      state.result = null;
      state.shadows = [];
      state.hooked = false;
      state.pow = 0;
      state.perfectCast = false;
      state.perfectHook = false;
      rollCurrent();
      rollSweetSpot();
      paintHud();
      say(`${currentLine()} · hold, then release to cast`);
    }

    function renderCard() {
      if (!hud.card) return;
      const result = state.result;
      const over = state.castsLeft <= 0;
      const record = over && saveBest();
      hud.card.innerHTML = `
        <div class="mc-card__head">
          <p class="mc-card__eyebrow">${result.serpent ? "SERPENT SPLASH" : "CATCH RECORD"}</p>
          <p class="mc-card__size">${Math.round(result.size)} <span>cm</span></p>
        </div>
        <div class="mc-card__body">
          <img class="mc-card__art" alt="${result.name}" src="${pixelSpriteUrl(SPECIES[result.species].id)}" data-mc-art />
          <div>
            <p class="mc-card__name">${result.name}</p>
            <p class="mc-card__meta">${result.serpent ? "hooked in the deep" : "pond catch"} · ${state.perfectHook ? "perfect hook" : "clean hook"} · ${state.perfectCast ? "ripple cast" : "open cast"}</p>
            <p class="mc-card__points">+${Math.round(result.points)} points</p>
            ${over ? `<p class="mc-card__meta">round total ${Math.round(state.score)}${record ? " · new best" : ""}</p>` : ""}
          </div>
        </div>
        <button type="button" class="mc-card__next" data-mc-action="next">
          ${over ? "Cast again" : "Next cast"}
        </button>`;
      hud.card.hidden = false;

      /* the sprite CDN occasionally misses: walk the same fallback chain the
         rest of the site uses before giving up on the art */
      const art = hud.card.querySelector("[data-mc-art]");
      if (art) {
        const urls = [
          pixelSpriteUrl(SPECIES[result.species].id),
          pixelSpriteRawUrl(SPECIES[result.species].id),
          pixelSpriteFallbackUrl(SPECIES[result.species].id),
        ];
        let step = 0;
        art.addEventListener("error", () => {
          step += 1;
          if (step < urls.length) art.src = urls[step];
          else art.src = portrait(result.serpent);
        });
      }
    }

    /* ---------- portrait ---------- */

    const portraits = new Map();
    function portrait(serpent) {
      const key = serpent ? "serpent" : "carp";
      if (portraits.has(key)) return portraits.get(key);
      const scratch = document.createElement("canvas");
      const e = PixelEngine.createEngine(scratch, { originY: 4, scale: 30 });
      e.clear();
      if (serpent) drawSerpent(e, 0, 0, 0, 3.6, 0.6);
      else drawCarp(e, 0, 0, 0.3, 3.4, 0.4);
      e.present();

      /* crop the transparent margin so the card art is the fish, not a pond
         sized canvas with a speck in the middle */
      let url = "";
      try {
        const src = scratch.getContext("2d").getImageData(0, 0, e.W, e.H).data;
        let x0 = e.W;
        let y0 = e.H;
        let x1 = 0;
        let y1 = 0;
        for (let y = 0; y < e.H; y += 1)
          for (let x = 0; x < e.W; x += 1) {
            if (src[(y * e.W + x) * 4 + 3] < 8) continue;
            if (x < x0) x0 = x;
            if (y < y0) y0 = y;
            if (x > x1) x1 = x;
            if (y > y1) y1 = y;
          }
        if (x1 <= x0 || y1 <= y0) {
          url = scratch.toDataURL("image/png");
        } else {
          const pad = 6;
          const w = x1 - x0 + 1 + pad * 2;
          const h = y1 - y0 + 1 + pad * 2;
          const side = Math.max(w, h);
          const out = document.createElement("canvas");
          out.width = 96;
          out.height = 96;
          const octx = out.getContext("2d");
          octx.imageSmoothingEnabled = false;
          octx.drawImage(
            scratch,
            x0 - pad - (side - w) / 2,
            y0 - pad - (side - h) / 2,
            side,
            side,
            0,
            0,
            96,
            96,
          );
          url = out.toDataURL("image/png");
        }
      } catch {
        url = "";
      }
      portraits.set(key, url);
      return url;
    }

    /* ---------- ripple / droplets ---------- */

    function spawnDrops(x, y, count, spread) {
      if (engine.STILL) return;
      for (let i = 0; i < count; i += 1) {
        state.particles.push({
          x: x + rand(-spread, spread),
          y: y + rand(-spread, spread),
          z: 0.15,
          vz: rand(1.2, 3.2),
          vx: rand(-0.5, 0.5),
          vy: rand(-0.5, 0.5),
          life: rand(0.35, 0.8),
        });
      }
    }

    /* ---------- update ---------- */

    function update(dt) {
      state.clock += dt;
      if (state.wipe > 0) state.wipe = Math.max(0, state.wipe - dt * 2);

      if (state.phase === "charge") {
        state.pow = Math.min(1, state.pow + dt / 0.9);
      } else if (state.phase === "cast") {
        state.cast.t += dt / 0.55;
        if (state.cast.t >= 1) {
          state.cast.t = 1;
          land();
        }
      } else if (state.phase === "wait") {
        state.waitLeft -= dt;
        for (const shadow of state.shadows) shadow.angle += dt * shadow.speed * 0.5;
        if (state.cast) {
          state.cast.drift = (state.cast.drift || 0) + state.current * dt * 0.12;
          state.cast.drift = clamp(state.cast.drift, -0.6, 0.6);
        }
        if (state.waitLeft <= 0) startBite();
      } else if (state.phase === "bite") {
        state.biteAt += dt;
        if (state.biteAt > 0.6) missBite("too slow — it spat the hook. cast spent");
      } else if (state.phase === "reel") {
        state.reelT += dt;
        if (state.reelT > 1.05) {
          state.phase = "leap";
          state.leapT = 0;
        }
      } else if (state.phase === "leap") {
        state.leapT += dt / 0.75;
        if (state.leapT >= 1) finishCatch();
      } else if (state.phase === "recover") {
        state.recover -= dt;
        if (state.recover <= 0) nextCast();
      }

      for (const ripple of state.ripples) {
        ripple.life -= dt * 0.8;
        ripple.r += dt * 3.2;
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
    }

    /* ---------- drawing ---------- */

    function bobberWorld() {
      if (state.phase === "cast") {
        const t = state.cast.t;
        return {
          x: lerp(state.cast.from.x, state.cast.target.x, t),
          y: lerp(state.cast.from.y, state.cast.target.y, t),
          z: lerp(state.cast.from.z, 0.12, t) + Math.sin(Math.PI * t) * 2.1,
        };
      }
      if (state.phase === "wait" || state.phase === "bite" || state.phase === "reel") {
        const base = state.cast?.target ?? { x: 0, y: 0 };
        const drift = state.cast?.drift || 0;
        let z = 0.12 + Math.sin(state.clock * 3) * 0.05;
        if (state.phase === "bite") z = -0.28;
        if (state.phase === "reel") z = 0.1;
        return { x: base.x + drift, y: base.y, z };
      }
      return null;
    }

    function drawSweetSpot() {
      if (state.phase !== "ready" && state.phase !== "charge") return;
      const q = engine.project(0, ANGLER.y - state.sweetD, 0.02);
      const pulse = 0.5 + Math.sin(state.clock * 2.4) * 0.1;
      const ink = engine.rgb(48, 104, 104);
      const pale = engine.rgb(214, 240, 234);
      engine.ring(q.sx, q.sy, 10 + pulse * 2, 0.44, pale, 3);
      engine.ring(q.sx, q.sy, 7, 0.44, ink, 2);
      engine.ring(q.sx, q.sy, 3, 0.44, ink, 0);
    }

    function drawWaterMarks() {
      for (const ripple of state.ripples) {
        const p = engine.project(ripple.x, ripple.y, 0.03);
        engine.ring(p.sx, p.sy, ripple.r * ripple.life * 9, 0.42, engine.rgb(232, 248, 246), 2);
        engine.ring(p.sx, p.sy, ripple.r * ripple.life * 5.4, 0.42, engine.rgb(190, 220, 216), 2);
      }
      for (const particle of state.particles) {
        const p = engine.project(particle.x, particle.y, particle.z);
        engine.dot(p.sx, p.sy, engine.rgb(226, 246, 244));
      }
      if (
        state.phase === "wait" ||
        state.phase === "bite" ||
        state.phase === "reel"
      ) {
        for (const shadow of state.shadows) {
          const x = Math.cos(shadow.angle) * shadow.radius;
          const y = Math.sin(shadow.angle) * shadow.radius;
          const p = engine.project(x, y, 0.02);
          const wiggle = Math.sin(state.clock * 2 + shadow.wobble);
          const flip = Math.cos(shadow.angle) < 0;
          drawFishSprite(engine, shadow.species, x, y, 0.02, 20 + shadow.radius * 2, {
            tint: [22, 62, 68],
            alpha: 0.7,
            dither: 0.25,
            flip,
          });
          if (Math.sin(state.clock * 0.9 + shadow.wobble) > 0.995) {
            engine.ring(p.sx + wiggle, p.sy + 2, 5, 0.4, engine.rgb(214, 240, 236), 3);
          }
        }
      }
      if (state.phase === "reel" && state.fish) {
        const t = clamp(state.reelT / 1.05, 0, 1);
        const base = state.cast.target;
        const fishX = lerp(base.x, ANGLER.x, t * 0.85);
        const fishY = lerp(base.y, ANGLER.y - 1.2, t * 0.7);
        drawFishSprite(engine, state.fish.species, fishX, fishY, lerp(0.02, 0.16, t), state.fish.serpent ? 42 : 26, {
          tint: [22, 62, 68],
          alpha: 0.72,
          dither: 0.2,
        });
        for (let i = 0; i < 2; i += 1) {
          const p = engine.project(fishX, fishY, 0.02);
          engine.ring(p.sx, p.sy, 4 + i * 4 + ((state.clock * 8) % 6), 0.42, engine.rgb(220, 244, 240), 2);
        }
      }
      if (state.phase === "leap" && state.fish) {
        const t = clamp(state.leapT, 0, 1);
        const base = state.cast.target;
        const x = lerp(base.x, ANGLER.x - 1.4, t);
        const y = lerp(base.y, ANGLER.y - 1.6, t);
        const z = 0.1 + Math.sin(Math.PI * t) * 4.6;
        drawFishSprite(engine, state.fish.species, x, y, z, state.fish.serpent ? 62 : 34, {
          flip: t > 0.6,
        });
      }
    }

    function drawAngler() {
      const pose = { z: 0.7, stance: 0.22, scale: 1.26 };
      if (state.phase === "charge") {
        pose.armR = 0.4 + state.pow * 1.5;
        pose.lean = 0.16 + state.pow * 0.2;
      } else if (state.phase === "cast") {
        pose.armR = 1.7;
        pose.lean = 0.42;
      } else if (state.phase === "reel") {
        pose.armR = 0.65;
        pose.lean = 0.26;
        pose.crouch = 0.12;
      } else if (state.phase === "leap" || state.phase === "result") {
        pose.armR = -1.2;
        pose.lean = -0.14;
      } else {
        pose.armR = 0.55;
        pose.lean = 0.1;
      }
      const hand = engine.figure(ANGLER.x, ANGLER.y, ANGLER.yaw, pose, {
        shirt: [232, 224, 202],
        stripe: [196, 98, 58],
        legs: [62, 74, 86],
        skin: [226, 182, 142],
        hair: [72, 52, 38],
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

    function drawBobber(tip) {
      const bob = bobberWorld();
      if (!bob) return;
      const p = engine.project(bob.x, bob.y, bob.z);
      const lineColor = engine.rgb(58, 62, 58);
      engine.line(tip.sx, tip.sy, p.sx, p.sy, lineColor, 1);
      engine.dot(p.sx, p.sy, engine.rgb(250, 250, 244));
      engine.dot(p.sx, p.sy + 1, engine.rgb(214, 74, 48));
      engine.dot(p.sx + 1, p.sy, engine.rgb(214, 74, 48));
      if (state.phase === "bite") {
        const ink = engine.rgb(36, 40, 38);
        const bobY = p.sy - 12 + Math.round(Math.sin(state.clock * 14) * 2);
        engine.dot(p.sx, bobY, ink);
        engine.dot(p.sx, bobY + 1, ink);
        engine.dot(p.sx, bobY + 2, ink);
        engine.dot(p.sx - 3, bobY + 3, ink);
        engine.dot(p.sx + 3, bobY + 3, ink);
        engine.dot(p.sx - 2, bobY + 4, ink);
        engine.dot(p.sx + 2, bobY + 4, ink);
      }
    }

    function drawPowerBar() {
      if (state.phase !== "charge") return;
      const width = 118;
      const x0 = Math.round((engine.W - width) / 2);
      const y = engine.H - 30;
      const sweet = clamp((state.sweetD - 1.1) / 7.4, 0, 1);
      for (let i = 0; i < width; i += 1) {
        const value = i / width;
        const inZone = Math.abs(value - sweet) < 0.11;
        engine.dot(x0 + i, y, engine.rgb(...(inZone ? [176, 138, 40] : [210, 214, 206])));
        engine.dot(x0 + i, y + 1, engine.rgb(...(inZone ? [204, 164, 62] : [226, 230, 222])));
        engine.dot(x0 + i, y + 2, engine.rgb(38, 44, 40));
      }
      const mark = x0 + Math.round(state.pow * width);
      engine.line(mark, y - 4, mark, y + 6, engine.rgb(38, 44, 40), 1);
      engine.dot(mark - 1, y - 4, engine.rgb(38, 44, 40));
    }

    function drawFrame() {
      engine.resetFrame();
      restoreTrees();
      engine.animateWater(state.clock, engine.KIND_WATER, 0.9);
      engine.drawTufts(state.clock);
      engine.drawLeaves(state.clock);
      drawSweetSpot();
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
      drawPowerBar();
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
      if (state.phase === "ready") {
        startCharge();
        say(castLine(0));
      } else if (state.phase === "bite") {
        hook();
      } else if (state.phase === "result") {
        nextCast();
      } else if (state.phase === "wait") {
        missBite("too early — the splash scared it off. cast spent");
      }
    }

    function releasePress() {
      if (state.phase === "charge") releaseCharge();
    }

    function onPointerDown(event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      try {
        canvas.setPointerCapture?.(event.pointerId);
      } catch {
        /* synthetic pointer */
      }
      state.pointerId = event.pointerId;
      /* keep Space/Enter working after a click without leaving a focus ring */
      try {
        canvas.focus({ preventScroll: true });
      } catch {
        /* old browsers */
      }
      press();
    }

    function onPointerUp(event) {
      try {
        canvas.releasePointerCapture?.(event.pointerId);
      } catch {
        /* not captured */
      }
      state.pointerId = null;
      releasePress();
    }

    function onKeyDown(event) {
      if (event.code !== "Space" && event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      if (event.repeat) return;
      press();
    }

    function onKeyUp(event) {
      if (event.code !== "Space" && event.key !== "Enter" && event.key !== " ") return;
      releasePress();
    }

    const bound = {
      pointerdown: onPointerDown,
      pointerup: onPointerUp,
      pointercancel: onPointerUp,
      keydown: onKeyDown,
      keyup: onKeyUp,
      blur: () => releasePress(),
    };
    Object.entries(bound).forEach(([type, handler]) =>
      canvas.addEventListener(type, handler, { passive: type === "keydown" }),
    );

    function onCardClick(event) {
      const button = event.target.closest("[data-mc-action='next']");
      if (button) nextCast();
    }
    hud.card?.addEventListener("click", onCardClick);

    function onMute() {
      window.dispatchEvent(new CustomEvent("pokedex:sound-toggle"));
      if (hud.mute) {
        hud.mute.setAttribute("aria-pressed", String(isMuted()));
        hud.mute.textContent = isMuted() ? "Sound off" : "Sound on";
      }
    }
    hud.mute?.addEventListener("click", onMute);

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

    /* headless helper: advance the simulation without drawing, for tests */
    function step(seconds) {
      let left = Math.max(0, seconds);
      while (left > 0) {
        update(1 / 60);
        left -= 1 / 60;
      }
    }

    const api = { pause, resume, step };

    syncSize();
    Object.values(SPECIES).forEach((species) => loadSprite(species.id));
    bakeScene();
    resetRound();
    paintHud();
    if (hud.mute) {
      hud.mute.setAttribute("aria-pressed", String(isMuted()));
      hud.mute.textContent = isMuted() ? "Sound off" : "Sound on";
    }
    state.lastFrame = performance.now();
    state.raf = requestAnimationFrame(frame);

    mounted = {
      root: rootEl,
      api,
      resume,
      pause,
      state,
      press,
      releasePress,
      step,
      destroy() {
        cancelAnimationFrame(state.raf);
        resizeObserver.disconnect();
        intersectionObserver.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
        Object.entries(bound).forEach(([type, handler]) => canvas.removeEventListener(type, handler));
        hud.card?.removeEventListener("click", onCardClick);
        hud.mute?.removeEventListener("click", onMute);
        mounted = null;
      },
    };
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
    get state() {
      return mounted?.state ?? null;
    },
    press() {
      mounted?.press();
    },
    releasePress() {
      mounted?.releasePress();
    },
    step(seconds) {
      mounted?.step(seconds);
    },
  };
})();

window.MagikarpCast = MagikarpCast;

export default MagikarpCast;
