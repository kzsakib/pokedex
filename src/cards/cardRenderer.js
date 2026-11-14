/* Card textures at 160x236, drawn on whole pixels. Solid fills, no dithering. */
import { drawText, textWidth, fitText } from "./pixelfont.js";
import { drawTypeBadge, TYPE_COLOURS } from "./icons.js";
import { RARITY_MARK } from "./generate.js";

export const CARD_W = 160;
export const CARD_H = 264;

const INK = "#171426";
const CREAM = "#f7f0d9";
const PAPER = "#fffaf0";
const HP_RED = "#c8281e";
const GOLD = "#e8b23a";

const SMALL = 7;
const NAME = 11;
const TRACK_S = 1;
const TRACK_M = 0;

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

function panel(ctx, x, y, w, h, colour) {
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, w, h);
}

function chamferRect(ctx, x, y, w, h, colour, cut = 5) {
  ctx.fillStyle = colour;
  for (let row = 0; row < h; row += 1) {
    const inset = row < cut ? cut - row : row >= h - cut ? row - (h - cut) + 1 : 0;
    ctx.fillRect(x + inset, y + row, w - inset * 2, 1);
  }
}

function artScene(ctx, type, x, y, w, h) {
  const pal = TYPE_COLOURS[type] || TYPE_COLOURS.Colorless;
  const sky = mix(pal.light, "#ffffff", 0.28);
  const mid = mix(pal.light, pal.frame, 0.5);
  const ground = mix(pal.frame, pal.deep, 0.35);
  const horizon = Math.round(h * 0.62);

  panel(ctx, x, y, w, horizon, sky);
  panel(ctx, x, y + horizon, w, h - horizon, ground);
  panel(ctx, x, y + horizon - 4, w, 4, mid);
  panel(ctx, x, y + horizon - 5, w, 1, mix(sky, "#ffffff", 0.55));

  /* a clean horizon glow strip and a few solid accents */
  const light = mix(pal.light, "#ffffff", 0.6);
  const deep = mix(pal.deep, "#000000", 0.1);
  ctx.fillStyle = light;
  for (let i = 0; i < 7; i += 1) {
    const sx = x + 8 + ((i * 31) % (w - 24));
    const sy = y + 8 + ((i * 17) % Math.max(6, horizon - 20));
    ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.fillStyle = deep;
  for (let i = 0; i < 6; i += 1) {
    const sx = x + 10 + ((i * 23) % (w - 28));
    const sy = y + horizon + 8 + ((i * 13) % Math.max(4, h - horizon - 16));
    ctx.fillRect(sx, sy, 3, 2);
  }

  if (type === "Fire") {
    for (let i = 0; i < 4; i += 1) {
      const fx = x + 14 + i * 30;
      const fy = y + horizon - 22;
      ctx.fillStyle = "#ffb347";
      ctx.fillRect(fx, fy, 4, 8);
      ctx.fillRect(fx + 1, fy - 4, 2, 6);
      ctx.fillStyle = "#fff0a8";
      ctx.fillRect(fx + 2, fy + 4, 2, 4);
    }
  } else if (type === "Water") {
    for (let i = 0; i < 5; i += 1) {
      const wx = x + 16 + i * 24;
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillRect(wx, y + 14 + (i % 3) * 9, 6, 2);
      ctx.fillRect(wx + 2, y + 10 + (i % 3) * 9, 3, 2);
    }
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 4; i += 1) ctx.fillRect(x + 20 + i * 28, y + horizon - 26 - (i % 2) * 8, 2, 2);
  } else if (type === "Grass") {
    for (let i = 0; i < 6; i += 1) {
      const gx = x + 10 + i * 22;
      const gy = y + horizon + 4 + (i % 2) * 6;
      ctx.fillStyle = mix(pal.deep, "#000000", 0.2);
      ctx.fillRect(gx, gy, 2, 8);
      ctx.fillStyle = mix(pal.light, "#ffffff", 0.3);
      ctx.fillRect(gx - 4, gy, 4, 3);
      ctx.fillRect(gx + 2, gy + 2, 4, 3);
    }
  } else if (type === "Lightning") {
    for (let i = 0; i < 3; i += 1) {
      const bx = x + 26 + i * 40;
      ctx.fillStyle = "#fff3b0";
      ctx.fillRect(bx, y + 10, 3, 8);
      ctx.fillRect(bx - 3, y + 16, 3, 3);
      ctx.fillRect(bx - 6, y + 18, 3, 8);
    }
  } else if (type === "Psychic") {
    for (let i = 0; i < 8; i += 1) {
      const sx = x + 12 + ((i * 37) % (w - 24));
      const sy = y + 10 + ((i * 19) % (horizon - 18));
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(sx, sy - 2, 2, 6);
      ctx.fillRect(sx - 2, sy, 6, 2);
    }
  } else if (type === "Fighting") {
    for (let i = 0; i < 6; i += 1) {
      const rx = x + 12 + ((i * 41) % (w - 30));
      const ry = y + horizon + 6 + ((i * 11) % 20);
      ctx.fillStyle = deep;
      ctx.fillRect(rx, ry, 6, 4);
      ctx.fillStyle = mix(pal.deep, "#ffffff", 0.25);
      ctx.fillRect(rx, ry, 3, 2);
    }
  } else {
    for (let i = 0; i < 4; i += 1) {
      const cx = x + 20 + i * 32;
      const cy = y + 18 + (i % 2) * 12;
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillRect(cx, cy, 12, 3);
      ctx.fillRect(cx + 3, cy - 3, 8, 3);
    }
  }
}

