/* Card faces drawn pixel by pixel on a 100x140 native canvas.
   Only the two hand-authored bitmap fonts and the 7x7 icons are used. */

export const CARD_W = 100;
export const CARD_H = 140;

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

function drawText(ctx, x, y, s, font, color, sp = 1, align = "l") {
  const txt = upper(s);
  if (align === "r") x = x - textWidth(txt, font, sp) + 1;
  if (align === "c") x = x - (textWidth(txt, font, sp) >> 1);
  ctx.fillStyle = color;
  let cx = Math.round(x);
  const cy = Math.round(y);
  for (const ch of txt) {
    const g = font[ch] ?? font[" "];
    for (let r = 0; r < g.length; r += 1) {
      for (let c = 0; c < g[r].length; c += 1) {
        if (g[r][c] === "X") ctx.fillRect(cx + c, cy + r, 1, 1);
      }
    }
    cx += g[0].length + sp;
  }
}

/* Fit chain: spacing 1 -> spacing 0 (3x5 only) -> truncate. */
function fitText(ctx, text, maxW, font, color, x, y, align = "l") {
  const raw = upper(text);
  let sp = 1;
  let out = raw;
  if (textWidth(out, font, sp) > maxW && font === F3) {
    sp = 0;
  }
  while (textWidth(out, font, sp) > maxW && out.length > 0) {
    out = out.slice(0, -1);
  }
  drawText(ctx, x, y, out, font, color, sp, align);
  return textWidth(out, font, sp);
}

/* ---------- colours and icons ---------- */

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

/* hue-shifted ramp: darks cool toward violet, lights warm */
export function rampFor(type) {
  const base = TYPE_BASE[type] || TYPE_BASE.Colorless;
  return {
    base,
    outline: mix(mix(base, "#241a3c", 0.72), "#6a5aa0", 0.18),
    shade: mix(base, "#4b2e6a", 0.34),
    light: mix(base, "#f7e7c6", 0.38),
    white: "#fdfbf4",
    dark: type === "Lightning" ? "#54380c" : mix(base, "#1a1a2e", 0.78),
  };
}

const ICON7 = {
  Fire: ["..OOO..", ".OBBWO.", "OBBWWBO", "OBWWWBO", "OBWWWDO", ".OBWBO.", "..OOO.."],
  Water: ["..OOO..", ".OBWBO.", "OBBWBBO", "OBWWWBO", "OBWWWDO", ".OWWWO.", "..OOO.."],
  Grass: ["..OOO..", ".OBBWO.", "OBBWWBO", "OBWWWBO", "OWWWBDO", ".OWBDO.", "..OOO.."],
  Lightning: ["..OOO..", ".OBBKO.", "OBBKBBO", "OBKKKBO", "OBBKBDO", ".OKDDO.", "..OOO.."],
  Psychic: ["..OOO..", ".OBBBO.", "OBWWWBO", "OWWKWWO", "OBWWWDO", ".ODDDO.", "..OOO.."],
  Fighting: ["..OOO..", ".OWBWO.", "OBBWBBO", "OBWWWBO", "OBBWBDO", ".OWDWO.", "..OOO.."],
  Colorless: ["..OOO..", ".OBWBO.", "OWWWWWO", "OBWWWBO", "OBWBWDO", ".OWBWO.", "..OOO.."],
};

const iconCache = new Map();
function iconCanvas(type) {
  if (iconCache.has(type)) return iconCache.get(type);
  const ramp = rampFor(type);
  const rows = ICON7[type] || ICON7.Colorless;
  const canvas = document.createElement("canvas");
  canvas.width = 7;
  canvas.height = 7;
  const ctx = canvas.getContext("2d");
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const colour =
        ch === "O" ? ramp.outline : ch === "B" ? ramp.base : ch === "D" ? ramp.shade : ch === "W" ? ramp.white : ch === "K" ? ramp.dark : null;
      if (!colour) return;
      ctx.fillStyle = colour;
      ctx.fillRect(x, y, 1, 1);
    });
  });
  iconCache.set(type, canvas);
  return canvas;
}

function drawIcon(ctx, type, x, y) {
  ctx.drawImage(iconCanvas(type), Math.round(x), Math.round(y));
}

