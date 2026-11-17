/* Card faces drawn pixel by pixel on a 160x224 native canvas.
   Only the hand-authored bitmap fonts are used. Big pixels (2x2) for the
   sprite, name, HP and damage; everything else is 1x1. */

export const CARD_W = 160;
export const CARD_H = 224;

const INK = "#1a1a2e";
const CREAM = "#f6efd4";
const SHADOW = "#b9b09a";
const HP_RED = "#c8281e";
const GOLD = "#e8be46";
const TEXT = "#1a1a2e";
const TEXT_MUTED = "#463c46";

const parse = (o) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.split("|")]));

const F3 = parse({
  A: ".X.|X.X|XXX|X.X|X.X", B: "XX.|X.X|XX.|X.X|XX.", C: ".XX|X..|X..|X..|.XX", D: "XX.|X.X|X.X|X.X|XX.",
  E: "XXX|X..|XX.|X..|XXX", F: "XXX|X..|XX.|X..|X..", G: ".XX|X..|X.X|X.X|.XX", H: "X.X|X.X|XXX|X.X|X.X",
  I: "XXX|.X.|.X.|.X.|XXX", J: "..X|..X|..X|X.X|.X.", K: "X.X|X.X|XX.|X.X|X.X", L: "X..|X..|X..|X..|XXX",
  M: "X.X|XXX|XXX|X.X|X.X", N: "XX.|X.X|X.X|X.X|X.X", O: ".X.|X.X|X.X|X.X|.X.", P: "XX.|X.X|XX.|X..|X..",
  Q: ".X.|X.X|X.X|XX.|.XX", R: "XX.|X.X|XX.|X.X|X.X", S: ".XX|X..|.X.|..X|XX.", T: "XXX|.X.|.X.|.X.|.X.",
  U: "X.X|X.X|X.X|X.X|XXX", V: "X.X|X.X|X.X|X.X|.X.", W: "X.X|X.X|XXX|XXX|X.X", X: "X.X|X.X|.X.|X.X|X.X",
  Y: "X.X|X.X|.X.|.X.|.X.", Z: "XXX|..X|.X.|X..|XXX",
  0: "XXX|X.X|X.X|X.X|XXX", 1: ".X.|XX.|.X.|.X.|XXX", 2: "XX.|..X|.X.|X..|XXX", 3: "XX.|..X|.X.|..X|XX.",
  4: "X.X|X.X|XXX|..X|..X", 5: "XXX|X..|XX.|..X|XX.", 6: ".XX|X..|XXX|X.X|XXX", 7: "XXX|..X|.X.|.X.|.X.",
  8: "XXX|X.X|XXX|X.X|XXX", 9: "XXX|X.X|XXX|..X|XX.",
  ".": "...|...|...|...|.X.", ",": "...|...|...|.X.|X..", "/": "..X|..X|.X.|X..|X..", "-": "...|...|XXX|...|...",
  ":": "...|.X.|...|.X.|...", "'": ".X.|.X.|...|...|...", '"': "X.X|X.X|...|...|...", "+": "...|.X.|XXX|.X.|...",
  "×": "...|X.X|.X.|X.X|...", "!": ".X.|.X.|.X.|...|.X.", "?": "XX.|..X|.X.|...|.X.",
  "<": "..X|.X.|X..|.X.|..X", ">": "X..|.X.|..X|.X.|X..", "♀": ".X.|X.X|.X.|XXX|.X.", "♂": ".XX|..X|.X.|X.X|.X.",
  " ": "..|..|..|..|..",
});

const F5 = parse({
  A: ".XXX.|X...X|X...X|XXXXX|X...X|X...X|X...X", B: "XXXX.|X...X|X...X|XXXX.|X...X|X...X|XXXX.",
  C: ".XXX.|X...X|X....|X....|X....|X...X|.XXX.", D: "XXXX.|X...X|X...X|X...X|X...X|X...X|XXXX.",
  E: "XXXXX|X....|X....|XXXX.|X....|X....|XXXXX", F: "XXXXX|X....|X....|XXXX.|X....|X....|X....",
  G: ".XXX.|X...X|X....|X.XXX|X...X|X...X|.XXXX", H: "X...X|X...X|X...X|XXXXX|X...X|X...X|X...X",
  I: ".XXX.|..X..|..X..|..X..|..X..|..X..|.XXX.", J: "..XXX|...X.|...X.|...X.|...X.|X..X.|.XX..",
  K: "X...X|X..X.|X.X..|XX...|X.X..|X..X.|X...X", L: "X....|X....|X....|X....|X....|X....|XXXXX",
  M: "X...X|XX.XX|X.X.X|X.X.X|X...X|X...X|X...X", N: "X...X|XX..X|X.X.X|X..XX|X...X|X...X|X...X",
  O: ".XXX.|X...X|X...X|X...X|X...X|X...X|.XXX.", P: "XXXX.|X...X|X...X|XXXX.|X....|X....|X....",
  Q: ".XXX.|X...X|X...X|X...X|X.X.X|X..X.|.XX.X", R: "XXXX.|X...X|X...X|XXXX.|X.X..|X..X.|X...X",
  S: ".XXXX|X....|X....|.XXX.|....X|....X|XXXX.", T: "XXXXX|..X..|..X..|..X..|..X..|..X..|..X..",
  U: "X...X|X...X|X...X|X...X|X...X|X...X|.XXX.", V: "X...X|X...X|X...X|X...X|X...X|.X.X.|..X..",
  W: "X...X|X...X|X...X|X.X.X|X.X.X|XX.XX|X...X", X: "X...X|X...X|.X.X.|..X..|.X.X.|X...X|X...X",
  Y: "X...X|X...X|.X.X.|..X..|..X..|..X..|..X..", Z: "XXXXX|....X|...X.|..X..|.X...|X....|XXXXX",
  0: ".XXX.|X...X|X..XX|X.X.X|XX..X|X...X|.XXX.", 1: "..X..|.XX..|..X..|..X..|..X..|..X..|.XXX.",
  2: ".XXX.|X...X|....X|...X.|..X..|.X...|XXXXX", 3: "XXXXX|...X.|..X..|...X.|....X|X...X|.XXX.",
  4: "...X.|..XX.|.X.X.|X..X.|XXXXX|...X.|...X.", 5: "XXXXX|X....|XXXX.|....X|....X|X...X|.XXX.",
  6: "..XX.|.X...|X....|XXXX.|X...X|X...X|.XXX.", 7: "XXXXX|....X|...X.|..X..|.X...|.X...|.X...",
  8: ".XXX.|X...X|X...X|.XXX.|X...X|X...X|.XXX.", 9: ".XXX.|X...X|X...X|.XXXX|....X|...X.|.XX..",
  ".": ".....|.....|.....|.....|.....|.....|..X..", ",": ".....|.....|.....|.....|..X..|..X..|.X...",
  "-": ".....|.....|.....|XXXXX|.....|.....|.....", "'": "..X..|..X..|.....|.....|.....|.....|.....",
  "!": "..X..|..X..|..X..|..X..|..X..|.....|..X..", "?": ".XXX.|X...X|....X|...X.|..X..|.....|..X..",
  "/": "....X|....X|...X.|..X..|.X...|X....|X....", ":": ".....|..X..|..X..|.....|..X..|..X..|.....",
  "+": ".....|..X..|..X..|XXXXX|..X..|..X..|.....", "×": ".....|X...X|.X.X.|..X..|.X.X.|X...X|.....",
  "♀": ".XXX.|X...X|X...X|.XXX.|..X..|.XXX.|..X..", "♂": "..XXX|...XX|..X.X|.XXX.|X...X|X...X|.XXX.",
  " ": "...|...|...|...|...|...|...",
});

