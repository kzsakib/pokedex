/* Procedural booster-pack textures: foil, logo, crimps, mascot, back. */
import { drawText, textWidth } from "./font.js";

export const PACK_W = 88;
export const PACK_H = 176;
export const TEAR_Y = 15;

export const VARIANTS = {
  fire: {
    id: "fire",
    label: "FIRE",
    mascot: 6,
    base: [196, 86, 40],
    light: [232, 136, 74],
    deep: [116, 42, 20],
    foil: [244, 188, 120],
    accent: "#f2c230",
  },
  water: {
    id: "water",
    label: "WATER",
    mascot: 9,
    base: [46, 108, 178],
    light: [96, 158, 216],
    deep: [22, 56, 104],
    foil: [158, 214, 244],
    accent: "#a8d9f7",
  },
  grass: {
    id: "grass",
    label: "GRASS",
    mascot: 3,
    base: [58, 132, 66],
    light: [110, 176, 96],
    deep: [26, 70, 36],
    foil: [176, 226, 140],
    accent: "#b6e29b",
  },
};

const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mixc = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const dither = (x, y, t) => BAYER[y & 3][x & 3] / 16 < t;

function foilField(ctx, variant) {
  for (let y = 0; y < PACK_H; y += 1) {
    for (let x = 0; x < PACK_W; x += 1) {
      const diagonal = (x + y * 0.62) % 16;
      let colour = variant.base;
      if (diagonal < 3) colour = variant.deep;
      else if (diagonal < 6) colour = mixc(variant.base, variant.light, 0.55);
      else if (diagonal < 8) colour = mixc(variant.base, variant.deep, 0.28);
      else if (diagonal > 14 && dither(x, y, 0.5)) colour = variant.light;
      /* vertical metal sheen */
      const sheen = Math.sin((x / PACK_W) * Math.PI);
      if (sheen > 0.9 && dither(x, y, 0.6)) colour = mixc(colour, variant.foil, 0.4);
      ctx.fillStyle = rgba(colour);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function rayBurst(ctx, variant, cx, cy) {
  for (let y = 30; y < 150; y += 1) {
    for (let x = 4; x < PACK_W - 4; x += 1) {
      const a = Math.atan2(y - cy, x - cx);
      const band = Math.floor(((a + Math.PI) / Math.PI) * 16) % 2;
      if (band !== 0) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d > 66) continue;
      if (!dither(x, y, 0.24)) continue;
      ctx.fillStyle = rgba(variant.foil, 0.35);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  /* halo behind the mascot */
  for (let y = -34; y <= 34; y += 1) {
    for (let x = -34; x <= 34; x += 1) {
      const d = Math.hypot(x, y);
      if (d > 32) continue;
      if (!dither(cx + x, cy + y, d < 24 ? 0.5 : 0.25)) continue;
      ctx.fillStyle = rgba(variant.foil, d < 20 ? 0.4 : 0.2);
      ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }
}

function crimp(ctx, variant, top) {
  const h = 12;
  const y0 = top ? 0 : PACK_H - h;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < PACK_W; x += 1) {
      const ridge = x % 2 === 0;
      const edge = y === 0 || y === h - 1;
      let colour = ridge ? variant.deep : mixc(variant.deep, variant.base, 0.35);
      if (edge) colour = mixc(variant.deep, [10, 8, 14], 0.6);
      if (ridge && dither(x, y0 + y, 0.5)) colour = mixc(colour, variant.light, 0.4);
      ctx.fillStyle = rgba(colour);
      ctx.fillRect(x, y0 + y, 1, 1);
    }
  }
  /* sawtooth inner edge */
  for (let x = 0; x < PACK_W; x += 1) {
    const notch = Math.abs((x % 6) - 3) < 2 ? 1 : 0;
    ctx.clearRect(x, top ? h - 1 - notch : PACK_H - h + notch, 1, 1);
  }
}

function tearLine(ctx, variant) {
  for (let x = 5; x < PACK_W - 5; x += 1) {
    if (x % 4 < 2) {
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillRect(x, TEAR_Y, 1, 1);
    }
    if (x % 16 === 0) {
      ctx.fillStyle = "rgba(26,26,46,0.5)";
      ctx.fillRect(x, TEAR_Y + 2, 1, 1);
    }
  }
  /* scissors glyph */
  const sx = PACK_W - 22;
  ctx.fillStyle = "#e8e6f0";
  ctx.fillRect(sx, TEAR_Y - 2, 3, 1);
  ctx.fillRect(sx + 3, TEAR_Y - 1, 2, 1);
  ctx.fillRect(sx + 1, TEAR_Y + 1, 2, 1);
  ctx.fillRect(sx + 3, TEAR_Y + 2, 2, 1);
  ctx.fillStyle = variant.deep;
  ctx.fillRect(sx + 5, TEAR_Y - 1, 1, 1);
  ctx.fillRect(sx + 5, TEAR_Y + 1, 1, 1);
}

function logo(ctx, variant) {
  const title = "KANTO";
  const scale = 3;
  const tw = textWidth(title, 5, scale, 0);
  const x = Math.round((PACK_W - tw) / 2);
  const y = 26;
  /* outline pass */
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (!dx && !dy) continue;
      drawText(ctx, title, x + dx, y + dy, { size: 5, scale, color: "rgba(26,26,46,0.85)", tracking: 0 });
    }
  }
  drawText(ctx, title, x, y, { size: 5, scale, color: variant.accent, tracking: 0 });
  /* pixel highlight on the top-left of each letter */
  for (let i = 0; i < title.length; i += 1) {
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillRect(x + i * 15 + 1, y + 1, 3, 1);
    ctx.fillRect(x + i * 15 + 1, y + 2, 1, 4);
  }
  const sub = "BOOSTER PACK";
  const sw = textWidth(sub, 3, 2, 0);
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      if (!dx && !dy) continue;
      drawText(ctx, sub, Math.round((PACK_W - sw) / 2) + dx, y + 26 + dy, { size: 3, scale: 2, color: "rgba(26,26,46,0.7)", tracking: 0 });
    }
  }
  drawText(ctx, sub, Math.round((PACK_W - sw) / 2), y + 26, { size: 3, scale: 2, color: "#f6f2e6", tracking: 0 });
}

