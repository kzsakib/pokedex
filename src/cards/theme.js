/* Card theme: type colours, dark panel tokens, 11x11 type icons and the seeded
   tech frame kit. Everything here is deterministic per species. */

export const TYPE_COL = {
  fire: [240, 128, 48],
  water: [104, 144, 240],
  grass: [120, 200, 80],
  lightning: [248, 208, 48],
  psychic: [248, 88, 136],
  fighting: [192, 48, 40],
  colorless: [168, 168, 120],
};

export const TYPE_INDEX = { fire: 0, water: 1, grass: 2, lightning: 3, psychic: 4, fighting: 5, colorless: 6 };
export const GOLD = [232, 190, 70];
const RAINBOW = [
  [255, 92, 122], [255, 196, 64], [132, 236, 120],
  [96, 208, 255], [150, 130, 255], [255, 160, 96],
];

export const keyOf = (tcg) => String(tcg || "colorless").toLowerCase().replace(/[^a-z]/g, "") || "colorless";

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const rgbToHsv = (c) => {
  const r = c[0] / 255;
  const g = c[1] / 255;
  const b = c[2] / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [((h * 60) + 360) % 360, max ? d / max : 0, max];
};
const hsvToRgb = (h, s, v) => {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const seg = Math.floor(h / 60) % 6;
  const tab = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][seg];
  return tab.map((n) => Math.round(clamp01(n + m) * 255));
};

export const mixRgb = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
export const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

/* dark panel ramp: index 0 darkest ... 4 lightest, from a type colour */
export function typeRamp(key) {
  const base = TYPE_COL[key] || TYPE_COL.colorless;
  const [h, s, v] = rgbToHsv(base);
  return [
    hsvToRgb(h, Math.min(1, s * 0.9), v * 0.22),
    hsvToRgb(h, Math.min(1, s * 0.95), v * 0.3),
    hsvToRgb(h, Math.min(1, s), v * 0.45),
    hsvToRgb(h, Math.min(1, s * 0.8), v * 0.72),
    hsvToRgb(h, Math.min(0.8, s * 0.55), Math.min(1, v * 0.98)),
  ];
}

export function themeFor(card) {
  const key = keyOf(card.tcg);
  const r = typeRamp(key);
  const tier = card.special === "ex" ? "ex" : card.special === "full" ? "fa" : "std";
  const premium = tier !== "std" || ["rare", "holo", "legend"].includes(card.rarity);
  const goldHi = mixRgb(GOLD, [255, 255, 255], 0.25);
  const goldLo = mixRgb(GOLD, [70, 46, 10], 0.3);
  const lineHi = premium ? goldHi : mixRgb(r[4], [255, 255, 255], 0.35);
  const lineLo = premium ? goldLo : r[2];
  const panel = mixRgb(r[0], [8, 10, 16], 0.55);
  const panel2 = mixRgb(r[0], [8, 10, 16], 0.35);
  const [ah, as, av] = rgbToHsv(TYPE_COL[key] || TYPE_COL.colorless);
  const accent = hsvToRgb((ah + 150) % 360, Math.min(1, as * 1.1 + 0.15), Math.max(0.85, av));
  const rainbow = card.rarity === "holo" || tier === "fa";
  return {
    key,
    type: TYPE_COL[key] || TYPE_COL.colorless,
    r,
    tier,
    premium,
    rainbow,
    lineHi,
    lineLo,
    panel,
    panel2,
    accent,
    text: mixRgb(lineHi, [255, 255, 255], 0.75),
    muted: tier === "fa" ? mixRgb(lineHi, [236, 234, 246], 0.42) : mixRgb(lineHi, panel, 0.45),
    hpCol: [255, 100, 96],
    shadowCol: mixRgb(panel, [0, 0, 0], 0.5),
    gold: GOLD,
    rainbowAt(x, y) {
      return RAINBOW[Math.floor((x + y) / 3) % 6];
    },
  };
}

/* ---------------- 11x11 type icons ---------------- */

const DISC11 = [
  "...#####...", "..#######..", ".#########.", "###########", "###########",
  "###########", "###########", "###########", ".#########.", "..#######..", "...#####...",
];
export const RING11 = [
  "...#####...", "..#.....#..", ".#.......#.", "#.........#", "#.........#",
  "#.........#", "#.........#", "#.........#", ".#.......#.", "..#.....#..", "...#####...",
];
const GLYPH7 = {
  normal: ["..XXX..", ".X...X.", "X.....X", "X..X..X", "X.....X", ".X...X.", "..XXX.."],
  fire: ["...X...", "..XX...", "..XXX..", ".XXXXX.", "XXXXXXX", "XXX.XXX", ".XXXXX."],
  water: ["...X...", "...X...", "..XXX..", ".XXXXX.", "XXXXXXX", "XXXXXXX", ".XXXXX."],
  electric: ["...XXXX", "..XXX..", ".XXX...", "XXXXXX.", "...XX..", "..XX...", ".X....."],
  grass: ["XX...XX", "XXX.XXX", ".XXXXX.", "..XXX..", "...X...", "...X...", "..XXX.."],
  fighting: [".X.X.X.", "XXXXXXX", "XXXXXXX", "XXXXXXX", ".XXXXX.", ".XXXXX.", "..XXX.."],
  psychic: [".......", ".XXXXX.", "XX...XX", "X..X..X", "XX...XX", ".XXXXX.", "......."],
};
const GLYPH_TYPE = {
  fire: "fire", water: "water", grass: "grass", lightning: "electric",
  psychic: "psychic", fighting: "fighting", colorless: "normal",
};