const upper = (s) =>
  String(s ?? "")
    .toUpperCase()
    .replace(/É/g, "E")
    .replace(/[^A-Z0-9 .,\/\-:'"!?+×<>♀♂]/g, "?");

function textWidth(s, font, sp = 1) {
  let w = 0;
  for (const ch of s) w += (font[ch] ?? font[" "])[0].length + sp;
  return Math.max(0, w - sp);
}

/* full art prints its text over the picture, so the ink palette is swapped for that pass */
let TEXT_MODE = null;
function ink(colour) {
  if (!TEXT_MODE) return colour;
  if (colour === TEXT) return TEXT_MODE.text;
  if (colour === TEXT_MUTED) return TEXT_MODE.muted;
  if (colour === SHADOW) return TEXT_MODE.shadow;
  if (colour === "#544854") return TEXT_MODE.effect;
  return colour;
}

function glyphs(ctx, text, font, x, y, color, sp, scale = 1, outline = false) {
  if (globalThis.__textLog) globalThis.__textLog.push({ text, x: Math.round(x), y: Math.round(y), color, scale });
  if (TEXT_MODE && TEXT_MODE.keyline && !outline) {
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      glyphs(ctx, text, font, x + ox, y + oy, TEXT_MODE.keyline, sp, scale, true);
    }
  }
  ctx.fillStyle = ink(color);
  let cx = Math.round(x);
  const cy = Math.round(y);
  for (const ch of text) {
    const g = font[ch] ?? font[" "];
    for (let r = 0; r < g.length; r += 1) {
      for (let c = 0; c < g[r].length; c += 1) {
        if (g[r][c] === "X") ctx.fillRect(cx + c * scale, cy + r * scale, scale, scale);
      }
    }
    cx += (g[0].length + sp) * scale;
  }
}

function drawText(ctx, x, y, s, font, color, sp = 1, align = "l", scale = 1) {
  const txt = upper(s);
  const w = textWidth(txt, font, sp) * scale;
  if (align === "r") x = x - w + 1;
  if (align === "c") x = x - (w >> 1);
  glyphs(ctx, txt, font, x, y, color, sp, scale);
}

function fitText(ctx, text, maxW, font, color, x, y, align = "l") {
  const raw = upper(text);
  let sp = 1;
  let out = raw;
  if (textWidth(out, font, sp) > maxW && font === F3) sp = 0;
  while (textWidth(out, font, sp) > maxW && out.length > 0) out = out.slice(0, -1);
  drawText(ctx, x, y, out, font, color, sp, align);
  return textWidth(out, font, sp);
}

/* ---------- bounds lint ---------- */

const ZONES = {
  headerA: [6, 20],
  headerB: [21, 36],
  window: [38, 147],
  info: [147, 154],
  move1: [154, 175],
  move2: [175, 196],
  footer: [196, 218],
};

let lint = null;
function record(zone, x, y, w, h) {
  if (!lint) return;
  const [z0, z1] = ZONES[zone] || ZONES.headerA;
  const box = { zone, x, y, w, h };
  if (x < 0 || y < 0 || x + w > CARD_W || y + h > CARD_H) box.error = "outside card";
  else if (y < z0 || y + h - 1 > z1) box.error = "outside zone";
  lint.boxes.push(box);
}

function lintDraw(zone, x, y, w, h, fn) {
  record(zone, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  fn();
}

export function lintReport(canvas) {
  return canvas.__lint || [];
}

/* ---------- colours ---------- */

const TYPE_BASE = {
  Fire: "#d9562b",
  Water: "#3f8fd9",
  Grass: "#4aa84a",
  Lightning: "#f2c230",
  Psychic: "#a65fc9",
  Fighting: "#b5703a",
  Colorless: "#b8b8b8",
};

const hex2rgb = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a, b, t) => {
  const A = hex2rgb(a);
  const B = hex2rgb(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
};

export function rampFor(type) {
  const base = TYPE_BASE[type] || TYPE_BASE.Colorless;
  return {
    base,
    outline: mix(mix(base, "#241a3c", 0.7), "#6a5aa0", 0.2),
    shade: mix(base, "#4b2e6a", 0.34),
    light: mix(base, "#f7e7c6", 0.4),
    highlight: mix(base, "#ffffff", 0.55),
  };
}

/* ---------- icons: 9x9 disc + 5x5 glyph ---------- */

const DISC9 = ["..OOOOO..", ".OLBBBBO.", "OLBBBBBBO", "OBBBBBBBO", "OBBBBBBBO", "OBBBBBBBO", "OBBBBBBDO", ".ODDDDDO.", "..OOOOO.."];
const GLYPH5 = {
  Fire: ["..W..", "..WW.", ".WWWW", "WWWWW", ".WWW."],
  Water: ["..W..", ".WWW.", "WWWWW", "WWWWW", ".WWW."],
  Grass: ["..WWW", ".WWWW", "WWWW.", ".WW..", "W...."],
  Lightning: ["...KK", "..KK.", ".KKKK", "..KK.", ".KK.."],
  Psychic: [".WWW.", "WWKWW", "WKKKW", "WWKWW", ".WWW."],
  Fighting: ["W.W.W", ".WWW.", "WWWWW", ".WWW.", "W.W.W"],
  Colorless: ["..W..", "WWWWW", ".WWW.", ".WWW.", "W...W"],
};

const iconCache = new Map();
function iconCanvas(type) {
  if (iconCache.has(type)) return iconCache.get(type);
  const ramp = rampFor(type);
  const pal = { O: ramp.outline, D: ramp.shade, B: ramp.base, L: ramp.light, W: "#ffffff", K: "#54380c" };
  const canvas = document.createElement("canvas");
  canvas.width = 9;
  canvas.height = 9;
  const ctx = canvas.getContext("2d");
  const rows = GLYPH5[type] || GLYPH5.Colorless;
  DISC9.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === "." || !pal[ch]) return;
      ctx.fillStyle = pal[ch];
      ctx.fillRect(x, y, 1, 1);
    });
  });
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === "." || !pal[ch]) return;
      ctx.fillStyle = pal[ch];
      ctx.fillRect(2 + x, 2 + y, 1, 1);
    });
  });
  /* 1px top-left highlight, 1px bottom-right shade */
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(2, 1, 1, 1);
  ctx.fillRect(1, 2, 1, 1);
  ctx.fillStyle = ramp.outline;
  ctx.fillRect(6, 7, 1, 1);
  ctx.fillRect(7, 6, 1, 1);
  iconCache.set(type, canvas);
  return canvas;
}

function drawIcon(ctx, type, x, y) {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(iconCanvas(type), Math.round(x), Math.round(y));
}

const RARITY5 = {
  common: [".XXX.", "XXXXX", "XXXXX", "XXXXX", ".XXX."],
  uncommon: ["..X..", ".XXX.", "XXXXX", ".XXX.", "..X.."],
  rare: ["..X..", "XXXXX", ".XXX.", ".X.X.", "X...X"],
  chroma: [".XXX.", "X...X", "..X..", "X...X", ".XXX."],
};
const RARITY_COLOUR = { common: "#78788c", uncommon: "#5c94dc", rare: GOLD, holo: GOLD, legend: GOLD, chroma: "#a86be8" };

function drawRarity(ctx, rarity, x, y) {
  const rows = RARITY5[rarity] || RARITY5.rare;
  ctx.fillStyle = RARITY_COLOUR[rarity] || RARITY_COLOUR.common;
  rows.forEach((row, ry) => {
    [...row].forEach((ch, rx) => {
      if (ch === "X") ctx.fillRect(x + rx, y + ry, 1, 1);
    });
  });
}