const DISC5 = [".OOO.", "OLBBO", "OBBBO", "OBBDO", ".OOO."];
function drawRetreat(ctx, x, y) {
  const ramp = rampFor("Colorless");
  const map = { O: ramp.outline, B: ramp.base, D: ramp.shade, L: ramp.light };
  DISC5.forEach((row, ry) => {
    [...row].forEach((ch, rx) => {
      if (!map[ch]) return;
      ctx.fillStyle = map[ch];
      ctx.fillRect(x + rx, y + ry, 1, 1);
    });
  });
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

/* ---------- frame texture helpers ---------- */

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function bayerFill(ctx, x, y, w, h, a, b, strength = 0.5) {
  for (let yy = 0; yy < h; yy += 1) {
    for (let xx = 0; xx < w; xx += 1) {
      const t = (BAYER[(y + yy) % 4][(x + xx) % 4] + 0.5) / 16;
      ctx.fillStyle = t < strength ? a : b;
      ctx.fillRect(x + xx, y + yy, 1, 1);
    }
  }
}

function frame(ctx, card) {
  const ramp = rampFor(card.tcg);
  const gold = card.rarity === "rare" || card.rarity === "holo" || card.rarity === "legend";
  // ink outline with stair-stepped 3px corners
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  for (let i = 0; i < 3; i += 1) {
    ctx.clearRect(0 + i, 0 + i, 1, 1);
    ctx.fillStyle = INK;
  }
  ctx.clearRect(0, 0, 3, 3);
  ctx.clearRect(CARD_W - 3, 0, 3, 3);
  ctx.clearRect(0, CARD_H - 3, 3, 3);
  ctx.clearRect(CARD_W - 3, CARD_H - 3, 3, 3);
  ctx.fillStyle = INK;
  ctx.fillRect(1, 0, CARD_W - 2, 1);
  ctx.fillRect(1, CARD_H - 1, CARD_W - 2, 1);
  ctx.fillRect(0, 1, 1, CARD_H - 2);
  ctx.fillRect(CARD_W - 1, 1, 1, CARD_H - 2);

  // 2px frame band, lightly dithered against a 15% lighter tone
  bayerFill(ctx, 1, 1, CARD_W - 2, CARD_H - 2, ramp.base, mix(ramp.base, "#ffffff", 0.15), 0.55);
  // accent line
  ctx.fillStyle = gold ? GOLD : "#c9c9d6";
  ctx.fillRect(3, 3, CARD_W - 6, 1);
  ctx.fillRect(3, CARD_H - 4, CARD_W - 6, 1);
  // inner panel, cream tinted 10% toward the type colour
  const panelColour = mix(CREAM, ramp.base, 0.1);
  ctx.fillStyle = panelColour;
  ctx.fillRect(4, 4, CARD_W - 8, CARD_H - 8);
}

/* ---------- art window (backdrop + sprite are kept as-is) ---------- */

const ART = { x: 8, y: 22, w: 84, h: 64 };

function artBackdrop(ctx, type, x, y, w, h) {
  const ramp = rampFor(type);
  const sky = mix(ramp.light, "#ffffff", 0.45);
  const band = mix(ramp.light, ramp.base, 0.35);
  const ground = mix(ramp.base, ramp.outline, 0.28);
  const horizon = Math.round(h * 0.66);

  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, horizon);
  ctx.fillStyle = ground;
  ctx.fillRect(x, y + horizon, w, h - horizon);
  ctx.fillStyle = band;
  ctx.fillRect(x, y + horizon - 3, w, 3);
  ctx.fillStyle = mix(sky, "#ffffff", 0.6);
  ctx.fillRect(x, y + horizon - 4, w, 1);

  ctx.fillStyle = mix(ramp.light, "#ffffff", 0.8);
  if (type === "Water") {
    ctx.fillRect(x + 12, y + 12, 20, 3);
    ctx.fillRect(x + 17, y + 8, 10, 3);
    ctx.fillRect(x + w - 30, y + 22, 16, 3);
  } else if (type === "Fire") {
    ctx.fillStyle = mix(ramp.base, "#ffb347", 0.45);
    ctx.fillRect(x + 13, y + horizon - 20, 6, 12);
    ctx.fillStyle = "#ffd98a";
    ctx.fillRect(x + 16, y + horizon - 26, 3, 8);
    ctx.fillStyle = mix(ramp.outline, "#ff9a5a", 0.5);
    ctx.fillRect(x + w - 24, y + horizon - 14, 5, 9);
  } else if (type === "Grass") {
    ctx.fillStyle = ramp.outline;
    ctx.fillRect(x + 11, y + horizon + 4, 3, 9);
    ctx.fillRect(x + 6, y + horizon + 4, 6, 3);
    ctx.fillRect(x + w - 22, y + horizon + 7, 3, 8);
    ctx.fillRect(x + w - 27, y + horizon + 7, 6, 3);
  } else if (type === "Lightning") {
    ctx.fillRect(x + 15, y + 11, 4, 10);
    ctx.fillRect(x + 12, y + 18, 4, 4);
    ctx.fillRect(x + 9, y + 21, 4, 10);
    ctx.fillRect(x + w - 24, y + 14, 3, 9);
  } else if (type === "Psychic") {
    for (let i = 0; i < 4; i += 1) {
      const sx = x + 13 + i * 18;
      const sy = y + 11 + (i % 2) * 9;
      ctx.fillRect(sx + 2, sy, 2, 7);
      ctx.fillRect(sx, sy + 3, 7, 2);
    }
  } else if (type === "Fighting") {
    ctx.fillStyle = mix(ramp.outline, "#000000", 0.15);
    for (let i = 0; i < 4; i += 1) {
      const sx = x + 9 + ((i * 23) % (w - 22));
      const sy = y + horizon + 4 + ((i * 11) % 16);
      ctx.fillRect(sx, sy, 9, 4);
    }
  } else {
    ctx.fillRect(x + 13, y + 12, 22, 4);
    ctx.fillRect(x + 19, y + 7, 12, 4);
    ctx.fillRect(x + w - 32, y + 26, 18, 4);
  }
}

