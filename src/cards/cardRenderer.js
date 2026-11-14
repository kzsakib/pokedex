/* Card faces drawn pixel by pixel on a 160x224 native canvas.
   Only the hand-authored bitmap fonts are used. Big pixels (2x2) for the
   sprite, name, HP and damage; everything else is 1x1. */

export const CARD_W = 160;
export const CARD_H = 224;

const INK = "#1a1a2e";
const CREAM = "#f6efd4";
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

function glyphs(ctx, text, font, x, y, color, sp, scale = 1) {
  ctx.fillStyle = color;
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
  A: [5, 18],
  B: [21, 34],
  art: [37, 142],
  info: [150, 155],
  move1: [162, 180],
  move2: [186, 204],
  footer: [209, 217],
};

let lint = null;
function record(zone, x, y, w, h) {
  if (!lint) return;
  const [z0, z1] = ZONES[zone] || ZONES.A;
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
};
const RARITY_COLOUR = { common: "#78788c", uncommon: "#5c94dc", rare: GOLD, holo: GOLD, legend: GOLD };

function drawRarity(ctx, rarity, x, y) {
  const rows = RARITY5[rarity === "common" || rarity === "uncommon" ? rarity : "rare"];
  ctx.fillStyle = RARITY_COLOUR[rarity] || RARITY_COLOUR.common;
  rows.forEach((row, ry) => {
    [...row].forEach((ch, rx) => {
      if (ch === "X") ctx.fillRect(x + rx, y + ry, 1, 1);
    });
  });
}

/* ---------- art window ---------- */

const ART = { x: 8, y: 37, w: 144, h: 106, inner: { x: 10, y: 39, w: 140, h: 102 } };
const BUFFER = { w: 70, h: 58 };

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
    const sy = Math.max(1, Math.round(h - 3 - sh));
    ctx.fillStyle = "rgba(26,26,46,0.2)";
    ctx.fillRect(sx + 3, h - 4, Math.max(4, sw - 6), 1);
    ctx.drawImage(sprite, sx, sy, sw, sh);
  }
  return canvas;
}

function artWindow(ctx, card, sprite) {
  const { x, y, w, h } = ART;
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
  const light = mix(ramp.light, "#ffffff", 0.55);
  const dark = mix(ramp.outline, "#000000", 0.1);
  ctx.fillStyle = light;
  ctx.fillRect(x + 1, y + 1, w - 2, 1);
  ctx.fillRect(x + 1, y + 1, 1, h - 2);
  ctx.fillStyle = dark;
  ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
  ctx.fillRect(x + w - 2, y + 1, 1, h - 2);

  const buffer = artBuffer(card, sprite);
  const { inner } = ART;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buffer, 0, 0, BUFFER.w, BUFFER.h, inner.x, inner.y, inner.w, inner.h);
}

/* ---------- frame ---------- */

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function frame(ctx, card) {
  const ramp = rampFor(card.tcg);
  const gold = card.rarity === "rare" || card.rarity === "holo" || card.rarity === "legend";

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  // stair-stepped 4px corners
  ctx.clearRect(0, 0, 2, 1);
  ctx.clearRect(0, 0, 1, 2);
  ctx.clearRect(CARD_W - 2, 0, 2, 1);
  ctx.clearRect(CARD_W - 1, 0, 1, 2);
  ctx.clearRect(0, CARD_H - 1, 2, 1);
  ctx.clearRect(0, CARD_H - 2, 1, 2);
  ctx.clearRect(CARD_W - 2, CARD_H - 1, 2, 1);
  ctx.clearRect(CARD_W - 1, CARD_H - 2, 1, 2);

  const lighter = mix(ramp.base, "#ffffff", 0.15);
  for (let yy = 1; yy < CARD_H - 1; yy += 1) {
    for (let xx = 1; xx < CARD_W - 1; xx += 1) {
      const t = (BAYER[yy % 4][xx % 4] + 0.5) / 16;
      ctx.fillStyle = t < 0.55 ? ramp.base : lighter;
      ctx.fillRect(xx, yy, 1, 1);
    }
  }
  ctx.fillStyle = gold ? GOLD : "#c9c9d6";
  ctx.fillRect(3, 3, CARD_W - 6, 1);
  ctx.fillRect(3, CARD_H - 4, CARD_W - 6, 1);

  ctx.fillStyle = mix(CREAM, ramp.base, 0.1);
  ctx.fillRect(4, 4, CARD_W - 8, CARD_H - 8);
}

/* ---------- moves and footer ---------- */

