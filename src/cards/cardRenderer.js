/* Card textures, drawn pixel by pixel at 100x140. No gradients, no smoothing. */
import { drawText, textWidth, fitText } from "./font.js";
import { drawTypeBadge, TYPE_COLOURS } from "./icons.js";
import { RARITY_LABEL, RARITY_MARK } from "./generate.js";

export const CARD_W = 100;
export const CARD_H = 140;

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
export const bayer = (x, y, density) => BAYER[y & 3][x & 3] / 16 < density;

const INK = "#1a1a2e";
const CREAM = "#f4ecd0";
const HP_RED = "#c8281e";

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function shade(hex, amount) {
  const [r, g, b] = hexToRgb(hex);
  const k = amount < 0 ? 1 + amount : 1;
  const lift = amount > 0 ? 255 * amount : 0;
  return `rgb(${Math.min(255, Math.round(r * k + lift))},${Math.min(255, Math.round(g * k + lift))},${Math.min(255, Math.round(b * k + lift))})`;
}

function panelTexture(ctx, x, y, w, h, base, tint) {
  for (let py = 0; py < h; py += 1) {
    for (let px = 0; px < w; px += 1) {
      const gx = x + px;
      const gy = y + py;
      const band = (px + py) % 8 < 2;
      let colour = base;
      if (band) colour = mix(base, tint, 0.16);
      if (bayer(gx, gy, 0.22)) colour = mix(base, tint, 0.34);
      ctx.fillStyle = colour;
      ctx.fillRect(gx, gy, 1, 1);
    }
  }
}

function artBackdrop(ctx, type, x, y, w, h) {
  const pal = TYPE_COLOURS[type] || TYPE_COLOURS.Colorless;
  const bands = [shade(pal.light, 0.04), mix(pal.light, pal.frame, 0.34), mix(pal.frame, pal.deep, 0.24)];
  for (let py = 0; py < h; py += 1) {
    for (let px = 0; px < w; px += 1) {
      const t = py / h;
      let band = t < 0.42 ? 0 : t < 0.76 ? 1 : 2;
      if (bayer(x + px, y + py, 0.5) && band < 2) band += 1;
      ctx.fillStyle = bands[band];
      ctx.fillRect(x + px, y + py, 1, 1);
    }
  }
  /* type-themed flecks */
  const fleck = shade(pal.light, 0.25);
  const deep = pal.deep;
  ctx.fillStyle = fleck;
  for (let i = 0; i < 26; i += 1) {
    const fx = x + ((i * 37) % w);
    const fy = y + ((i * 53) % h);
    ctx.fillRect(fx, fy, 1, 1);
  }
  ctx.fillStyle = mix(pal.deep, "#ffffff", 0.25);
  if (type === "Fire") {
    for (let i = 0; i < 5; i += 1) {
      const fx = x + 6 + ((i * 17) % (w - 12));
      const fy = y + 10 + ((i * 9) % (h - 18));
      ctx.fillRect(fx, fy, 2, 3);
      ctx.fillRect(fx + 2, fy + 1, 1, 2);
    }
  } else if (type === "Water") {
    for (let row = 0; row < 4; row += 1) {
      const wy = y + 12 + row * 9;
      for (let i = 0; i < 5; i += 1) {
        ctx.fillRect(x + 8 + i * 3, wy, 2, 1);
        ctx.fillRect(x + 10 + i * 3, wy + 1, 2, 1);
      }
    }
  } else if (type === "Grass") {
    for (let i = 0; i < 6; i += 1) {
      const gx = x + 7 + ((i * 13) % (w - 14));
      const gy = y + 8 + ((i * 11) % (h - 16));
      ctx.fillRect(gx, gy, 1, 4);
      ctx.fillRect(gx + 1, gy + 1, 2, 1);
      ctx.fillRect(gx - 2, gy + 2, 2, 1);
    }
  } else if (type === "Lightning") {
    for (let i = 0; i < 3; i += 1) {
      const bx = x + 10 + ((i * 23) % (w - 20));
      const by = y + 6 + ((i * 13) % (h - 18));
      ctx.fillRect(bx, by, 2, 2);
      ctx.fillRect(bx - 1, by + 2, 2, 2);
      ctx.fillRect(bx - 2, by + 4, 2, 2);
    }
  } else if (type === "Psychic") {
    for (let i = 0; i < 18; i += 1) {
      const fx = x + ((i * 29) % w);
      const fy = y + ((i * 41) % h);
      ctx.fillRect(fx, fy, 1, 1);
    }
    ctx.fillRect(x + 14, y + 8, 1, 1);
    ctx.fillRect(x + w - 18, y + 16, 1, 1);
  } else if (type === "Fighting") {
    for (let i = 0; i < 7; i += 1) {
      const fx = x + 6 + ((i * 19) % (w - 12));
      const fy = y + h - 12 - ((i * 7) % 14);
      ctx.fillRect(fx, fy, 3, 2);
      ctx.fillRect(fx + 1, fy - 1, 1, 1);
    }
  } else {
    for (let i = 0; i < 4; i += 1) {
      const cx = x + 10 + ((i * 21) % (w - 24));
      const cy = y + 10 + ((i * 15) % (h - 24));
      ctx.fillRect(cx, cy, 6, 2);
      ctx.fillRect(cx + 2, cy + 2, 5, 1);
    }
  }
  ctx.fillStyle = deep;
}