import { backgroundFor } from "./backgrounds.js";
import {
  themeFor, frameSpec, insideFrame, ringPixels, drawTypeIcon, drawRingSlot,
  mixRgb, rgb, typeRamp,
} from "./theme.js";

/* ---------- art window ---------- */

const ART = { x: 8, y: 39, w: 144, h: 107, inner: { x: 10, y: 41, w: 140, h: 102 } };
const ART_EX = ART;

export const LAYOUT = {
  headerA: 7,
  headerB: 22,
  window: { x: 8, y: 39, w: 144, h: 107 },
  interior: { x: 10, y: 41, w: 140, h: 102 },
  info: 148,
  move1: 155,
  move2: 176,
  divider: 194,
  footerIcons: 198,
  footerText: 201,
  fa: { x: 6, y: 6, w: 148, h: 212 },
};
const BUFFER = { w: 70, h: 51 };

function artBuffer(card, sprite) {
  const canvas = document.createElement("canvas");
  canvas.width = BUFFER.w;
  canvas.height = BUFFER.h;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const { w, h } = BUFFER;
  const ramp = rampFor(card.tcg);
  const sky = mix(ramp.light, "#ffffff", 0.45);
  const band = mix(ramp.light, ramp.base, 0.32);
  const ground = mix(ramp.base, ramp.outline, 0.3);
  const horizon = Math.round(h * 0.66);

  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizon, w, h - horizon);
  ctx.fillStyle = band;
  ctx.fillRect(0, horizon - 3, w, 3);
  ctx.fillStyle = mix(sky, "#ffffff", 0.6);
  ctx.fillRect(0, horizon - 4, w, 1);

  ctx.fillStyle = mix(ramp.light, "#ffffff", 0.8);
  if (card.tcg === "Water") {
    ctx.fillRect(9, 11, 18, 3);
    ctx.fillRect(14, 7, 9, 3);
    ctx.fillRect(w - 26, 19, 14, 3);
  } else if (card.tcg === "Fire") {
    ctx.fillStyle = mix(ramp.base, "#ffb347", 0.45);
    ctx.fillRect(11, horizon - 18, 5, 11);
    ctx.fillStyle = "#ffd98a";
    ctx.fillRect(13, horizon - 24, 3, 8);
    ctx.fillStyle = mix(ramp.outline, "#ff9a5a", 0.5);
    ctx.fillRect(w - 20, horizon - 12, 4, 8);
  } else if (card.tcg === "Grass") {
    ctx.fillStyle = ramp.outline;
    ctx.fillRect(9, horizon + 4, 2, 8);
    ctx.fillRect(5, horizon + 4, 5, 2);
    ctx.fillRect(w - 18, horizon + 6, 2, 7);
    ctx.fillRect(w - 22, horizon + 6, 5, 2);
  } else if (card.tcg === "Lightning") {
    ctx.fillRect(12, 9, 3, 9);
    ctx.fillRect(10, 15, 3, 4);
    ctx.fillRect(8, 18, 3, 9);
    ctx.fillRect(w - 20, 12, 2, 8);
  } else if (card.tcg === "Psychic") {
    for (let i = 0; i < 4; i += 1) {
      const sx = 10 + i * 15;
      const sy = 9 + (i % 2) * 8;
      ctx.fillRect(sx + 2, sy, 1, 6);
      ctx.fillRect(sx, sy + 2, 5, 1);
    }
  } else if (card.tcg === "Fighting") {
    ctx.fillStyle = mix(ramp.outline, "#000000", 0.15);
    for (let i = 0; i < 4; i += 1) {
      const sx = 7 + ((i * 19) % (w - 19));
      const sy = horizon + 4 + ((i * 9) % 14);
      ctx.fillRect(sx, sy, 8, 3);
    }
  } else {
    ctx.fillRect(10, 10, 18, 3);
    ctx.fillRect(15, 6, 10, 3);
    ctx.fillRect(w - 27, 22, 15, 3);
  }

  if (sprite) {
    const scale = sprite.width * 2 <= 66 && sprite.height * 2 <= 52 ? 2 : 1;
    const sw = sprite.width * scale;
    const sh = sprite.height * scale;
    const sx = Math.round(w / 2 - sw / 2);
    const sy = Math.max(2, Math.round(h - 4 - sh));
    ctx.fillStyle = "rgba(26,26,46,0.2)";
    ctx.fillRect(sx + 3, h - 4, Math.max(4, sw - 6), 1);
    ctx.drawImage(sprite, sx, sy, sw, sh);
  }
  return canvas;
}