function drawSprite(ctx, sprite, cx, bottom, groundY) {
  if (!sprite) return;
  const scale = 2;
  const w = sprite.width * scale;
  const h = sprite.height * scale;
  const x = Math.round(cx - w / 2);
  const y = Math.round(bottom - h);
  ctx.fillStyle = "rgba(23,20,38,0.18)";
  ctx.fillRect(x + 4, groundY, w - 8, 2);
  ctx.fillStyle = "rgba(23,20,38,0.12)";
  ctx.fillRect(x + 12, groundY + 2, w - 24, 2);
  ctx.fillStyle = "rgba(23,20,38,0.22)";
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, x, y, w, h);
}

function moveRow(ctx, card, move, y) {
  const costs = move.cost || [];
  costs.forEach((type, i) => drawTypeBadge(ctx, type, 10 + i * 13, y, 12));
  const cursor = 10 + costs.length * 13 + (costs.length ? 5 : 0);
  const dmgW = textWidth(move.display, 10, 1, 0);
  const nameMax = 146 - cursor - dmgW - 4;
  let name = fitText(ctx, move.name, Math.max(18, nameMax), SMALL, 1, 0);
  if (name !== move.name) name = `${fitText(ctx, move.name, Math.max(12, nameMax - 14), SMALL, 1, 0)}..`;
  drawText(ctx, name, cursor, y + 1, { size: SMALL, scale: 1, color: INK, tracking: 0 });
  drawText(ctx, move.display, 148 - dmgW, y - 2, { size: 10, scale: 1, color: INK, tracking: 0 });
  if (move.effect) {
    drawText(ctx, fitText(ctx, move.effect, 132, SMALL, 1, 0), 12, y + 15, {
      size: SMALL,
      scale: 1,
      color: shade(TYPE_COLOURS[card.tcg]?.deep || INK, 0.05),
      tracking: 0,
    });
  }
}