function drawSprite(ctx, sprite, cx, bottom) {
  if (!sprite) return;
  const scale = sprite.width * 2 <= ART.w - 4 && sprite.height * 2 <= ART.h - 6 ? 2 : 1;
  const w = sprite.width * scale;
  const h = sprite.height * scale;
  const x = Math.round(cx - w / 2);
  const y = Math.round(bottom - h);
  ctx.fillStyle = "rgba(26,26,46,0.2)";
  ctx.fillRect(x + 4, bottom - 1, w - 8, 2);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, x, y, w, h);
}

function artWindow(ctx, card, sprite) {
  const { x, y, w, h } = ART;
  ctx.fillStyle = INK;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  artBackdrop(ctx, card.tcg, x, y, w, h);
  drawSprite(ctx, sprite, x + w / 2, y + h - 3);
  ctx.restore();
  const light = mix(rampFor(card.tcg).light, "#ffffff", 0.5);
  const dark = mix(rampFor(card.tcg).outline, "#000000", 0.1);
  ctx.fillStyle = light;
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = dark;
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x + w - 1, y, 1, h);
}

/* ---------- moves, footer ---------- */

function damageText(move) {
  if (!move) return "-";
  if (move.display) return String(move.display).replace(/^([0-9]+)$/, "$1");
  return move.damage ? String(move.damage) : "-";
}

function moveSlot(ctx, card, move, y) {
  const cost = (move.cost || []).slice(0, 3);
  cost.forEach((type, i) => drawIcon(ctx, type, 8 + i * 8, y));
  const nameX = 8 + cost.length * 8 + 2;
  const dmg = damageText(move);
  const dmgW = textWidth(dmg, F5, 0);
  const maxName = 91 - dmgW - 4 - nameX;
  fitText(ctx, move.name, Math.max(18, maxName), F3, TEXT, nameX, y + 1);
  drawText(ctx, dmg, 91, y, F5, TEXT, 1, "r");
  if (move.effect) {
    fitText(ctx, move.effect, 82, F3, "#544854", 9, y + 9);
  }
}

function footer(ctx, card) {
  const y = 128;
  const textY = 129;
  let x = 8;
  const label = (t) => {
    drawText(ctx, x, textY, t, F3, TEXT_MUTED, 1);
    x += textWidth(t, F3, 1) + 2;
  };

  label("WK");
  drawIcon(ctx, card.weakness || "Colorless", x, y);
  x += 8;
  drawText(ctx, "×2", x, textY, F3, TEXT, 1);
  x += textWidth("×2", F3, 1) + 3;

  label("RES");
  if (card.resistance) {
    drawIcon(ctx, card.resistance, x, y);
    x += 8;
    drawText(ctx, "-30", x, textY, F3, TEXT, 1);
    x += textWidth("-30", F3, 1) + 3;
  } else {
    drawText(ctx, "-", x, textY, F3, TEXT, 1);
    x += textWidth("-", F3, 1) + 3;
  }

  label("RET");
  const retreat = Math.min(3, card.retreat || 0);
  if (retreat === 0) {
    drawText(ctx, "0", x, textY, F3, TEXT, 1);
  } else {
    for (let i = 0; i < retreat; i += 1) drawRetreat(ctx, x + i * 5, 129);
  }
}

/* ---------- card ---------- */