function bottomBand(ctx, variant) {
  const y = PACK_H - 34;
  ctx.fillStyle = "rgba(18,14,24,0.72)";
  ctx.fillRect(12, y, PACK_W - 24, 12);
  ctx.fillStyle = rgba(variant.foil, 0.5);
  ctx.fillRect(12, y, PACK_W - 24, 1);
  const label = "5 CARDS";
  const w = textWidth(label, 3, 2, 1);
  drawText(ctx, label, Math.round((PACK_W - w) / 2), y + 3, { size: 3, scale: 2, color: "#f2ecd8", tracking: 1 });
}

export function renderPackFront(variant, mascot) {
  const canvas = document.createElement("canvas");
  canvas.width = PACK_W;
  canvas.height = PACK_H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  foilField(ctx, variant);
  rayBurst(ctx, variant, PACK_W / 2, 104);
  crimp(ctx, variant, true);
  crimp(ctx, variant, false);
  logo(ctx, variant);

  if (mascot) {
    const w = mascot.width;
    const h = mascot.height;
    const cx = Math.round((PACK_W - w) / 2);
    const cy = 100 - Math.round(h / 2) + 4;
    for (let py = 0; py < h; py += 1) {
      for (let px = 0; px < w; px += 1) {
        if (!dither(cx + px, cy + py + h - 2, 0.4)) continue;
        ctx.fillStyle = "rgba(18,14,24,0.35)";
        ctx.fillRect(cx + px, cy + py + h - 2, 1, 1);
      }
    }
    ctx.drawImage(mascot, cx, cy, w, h);
  }

  tearLine(ctx, variant);
  bottomBand(ctx, variant);
  return canvas;
}

export function renderPackBack(variant) {
  const canvas = document.createElement("canvas");
  canvas.width = PACK_W;
  canvas.height = PACK_H;
  const ctx = canvas.getContext("2d");
  foilField(ctx, variant);
  crimp(ctx, variant, true);
  crimp(ctx, variant, false);
  /* fin seal */
  for (let y = 14; y < PACK_H - 14; y += 1) {
    for (let x = PACK_W / 2 - 4; x <= PACK_W / 2 + 4; x += 1) {
      const t = x % 2 === 0;
      ctx.fillStyle = t ? rgba(variant.deep) : rgba(mixc(variant.deep, variant.base, 0.4));
      ctx.fillRect(x, y, 1, 1);
    }
  }
  /* barcode */
  const bx = 14;
  const by = 42;
  ctx.fillStyle = "#f6f2e6";
  ctx.fillRect(bx - 2, by - 2, 34, 18);
  for (let i = 0; i < 24; i += 1) {
    const w = i % 3 === 0 ? 2 : 1;
    ctx.fillStyle = "#14122a";
    ctx.fillRect(bx + i * 1.25, by, w, 13);
  }
  drawText(ctx, "KANTO 151", 14, 66, { size: 3, scale: 1, color: "#f6f2e6" });
  drawText(ctx, "1 RARE OR BETTER", 14, 76, { size: 3, scale: 1, color: "rgba(246,242,230,0.8)" });
  drawText(ctx, "5 CARDS", 14, 86, { size: 3, scale: 1, color: "rgba(246,242,230,0.8)" });
  const note = "FAN PROJECT. NOT AFFILIATED WITH NINTENDO, GAME FREAK OR THE POKEMON COMPANY.";
  const words = note.split(" ");
  let line = "";
  let y = 112;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next, 3, 1, 1) > PACK_W - 22) {
      drawText(ctx, line, 11, y, { size: 3, scale: 1, color: "rgba(246,242,230,0.62)" });
      y += 7;
      line = word;
    } else {
      line = next;
    }
  }
  if (line) drawText(ctx, line, 11, y, { size: 3, scale: 1, color: "rgba(246,242,230,0.62)" });
  drawText(ctx, "OPEN WITH CARE", 11, PACK_H - 52, { size: 3, scale: 1, color: variant.accent });
  return canvas;
}

export function renderStrip(variant) {
  const canvas = document.createElement("canvas");
  canvas.width = PACK_W;
  canvas.height = TEAR_Y;
  const ctx = canvas.getContext("2d");
  foilField(ctx, variant);
  crimp(ctx, variant, true);
  for (let x = 0; x < PACK_W; x += 1) {
    const jag = Math.round(Math.sin(x * 0.7) * 1.2 + Math.sin(x * 0.23) * 0.8);
    ctx.clearRect(x, TEAR_Y - 2 + jag, 1, 3);
    ctx.fillStyle = "rgba(26,26,46,0.6)";
    ctx.fillRect(x, TEAR_Y - 3 + jag, 1, 1);
  }
  return canvas;
}
