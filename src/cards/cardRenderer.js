/* Card textures at 180x280, drawn on whole pixels. Solid fills, no dithering. */
import { drawText, textWidth, fitText } from "./pixelfont.js";
import { drawTypeBadge, TYPE_COLOURS } from "./icons.js";
import { RARITY_MARK } from "./generate.js";

export const CARD_W = 180;
export const CARD_H = 280;

const INK = "#171426";
const CREAM = "#f7f0d9";
const HP_RED = "#c8281e";
const GOLD = "#e8b23a";

const SMALL = 8;
const NAME = 13;
const DAMAGE = 11;

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
function chamfer(ctx, x, y, w, h, colour, cut) {
  ctx.fillStyle = colour;
  for (let row = 0; row < h; row += 1) {
    const inset = row < cut ? cut - row : row >= h - cut ? row - (h - cut) + 1 : 0;
    ctx.fillRect(x + inset, y + row, w - inset * 2, 1);
  }
}

function artScene(ctx, type, x, y, w, h) {
  const pal = TYPE_COLOURS[type] || TYPE_COLOURS.Colorless;
  const sky = mix(pal.light, "#ffffff", 0.34);
  const mid = mix(pal.light, pal.frame, 0.45);
  const ground = mix(pal.frame, pal.deep, 0.3);
  const horizon = Math.round(h * 0.66);

  panel(ctx, x, y, w, horizon, sky);
  panel(ctx, x, y + horizon, w, h - horizon, ground);
  panel(ctx, x, y + horizon - 6, w, 6, mid);
  panel(ctx, x, y + horizon - 7, w, 1, mix(sky, "#ffffff", 0.6));

  const light = mix(pal.light, "#ffffff", 0.7);
  const deep = mix(pal.deep, "#000000", 0.15);
  /* bold, sparse accents — no scattered pixels */
  if (type === "Water") {
    panel(ctx, x + 16, y + 14, 26, 4, light);
    panel(ctx, x + 22, y + 9, 14, 4, light);
    panel(ctx, x + w - 40, y + 28, 22, 4, light);
  } else if (type === "Fire") {
    panel(ctx, x + 18, y + horizon - 26, 8, 16, mix(pal.frame, "#ffb347", 0.5));
    panel(ctx, x + 22, y + horizon - 34, 4, 10, "#ffd98a");
    panel(ctx, x + w - 34, y + horizon - 18, 6, 12, mix(pal.deep, "#ff9a5a", 0.5));
  } else if (type === "Grass") {
    panel(ctx, x + 14, y + horizon + 6, 4, 12, deep);
    panel(ctx, x + 8, y + horizon + 6, 8, 4, light);
    panel(ctx, x + w - 30, y + horizon + 10, 4, 10, deep);
    panel(ctx, x + w - 36, y + horizon + 10, 8, 4, light);
  } else if (type === "Lightning") {
    panel(ctx, x + 20, y + 14, 5, 14, light);
    panel(ctx, x + 16, y + 24, 5, 5, light);
    panel(ctx, x + 12, y + 27, 5, 14, light);
    panel(ctx, x + w - 34, y + 18, 4, 12, light);
  } else if (type === "Psychic") {
    for (let i = 0; i < 4; i += 1) {
      const sx = x + 18 + i * 34;
      const sy = y + 14 + (i % 2) * 12;
      panel(ctx, sx + 3, sy, 2, 10, light);
      panel(ctx, sx, sy + 4, 10, 2, light);
    }
  } else if (type === "Fighting") {
    for (let i = 0; i < 4; i += 1) {
      const sx = x + 14 + ((i * 37) % (w - 34));
      const sy = y + horizon + 6 + ((i * 17) % 26);
      panel(ctx, sx, sy, 12, 6, deep);
      panel(ctx, sx, sy, 6, 3, mix(pal.deep, "#ffffff", 0.3));
    }
  } else {
    panel(ctx, x + 18, y + 16, 30, 6, "rgba(255,255,255,0.8)");
    panel(ctx, x + 26, y + 10, 18, 6, "rgba(255,255,255,0.8)");
    panel(ctx, x + w - 48, y + 34, 26, 5, "rgba(255,255,255,0.7)");
  }
}

function drawSprite(ctx, sprite, cx, bottom) {
  if (!sprite) return;
  const scale = sprite.width * 2 <= 150 && sprite.height * 2 <= 116 ? 2 : 1;
  const w = sprite.width * scale;
  const h = sprite.height * scale;
  const x = Math.round(cx - w / 2);
  const y = Math.round(bottom - h);
  ctx.fillStyle = "rgba(23,20,38,0.22)";
  ctx.fillRect(x + 6, bottom - 2, w - 12, 3);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, x, y, w, h);
}