function typeIconPanel(ctx, type, x, y) {
  drawTypeBadge(ctx, type, x, y, 9);
}

function moveRow(ctx, card, move, y) {
  const pal = TYPE_COLOURS[card.tcg] || TYPE_COLOURS.Colorless;
  let cursor = 8;
  move.cost.forEach((type, i) => {
    drawTypeBadge(ctx, type, cursor, y, 7);
    cursor += 8;
  });
  const damageW = textWidth(move.display, 5, 1, 1);
  const nameMax = 90 - cursor - damageW - 3;
  const name = fitText(ctx, move.name, Math.max(18, nameMax), 5, 1, 1);
  drawText(ctx, name, cursor + 2, y + 1, { size: 5, scale: 1, color: INK });
  const dw = textWidth(move.display, 5, 1, 1);
  drawText(ctx, move.display, 91 - dw, y + 1, { size: 5, scale: 1, color: INK });
  if (move.effect) {
    drawText(ctx, move.effect, 8, y + 11, { size: 3, scale: 1, color: shade(pal.deep, 0.2), tracking: 1 });
  }
}

function drawSprite(ctx, sprite, cx, cy, max = 56) {
  if (!sprite) return;
  const w = sprite.width;
  const h = sprite.height;
  const x = Math.round(cx - w / 2);
  const y = Math.round(cy - h / 2);
  /* dithered ground shadow */
  for (let py = 0; py < 5; py += 1) {
    const run = Math.round((w / 2) * (1 - py / 6));
    for (let px = -run; px <= run; px += 1) {
      if (!bayer(cx + px, cy + h / 2 + py, 0.45 - py * 0.07)) continue;
      ctx.fillStyle = "rgba(26,26,46,0.32)";
      ctx.fillRect(Math.round(cx + px), Math.round(cy + h / 2 + py), 1, 1);
    }
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, x, y, w, h);
}