export function renderCard(card, sprite) {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  frame(ctx, card);
  artWindow(ctx, card, sprite);

  // header row 1
  const stageName = card.rarity === "legend" ? "LEGEND" : card.stage === 2 ? "STAGE 2" : card.stage === 1 ? "STAGE 1" : "BASIC";
  drawText(ctx, 7, 6, `${stageName}  LV.${card.level}`, F3, TEXT, 1);
  const hp = String(card.hp);
  drawText(ctx, 92, 5, hp, F5, HP_RED, 0, "r");
  const hpW = textWidth(hp, F5, 0);
  drawText(ctx, 92 - hpW - 5, 7, "HP", F3, TEXT, 0, "r");

  // header row 2: name + type icon
  const nameMax = 86 - 7 - 4;
  let nameSp = 1;
  const rawName = upper(card.name);
  if (textWidth(rawName, F5, nameSp) > nameMax) nameSp = 1;
  let name = rawName;
  while (textWidth(name, F5, nameSp) > nameMax && name.length > 0) name = name.slice(0, -1);
  drawText(ctx, 7, 13, name, F5, TEXT, nameSp, "l");
  drawIcon(ctx, card.tcg, 84, 13);

  // info strip
  const genus = String(card.genus || "").replace(/\s*POKEMON$/i, "").trim();
  fitText(ctx, genus, 52, F3, TEXT_MUTED, 9, 88);
  drawText(ctx, `${String(card.id).padStart(3, "0")}/151`, 86, 88, F3, TEXT_MUTED, 1, "r");
  drawRarity(ctx, card.rarity, 88, 86);

  // move slots
  moveSlot(ctx, card, card.moves[0], 94);
  ctx.fillStyle = mix(rampFor(card.tcg).base, INK, 0.25);
  for (let x = 8; x < 92; x += 2) ctx.fillRect(x, 109, 1, 1);

  if (card.moves[1]) {
    moveSlot(ctx, card, card.moves[1], 111);
  }
  if (!card.moves[1]) {
    const total = Math.round((card.height || 0) * 39.3701);
    const ft = Math.floor(total / 12);
    const inch = total % 12;
    const lb = Math.round((card.weight || 0) * 2.2046);
    fitText(ctx, `HT ${ft}'${String(inch).padStart(2, "0")}"  WT ${lb} LB`, 82, F3, TEXT, 9, 112);
    if (card.flavour) fitText(ctx, card.flavour, 82, F3, "#544854", 9, 119);
  }

  // footer divider + row
  ctx.fillStyle = mix(rampFor(card.tcg).base, INK, 0.3);
  ctx.fillRect(6, 126, 88, 1);
  footer(ctx, card);

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
  ctx.clearRect(0, 0, 3, 3);
  ctx.clearRect(CARD_W - 3, 0, 3, 3);
  ctx.clearRect(0, CARD_H - 3, 3, 3);
  ctx.clearRect(CARD_W - 3, CARD_H - 3, 3, 3);
  ctx.fillStyle = "#1d2b52";
  ctx.fillRect(3, 3, CARD_W - 6, CARD_H - 6);
  ctx.fillStyle = "#101a31";
  ctx.fillRect(5, 5, CARD_W - 10, CARD_H - 10);

  ctx.fillStyle = "#182741";
  for (let d = -CARD_H; d < CARD_W + CARD_H; d += 12) {
    for (let y = 7; y < CARD_H - 7; y += 1) {
      const x = d + y;
      if (x >= 7 && x < CARD_W - 8) ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.fillStyle = GOLD;
  ctx.fillRect(7, 8, CARD_W - 14, 1);
  ctx.fillRect(7, CARD_H - 9, CARD_W - 14, 1);

  const cx = CARD_W / 2;
  const cy = 62;
  const r = 24;
  for (let y = -r; y <= r; y += 1) {
    for (let x = -r; x <= r; x += 1) {
      if (x * x + y * y > r * r) continue;
      ctx.fillStyle = y < 0 ? "#c8281e" : "#f6efd4";
      ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }
  ctx.fillStyle = INK;
  ctx.fillRect(cx - r, cy - 1, r * 2, 2);
  for (let y = -6; y <= 6; y += 1) {
    for (let x = -6; x <= 6; x += 1) {
      const d = Math.sqrt(x * x + y * y);
      if (d > 6) continue;
      ctx.fillStyle = d > 4 ? INK : "#f6efd4";
      ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }

  drawText(ctx, "KANTO 151", cx, 96, F5, "#f6efd4", 0, "c");
  drawText(ctx, "TRADE - PLAY - COLLECT", cx, 108, F3, "#8fa6d8", 0, "c");
  drawText(ctx, "FAN PROJECT", cx, CARD_H - 14, F3, "#5d6f9c", 0, "c");
  return canvas;
}

export { F3, F5, drawText, textWidth, fitText, drawIcon, TYPE_BASE, ART };