const trimCache = new Map();
function trimSprite(sprite) {
  if (!sprite) return null;
  const key = sprite.src || sprite;
  if (trimCache.has(key)) return trimCache.get(key);
  const probe = document.createElement("canvas");
  probe.width = sprite.width;
  probe.height = sprite.height;
  const pctx = probe.getContext("2d");
  pctx.imageSmoothingEnabled = false;
  pctx.drawImage(sprite, 0, 0);
  let minX = sprite.width;
  let minY = sprite.height;
  let maxX = -1;
  let maxY = -1;
  try {
    const { data } = pctx.getImageData(0, 0, sprite.width, sprite.height);
    for (let y = 0; y < sprite.height; y += 1) {
      for (let x = 0; x < sprite.width; x += 1) {
        if (data[(y * sprite.width + x) * 4 + 3] > 16) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  } catch {
    trimCache.set(key, sprite);
    return sprite;
  }
  if (maxX < 0) {
    trimCache.set(key, sprite);
    return sprite;
  }
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  const octx = out.getContext("2d");
  octx.imageSmoothingEnabled = false;
  octx.drawImage(probe, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  trimCache.set(key, out);
  return out;
}

/* where the pokemon sits on the face, in card pixels; the 3D layer reuses this */
export function cardSpriteLayout(card, sprite) {
  const clean = trimSprite(sprite);
  if (!clean) return null;
  if (card.special === "full") {
    const k = fitScale(clean, 146, 110);
    const w = Math.round(clean.width * k);
    const h = Math.round(clean.height * k);
    const feet = 148;
    return { sprite: clean, k, w, h, x: Math.round(CARD_W / 2 - w / 2), y: feet - h, feet };
  }
  const inner = LAYOUT.interior;
  if (card.special === "ex") {
    /* EX printings break the window: the sprite runs past the ring and the frame */
    const k = fitScale(clean, 152, 112);
    const w = Math.round(clean.width * k);
    const h = Math.round(clean.height * k);
    const bottom = inner.y + inner.h + 6;
    return { sprite: clean, k, w, h, x: Math.round(CARD_W / 2 - w / 2), y: bottom - h, feet: bottom };
  }
  const k = fitScale(clean, 138, 102);
  const w = Math.round(clean.width * k);
  const h = Math.round(clean.height * k);
  const bottom = inner.y + inner.h - 2;
  return { sprite: clean, k, w, h, x: Math.round(CARD_W / 2 - w / 2), y: bottom - h, feet: bottom };
}

/* fill the box on the sprite's larger axis so every pokemon reads the same size */
/* integer only: 2x when the trimmed art fits the box, else 1x */
function fitScale(sprite, maxW, maxH) {
  /* fill the box on the larger axis: whole steps where they fit, quarter steps
     after that so mid-size sprites are not stuck at 1x */
  const raw = Math.min(maxW / sprite.width, maxH / sprite.height);
  return Math.max(1, Math.min(3, Math.floor(raw * 4) / 4));
}

/* largest whole-number scale that stays inside the box: no resampling mush */
function spriteScale(sprite, maxW, maxH) {
  let k = 1;
  while (sprite.width * (k + 1) <= maxW && sprite.height * (k + 1) <= maxH) k += 1;
  return k;
}

function drawSpriteAt(ctx, place) {
  const { sprite, k, x, y, w, h } = place;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, 0, 0, sprite.width, sprite.height, x, y, w, h);
  void k;
}

/* full art: the illustration covers the whole face and the text prints over it */
function drawFullArt(ctx, card, place, bakeSprite = true) {
  const ramp = rampFor(card.tcg);
  const skyHigh = mix(ramp.light, "#ffffff", 0.72);
  const skyMid = mix(ramp.light, "#ffffff", 0.4);
  const skyLow = mix(ramp.light, ramp.base, 0.3);
  const hillFar = mix(ramp.base, ramp.light, 0.55);
  const hillNear = mix(ramp.base, ramp.outline, 0.12);
  const ground = mix(ramp.base, ramp.outline, 0.34);
  const groundDeep = mix(ramp.outline, "#000000", 0.22);
  const horizon = 116;

  ctx.imageSmoothingEnabled = false;

  /* sky: three bands with a dithered seam so it reads as pixel art */
  const bands = [
    [0, 62, skyHigh],
    [62, 34, skyMid],
    [96, horizon - 96, skyLow],
  ];
  for (const [top, height, colour] of bands) {
    ctx.fillStyle = colour;
    ctx.fillRect(0, top, CARD_W, height);
  }

  /* low sun behind the pokemon, dithered edge so it stays pixel art */
  for (let r = 34; r > 0; r -= 2) {
    ctx.fillStyle = mix(skyLow, "#ffffff", 0.22 + (34 - r) / 90);
    const inner = r - 2;
    for (let yy = -r; yy <= r; yy += 1) {
      const half = Math.sqrt(Math.max(0, r * r - yy * yy));
      const halfIn = Math.max(0, inner * inner - yy * yy);
      const x0 = Math.round(CARD_W / 2 - half);
      const w = Math.round(half * 2);
      if (w <= 0) continue;
      ctx.fillRect(x0, 88 + yy, w, 1);
      if (halfIn > 0) {
        ctx.clearRect(0, 0, 0, 0);
      }
    }
  }

  /* two hill layers with stepped, dithered tops */
  const hill = (baseY, height, colour, offset) => {
    for (let xx = 0; xx < CARD_W; xx += 2) {
      const wave = Math.sin((xx + offset) / 26) * 10 + Math.sin((xx + offset) / 9) * 3;
      const top = Math.round(baseY - height - wave);
      ctx.fillStyle = colour;
      ctx.fillRect(xx, top, 2, horizon + 6 - top);
      ctx.fillStyle = mix(colour, "#ffffff", 0.22);
      ctx.fillRect(xx, top, 2, 2);
    }
  };
  hill(horizon, 6, hillFar, 18);
  hill(horizon + 2, 3, hillNear, 70);

  /* ground */
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizon + 4, CARD_W, CARD_H - horizon - 4);
  ctx.fillStyle = mix(ground, "#ffffff", 0.28);
  ctx.fillRect(0, horizon + 4, CARD_W, 1);
  ctx.fillStyle = groundDeep;
  ctx.fillRect(0, horizon + 22, CARD_W, 2);
  ctx.fillRect(0, CARD_H - 3, CARD_W, 3);
  /* a few deliberate tufts along the horizon, nothing scattered under the text */
  for (const [tx, blades, tone] of [[16, 3, 0.16], [42, 2, 0.1], [63, 4, 0.18], [96, 2, 0.12], [118, 3, 0.16], [143, 2, 0.1]]) {
    ctx.fillStyle = mix(ground, "#ffffff", tone);
    for (let b = 0; b < blades; b += 1) {
      const bx = tx + b * 3;
      const bh = 2 + (b % 2) * 2;
      ctx.fillRect(bx, horizon + 8 - bh, 1, bh);
      ctx.fillRect(bx + 1, horizon + 8 - bh + 1, 1, bh - 1);
    }
  }

  if (place) {
    ctx.fillStyle = "rgba(12, 10, 26, 0.26)";
    ctx.fillRect(Math.round(place.x + place.w * 0.18), place.feet - 2, Math.round(place.w * 0.64), 3);
    if (bakeSprite) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(place.sprite, 0, 0, place.sprite.width, place.sprite.height, place.x, place.y, place.w, place.h);
    }
  }

  /* ink scrim so the light text keeps its contrast over the illustration */
  const scrimTop = 112;
  for (let i = 0; i < CARD_H - scrimTop; i += 1) {
    const t = i / (CARD_H - scrimTop);
    ctx.fillStyle = `rgba(10, 8, 22, ${(0.26 * t ** 1.4).toFixed(3)})`;
    ctx.fillRect(0, scrimTop + i, CARD_W, 1);
  }
  for (let i = 0; i < 34; i += 1) {
    ctx.fillStyle = `rgba(10, 8, 22, ${(0.3 * (34 - i)) / 34})`;
    ctx.fillRect(0, i, CARD_W, 1);
  }
}

function artWindow(ctx, card, geo = ART) {
  const { x, y, w, h } = geo;
  const inner = geo.inner || { x: x + 2, y: y + 2, w: w - 4, h: h - 4 };
  // explicit border + bevel so every corner pixel is deliberate
  ctx.fillStyle = INK;
  for (let i = 0; i < w; i += 1) {
    ctx.fillRect(x + i, y, 1, 1);
    ctx.fillRect(x + i, y + h - 1, 1, 1);
  }
  for (let i = 0; i < h; i += 1) {
    ctx.fillRect(x, y + i, 1, 1);
    ctx.fillRect(x + w - 1, y + i, 1, 1);
  }
  const ramp = rampFor(card.tcg);
  const light = mix(ramp.light, "#ffffff", 0.62);
  const dark = mix(ramp.outline, "#000000", 0.22);
  /* inset: 2px shadow inside the top and left, 1px light lip bottom and right */
  ctx.fillStyle = dark;
  ctx.fillRect(x + 1, y + 1, w - 2, 2);
  ctx.fillRect(x + 1, y + 1, 2, h - 2);
  ctx.fillStyle = light;
  ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
  ctx.fillRect(x + w - 2, y + 1, 1, h - 2);

  const buffer = backgroundFor(card);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buffer, 0, 0, BUFFER.w, BUFFER.h, inner.x, inner.y, inner.w, inner.h);
}

/* ---------- the new face: dark panel, tech frame, grid layout ---------- */

const CORNERS = {
  tl: [0, 0, 1, 1],
  tr: [CARD_W - 1, 0, -1, 1],
  bl: [0, CARD_H - 1, 1, -1],
  br: [CARD_W - 1, CARD_H - 1, -1, -1],
};

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function damageText(move) {
  if (!move) return "-";
  const d = move.display ?? move.damage;
  if (d === null || d === undefined) return "-";
  if (typeof d === "object") return String(d.display ?? "-");
  return String(d);
}