function moveRow(ctx, card, move, y) {
  const costs = move.cost || [];
  costs.forEach((type, i) => drawTypeBadge(ctx, type, 12 + i * 14, y, 12));
  const cursor = 12 + costs.length * 14 + (costs.length ? 6 : 0);
  const dmgW = textWidth(move.display, DAMAGE, 1, 0);
  const nameMax = 168 - cursor - dmgW - 6;
  const name = fitText(ctx, move.name, Math.max(20, nameMax), SMALL, 1, 0);
  drawText(ctx, name, cursor, y + 1, { size: SMALL, color: INK, tracking: 0 });
  drawText(ctx, move.display, 168 - dmgW, y - 1, { size: DAMAGE, color: INK, tracking: 0 });
  if (move.effect) {
    drawText(ctx, fitText(ctx, move.effect, 156, SMALL, 1, 0), 12, y + 16, {
      size: SMALL,
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

  chamfer(ctx, 0, 0, CARD_W, CARD_H, INK, 8);
  chamfer(ctx, 2, 2, CARD_W - 4, CARD_H - 4, frame, 7);
  chamfer(ctx, 7, 7, CARD_W - 14, CARD_H - 14, INK, 5);
  chamfer(ctx, 8, 8, CARD_W - 16, CARD_H - 16, CREAM, 4);

  ctx.fillStyle = shade(frame, 0.3);
  ctx.fillRect(10, 2, CARD_W - 24, 2);
  ctx.fillRect(2, 10, 2, CARD_H - 24);
  ctx.fillStyle = shade(frame, -0.32);
  ctx.fillRect(10, CARD_H - 4, CARD_W - 24, 2);
  ctx.fillRect(CARD_W - 4, 10, 2, CARD_H - 24);

  ctx.fillStyle = shade(CREAM, 0.55);
  ctx.fillRect(9, 8, CARD_W - 18, 2);

  /* rarity accents */
  ctx.fillStyle = rarityColour;
  ctx.fillRect(12, CARD_H - 12, CARD_W - 24, 2);
  if (gold) {
    ctx.fillStyle = "rgba(232,178,58,0.45)";
    ctx.fillRect(10, 12, 1, CARD_H - 24);
    ctx.fillRect(CARD_W - 11, 12, 1, CARD_H - 24);
  }

  /* header */
  const stageLabel = card.rarity === "legend" ? "LEGEND" : card.stage === 0 ? "BASIC" : card.stage === 1 ? "STAGE 1" : "STAGE 2";
  drawText(ctx, `${stageLabel}  LV.${card.level}`, 12, 11, {
    size: SMALL,
    color: shade(pal.deep, 0.05),
    tracking: 0,
  });
  const hpText = String(card.hp);
  const hpW = textWidth(hpText, NAME, 1, 0);
  drawText(ctx, hpText, 168 - hpW, 6, { size: NAME, color: HP_RED, tracking: 0 });
  drawText(ctx, "HP", 168 - hpW - 26, 11, { size: SMALL, color: shade(pal.deep, 0.05), tracking: 0 });

  drawText(ctx, fitText(ctx, card.name, 156, NAME, 1, 0), 12, 25, {
    size: NAME,
    color: INK,
    tracking: 0,
  });

  /* art window */
  const ax = 12;
  const ay = 48;
  const aw = 156;
  const ah = 124;
  panel(ctx, ax - 2, ay - 2, aw + 4, ah + 4, INK);
  panel(ctx, ax - 1, ay - 1, aw + 2, ah + 2, shade(frame, -0.18));
  ctx.save();
  ctx.beginPath();
  ctx.rect(ax, ay, aw, ah);
  ctx.clip();
  artScene(ctx, card.tcg, ax, ay, aw, ah);
  drawSprite(ctx, sprite, ax + aw / 2, ay + ah - 8);
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillRect(ax, ay, aw, 1);
  ctx.fillRect(ax, ay, 1, ah);
  ctx.fillStyle = "rgba(23,20,38,0.4)";
  ctx.fillRect(ax, ay + ah - 1, aw, 1);
  ctx.fillRect(ax + aw - 1, ay, 1, ah);

  drawTypeBadge(ctx, card.tcg, ax + 2, ay + 2, 24);

  if (card.shiny) {
    const tag = "SHINY ✦";
    const tw = textWidth(tag, SMALL, 1, 0) + 12;
    panel(ctx, ax + aw - tw - 4, ay + 4, tw, 16, "rgba(23,20,38,0.88)");
    drawText(ctx, tag, ax + aw - tw + 2, ay + 7, { size: SMALL, color: "#ffe27a", tracking: 0 });
  }

  /* info strip */
  const numText = String(card.id).padStart(3, "0");
  const numW = textWidth(numText, SMALL, 1, 0);
  drawText(ctx, fitText(ctx, `NO.${numText} ${card.genus}`, 168 - numW - 30, SMALL, 1, 0), 12, 178, {
    size: SMALL,
    color: shade(pal.deep, 0.1),
    tracking: 0,
  });
  drawText(ctx, numText, 168 - numW, 178, { size: SMALL, color: INK, tracking: 0 });
  drawText(ctx, RARITY_MARK[card.rarity], 168 - numW - 15, 178, {
    size: SMALL,
    color: rarityColour,
    tracking: 0,
  });

  panel(ctx, 10, 191, CARD_W - 20, 2, mix(pal.frame, CREAM, 0.35));

  moveRow(ctx, card, card.moves[0], 197);
  panel(ctx, 10, 224, CARD_W - 20, 1, mix(pal.frame, CREAM, 0.6));
  if (card.moves[1]) {
    moveRow(ctx, card, card.moves[1], 230);
  } else {
    const total = Math.round((card.height || 0) * 39.3701);
    const feet = Math.floor(total / 12);
    const inches = total % 12;
    const lb = Math.round((card.weight || 0) * 2.2046);
    drawText(ctx, `HT ${feet}'${String(inches).padStart(2, "0")}"   WT ${lb} LB`, 12, 230, {
      size: SMALL,
      color: INK,
      tracking: 0,
    });
  }

  /* footer */
  const footY = 258;
  drawText(ctx, "WK", 12, footY, { size: SMALL, color: shade(pal.deep, 0.15), tracking: 0 });
  drawTypeBadge(ctx, card.weakness, 30, footY - 4, 12);
  drawText(ctx, "X2", 46, footY, { size: SMALL, color: INK, tracking: 0 });
  drawText(ctx, "RES", 66, footY, { size: SMALL, color: shade(pal.deep, 0.15), tracking: 0 });
  if (card.resistance) {
    drawTypeBadge(ctx, card.resistance, 86, footY - 4, 12);
    drawText(ctx, "-30", 102, footY, { size: SMALL, color: INK, tracking: 0 });
  } else {
    drawText(ctx, "--", 86, footY, { size: SMALL, color: INK, tracking: 0 });
  }
  drawText(ctx, "RET", 126, footY, { size: SMALL, color: shade(pal.deep, 0.15), tracking: 0 });
  drawText(ctx, String(card.retreat || 0), 150, footY, { size: SMALL, color: INK, tracking: 0 });

  return canvas;
}

export function renderCardBack() {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  panel(ctx, 0, 0, CARD_W, CARD_H, INK);
  chamfer(ctx, 3, 3, CARD_W - 6, CARD_H - 6, "#20305c", 7);
  chamfer(ctx, 6, 6, CARD_W - 12, CARD_H - 12, "#16223f", 5);
  chamfer(ctx, 9, 9, CARD_W - 18, CARD_H - 18, "#101a31", 4);

  /* clean diagonal pinstripes, spaced well apart */
  ctx.fillStyle = "#182741";
  for (let d = -CARD_H; d < CARD_W + CARD_H; d += 22) {
    for (let y = 14; y < CARD_H - 14; y += 1) {
      const x = d + y;
      if (x >= 14 && x < CARD_W - 16) ctx.fillRect(x, y, 2, 1);
    }
  }
  ctx.fillStyle = "#c8a24a";
  ctx.fillRect(14, 16, CARD_W - 28, 2);
  ctx.fillRect(14, CARD_H - 18, CARD_W - 28, 2);

  const cx = CARD_W / 2;
  const cy = 112;
  const r = 44;
  for (let y = -r - 2; y <= r + 2; y += 1) {
    for (let x = -r - 2; x <= r + 2; x += 1) {
      const d = Math.hypot(x, y);
      if (d > r + 2) continue;
      ctx.fillStyle = d > r ? INK : y < 0 ? "#c8281e" : "#f7f0d9";
      ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }
  panel(ctx, cx - r, cy - 3, r * 2, 6, INK);
  for (let y = -12; y <= 12; y += 1) {
    for (let x = -12; x <= 12; x += 1) {
      const d = Math.hypot(x, y);
      if (d > 12) continue;
      ctx.fillStyle = d > 8 ? INK : "#f7f0d9";
      ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }

  const label = "KANTO 151";
  const lw = textWidth(label, 14, 1, 0);
  drawText(ctx, label, Math.round((CARD_W - lw) / 2), 176, {
    size: 14,
    color: "#f7f0d9",
    tracking: 0,
  });
  const sub = "TRADE - PLAY - COLLECT";
  const sw = textWidth(sub, SMALL, 1, 0);
  drawText(ctx, sub, Math.round((CARD_W - sw) / 2), 200, {
    size: SMALL,
    color: "#8fa6d8",
    tracking: 0,
  });
  const note = "FAN PROJECT";
  const nw = textWidth(note, 7, 1, 0);
  drawText(ctx, note, Math.round((CARD_W - nw) / 2), CARD_H - 30, {
    size: 7,
    color: "#5d6f9c",
    tracking: 0,
  });
  return canvas;
}
