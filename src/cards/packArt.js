/* Booster-pack textures at 176x352, drawn on whole pixels with solid fills. */
import { drawText, textWidth } from "./pixelfont.js";

export const PACK_W = 176;
export const PACK_H = 352;
export const TEAR_Y = 30;

export const VARIANTS = {
  fire: {
    id: "fire",
    label: "FIRE",
    mascot: 6,
    base: "#cf5a24",
    light: "#ef8a45",
    deep: "#8c3315",
    foil: "#ffd39a",
    accent: "#ffe07a",
  },
  water: {
    id: "water",
    label: "WATER",
    mascot: 9,
    base: "#2f74bd",
    light: "#5ea6e0",
    deep: "#123c68",
    foil: "#bfe6ff",
    accent: "#cdeeff",
  },
  grass: {
    id: "grass",
    label: "GRASS",
    mascot: 3,
    base: "#3a8f43",
    light: "#67b055",
    deep: "#174d22",
    foil: "#c8efa0",
    accent: "#d8f5b4",
  },
};

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
  const A = rgb(a);
  const B = rgb(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}
function shade(hex, amount) {
  return amount < 0 ? mix(hex, "#000000", -amount) : mix(hex, "#ffffff", amount);
}

function foil(ctx, v) {
  ctx.fillStyle = v.base;
  ctx.fillRect(0, 0, PACK_W, PACK_H);
  /* diagonal 8px foil bands, two clean tones */
  for (let d = -PACK_H; d < PACK_W + PACK_H; d += 8) {
    const band = Math.floor((d + PACK_H) / 8) % 3;
    ctx.fillStyle = band === 0 ? v.light : band === 1 ? v.base : mix(v.base, v.deep, 0.35);
    for (let y = 0; y < PACK_H; y += 1) {
      const x0 = d + y;
      if (x0 < 0 || x0 >= PACK_W) continue;
      ctx.fillRect(x0, y, 4, 1);
    }
  }
  /* wide, clean sheen down the middle */
  ctx.fillStyle = mix(v.light, "#ffffff", 0.18);
  for (let y = 26; y < PACK_H - 26; y += 1) {
    const x = Math.round(PACK_W * 0.12 + y * 0.18);
    if (x >= 0 && x + 10 < PACK_W) ctx.fillRect(x, y, 10, 1);
  }
}

function crimp(ctx, v, top) {
  const h = 24;
  const y0 = top ? 0 : PACK_H - h;
  ctx.fillStyle = v.deep;
  ctx.fillRect(0, y0, PACK_W, h);
  for (let x = 0; x < PACK_W; x += 4) {
    ctx.fillStyle = mix(v.deep, v.base, 0.35);
    ctx.fillRect(x, y0 + 3, 2, h - 6);
    ctx.fillStyle = mix(v.deep, "#000000", 0.35);
    ctx.fillRect(x + 2, y0 + 3, 1, h - 6);
  }
  ctx.fillStyle = mix(v.deep, "#000000", 0.5);
  ctx.fillRect(0, top ? 0 : PACK_H - 2, PACK_W, 2);
  if (top) {
    ctx.fillStyle = mix(v.deep, "#000000", 0.5);
    ctx.fillRect(0, h - 1, PACK_W, 1);
  } else {
    ctx.fillStyle = mix(v.deep, "#000000", 0.5);
    ctx.fillRect(0, y0, PACK_W, 1);
  }
  /* sawtooth inner edge */
  for (let x = 0; x < PACK_W; x += 1) {
    const notch = Math.abs((x % 8) - 4) < 2 ? 2 : 0;
    if (top) ctx.clearRect(x, h - 1 - notch, 1, 2);
    else ctx.clearRect(x, PACK_H - h + notch - 1, 1, 2);
  }
}