const iconCache = new Map();

export function typeIcon(key) {
  const k = TYPE_COL[key] ? key : "colorless";
  if (iconCache.has(k)) return iconCache.get(k);
  const c = TYPE_COL[k];
  const r = typeRamp(k);
  const canvas = document.createElement("canvas");
  canvas.width = 11;
  canvas.height = 11;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const on = (x, y) => y >= 0 && y < 11 && x >= 0 && x < 11 && DISC11[y][x] === "#";
  for (let y = 0; y < 11; y += 1) {
    for (let x = 0; x < 11; x += 1) {
      if (!on(x, y)) continue;
      const edge = !on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1);
      ctx.fillStyle = rgb(edge ? r[0] : c);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.fillStyle = rgb(r[4]);
  for (const [x, y] of [[3, 2], [2, 3], [4, 2], [2, 4]]) ctx.fillRect(x, y, 1, 1);
  ctx.fillStyle = rgb(r[1]);
  for (const [x, y] of [[7, 8], [8, 7], [6, 8], [8, 6]]) ctx.fillRect(x, y, 1, 1);

  const glyph = GLYPH7[GLYPH_TYPE[k]];
  const paint = (colour, ox, oy) => {
    ctx.fillStyle = colour;
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        if (glyph[y][x] === "X") ctx.fillRect(2 + x + ox, 2 + y + oy, 1, 1);
      }
    }
  };
  if (k === "lightning") paint("rgb(150,92,10)", 1, 1);
  paint("#ffffff", 0, 0);
  iconCache.set(k, canvas);
  return canvas;
}

export function drawTypeIcon(ctx, key, x, y) {
  ctx.drawImage(typeIcon(key), Math.round(x), Math.round(y));
}

export function drawRingSlot(ctx, x, y, colour) {
  ctx.fillStyle = rgb(colour);
  for (let yy = 0; yy < 11; yy += 1) {
    for (let xx = 0; xx < 11; xx += 1) if (RING11[yy][xx] === "#") ctx.fillRect(x + xx, y + yy, 1, 1);
  }
}

/* ---------------- seeded tech frame ---------------- */

export function mulberry32(a) {
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function frameSpec(card) {
  const key = keyOf(card.tcg);
  const rnd = mulberry32(card.id * 7919 + (TYPE_INDEX[key] ?? 6) * 104729);
  const corners = rnd() < 0.5 ? ["tr", "bl"] : ["tl", "br"];
  const cut = 4 + Math.floor(rnd() * 3);
  const arm = 9 + Math.floor(rnd() * 5) + (card.rarity === "uncommon" ? 2 : 0);
  const gaps = () => {
    const out = [];
    for (let t = 0; t < 60 && out.length < 2; t += 1) {
      const x = 24 + Math.floor(rnd() * 108);
      if (out.every((o) => Math.abs(x - o) >= 22)) out.push(x);
    }
    return out.sort((a, b) => a - b);
  };
  const topGaps = gaps();
  const botGaps = gaps();
  const jogL = 40 + Math.floor(rnd() * 120);
  const jogR = 40 + Math.floor(rnd() * 120);
  const premium = card.special === "ex" || card.special === "full" || ["rare", "holo", "legend"].includes(card.rarity);
  const th = premium ? 3 : 2;
  return { corners, cut, arm, topGaps, botGaps, jogL, jogR, th, key };
}

const W = 160;
const H = 224;

function inside(x, y, i, cut, corners) {
  if (x < i || x > W - 1 - i || y < i || y > H - 1 - i) return false;
  const c = Math.max(1, cut - Math.floor((i - 3) / 2));
  const test = (corner, dx, dy) => corners.includes(corner) && dx + dy < c;
  if (test("tl", x - i, y - i)) return false;
  if (test("tr", W - 1 - i - x, y - i)) return false;
  if (test("bl", x - i, H - 1 - i - y)) return false;
  if (test("br", W - 1 - i - x, H - 1 - i - y)) return false;
  return true;
}

export function insideFrame(x, y, inset, spec) {
  return inside(x, y, inset, spec.cut, spec.corners);
}

/* every pixel of ring(i): inside(i) with a 4-neighbour outside(i) */
export function ringPixels(i, spec, fn) {
  for (let y = i; y < H - i; y += 1) {
    for (let x = i; x < W - i; x += 1) {
      if (!inside(x, y, i, spec.cut, spec.corners)) continue;
      const edge =
        !inside(x - 1, y, i, spec.cut, spec.corners) ||
        !inside(x + 1, y, i, spec.cut, spec.corners) ||
        !inside(x, y - 1, i, spec.cut, spec.corners) ||
        !inside(x, y + 1, i, spec.cut, spec.corners);
      if (edge) fn(x, y);
    }
  }
}
