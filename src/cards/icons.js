/* TCG type badges, drawn from 9x9 glyph bitmaps and sampled to any size. */

export const TYPE_COLOURS = {
  Fire: { frame: "#d9562b", deep: "#8f2c17", light: "#f7b06b", ink: "#2a1208" },
  Water: { frame: "#3f8fd9", deep: "#22527f", light: "#a8d9f7", ink: "#0a1d2e" },
  Grass: { frame: "#4aa84a", deep: "#26682d", light: "#b6e29b", ink: "#0d240f" },
  Lightning: { frame: "#f2c230", deep: "#9c7413", light: "#fff0a8", ink: "#2b2105" },
  Psychic: { frame: "#a65fc9", deep: "#5f2f7c", light: "#e3b8f2", ink: "#20102a" },
  Fighting: { frame: "#b5703a", deep: "#6d3d1c", light: "#efc39b", ink: "#26150a" },
  Colorless: { frame: "#b8b8b8", deep: "#6d6d72", light: "#f2f2ee", ink: "#20202a" },
};

const GLYPH = {
  Fire: [
    "....#....",
    "...#.#...",
    "...#.#...",
    "..##.##..",
    "..#####..",
    ".##.###..",
    ".#######.",
    "..#####..",
    "...#.#...",
  ],
  Water: [
    "....#....",
    "....#....",
    "...###...",
    "..#####..",
    ".#######.",
    ".#######.",
    "..#####..",
    "...###...",
    ".........",
  ],
  Grass: [
    ".....##..",
    "....####.",
    "...####..",
    "..####...",
    ".####....",
    ".###.....",
    ".##......",
    ".#.......",
    ".........",
  ],
  Lightning: [
    "....###..",
    "...###...",
    "..###....",
    ".######..",
    "...###...",
    "..###....",
    ".###.....",
    ".#.......",
    ".........",
  ],
  Psychic: [
    "...###...",
    ".##...##.",
    ".#.....#.",
    "#..###..#",
    "#.#...#.#",
    "#..###..#",
    ".#.....#.",
    ".##...##.",
    "...###...",
  ],
  Fighting: [
    "..#.#.#..",
    ".#######.",
    ".#######.",
    ".#######.",
    "..#####..",
    "...###...",
    "....#....",
    ".........",
    ".........",
  ],
  Colorless: [
    "....#....",
    "...#.#...",
    "#########",
    ".#######.",
    "..#####..",
    ".###.###.",
    ".#.....#.",
    ".........",
    ".........",
  ],
};

function plot(ctx, colour, x, y) {
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, 1, 1);
}

function circleMask(size, x, y) {
  const cx = (size - 1) / 2;
  const r = size / 2 + 0.15;
  return (px, py) => (px - cx) ** 2 + (py - cx) ** 2 <= r * r;
}

/** Draw a type badge. `size` is the pixel diameter (5, 7 or 9). */
export function drawTypeBadge(ctx, type, x, y, size = 7, { plain = false } = {}) {
  const palette = TYPE_COLOURS[type] || TYPE_COLOURS.Colorless;
  const inside = circleMask(size);
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      if (!inside(px, py)) continue;
      const edge = !inside(px - 1, py) || !inside(px + 1, py) || !inside(px, py - 1) || !inside(px, py + 1);
      const shade = py > size * 0.62 ? palette.deep : palette.frame;
      ctx.fillStyle = plain ? "rgba(0,0,0,0.25)" : edge ? palette.ink : shade;
      ctx.fillRect(x + px, y + py, 1, 1);
    }
  }
  /* glyph sampled from the 9x9 grid */
  const glyph = GLYPH[type] || GLYPH.Colorless;
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      if (!inside(px, py)) continue;
      const gx = Math.min(8, Math.floor((px * 9) / size));
      const gy = Math.min(8, Math.floor((py * 9) / size));
      if (glyph[gy][gx] !== "#") continue;
      ctx.fillStyle = plain ? "#1a1a2e" : "rgba(255,255,255,0.92)";
      ctx.fillRect(x + px, y + py, 1, 1);
    }
  }
  return size;
}

export function drawEnergyRow(ctx, types, x, y, size = 7, gap = 1) {
  let cursor = x;
  for (const type of types) {
    drawTypeBadge(ctx, type, cursor, y, size);
    cursor += size + gap;
  }
  return cursor - x;
}
