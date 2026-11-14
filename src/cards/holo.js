/* Holo mask textures: art window for Holo Rare, whole card for Legend. */
import { CARD_W, CARD_H } from "./cardRenderer.js";

export { CARD_W, CARD_H };

export function makeHoloMask(rarity) {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = "#fff";
  if (rarity === "legend") {
    for (let y = 6; y < CARD_H - 6; y += 1) ctx.fillRect(6, y, CARD_W - 12, 1);
  } else if (rarity === "holo") {
    /* full-card iridescent sheet, art window a touch stronger */
    for (let y = 6; y < CARD_H - 6; y += 1) ctx.fillRect(6, y, CARD_W - 12, 1);
    for (let y = 39; y < 143; y += 1) ctx.fillRect(10, y, 140, 1);
  }
  return canvas;
}

export function holoDensityFor(rarity) {
  if (rarity === "legend") return 0.4;
  if (rarity === "holo") return 0.3;
  return 0;
}