function tearLine(ctx, v) {
  for (let x = 12; x < PACK_W - 44; x += 1) {
    if (x % 6 < 3) {
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillRect(x, TEAR_Y, 1, 2);
    }
  }
  /* scissors */
  const sx = PACK_W - 34;
  const sy = TEAR_Y - 5;
  ctx.fillStyle = "#fdfbf4";
  ctx.fillRect(sx, sy, 6, 2);
  ctx.fillRect(sx + 6, sy + 2, 5, 2);
  ctx.fillRect(sx + 2, sy + 4, 3, 2);
  ctx.fillRect(sx + 7, sy + 6, 6, 2);
  ctx.fillStyle = v.deep;
  ctx.fillRect(sx + 11, sy + 2, 2, 2);
  ctx.fillRect(sx + 12, sy + 6, 2, 2);
}

function rays(ctx, v, cx, cy, radius) {
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    ctx.fillStyle = i % 2 === 0 ? mix(v.foil, v.light, 0.35) : mix(v.base, v.deep, 0.25);
    for (let r = 26; r < radius; r += 1) {
      const w = r < radius * 0.7 ? 3 : 5;
      const x = Math.round(cx + Math.cos(a) * r);
      const y = Math.round(cy + Math.sin(a) * r);
      ctx.fillRect(x, y, w, 2);
    }
  }
  ctx.fillStyle = mix(v.foil, "#ffffff", 0.25);
  for (let y = -radius; y < radius; y += 1) {
    for (let x = -radius; x < radius; x += 1) {
      const d = Math.hypot(x, y);
      if (d > radius * 0.52 || d < radius * 0.34) continue;
      ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }
}

function logo(ctx, v) {
  const title = "KANTO";
  const size = 42;
  const tw = textWidth(title, size, 1, 2);
  const x = Math.round((PACK_W - tw) / 2);
  const y = 42;
  for (let dy = -3; dy <= 3; dy += 1) {
    for (let dx = -3; dx <= 3; dx += 1) {
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) continue;
      drawText(ctx, title, x + dx, y + dy, { size, color: "#20162c", tracking: 2 });
    }
  }
  drawText(ctx, title, x + 2, y + 3, { size, color: mix(v.deep, "#000000", 0.3), tracking: 2 });
  drawText(ctx, title, x, y, { size, color: v.accent, tracking: 2 });

  const sub = "BOOSTER PACK";
  const ssize = 14;
  const sw = textWidth(sub, ssize, 1, 2);
  const sx = Math.round((PACK_W - sw) / 2);
  const sy = y + 54;
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) continue;
      drawText(ctx, sub, sx + dx, sy + dy, { size: ssize, color: "#20162c", tracking: 2 });
    }
  }
  drawText(ctx, sub, sx, sy, { size: ssize, color: "#fdfbf4", tracking: 2 });
}

function plaque(ctx, v, y, label, textColour) {
  const w = PACK_W - 48;
  const x = 24;
  ctx.fillStyle = "#161022";
  ctx.fillRect(x, y, w, 28);
  ctx.fillStyle = mix(v.foil, v.deep, 0.35);
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y + 26, w, 2);
  const tw = textWidth(label, 12, 1, 1);
  drawText(ctx, label, Math.round((PACK_W - tw) / 2), y + 8, { size: 12, color: textColour, tracking: 1 });
}

