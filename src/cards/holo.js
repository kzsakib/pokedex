/* Holo mask textures: art-window-only for Holo Rare, whole card for Legend. */
export const CARD_W = 100;
export const CARD_H = 140;

export function makeHoloMask(rarity) {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = "#fff";
  if (rarity === "legend") {
    for (let y = 3; y < CARD_H - 2; y += 1) {
      ctx.fillRect(3, y, CARD_W - 6, 1);
    }
  } else if (rarity === "holo") {
    for (let y = 22; y < 84; y += 1) {
      ctx.fillRect(9, y, 82, 1);
    }
  }
  return canvas;
}

export function holoDensityFor(rarity) {
  if (rarity === "legend") return 0.42;
  if (rarity === "holo") return 0.34;
  return 0;
}