export function renderCard(card, sprite) {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const pal = TYPE_COLOURS[card.tcg] || TYPE_COLOURS.Colorless;
  const gold = card.rarity === "rare" || card.rarity === "holo" || card.rarity === "legend";
  const frame = card.rarity === "legend" ? "#d9a52c" : pal.frame;
  const rarityColour = gold ? GOLD : card.rarity === "uncommon" ? "#7fb6c9" : "#b9b6c6";

  /* frame */
  chamferRect(ctx, 0, 0, CARD_W, CARD_H, INK, 7);
  chamferRect(ctx, 2, 2, CARD_W - 4, CARD_H - 4, frame, 6);
  chamferRect(ctx, 7, 7, CARD_W - 14, CARD_H - 14, INK, 4);
  chamferRect(ctx, 8, 8, CARD_W - 16, CARD_H - 16, CREAM, 3);

  /* frame bevel: light top-left, deep bottom-right */
  ctx.fillStyle = shade(frame, 0.28);
  ctx.fillRect(9, 2, CARD_W - 20, 2);
  ctx.fillRect(2, 9, 2, CARD_H - 20);
  ctx.fillStyle = shade(frame, -0.3);
  ctx.fillRect(9, CARD_H - 4, CARD_W - 20, 2);
  ctx.fillRect(CARD_W - 4, 9, 2, CARD_H - 20);

  /* panel polish */
  ctx.fillStyle = shade(CREAM, 0.5);
  ctx.fillRect(9, 8, CARD_W - 18, 2);
  ctx.fillStyle = mix(CREAM, pal.light, 0.35);
  ctx.fillRect(9, 8, 2, CARD_H - 16);

  /* rarity accent line just inside the frame */
  ctx.fillStyle = rarityColour;
  ctx.fillRect(10, CARD_H - 12, CARD_W - 20, 1);
  if (gold) {
    ctx.fillStyle = "rgba(232,178,58,0.5)";
    ctx.fillRect(10, 10, 1, CARD_H - 20);
    ctx.fillRect(CARD_W - 11, 10, 1, CARD_H - 20);
  }

  /* header row 1: stage left, HP right */
  const stageLabel = card.rarity === "legend" ? "LEGEND" : card.stage === 0 ? "BASIC" : card.stage === 1 ? "STAGE 1" : "STAGE 2";
  drawText(ctx, `${stageLabel}  LV.${card.level}`, 12, 12, {
    size: SMALL,
    scale: 1,
    color: shade(pal.deep, 0.06),
    tracking: 0,
  });
  const hpText = String(card.hp);
  const hpW = textWidth(hpText, NAME, 1, 0);
  drawText(ctx, hpText, 146 - hpW, 7, { size: NAME, scale: 1, color: HP_RED, tracking: 0 });
  drawText(ctx, "HP", 146 - hpW - 22, 10, { size: SMALL, scale: 1, color: shade(pal.deep, 0.05), tracking: 0 });

  /* header row 2: name across the card */
  const name = fitText(ctx, card.name, 136, NAME, 1, 0);
  drawText(ctx, name, 12, 27, { size: NAME, scale: 1, color: INK, tracking: 0 });

  /* art window */
  const ax = 12;
  const ay = 46;
  const aw = 136;
  const ah = 104;
  panel(ctx, ax - 2, ay - 2, aw + 4, ah + 4, INK);
  panel(ctx, ax - 1, ay - 1, aw + 2, ah + 2, shade(frame, -0.18));
  ctx.save();
  ctx.beginPath();
  ctx.rect(ax, ay, aw, ah);
  ctx.clip();
  artScene(ctx, card.tcg, ax, ay, aw, ah);
  const groundY = ay + Math.round(ah * 0.66);
  drawSprite(ctx, sprite, ax + aw / 2, ay + ah - 6, groundY);
  ctx.restore();
  /* window inner edge */
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillRect(ax, ay, aw, 1);
  ctx.fillRect(ax, ay, 1, ah);
  ctx.fillStyle = "rgba(23,20,38,0.35)";
  ctx.fillRect(ax, ay + ah - 1, aw, 1);
  ctx.fillRect(ax + aw - 1, ay, 1, ah);

  drawTypeBadge(ctx, card.tcg, ax + 2, ay + 2, 24);

  if (card.shiny) {
    const tag = "SHINY ✦";
    const tw = textWidth(tag, SMALL, 2, 0) + 10;
    panel(ctx, ax + aw - tw - 2, ay + 2, tw, 16, "rgba(23,20,38,0.86)");
    drawText(ctx, tag, ax + aw - tw + 3, ay + 5, { size: SMALL, scale: 1, color: "#ffe27a", tracking: 0 });
  }

  /* info strip */
  const numText = String(card.id).padStart(3, "0");
  const info = `NO.${numText} ${card.genus}`;
  const mark = RARITY_MARK[card.rarity];
  const numW = textWidth(numText, SMALL, 1, 0);
  drawText(ctx, fitText(ctx, info, 146 - numW - 26, SMALL, 1, 0), 12, 155, {
    size: SMALL,
    scale: 1,
    color: shade(pal.deep, 0.1),
    tracking: 0,
  });
  drawText(ctx, numText, 146 - numW, 155, { size: SMALL, scale: 1, color: INK, tracking: 0 });
  drawText(ctx, mark, 146 - numW - 13, 155, { size: SMALL, scale: 1, color: rarityColour, tracking: 0 });

  /* divider */
  panel(ctx, 10, 169, CARD_W - 20, 2, mix(pal.frame, CREAM, 0.35));

  /* moves */
  moveRow(ctx, card, card.moves[0], 173);
  panel(ctx, 10, 201, CARD_W - 20, 1, mix(pal.frame, CREAM, 0.6));
  if (card.moves[1]) {
    moveRow(ctx, card, card.moves[1], 205);
  } else {
    const total = Math.round((card.height || 0) * 39.3701);
    const feet = Math.floor(total / 12);
    const inches = total % 12;
    const lb = Math.round((card.weight || 0) * 2.2046);
    drawText(ctx, `HT ${feet}'${String(inches).padStart(2, "0")}"   WT ${lb} LB`, 12, 205, {
      size: SMALL,
      scale: 1,
      color: INK,
      tracking: 0,
    });
    drawText(ctx, fitText(ctx, card.flavour || "A KANTO FIELD SPECIMEN.", 132, SMALL, 1, 0), 12, 222, {
      size: SMALL,
      scale: 1,
      color: shade(pal.deep, 0.18),
      tracking: 0,
    });
  }

  /* footer */
  const footY = 240;
  drawText(ctx, "WK", 12, footY, { size: 7, scale: 1, color: shade(pal.deep, 0.15), tracking: 0 });
  drawTypeBadge(ctx, card.weakness, 26, footY - 3, 12);
  drawText(ctx, "X2", 40, footY, { size: 7, scale: 1, color: INK, tracking: 0 });
  drawText(ctx, "RES", 58, footY, { size: 7, scale: 1, color: shade(pal.deep, 0.15), tracking: 0 });
  if (card.resistance) {
    drawTypeBadge(ctx, card.resistance, 74, footY - 3, 12);
    drawText(ctx, "-30", 88, footY, { size: 7, scale: 1, color: INK, tracking: 0 });
  } else {
    drawText(ctx, "--", 82, footY, { size: 7, scale: 1, color: INK, tracking: 0 });
  }
  drawText(ctx, "RET", 112, footY, { size: 7, scale: 1, color: shade(pal.deep, 0.15), tracking: 0 });
  drawText(ctx, String(card.retreat || 0), 132, footY, { size: 7, scale: 1, color: INK, tracking: 0 });

  return canvas;
}