export function renderPackFront(v, mascot) {
  const canvas = document.createElement("canvas");
  canvas.width = PACK_W;
  canvas.height = PACK_H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  foil(ctx, v);
  /* clean plate behind the mascot for contrast */
  const plateW = 150;
  const plateH = 128;
  const px = (PACK_W - plateW) / 2;
  const py = 268 - plateH;
  ctx.fillStyle = mix(v.deep, "#000000", 0.18);
  for (let row = 0; row < plateH; row += 1) {
    const inset = row < 10 ? 10 - row : row > plateH - 10 ? row - (plateH - 10) : 0;
    ctx.fillRect(px + inset, py + row, plateW - inset * 2, 1);
  }
  ctx.fillStyle = mix(v.light, "#ffffff", 0.12);
  ctx.fillRect(px + 10, py + 10, plateW - 20, 2);
  ctx.fillStyle = mix(v.deep, "#000000", 0.4);
  ctx.fillRect(px + 10, py + plateH - 12, plateW - 20, 2);

  logo(ctx, v);

  if (mascot) {
    const scale = mascot.width * 2 <= 130 && mascot.height * 2 <= 130 ? 2 : 1;
    const w = mascot.width * scale;
    const h = mascot.height * scale;
    const x = Math.round((PACK_W - w) / 2);
    const y = 266 - h;
    ctx.fillStyle = "rgba(20,14,30,0.28)";
    ctx.fillRect(x + 4, y + h - 4, w - 8, 4);
    ctx.drawImage(mascot, x, y, w, h);
  }

  tearLine(ctx, v);
  plaque(ctx, v, 274, "5 CARDS", "#ffe9a8");
  crimp(ctx, v, true);
  crimp(ctx, v, false);

  /* foil edge lighting */
  ctx.fillStyle = mix(v.foil, v.light, 0.5);
  ctx.fillRect(0, 24, 2, PACK_H - 48);
  ctx.fillRect(PACK_W - 2, 24, 2, PACK_H - 48);
  return canvas;
}

export function renderPackBack(v) {
  const canvas = document.createElement("canvas");
  canvas.width = PACK_W;
  canvas.height = PACK_H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  foil(ctx, v);
  crimp(ctx, v, true);
  crimp(ctx, v, false);

  /* fin seal */
  ctx.fillStyle = mix(v.deep, "#000000", 0.25);
  ctx.fillRect(PACK_W / 2 - 10, 24, 20, PACK_H - 48);
  for (let y = 26; y < PACK_H - 26; y += 3) {
    ctx.fillStyle = mix(v.base, v.deep, 0.5);
    ctx.fillRect(PACK_W / 2 - 8, y, 16, 1);
  }

  /* barcode plaque */
  ctx.fillStyle = "#fdfbf4";
  ctx.fillRect(20, 70, 78, 42);
  for (let i = 0; i < 26; i += 1) {
    const w = i % 4 === 0 ? 3 : i % 3 === 0 ? 2 : 1;
    ctx.fillStyle = "#161022";
    ctx.fillRect(24 + i * 2.7, 76, w, 30);
  }
  drawText(ctx, "KANTO 151", 20, 120, { size: 11, color: "#fdfbf4", tracking: 1 });
  drawText(ctx, "5 CARDS - 1 RARE OR BETTER", 20, 140, { size: 9, color: mix(v.foil, "#ffffff", 0.4), tracking: 1 });

  const note = "FAN PROJECT. NOT AFFILIATED WITH NINTENDO, GAME FREAK OR THE POKEMON COMPANY.";
  let line = "";
  let y = 200;
  for (const word of note.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next, 9, 1, 1) > PACK_W - 40) {
      drawText(ctx, line, 20, y, { size: 9, color: "#fdfbf4", tracking: 1 });
      y += 13;
      line = word;
    } else {
      line = next;
    }
  }
  if (line) drawText(ctx, line, 20, y, { size: 9, color: "#fdfbf4", tracking: 1 });

  drawText(ctx, "SEALED IN KANTO", 20, 296, { size: 10, color: v.accent, tracking: 1 });
  return canvas;
}

export function renderStrip(v) {
  const canvas = document.createElement("canvas");
  canvas.width = PACK_W;
  canvas.height = TEAR_Y;
  const ctx = canvas.getContext("2d");
  foil(ctx, v);
  crimp(ctx, v, true);
  for (let x = 0; x < PACK_W; x += 1) {
    const jag = Math.round(Math.sin(x * 0.6) * 1.4 + Math.sin(x * 0.19) * 1);
    ctx.clearRect(x, TEAR_Y - 3 + jag, 1, 4);
    ctx.fillStyle = "rgba(22,16,34,0.75)";
    ctx.fillRect(x, TEAR_Y - 4 + jag, 1, 1);
  }
  return canvas;
}
