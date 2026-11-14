/* Type badges drawn on a 12x12 grid, scaled only by whole numbers. */

export const TYPE_COLOURS = {
  Fire: { frame: "#e0572a", deep: "#8f2c17", light: "#ffc07a", ink: "#2a1208" },
  Water: { frame: "#3d90dd", deep: "#1f4f80", light: "#a8dcff", ink: "#08192a" },
  Grass: { frame: "#4fae53", deep: "#256a2f", light: "#c2ecab", ink: "#0a2210" },
  Lightning: { frame: "#f5c62f", deep: "#9a7310", light: "#fff2ad", ink: "#2b2105" },
  Psychic: { frame: "#ab63cf", deep: "#5c2f7b", light: "#e7c0f7", ink: "#1d0e28" },
  Fighting: { frame: "#bc753c", deep: "#6b3c1b", light: "#f4cba4", ink: "#231208" },
  Colorless: { frame: "#c3c0cc", deep: "#6d6a7d", light: "#f7f4ea", ink: "#1c1a26" },
};

/* 12x12 glyphs, one character per pixel. */
const GLYPH = {
  Fire: [
    "............",
    ".....1......",
    "....131.....",
    "....131.....",
    "...11311....",
    "...13331....",
    "..1133311...",
    "..1333331...",
    ".113333311..",
    ".133333331..",
    "..1333331...",
    "...11111....",
  ],
  Water: [
    ".....11.....",
    ".....11.....",
    "....1331....",
    "....1331....",
    "...133331...",
    "..13333331..",
    "..13333331..",
    ".1333333331.",
    ".1333333331.",
    "..13333331..",
    "...111111...",
    "............",
  ],
  Grass: [
    "......111...",
    ".....13331..",
    "....133331..",
    "...133331...",
    "..133331....",
    ".133331.....",
    ".13331......",
    ".1331.......",
    ".131........",
    ".11.........",
    "............",
    "............",
  ],
  Lightning: [
    ".....111....",
    "....1331....",
    "...1331.....",
    "..1331......",
    ".1333311....",
    ".11333331...",
    "....13331...",
    "...13331....",
    "..13331.....",
    "..1331......",
    ".1331.......",
    ".111........",
  ],
  Psychic: [
    "....1111....",
    "..11333311..",
    ".1333113331.",
    ".1331..1331.",
    "1331....1331",
    "1331....1331",
    "1331....1331",
    ".1331..1331.",
    ".1333113331.",
    "..11333311..",
    "....1111....",
    "............",
  ],
  Fighting: [
    "..1.1.1.1...",
    ".1331331331.",
    ".1333333331.",
    ".1333333331.",
    ".1333333331.",
    "..13333331..",
    "...133331...",
    "....1331....",
    "....1331....",
    "....1111....",
    "............",
    "............",
  ],
  Colorless: [
    ".....11.....",
    "....1331....",
    "111333333111",
    "133333333331",
    "133333333331",
    ".1333333331.",
    "..13333331..",
    ".133133331..",
    ".131..1331..",
    ".11....131..",
    "........1...",
    "............",
  ],
};

const cache = new Map();

function glyphCanvas(type) {
  if (cache.has(type)) return cache.get(type);
  const rows = GLYPH[type] || GLYPH.Colorless;
  const canvas = document.createElement("canvas");
  canvas.width = 12;
  canvas.height = 12;
  const ctx = canvas.getContext("2d");
  const pal = TYPE_COLOURS[type] || TYPE_COLOURS.Colorless;
  const cx = 5.5;
  const r = 5.6;
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 12; x += 1) {
      const d = Math.hypot(x - cx, y - cx);
      if (d > r) continue;
      const edge = d > r - 1.1;
      const shade = y > 7 ? pal.deep : y > 3 ? pal.frame : pal.light;
      ctx.fillStyle = edge ? pal.ink : shade;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 12; x += 1) {
      if (rows[y][x] !== "1") continue;
      ctx.fillStyle = y > 7 ? "rgba(255,255,255,0.9)" : "#ffffff";
      ctx.fillRect(x, y, 1, 1);
    }
  }
  cache.set(type, canvas);
  return canvas;
}

/** size is 12 or 24 (whole multiples of the grid). */
export function drawTypeBadge(ctx, type, x, y, size = 12) {
  const scale = size >= 24 ? 2 : 1;
  const src = glyphCanvas(type);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, x, y, 12 * scale, 12 * scale);
}

export function drawEnergyRow(ctx, types, x, y, size = 10, pitch = 12) {
  types.forEach((type, i) => drawTypeBadge(ctx, type, x + i * pitch, y, size));
}
