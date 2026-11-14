/* Holo mask textures: art window for Holo Rare, whole card for Legend. */
export const CARD_W = 160;
export const CARD_H = 264;

export function makeHoloMask(rarity) {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = "#fff";
  if (rarity === "legend") {
    for (let y = 8; y < CARD_H - 8; y += 1) ctx.fillRect(8, y, CARD_W - 16, 1);
  } else if (rarity === "holo") {
    for (let y = 46; y < 150; y += 1) ctx.fillRect(12, y, 136, 1);
  }
  return canvas;
}

export function holoDensityFor(rarity) {
  if (rarity === "legend") return 0.26;
  if (rarity === "holo") return 0.18;
  return 0;
}