function damageText(move) {
  if (!move) return "-";
  if (move.display) return String(move.display);
  return move.damage ? String(move.damage) : "-";
}

function moveSlot(ctx, card, move, y, zone) {
  if (!move) return;
  const cost = (move.cost || []).slice(0, 3);
  cost.forEach((type, i) => lintDraw(zone, 8 + i * 10, y, 9, 9, () => drawIcon(ctx, type, 8 + i * 10, y)));
  const nameX = 8 + cost.length * 10 + 3;
  const dmg = damageText(move);
  const dmgW = textWidth(dmg, F5, 1);
  const maxName = 149 - dmgW - 6 - nameX;
  lintDraw(zone, nameX, y + 1, Math.max(10, maxName), 7, () => {
    fitText(ctx, move.name, Math.max(10, maxName), F5, TEXT, nameX, y + 1);
  });
  lintDraw(zone, 149 - dmgW, y + 1, dmgW, 7, () => {
    drawText(ctx, dmg, 149, y + 1, F5, TEXT, 1, "r", 1);
  });
  if (move.effect) {
    lintDraw(zone, 9, y + 11, 140, 5, () => {
      fitText(ctx, move.effect, 140, F3, "#544854", 9, y + 11);
    });
  }
}

function footer(ctx, card) {
  const y = 209;
  const textY = 211;
  const groups = [];

  const wk = () => {
    let w = 0;
    w += textWidth("WK", F3, 1) + 2;
    w += 9 + 2;
    w += textWidth("×2", F3, 1);
    return w;
  };
  const res = () => textWidth("RES", F3, 1) + 2 + 9 + 2 + textWidth(card.resistance ? "-30" : "-", F3, 1);
  const retreat = Math.min(3, card.retreat || 0);
  const ret = () => textWidth("RET", F3, 1) + 2 + (retreat === 0 ? textWidth("0", F3, 1) : retreat * 10 - 1);

  const widths = [wk(), res(), ret()];
  const total = widths.reduce((a, b) => a + b, 0);
  const gap = Math.max(6, Math.floor((143 - total) / 2));

  let x = 8;
  const drawGroup = (width, fn) => {
    const start = x;
    fn();
    lintDraw("footer", start, 209, width, 9, () => {});
    x += width + gap;
  };

  drawGroup(widths[0], () => {
    drawText(ctx, x, textY, "WK", F3, TEXT_MUTED, 1);
    x += textWidth("WK", F3, 1) + 2;
    drawIcon(ctx, card.weakness || "Colorless", x, y);
    x += 9 + 2;
    drawText(ctx, x, textY, "×2", F3, TEXT, 1);
    x = x; // group width reserved below
  });
  x = 8 + widths[0] + gap;

  drawText(ctx, x, textY, "RES", F3, TEXT_MUTED, 1);
  x += textWidth("RES", F3, 1) + 2;
  if (card.resistance) {
    drawIcon(ctx, card.resistance, x, y);
    x += 11;
    drawText(ctx, x, textY, "-30", F3, TEXT, 1);
  } else {
    drawText(ctx, x + 9, textY, "-", F3, TEXT, 1);
  }
  x = 8 + widths[0] + gap + widths[1] + gap;

  drawText(ctx, x, textY, "RET", F3, TEXT_MUTED, 1);
  x += textWidth("RET", F3, 1) + 2;
  if (retreat === 0) {
    drawText(ctx, x, textY, "0", F3, TEXT, 1);
  } else {
    for (let i = 0; i < retreat; i += 1) drawIcon(ctx, "Colorless", x + i * 10, y);
  }

  groups.push(total);
}

/* ---------- card ---------- */