export function renderCard(card, sprite) {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const pal = TYPE_COLOURS[card.tcg] || TYPE_COLOURS.Colorless;
  const isGold = card.rarity === "legend";
  const frame = isGold ? "#c9a227" : pal.frame;

  /* cream body with stair-cut corners */
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const cut = (x, y, w, h, colour) => {
    ctx.fillStyle = colour;
    ctx.fillRect(x + 2, y, w - 4, h);
    ctx.fillRect(x, y + 2, w, h - 4);
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  };
  cut(1, 1, CARD_W - 2, CARD_H - 2, frame);
  cut(3, 3, CARD_W - 6, CARD_H - 6, shade(frame, -0.28));
  cut(4, 4, CARD_W - 8, CARD_H - 8, CREAM);
  panelTexture(ctx, 5, 5, CARD_W - 10, CARD_H - 10, CREAM, pal.light);

  /* header row 1: stage + level / number + rarity */
  const stageLabel = card.rarity === "legend" ? "LEGEND" : card.stage === 0 ? "BASIC" : card.stage === 1 ? "STAGE 1" : "STAGE 2";
  drawText(ctx, stageLabel, 7, 7, { size: 3, scale: 1, color: shade(pal.deep, 0.05) });
  drawText(ctx, `LV.${card.level}`, 7 + textWidth(stageLabel, 3, 1, 1) + 4, 7, { size: 3, scale: 1, color: INK });
  const num = `${String(card.id).padStart(3, "0")}/151`;
  const mark = RARITY_MARK[card.rarity];
  const numW = textWidth(num, 3, 1, 1);
  drawText(ctx, num, 86 - numW, 7, { size: 3, scale: 1, color: INK });
  drawText(ctx, mark, 87, 7, { size: 3, scale: 1, color: isGold ? "#b98a1f" : pal.deep });

  /* header row 2: name / HP / type badge */
  const nameFit = fitText(ctx, card.name, 49, 5, 1, 1);
  drawText(ctx, nameFit, 7, 12, { size: 5, scale: 1, color: INK });
  drawText(ctx, "HP", 59, 13, { size: 3, scale: 1, color: INK });
  const hpText = String(card.hp);
  const hpW = textWidth(hpText, 5, 1, 1);
  drawText(ctx, hpText, 80 - hpW, 12, { size: 5, scale: 1, color: HP_RED });
  typeIconPanel(ctx, card.tcg, 84, 11);

  /* art window */
  const ax = 8;
  const ay = 22;
  const aw = 84;
  const ah = 62;
  ctx.fillStyle = INK;
  ctx.fillRect(ax - 1, ay - 1, aw + 2, ah + 2);
  artBackdrop(ctx, card.tcg, ax, ay, aw, ah);
  /* bevel */
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillRect(ax, ay, aw, 1);
  ctx.fillRect(ax, ay, 1, ah);
  ctx.fillStyle = "rgba(26,26,46,0.28)";
  ctx.fillRect(ax, ay + ah - 1, aw, 1);
  ctx.fillRect(ax + aw - 1, ay, 1, ah);
  drawSprite(ctx, sprite, ax + aw / 2, ay + ah / 2 - 2, 56);

  if (card.shiny) {
    const tag = "SHINY ✦";
    const tw = textWidth(tag, 3, 1, 1) + 4;
    ctx.fillStyle = "rgba(26,26,46,0.78)";
    ctx.fillRect(ax + aw - tw - 2, ay + 2, tw, 9);
    drawText(ctx, tag, ax + aw - tw, ay + 4, { size: 3, scale: 1, color: "#ffe27a" });
  }

  /* info strip: number and genus */
  const info = `NO.${String(card.id).padStart(3, "0")} ${card.genus}`;
  drawText(ctx, fitText(ctx, info, 84, 3, 1, 1), 7, 87, { size: 3, scale: 1, color: shade(pal.deep, 0.12) });

  /* moves */
  moveRow(ctx, card, card.moves[0], 94);
  ctx.fillStyle = mix(pal.frame, CREAM, 0.55);
  for (let x = 7; x < 93; x += 2) ctx.fillRect(x, 110, 1, 1);
  if (card.moves[1]) {
    moveRow(ctx, card, card.moves[1], 112);
  } else {
    const total = Math.round((card.height || 0) * 39.3701);
    const feet = Math.floor(total / 12);
    const inches = total % 12;
    const wn = Math.round(card.weight * 2.2046);
    const size = `HT ${feet}'${String(inches).padStart(2, "0")}"  WT ${wn} LB`;
    drawText(ctx, fitText(ctx, size, 84, 3, 1, 1), 7, 113, { size: 3, scale: 1, color: shade(pal.deep, 0.12) });
    const flavour = fitText(ctx, card.flavour || "A FIELD SPECIMEN FROM KANTO.", 84, 3, 1, 1);
    drawText(ctx, flavour, 7, 120, { size: 3, scale: 1, color: shade(pal.deep, 0.24) });
  }

  /* footer */
  ctx.fillStyle = INK;
  ctx.fillRect(6, 127, 88, 1);
  drawText(ctx, "WK", 6, 130, { size: 3, scale: 1, color: shade(pal.deep, 0.1) });
  drawTypeBadge(ctx, card.weakness, 14, 129, 5);
  drawText(ctx, "x2", 20, 130, { size: 3, scale: 1, color: INK });
  drawText(ctx, "RES", 33, 130, { size: 3, scale: 1, color: shade(pal.deep, 0.1) });
  if (card.resistance) {
    drawTypeBadge(ctx, card.resistance, 45, 129, 5);
    drawText(ctx, "-30", 51, 130, { size: 3, scale: 1, color: INK });
  } else {
    drawText(ctx, "--", 45, 130, { size: 3, scale: 1, color: INK });
  }
  drawText(ctx, "RET", 64, 130, { size: 3, scale: 1, color: shade(pal.deep, 0.1) });
  for (let i = 0; i < card.retreat; i += 1) drawTypeBadge(ctx, "Colorless", 77 + i * 5, 130, 4);

  /* rarity accent line */
  if (card.rarity !== "common") {
    const accent = isGold ? "#e0b93c" : card.rarity === "holo" ? "#c9a7f0" : card.rarity === "rare" ? "#d9b23f" : "#b9b9c4";
    for (let x = 6; x < 94; x += 1) {
      if (bayer(x, 0, 0.7)) {
        ctx.fillStyle = accent;
        ctx.fillRect(x, 5, 1, 1);
      }
    }
  }
  return canvas;
}