export function renderCardBack() {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  panel(ctx, 0, 0, CARD_W, CARD_H, INK);
  chamferRect(ctx, 4, 4, CARD_W - 8, CARD_H - 8, "#1d2b52", 6);
  chamferRect(ctx, 8, 8, CARD_W - 16, CARD_H - 16, "#111a33", 4);

  /* clean diagonal weave: 4px bands, alternating tones */
  for (let y = 12; y < CARD_H - 12; y += 8) {
    for (let x = 12; x < CARD_W - 12; x += 8) {
      const alt = ((x + y) / 8) % 2 === 0;
      ctx.fillStyle = alt ? "#1a2748" : "#16203c";
      ctx.fillRect(x, y, 4, 4);
    }
  }
  ctx.fillStyle = "#0f1830";
  ctx.fillRect(12, CARD_H / 2 - 2, CARD_W - 24, 2);

  /* emblem */
  const cx = CARD_W / 2;
  const cy = CARD_H / 2 - 10;
  const r = 34;
  for (let y = -r - 3; y <= r + 3; y += 1) {
    for (let x = -r - 3; x <= r + 3; x += 1) {
      const d = Math.hypot(x, y);
      if (d > r + 3) continue;
      const edge = d > r;
      const top = y < 0;
      ctx.fillStyle = edge ? INK : top ? "#c8281e" : "#f7f0d9";
      ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }
  panel(ctx, cx - r, cy - 3, r * 2, 6, INK);
  for (let y = -11; y <= 11; y += 1) {
    for (let x = -11; x <= 11; x += 1) {
      const d = Math.hypot(x, y);
      if (d > 11) continue;
      ctx.fillStyle = d > 7 ? INK : "#f7f0d9";
      ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }
  const label = "KANTO 151";
  const lw = textWidth(label, NAME, 2, 0);
  drawText(ctx, label, Math.round((CARD_W - lw) / 2), cy + 54, {
    size: NAME,
    scale: 1,
    color: "#f7f0d9",
    tracking: 0,
  });
  const sub = "TRADE - PLAY - COLLECT";
  const sw = textWidth(sub, SMALL, 2, 0);
  drawText(ctx, sub, Math.round((CARD_W - sw) / 2), cy + 76, {
    size: SMALL,
    scale: 1,
    color: "#8fa6d8",
    tracking: 0,
  });
  return canvas;
}
