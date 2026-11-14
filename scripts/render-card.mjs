import fs from "node:fs";
import zlib from "node:zlib";

const CRC = (() => { const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return (buf) => { let c = -1; for (const b of buf) c = t[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
})();
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
function parseColour(style) {
  if (typeof style !== "string") return [0, 0, 0, 255];
  if (style[0] === "#") {
    const h = style.slice(1);
    const v = h.length === 3 ? h.split("").map((c) => parseInt(c + c, 16)) : [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    return [v[0], v[1], v[2], 255];
  }
  const m = style.match(/rgba?\(([^)]+)\)/);
  if (m) { const p = m[1].split(",").map((s) => parseFloat(s)); return [p[0], p[1], p[2], Math.round((p[3] ?? 1) * 255)]; }
  return [0, 0, 0, 255];
}
function makeCanvas(w, h) {
  const buf = Buffer.alloc(w * h * 4);
  const ctx = {
    fillStyle: "#000", imageSmoothingEnabled: false,
    clearRect(x, y, cw, ch) { for (let j = y; j < y + ch; j++) for (let i = x; i < x + cw; i++) if (i >= 0 && j >= 0 && i < w && j < h) buf.fill(0, (j * w + i) * 4, (j * w + i) * 4 + 4); },
    fillRect(x, y, rw, rh) {
      const [r, g, b, a] = parseColour(this.fillStyle);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      for (let j = Math.round(y); j < Math.round(y) + Math.round(rh); j++) {
        for (let i = Math.round(x); i < Math.round(x) + Math.round(rw); i++) {
          if (i < 0 || j < 0 || i >= w || j >= h) continue;
          const o = (j * w + i) * 4;
          if (a >= 255) { buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; buf[o + 3] = 255; }
          else { const t = a / 255; buf[o] = Math.round(buf[o] * (1 - t) + r * t); buf[o + 1] = Math.round(buf[o + 1] * (1 - t) + g * t); buf[o + 2] = Math.round(buf[o + 2] * (1 - t) + b * t); buf[o + 3] = 255; }
        }
      }
    },
    drawImage() {}, strokeRect() {},
  };
  return { width: w, height: h, getContext: () => ctx, __buf: buf };
}
globalThis.document = { createElement: () => makeCanvas(160, 224) };
const { renderCard } = await import("../src/cards/cardRenderer.js");

const card = {
  id: 48, name: "Venonat", genus: "Insect Pokémon", tcg: "Grass", stage: 0, level: 16, hp: 50,
  rarity: "legend", shiny: false, finish: "prism",
  moves: [
    { name: "Sleep Powder", cost: ["Grass", "Grass"], effect: "Heads: Paralyzed", damage: null },
    { name: "Psychic", cost: ["Grass", "Colorless"], effect: "Discard 1 Energy", damage: 40, display: "40+" },
  ],
  weakness: "Fire", resistance: null, retreat: 1, height: 1.0, weight: 30,
};
const c = renderCard(card, null);
const k = 3, W = 160 * k, H = 224 * k;
const out = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const s = ((Math.floor(y / k)) * 160 + Math.floor(x / k)) * 4;
  const d = (y * W + x) * 4;
  const a = c.__buf[s + 3] / 255;
  out[d] = Math.round(c.__buf[s] * a + 246 * (1 - a));
  out[d + 1] = Math.round(c.__buf[s + 1] * a + 244 * (1 - a));
  out[d + 2] = Math.round(c.__buf[s + 2] * a + 236 * (1 - a));
  out[d + 3] = 255;
}
fs.writeFileSync("artifacts/render-check.png", png(W, H, out));
console.log("wrote artifacts/render-check.png");