export function renderCardBack() {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = "#2b2a4d";
  ctx.fillRect(3, 3, CARD_W - 6, CARD_H - 6);
  /* dithered diamond lattice */
  for (let y = 6; y < CARD_H - 6; y += 1) {
    for (let x = 6; x < CARD_W - 6; x += 1) {
      const d = Math.abs(x - CARD_W / 2) + Math.abs(y - CARD_H / 2);
      if ((x + y) % 8 === 0 || (x - y + 200) % 8 === 0) {
        ctx.fillStyle = d % 3 === 0 ? "#3b3a63" : "#33325a";
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  /* emblem */
  const cx = CARD_W / 2;
  const cy = CARD_H / 2;
  for (let y = -18; y <= 18; y += 1) {
    for (let x = -18; x <= 18; x += 1) {
      if (x * x + y * y > 324) continue;
      ctx.fillStyle = "#e8e6f0";
      ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
    }
  }
  for (let y = -18; y <= 0; y += 1) {
    for (let x = -18; x <= 18; x += 1) {
      if (x * x + y * y > 324) continue;
      ctx.fillStyle = "#c8281e";
      ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
    }
  }
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(cx - 19, cy - 1, 38, 3);
  for (let y = -7; y <= 7; y += 1) {
    for (let x = -7; x <= 7; x += 1) {
      if (x * x + y * y > 49) continue;
      ctx.fillStyle = "#e8e6f0";
      ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
    }
  }
  for (let y = -3; y <= 3; y += 1) {
    for (let x = -3; x <= 3; x += 1) {
      if (x * x + y * y > 9) continue;
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
    }
  }
  drawText(ctx, "KANTO", cx - textWidth("KANTO", 5, 1, 1) / 2, CARD_H - 26, { size: 5, scale: 1, color: "#e8e6f0" });
  drawText(ctx, "151", cx - textWidth("151", 3, 1, 1) / 2, CARD_H - 16, { size: 3, scale: 1, color: "#8b87a0" });
  return canvas;
}