export function renderCard(card, sprite, options = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  lint = options.lint ? { boxes: [] } : null;

  frame(ctx, card);
  artWindow(ctx, card, sprite);

  // Row A
  const stageName = card.rarity === "legend" ? "LEGEND" : card.stage === 2 ? "STAGE 2" : card.stage === 1 ? "STAGE 1" : "BASIC";
  lintDraw("A", 8, 10, 60, 5, () => drawText(ctx, 8, 10, `${stageName}  LV.${card.level}`, F3, TEXT, 1));
  const hp = String(card.hp);
  const hpW = textWidth(hp, F5, 1) * 2;
  lintDraw("A", 151 - hpW, 5, hpW, 14, () => drawText(ctx, 151, 5, hp, F5, HP_RED, 1, "r", 2));
  lintDraw("A", 151 - hpW - 18, 13, 16, 5, () => drawText(ctx, 151 - hpW - 2, 13, "HP", F3, TEXT, 1, "r"));

  // Row B
  const nameMax = 118;
  lintDraw("B", 8, 21, nameMax, 14, () => {
    const raw = upper(card.name);
    let n = raw;
    while (textWidth(n, F5, 1) * 2 > nameMax && n.length > 0) n = n.slice(0, -1);
    drawText(ctx, 8, 21, n, F5, TEXT, 1, "l", 2);
  });
  lintDraw("B", 142, 23, 9, 9, () => drawIcon(ctx, card.tcg, 142, 23));

  // info strip
  const genus = String(card.genus || "").replace(/\s*POKEMON$/i, "").trim();
  lintDraw("info", 8, 150, 110, 5, () => fitText(ctx, genus, 110, F3, TEXT_MUTED, 8, 150));
  lintDraw("info", 96, 150, 44, 5, () =>
    drawText(ctx, 140, 150, `${String(card.id).padStart(3, "0")}/151`, F3, TEXT_MUTED, 1, "r")
  );
  lintDraw("info", 146, 150, 5, 5, () => drawRarity(ctx, card.rarity, 146, 150));

  // move slots
  moveSlot(ctx, card, card.moves[0], 162, "move1");
  ctx.fillStyle = mix(rampFor(card.tcg).base, INK, 0.25);
  for (let x = 8; x < 152; x += 2) ctx.fillRect(x, 181, 1, 1);

  if (card.moves[1]) {
    moveSlot(ctx, card, card.moves[1], 186, "move2");
  } else {
    const total = Math.round((card.height || 0) * 39.3701);
    const ft = Math.floor(total / 12);
    const inch = total % 12;
    const lb = Math.round((card.weight || 0) * 2.2046);
    lintDraw("move2", 9, 188, 140, 5, () =>
      fitText(ctx, `HT ${ft}'${String(inch).padStart(2, "0")}"  WT ${lb} LB`, 140, F3, TEXT, 9, 188)
    );

  }

  ctx.fillStyle = mix(rampFor(card.tcg).base, INK, 0.3);
  ctx.fillRect(6, 207, 148, 1);
  footer(ctx, card);

  if (lint) {
    const seen = new Map();
    for (const b of lint.boxes) {
      if (b.error) continue;
      const key = b.zone;
      const other = seen.get(key);
      const tiled = b.zone === "info" || b.zone === "move1" || b.zone === "move2";
      if (!tiled && other && b.x < other.x + other.w && other.x < b.x + b.w && b.y < other.y + other.h && other.y < b.y + b.h) {
        b.error = "overlap";
      }
      seen.set(key, b);
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

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = "#1d2b52";
  ctx.fillRect(3, 3, CARD_W - 6, CARD_H - 6);
  ctx.fillStyle = "#101a31";
  ctx.fillRect(5, 5, CARD_W - 10, CARD_H - 10);

  ctx.fillStyle = "#182741";
  for (let d = -CARD_H; d < CARD_W + CARD_H; d += 14) {
    for (let y = 8; y < CARD_H - 8; y += 1) {
      const x = d + y;
      if (x >= 8 && x < CARD_W - 9) ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.fillStyle = GOLD;
  ctx.fillRect(8, 10, CARD_W - 16, 1);
  ctx.fillRect(8, CARD_H - 11, CARD_W - 16, 1);

  const cx = CARD_W / 2;
  const cy = 100;
  const r = 38;
  for (let y = -r; y <= r; y += 1) {
    for (let x = -r; x <= r; x += 1) {
      if (x * x + y * y > r * r) continue;
      ctx.fillStyle = y < 0 ? "#c8281e" : "#f6efd4";
      ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }
  ctx.fillStyle = INK;
  ctx.fillRect(cx - r, cy - 2, r * 2, 4);
  for (let y = -10; y <= 10; y += 1) {
    for (let x = -10; x <= 10; x += 1) {
      const d = Math.sqrt(x * x + y * y);
      if (d > 10) continue;
      ctx.fillStyle = d > 7 ? INK : "#f6efd4";
      ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }

  drawText(ctx, cx, 156, "KANTO 151", F5, "#f6efd4", 1, "c", 2);
  drawText(ctx, cx, 176, "TRADE - PLAY - COLLECT", F3, "#8fa6d8", 1, "c");
  drawText(ctx, cx, CARD_H - 22, "FAN PROJECT", F3, "#5d6f9c", 1, "c");
  return canvas;
}

export { F3, F5, drawText, textWidth, fitText, drawIcon, TYPE_BASE, ART };
