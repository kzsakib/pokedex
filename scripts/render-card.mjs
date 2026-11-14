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
    drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh) {
      if (!src || !src.__buf) return;
      if (arguments.length === 3) { sx = 0; sy = 0; sw = src.width; sh = src.height; dx = arguments[1]; dy = arguments[2]; dw = sw; dh = sh; }
      else if (arguments.length === 5) { sx = 0; sy = 0; sw = src.width; sh = src.height; dx = arguments[1]; dy = arguments[2]; dw = arguments[3]; dh = arguments[4]; }
      for (let j = 0; j < dh; j++) {
        for (let i = 0; i < dw; i++) {
          const sxp = Math.floor(sx + (i * sw) / dw);
          const syp = Math.floor(sy + (j * sh) / dh);
          const so = (syp * src.width + sxp) * 4;
          if (src.__buf[so + 3] < 8) continue;
          const px = dx + i, py = dy + j;
          if (px < 0 || py < 0 || px >= w || py >= h) continue;
          const o = (py * w + px) * 4;
          buf[o] = src.__buf[so]; buf[o + 1] = src.__buf[so + 1]; buf[o + 2] = src.__buf[so + 2]; buf[o + 3] = 255;
        }
      }
    },
    strokeRect() {},
    getImageData() { return { data: new Uint8ClampedArray(buf) }; },
    putImageData(img) { buf.set(img.data); },
  };
  return { width: w, height: h, getContext: () => ctx, __buf: buf };
}
globalThis.document = { createElement: () => makeCanvas(160, 224) };
const { renderCard } = await import("../src/cards/cardRenderer.js");

const single = process.argv[2] === "single";
const card = single ? {
  id: 54, name: "Psyduck", genus: "Duck Pokémon", tcg: "Water", stage: 0, level: 12, hp: 50,
  rarity: "common", shiny: false, finish: "reverse",
  moves: [{ name: "Bubblebeam", cost: ["Water", "Water", "Colorless"], effect: "Recoil: 10 damage", damage: 20, display: "20x" }],
  weakness: "Lightning", resistance: null, retreat: 1, height: 0.8, weight: 20,
} : {
  id: 48, name: "Venonat", genus: "Insect Pokémon", tcg: "Grass", stage: 0, level: 16, hp: 50,
  rarity: "legend", shiny: false, finish: "prism",
  moves: [
    { name: "Sleep Powder", cost: ["Grass", "Grass"], effect: "Heads: Paralyzed", damage: null },
    { name: "Psychic", cost: ["Grass", "Colorless"], effect: "Discard 1 Energy", damage: 40, display: "40+" },
  ],
  weakness: "Fire", resistance: null, retreat: 1, height: 1.0, weight: 30,
};
const raw = fs.readFileSync(`artifacts/s${Number(process.argv[3] || 108)}.rgba`);
let minX = 64, minY = 64, maxX = -1, maxY = -1;
for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
  if (raw[(y * 64 + x) * 4 + 3] < 24) continue;
  if (x < minX) minX = x; if (x > maxX) maxX = x;
  if (y < minY) minY = y; if (y > maxY) maxY = y;
}
const bw = maxX - minX + 1, bh = maxY - minY + 1;
const sfit = Math.min(1, 54 / bw, 54 / bh);
const tw = Math.max(1, Math.round(bw * sfit)), th = Math.max(1, Math.round(bh * sfit));
const spr = makeCanvas(tw, th);
for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
  const sx2 = minX + Math.floor((x * bw) / tw), sy2 = minY + Math.floor((y * bh) / th);
  const so = (sy2 * 64 + sx2) * 4, o = (y * tw + x) * 4;
  spr.__buf[o] = raw[so]; spr.__buf[o + 1] = raw[so + 1]; spr.__buf[o + 2] = raw[so + 2]; spr.__buf[o + 3] = raw[so + 3];
}
console.log("sprite", tw, "x", th, "from", bw, "x", bh);

const c = renderCard(card, spr);
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
fs.writeFileSync(single ? "artifacts/render-single.png" : "artifacts/render-check.png", png(W, H, out));
console.log("wrote artifacts/render-check.png");