function px(ctx, x, y, colour) {
  ctx.fillStyle = colour;
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

function bayerAt(x, y) {
  return (BAYER[y % 4][x % 4] + 0.5) / 16;
}

function drawPanel(ctx, t, spec) {
  ctx.fillStyle = rgb(t.panel);
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const a = rgb(t.panel), b = rgb(t.panel2);
  const block = { x0: 7, y0: LAYOUT.info - 1, x1: 152, y1: 212 };
  for (let y = 0; y < CARD_H; y += 1) {
    for (let x = 0; x < CARD_W; x += 1) {
      if (!insideFrame(x, y, 6, spec)) continue;
      const inBlock = x >= block.x0 && x <= block.x1 && y >= block.y0 && y <= block.y1;
      const on = inBlock ? bayerAt(x + 1, y) < 0.78 : bayerAt(x, y) < 0.82;
      ctx.fillStyle = inBlock ? (on ? b : a) : on ? a : b;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawWindow(ctx, card, t) {
  const { x, y, w, h } = LAYOUT.window;
  const inner = LAYOUT.interior;
  ctx.fillStyle = rgb(t.lineHi);
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
  ctx.fillStyle = rgb(t.lineLo);
  ctx.fillRect(x + 1, y + 1, w - 2, 1);
  ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
  ctx.fillRect(x + 1, y + 1, 1, h - 2);
  ctx.fillRect(x + w - 2, y + 1, 1, h - 2);
  const buffer = backgroundFor(card);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buffer, 0, 0, BUFFER.w, BUFFER.h, inner.x, inner.y, inner.w, inner.h);
}

function drawFaBands(ctx, t) {
  const band = rgb(t.panel);
  ctx.save();
  /* one even wash instead of bands, so the picture runs edge to edge with no seams */
  ctx.fillStyle = rgb([0, 0, 0]);
  ctx.globalAlpha = 0.42;
  ctx.fillRect(6, 6, 148, 212);
  ctx.restore();
}

/* the border changes shape by tier: standard carries the seeded tech frame,
   EX a double rail with heavy brackets, full art a thin rail with all four
   corners cut */
function drawBorder(ctx, card, t, spec) {
  if (t.tier === "ex") return drawFrameEx(ctx, card, t, spec);
  if (t.tier === "fa") return drawFrameFa(ctx, card, t, spec);
  return drawFrameKit(ctx, card, t, spec);
}

function drawFrameEx(ctx, card, t, spec) {
  const hiAt = (x, y) => rgb(t.frameInk(x, y));
  const lo = rgb(t.lineLo);
  const accent = (x, y) => rgb(t.rainbow ? t.rainbowAt(x, y) : t.accent);

  /* double gold rail, no gaps: the EX sheet reads as one sealed plate */
  ringPixels(2, spec, (x, y) => px(ctx, x, y, hiAt(x, y)));
  ringPixels(4, spec, (x, y) => px(ctx, x, y, lo));
  ringPixels(6, spec, (x, y) => {
    if ((x + y) % 2 !== 0) return;
    px(ctx, x, y, hiAt(x, y));
  });

  /* heavy brackets on every corner */
  const arm = spec.arm + 8;
  for (const name of ["tl", "tr", "bl", "br"]) {
    const [ox, oy, dx, dy] = CORNERS[name];
    for (let k = 0; k < arm; k += 1) {
      for (let th = 0; th < 3; th += 1) {
        px(ctx, ox + dx * k, oy + dy * th, hiAt(ox + dx * k, oy + dy * th));
        px(ctx, ox + dx * th, oy + dy * k, hiAt(ox + dx * th, oy + dy * k));
      }
    }
    /* gem: 3x3 accent block, ringed in the dark line */
    for (let gx = 5; gx <= 7; gx += 1) {
      for (let gy = 5; gy <= 7; gy += 1) {
        px(ctx, ox + dx * gx, oy + dy * gy, accent(ox + dx * gx, oy + dy * gy));
      }
    }
  }

  /* centre plaque bars, top and bottom */
  for (const y of [2, CARD_H - 3]) {
    for (let x = 52; x < 108; x += 1) px(ctx, x, y, hiAt(x, y));
    for (let x = 58; x < 102; x += 1) px(ctx, x, y === 2 ? 5 : CARD_H - 6, accent(x, y));
  }
  /* side ticks at the vertical mid-point */
  for (const y of [108, 112]) {
    for (let k = 0; k < 4; k += 1) {
      px(ctx, 2 + k, y, accent(2 + k, y));
      px(ctx, CARD_W - 3 - k, y, accent(CARD_W - 3 - k, y));
    }
  }
}

function drawFrameFa(ctx, card, t, spec) {
  const hiAt = (x, y) => rgb(t.frameInk(x, y));
  const accent = (x, y) => rgb(t.rainbow ? t.rainbowAt(x, y) : t.accent);

  /* one thin rail, every corner cut away */
  ringPixels(2, spec, (x, y) => px(ctx, x, y, hiAt(x, y)));

  const cut = 12;
  for (const [cx, cy, sx, sy] of [[2, 2, 1, 1], [CARD_W - 3, 2, -1, 1], [2, CARD_H - 3, 1, -1], [CARD_W - 3, CARD_H - 3, -1, -1]]) {
    for (let k = 0; k < cut; k += 1) ctx.clearRect(cx + sx * k, cy + sy * (cut - k), 1, 1);
  }
  for (const [cx, cy, sx, sy] of [[2, 2, 1, 1], [CARD_W - 3, 2, -1, 1], [2, CARD_H - 3, 1, -1], [CARD_W - 3, CARD_H - 3, -1, -1]]) {
    for (let k = 0; k < cut; k += 1) {
      const x = cx + sx * (k + 1);
      const y = cy + sy * (cut + 1 - k);
      if (x >= 0 && x < CARD_W && y >= 0 && y < CARD_H) px(ctx, x, y, hiAt(x, y));
    }
    for (let k = 0; k < 3; k += 1) px(ctx, cx + sx * (3 + k), cy + sy * (cut - k), accent(cx, cy));
  }

  /* inner corner brackets only, no continuous inner line */
  const arm = spec.arm + 2;
  for (const name of ["tl", "tr", "bl", "br"]) {
    const [ox, oy, dx, dy] = CORNERS[name];
    for (let k = 5; k < 5 + arm; k += 1) {
      px(ctx, ox + dx * k, oy + dy * 5, hiAt(ox + dx * k, oy + dy * 5));
      px(ctx, ox + dx * 5, oy + dy * k, hiAt(ox + dx * 5, oy + dy * k));
    }
  }

  /* dashes along the top and bottom rails */
  for (let x = 26; x < CARD_W - 26; x += 10) {
    for (let d = 0; d < 5; d += 1) {
      px(ctx, x + d, 1, accent(x + d, 1));
      px(ctx, x + d, CARD_H - 2, accent(x + d, CARD_H - 2));
    }
  }
}

function drawFrameKit(ctx, card, t, spec) {
  /* the standard sheet keeps the plain tech frame, but its lines are pulled
     toward the type colour so each species' card edge reads as its own */
  const hi = rgb(mixRgb(t.r[4], [255, 255, 255], 0.45));
  const hiAt = (x, y) => (t.premium ? rgb(t.frameInk(x, y)) : hi);
  const lo = rgb(t.lineLo);
  const accent = (x, y) => rgb(t.rainbow ? t.rainbowAt(x, y) : t.accent);
  const topG = spec.topGaps;
  const botG = spec.botGaps;
  const inList = (x, list) => list.some((g) => x >= g && x <= g + 2);

  ringPixels(3, spec, (x, y) => {
    if (y === 3 && inList(x, topG)) return;
    if (y === CARD_H - 4 && inList(x, botG)) return;
    let dx = x;
    if (x === 3 && y >= spec.jogL && y < spec.jogL + 5) dx = 4;
    if (x === CARD_W - 4 && y >= spec.jogR && y < spec.jogR + 5) dx = CARD_W - 5;
    px(ctx, dx, y, hiAt(dx, y));
  });
  for (const g of topG) {
    for (let k = 3; k <= 5; k += 1) {
      px(ctx, g - 1, k, hiAt(g - 1, k));
      px(ctx, g + 3, k, hiAt(g + 3, k));
    }
  }
  for (const g of botG) {
    for (let k = CARD_H - 6; k <= CARD_H - 4; k += 1) {
      px(ctx, g - 1, k, hiAt(g - 1, k));
      px(ctx, g + 3, k, hiAt(g + 3, k));
    }
  }

  ringPixels(5, spec, (x, y) => px(ctx, x, y, lo));
  if (t.tier === "ex" || t.tier === "fa" || card.rarity === "legend") ringPixels(1, spec, (x, y) => px(ctx, x, y, lo));

  /* brackets on the two square corners */
  const square = ["tl", "tr", "bl", "br"].filter((c) => !spec.corners.includes(c));
  for (const name of square) {
    const [ox, oy, dx, dy] = CORNERS[name];
    const th = spec.th;
    for (let k = 0; k < spec.arm; k += 1) {
      for (let t2 = 0; t2 < th; t2 += 1) {
        px(ctx, ox + dx * k, oy + dy * t2, hiAt(ox + dx * k, oy + dy * t2));
        px(ctx, ox + dx * t2, oy + dy * k, hiAt(ox + dx * t2, oy + dy * k));
      }
    }
    for (const [ax, ay] of [[3, 3], [4, 3], [3, 4], [4, 4]]) px(ctx, ox + dx * ax, oy + dy * ay, accent(ox + dx * ax, oy + dy * ay));
    if (t.premium) {
      for (let gx = 6; gx <= 8; gx += 1) {
        for (let gy = 6; gy <= 8; gy += 1) px(ctx, ox + dx * gx, oy + dy * gy, accent(ox + dx * gx, oy + dy * gy));
      }
    }
    if (spec.key === "fighting") {
      const k = Math.floor(spec.arm / 2);
      for (let a = 0; a < 2; a += 1) {
        for (let b = 0; b < 2; b += 1) {
          px(ctx, ox + dx * (k + b), oy + dy * (spec.th + a), accent(ox, oy));
          px(ctx, ox + dx * (spec.th + a), oy + dy * (k + b), accent(ox, oy));
        }
      }
    }
  }

  /* chamfered corners: an outer diagonal with two accent pixels */
  for (const name of spec.corners) {
    const [ox, oy, dx, dy] = CORNERS[name];
    for (let k = 0; k <= spec.cut + 1; k += 1) {
      const x = ox + dx * (k + 1);
      const y = oy + dy * (spec.cut + 3 - k);
      px(ctx, x, y, hiAt(x, y));
    }
    px(ctx, ox + dx * 2, oy + dy * (spec.cut + 1), accent(ox, oy));
    px(ctx, ox + dx * 3, oy + dy * spec.cut, accent(ox, oy));
  }

  /* one motif per type, drawn on the frame lines only */
  const key = spec.key;
  if (key === "fire") {
    for (let x = 48; x <= 111; x += 6) {
      px(ctx, x, 2, hiAt(x, 2));
      px(ctx, x + 1, 1, hiAt(x + 1, 1));
      px(ctx, x + 2, 2, hiAt(x + 2, 2));
    }
  } else if (key === "water") {
    for (let x = 44; x <= 115; x += 1) px(ctx, x, Math.floor(x / 3) % 2 === 0 ? 2 : 1, hiAt(x, 2));
  } else if (key === "grass") {
    for (const [list, y0, s] of [[topG, 3, -1], [botG, CARD_H - 4, 1]]) {
      for (const g of list) {
        px(ctx, g, y0 + s, accent(g, y0));
        px(ctx, g + 1, y0 + 2 * s, accent(g, y0));
        px(ctx, g + 2, y0 + 3 * s, accent(g, y0));
      }
    }
  } else if (key === "lightning") {
    for (let y = 100; y <= 107; y += 1) px(ctx, 2, y, hiAt(2, y));
    px(ctx, 1, 108, hiAt(1, 108));
    px(ctx, 1, 109, hiAt(1, 109));
    px(ctx, CARD_W - 3, 120, hiAt(CARD_W - 3, 120));
    px(ctx, CARD_W - 3, 121, hiAt(CARD_W - 3, 121));
  } else if (key === "psychic") {
    for (let x = 30; x <= 129; x += 4) {
      px(ctx, x, 4, accent(x, 4));
      px(ctx, x, CARD_H - 5, accent(x, CARD_H - 5));
    }
  }
}

function textCss(c) {
  return rgb(c);
}

function drawHeader(ctx, card, t, spec) {
  const rarityWord = { common: "COMMON", uncommon: "UNCOMMON", rare: "RARE", holo: "HOLO", legend: "LEGEND", chroma: "CHROMA" };
  const tier = tierWord(card, t);
  const stageWord = card.rarity === "legend" ? "LEGEND" : card.stage === 2 ? "STAGE 2" : card.stage === 1 ? "STAGE 1" : "BASIC";
  const stageText = `${stageWord} LV.${card.level}`;
  const hp = String(card.hp);
  const hpW = textWidth(hp, F5, 1) * 2;
  const hpLabelX = 148 - hpW - 9;

  if (tier !== "plate") {
    for (let i = 0; i < 4; i += 1) px(ctx, 10 + i, 13, textCss(t.lineHi));
  }

  let x = 16;
  if (tier === "plate") {
    ctx.fillStyle = rgb(t.gold);
    ctx.fillRect(10, 10, 12, 7);
    drawText(ctx, 12, 11, "EX", F3, rgb([40, 26, 6]));
    x = 24;
  } else if (tier) {
    const tw = textWidth(upper(tier), F3, 1);
    const sw = textWidth(upper(stageText), F3, 1);
    if (16 + tw + 7 + sw <= hpLabelX - 3) {
      drawText(ctx, 16, 11, tier, F3, textCss(t.lineHi));
      px(ctx, 16 + tw + 3, 13, rgb(t.lineLo));
      x = 16 + tw + 7;
    }
  }
  drawText(ctx, x, 11, stageText, F3, textCss(t.muted));

  drawText(ctx, 149, 8, hp, F5, rgb(t.shadowCol), 1, "r", 2);
  drawText(ctx, 148, 7, hp, F5, rgb(t.hpCol), 1, "r", 2);
  drawText(ctx, hpLabelX, 15, "HP", F3, textCss(t.text));
  void rarityWord;

  /* row B */
  const nameRaw = upper(card.name);
  let name = nameRaw;
  let sp = 1;
  if (textWidth(name, F5, sp) * 2 > 118) {
    sp = 0;
    while (textWidth(name, F5, 0) * 2 > 118 && name.length > 1) name = name.slice(0, -1);
  }
  drawText(ctx, 12, 24, name, F5, rgb(t.shadowCol), sp, "l", 2);
  drawText(ctx, 10, 22, name, F5, rgb(t.tier === "ex" ? t.gold : t.text), sp, "l", 2);
  drawTypeIcon(ctx, t.key, 140, 24);
}

function tierWord(card, t) {
  if (t.tier === "ex") return "plate";
  if (t.tier === "fa") return "FULL ART";
  return { common: "COMMON", uncommon: "UNCOMMON", rare: "RARE", holo: "HOLO", legend: "LEGEND", chroma: "CHROMA" }[card.rarity] || "";
}

function drawInfoLine(ctx, card, t) {
  const genus = upper(String(card.genus || "")).replace(/\s*POKEMON$/i, "").trim();
  const dex = `${String(card.id).padStart(3, "0")}/151`;
  const y = LAYOUT.info;
  if (t.tier === "ex") drawText(ctx, 10, y, "EX RULE: 2 PRIZES WHEN KO", F3, rgb(t.gold));
  else fitText(ctx, genus, 96, F3, textCss(t.muted), 10, y);
  drawText(ctx, 149, y, dex, F3, textCss(t.muted), 1, "r");
}

function drawMoves(ctx, card, t) {
  const slots = [112, 124, 136];
  const rows = [LAYOUT.move1, LAYOUT.move2];
  card.moves.slice(0, 2).forEach((move, i) => {
    const y0 = rows[i];
    const cost = (move.cost || []).slice(0, 3);
    for (let s2 = 0; s2 < 3; s2 += 1) {
      const sx = slots[s2];
      if (s2 < cost.length) drawTypeIcon(ctx, cost[s2], sx, y0);
      else drawRingSlot(ctx, sx, y0, t.lineLo);
    }
    const dmg = damageText(move);
    const dmgW = textWidth(dmg, F5, 1);
    drawText(ctx, 108, y0 + 2, dmg, F5, textCss(t.text), 1, "r");
    const nameW = 108 - dmgW - 4 - 10;
    let name = upper(move.name);
    let sp = 1;
    if (textWidth(name, F5, 1) > nameW) {
      sp = 0;
      while (textWidth(name, F5, 0) > nameW && name.length > 1) name = name.slice(0, -1);
    }
    drawText(ctx, 10, y0 + 2, name, F5, textCss(t.text), sp);
    if (move.effect) fitText(ctx, String(move.effect).slice(0, 34), 138, F3, textCss(t.muted), 10, y0 + 13);
  });

  if (!card.moves[1]) {
    const total = Math.round((card.height || 0) * 39.3701);
    const ft = Math.floor(total / 12);
    const inch = total % 12;
    const lb = Math.round((card.weight || 0) * 2.2046);
    drawText(ctx, 10, LAYOUT.move2 + 4, `HT ${ft}'${String(inch).padStart(2, "0")}"  WT ${lb} LB`, F3, textCss(t.text));
  }
}

function drawDivider(ctx, t) {
  const y = LAYOUT.divider;
  ctx.fillStyle = rgb(t.lineLo);
  ctx.fillRect(10, y, 140, 1);
  ctx.fillRect(10, y - 2, 1, 3);
  ctx.fillRect(149, y - 2, 1, 3);
}

function drawFooter(ctx, card, t) {
  const yText = LAYOUT.footerText;
  const yIcon = LAYOUT.footerIcons;
  const retreat = Math.min(3, card.retreat || 0);
  const groups = [];
  const wkText = textWidth("WK", F3, 1);
  const resText = textWidth("RES", F3, 1);
  const retText = textWidth("RET", F3, 1);
  const wk = { w: wkText + 3 + (card.weakness ? 11 + 3 + textWidth("X2", F3, 1) : textWidth("-", F3, 1)) };
  const res = { w: resText + 3 + (card.resistance ? 11 + 3 + textWidth("-30", F3, 1) : textWidth("-", F3, 1)) };
  const ret = { w: retText + 3 + (retreat ? retreat * 11 + (retreat - 1) * 1 : textWidth("-", F3, 1)) };
  groups.push(wk, res, ret);
  const total = groups.reduce((a, g) => a + g.w, 0);
  const gap = Math.max(6, Math.floor((140 - total) / 2));

  let x = 10;
  drawText(ctx, x, yText, "WK", F3, textCss(t.text));
  x += wkText + 3;
  if (card.weakness) {
    drawTypeIcon(ctx, keyOfType(card.weakness), x, yIcon);
    x += 11 + 3;
    drawText(ctx, x, yText, "X2", F3, textCss(t.muted));
  } else {
    drawText(ctx, x, yText, "-", F3, textCss(t.muted));
  }
  x = 10 + wk.w + gap;

  drawText(ctx, x, yText, "RES", F3, textCss(t.text));
  x += resText + 3;
  if (card.resistance) {
    drawTypeIcon(ctx, keyOfType(card.resistance), x, yIcon);
    x += 11 + 3;
    drawText(ctx, x, yText, "-30", F3, textCss(t.muted));
  } else {
    drawText(ctx, x, yText, "-", F3, textCss(t.muted));
  }
  x = 10 + wk.w + gap + res.w + gap;

  drawText(ctx, x, yText, "RET", F3, textCss(t.text));
  x += retText + 3;
  if (retreat) {
    for (let i = 0; i < retreat; i += 1) drawTypeIcon(ctx, "colorless", x + i * 12, yIcon);
  } else {
    drawText(ctx, x, yText, "-", F3, textCss(t.muted));
  }
}

function keyOfType(tcg) {
  return String(tcg || "colorless").toLowerCase().replace(/[^a-z]/g, "") || "colorless";
}

export function renderCard(card, sprite, options = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  lint = options.lint ? { boxes: [] } : null;
  TEXT_MODE = null;

  const t = themeFor(card);
  const spec = frameSpec(card);
  const place = sprite && !options.omitArt ? cardSpriteLayout(card, sprite) : null;
  const tier = t.tier;

  drawPanel(ctx, t, spec);

  if (!options.omitArt) {
    if (tier === "fa") {
      drawFullArt(ctx, card, card.special === "full" ? place : null, !options.omitSprite);
      drawFaBands(ctx, t);
      /* full art prints its text straight over the picture, so every glyph gets a dark keyline */
      TEXT_MODE = { keyline: "#0a0816" };
    } else {
      drawWindow(ctx, card, t);
      if (place) {
        if (place.feet) {
          ctx.fillStyle = "rgba(12,10,26,0.35)";
          ctx.fillRect(Math.round(place.x + place.w * 0.2), place.feet - 1, Math.round(place.w * 0.6), 2);
        }
        if (!options.omitSprite) drawSpriteAt(ctx, place);
      }
    }
  }

  drawBorder(ctx, card, t, spec);
  if (lint) {
    lintDraw("headerA", 10, 7, 138, 14, () => {});
    lintDraw("headerB", 10, 22, 138, 14, () => {});
    lintDraw("window", 8, 39, 144, 107, () => {});
    lintDraw("info", 10, 148, 139, 6, () => {});
    lintDraw("move1", 10, 155, 138, 19, () => {});
    lintDraw("move2", 10, 176, 138, 19, () => {});
    lintDraw("footer", 10, 198, 139, 10, () => {});
  }
  drawHeader(ctx, card, t, spec);
  drawInfoLine(ctx, card, t);
  drawMoves(ctx, card, t);
  drawDivider(ctx, t);
  drawFooter(ctx, card, t);

  if (lint) {
    const seen = new Map();
    for (const box of lint.boxes) {
      if (box.error) continue;
      const other = seen.get(box.zone);
      if (other && box.x < other.x + other.w && other.x < box.x + box.w && box.y < other.y + other.h && other.y < box.y + box.h) {
        const tiled = box.zone === "move1" || box.zone === "move2";
        if (!tiled) box.error = "overlap";
      }
      seen.set(box.zone, box);
    }
    canvas.__lint = lint.boxes;
    lint = null;
  }

  return canvas;
}

export function renderCardBack() {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const INK_DEEP = "#080c18";
  const SLATE = "#0e1526";
  const SLATE_2 = "#121b30";
  const HAIR = "#243252";
  const GOLD_HI = "#f2d894";
  const MUTED_BACK = "#7d90b8";

  const px = (x, y, colour) => {
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, 1, 1);
  };
  const rect = (x, y, w, h, colour) => {
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, w, h);
  };

  /* base + inner sheet */
  rect(0, 0, CARD_W, CARD_H, INK_DEEP);
  rect(2, 2, CARD_W - 4, CARD_H - 4, SLATE);
  rect(6, 6, CARD_W - 12, CARD_H - 12, SLATE_2);

  /* faint diagonal hatch, one tone, 16px apart */
  for (let d = -CARD_H; d < CARD_W + CARD_H; d += 16) {
    for (let y = 8; y < CARD_H - 8; y += 1) {
      const x = d + y;
      if (x >= 8 && x < CARD_W - 8) px(x, y, "#16203a");
    }
  }

  /* outer frame: gold hairline with corner chamfers and a gap mid-top / mid-bottom */
  const cut = 10;
  const guard = (x, y) => {
    const dx = Math.min(x - 2, CARD_W - 3 - x);
    const dy = Math.min(y - 2, CARD_H - 3 - y);
    return dx + dy < cut;
  };
  for (let x = 2; x < CARD_W - 2; x += 1) {
    for (const y of [2, CARD_H - 3]) {
      if (guard(x, y)) continue;
      if (Math.abs(x - (CARD_W >> 1)) < 10) continue;
      px(x, y, GOLD_HI);
    }
  }
  for (let y = 2; y < CARD_H - 2; y += 1) {
    for (const x of [2, CARD_W - 3]) {
      if (guard(x, y)) continue;
      px(x, y, GOLD_HI);
    }
  }
  /* the chamfer diagonals, plus a 1px accent at each end of the top gap */
  for (let k = 0; k < cut; k += 1) {
    px(2 + k, 2 + (cut - k), GOLD_HI);
    px(CARD_W - 3 - k, 2 + (cut - k), GOLD_HI);
    px(2 + k, CARD_H - 3 - (cut - k), GOLD_HI);
    px(CARD_W - 3 - k, CARD_H - 3 - (cut - k), GOLD_HI);
  }
  rect(CARD_W / 2 - 11, 1, 3, 1, GOLD_HI);
  rect(CARD_W / 2 + 8, 1, 3, 1, GOLD_HI);
  rect(CARD_W / 2 - 11, CARD_H - 2, 3, 1, GOLD_HI);
  rect(CARD_W / 2 + 8, CARD_H - 2, 3, 1, GOLD_HI);

  /* inner hairline: quiet slate, chamfers only */
  for (let x = 6; x < CARD_W - 6; x += 1) {
    for (const y of [6, CARD_H - 7]) {
      const edge = Math.min(x - 6, CARD_W - 7 - x);
      const ny = Math.abs(y - (y === 6 ? 6 : CARD_H - 7));
      if (edge + ny < 7) continue;
      px(x, y, HAIR);
    }
  }
  for (let y = 6; y < CARD_H - 6; y += 1) px(6, y, HAIR);
  for (let y = 6; y < CARD_H - 6; y += 1) px(CARD_W - 7, y, HAIR);

  /* corner brackets */
  const arm = 14;
  for (const [ox, oy, dx, dy] of [[2, 2, 1, 1], [CARD_W - 3, CARD_H - 3, -1, -1]]) {
    for (let k = cut + 3; k < cut + 3 + arm; k += 1) {
      px(ox + dx * k, oy + dy * 3, GOLD_HI);
      px(ox + dx * 3, oy + dy * k, GOLD_HI);
    }
  }

  /* emblem: a ball inside a progress ring, drawn on whole pixels */
  const cx = CARD_W / 2;
  const cy = 98;
  const r = 30;
  for (let y = -r; y <= r; y += 1) {
    for (let x = -r; x <= r; x += 1) {
      const d = Math.sqrt(x * x + y * y);
      if (d > r) continue;
      if (d > r - 1.4) {
        px(cx + x, cy + y, HAIR);
        continue;
      }
      if (Math.abs(y) < 2) px(cx + x, cy + y, INK_DEEP);
      else px(cx + x, cy + y, y < 0 ? "#cf3b2c" : "#efe7cf");
    }
  }
  /* ring ticks at the quarters, 3px long */
  for (const [ax, ay] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    for (let k = 0; k < 3; k += 1) {
      px(cx + ax * (r + 2 + k), cy + ay * (r + 2 + k), GOLD_HI);
    }
  }
  /* hub */
  for (let y = -8; y <= 8; y += 1) {
    for (let x = -8; x <= 8; x += 1) {
      const d = Math.sqrt(x * x + y * y);
      if (d > 8) continue;
      px(cx + x, cy + y, d > 5.2 ? INK_DEEP : "#efe7cf");
    }
  }
  for (let y = -3; y <= 3; y += 1) {
    for (let x = -3; x <= 3; x += 1) {
      if (x * x + y * y > 9) continue;
      px(cx + x, cy + y, "#cf3b2c");
    }
  }

  /* wordmark block */
  drawText(ctx, cx, 146, "KANTO 151", F5, "#f4f1e6", 1, "c", 2);
  rect(20, 166, 40, 1, HAIR);
  rect(100, 166, 40, 1, HAIR);
  rect(cx - 3, 165, 6, 1, GOLD_HI);
  drawText(ctx, cx, 173, "TRADE - PLAY - COLLECT", F3, MUTED_BACK, 1, "c");

  /* footer: serial-style rule instead of the old project note */
  drawText(ctx, 24, CARD_H - 20, "SERIES 01", F3, MUTED_BACK, 1, "l");
  drawText(ctx, CARD_W - 24, CARD_H - 20, "001 - 151", F3, MUTED_BACK, 1, "r");
  rect(24, CARD_H - 13, CARD_W - 48, 1, HAIR);
  return canvas;
}

/* The sprite on its own transparent layer, so it can float above the art
   window and shift with the tilt. Coordinates match the art buffer. */
export function renderSpriteLayer(card, sprite) {
  const canvas = document.createElement("canvas");
  canvas.width = ART.inner.w;
  canvas.height = ART.inner.h;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  if (!sprite) return canvas;
  const scale = sprite.width * 2 <= 66 && sprite.height * 2 <= 52 ? 2 : 1;
  const sw = sprite.width * scale;
  const sh = sprite.height * scale;
  const sx = Math.round((BUFFER.w / 2 - sw / 2) * 2);
  const sy = Math.max(2, Math.round(BUFFER.h - 4 - sh)) * 2;
  ctx.drawImage(sprite, sx, sy, sw * 2, sh * 2);
  return canvas;
}

/* Backdrop only, sized to the art window (used as a layer behind the frame). */
export function renderBackdropLayer(card) {
  const canvas = document.createElement("canvas");
  canvas.width = ART.inner.w;
  canvas.height = ART.inner.h;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const buffer = backgroundFor(card);
  ctx.drawImage(buffer, 0, 0, BUFFER.w, BUFFER.h, 0, 0, ART.inner.w, ART.inner.h);
  return canvas;
}

/* Dithered ellipse contact shadow, drawn once and reused. */
const shadowCache = new Map();
export function renderContactShadow(w = 132, h = 26) {
  const key = `${w}x${h}`;
  if (shadowCache.has(key)) return shadowCache.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  ctx.fillStyle = "#0d0b1e";
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const nx = (x - w / 2) / (w / 2);
      const ny = (y - h / 2) / (h / 2);
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      const t = (BAYER4[(y % 4) * 4 + (x % 4)] + 0.5) / 16;
      if (t < 0.75 * (1 - d * 0.85)) ctx.fillRect(x, y, 1, 1);
    }
  }
  shadowCache.set(key, canvas);
  return canvas;
}

export { F3, F5, drawText, textWidth, fitText, drawIcon, TYPE_BASE, ART };
