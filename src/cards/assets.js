/* Static data + sprite loading. Sprites are trimmed to their alpha box and
   recoloured for shiny cards, all in the browser at load time. */

const BASE = (import.meta.env && import.meta.env.BASE_URL) || "/";
const spriteCache = new Map();
const shinyCache = new Map();

let dataPromise = null;

export function loadGen1() {
  if (!dataPromise) {
    dataPromise = fetch(`${BASE}cards/data/gen1.json`).then((res) => {
      if (!res.ok) throw new Error(`gen1.json ${res.status}`);
      return res.json();
    });
  }
  return dataPromise;
}

const spriteUrl = (id) => `${BASE}cards/sprites/${String(id).padStart(3, "0")}.png`;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`sprite failed: ${url}`));
    img.src = url;
  });
}

function trim(img) {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] < 24) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return canvas;
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  /* shrink oversized sprites proportionally instead of cropping their edges */
  const s = Math.min(1, 54 / bw, 54 / bh);
  const w = Math.max(1, Math.round(bw * s));
  const h = Math.max(1, Math.round(bh * s));
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const octx = out.getContext("2d");
  octx.imageSmoothingEnabled = false;
  octx.drawImage(canvas, minX, minY, bw, bh, 0, 0, w, h);
  return out;
}

/* Rotate the hue of the body tones, leave the dark ink and the near-white
   highlight alone so the silhouette keeps its outline. */
function shinyFrom(sprite) {
  const canvas = document.createElement("canvas");
  canvas.width = sprite.width;
  canvas.height = sprite.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 40) continue;
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max < 0.16 || l > 0.93) continue;
    let h = 0;
    const d = max - min || 1e-6;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 140) % 360;
    if (h < 0) h += 360;
    const s = d / (1 - Math.abs(2 * l - 1) || 1);
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let nr = 0;
    let ng = 0;
    let nb = 0;
    if (h < 60) [nr, ng, nb] = [c, x, 0];
    else if (h < 120) [nr, ng, nb] = [x, c, 0];
    else if (h < 180) [nr, ng, nb] = [0, c, x];
    else if (h < 240) [nr, ng, nb] = [0, x, c];
    else if (h < 300) [nr, ng, nb] = [x, 0, c];
    else [nr, ng, nb] = [c, 0, x];
    data[i] = Math.round((nr + m) * 255);
    data[i + 1] = Math.round((ng + m) * 255);
    data[i + 2] = Math.round((nb + m) * 255);
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export async function loadSprite(id) {
  if (spriteCache.has(id)) return spriteCache.get(id);
  const img = await loadImage(spriteUrl(id));
  const sprite = trim(img);
  spriteCache.set(id, sprite);
  return sprite;
}

export async function loadShiny(id) {
  if (shinyCache.has(id)) return shinyCache.get(id);
  const base = await loadSprite(id);
  const shiny = shinyFrom(base);
  shinyCache.set(id, shiny);
  return shiny;
}

export async function preloadSprites(onProgress) {
  const ids = Array.from({ length: 151 }, (_, i) => i + 1);
  let done = 0;
  const queue = ids.slice();
  async function worker() {
    while (queue.length) {
      const id = queue.shift();
      try {
        await loadSprite(id);
      } catch {
        /* a missing sprite should not block the pack */
      }
      done += 1;
      if (onProgress) onProgress(done, ids.length);
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* Multi-stop colour ramp: one sprite can carry several distinct colours at once. */
function rampColor(stops, t) {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 0; i < stops.length - 1; i += 1) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (x <= t1 || i === stops.length - 2) {
      const k = t1 === t0 ? 0 : (x - t0) / (t1 - t0);
      const a = hexToRgb(c0);
      const b = hexToRgb(c1);
      return [
        Math.round(a[0] + (b[0] - a[0]) * k),
        Math.round(a[1] + (b[1] - a[1]) * k),
        Math.round(a[2] + (b[2] - a[2]) * k),
      ];
    }
  }
  return hexToRgb(stops[stops.length - 1][1]);
}

/* Repaint a sprite with a shifted palette. Every pixel keeps its own lightness,
   so the pokemon's shapes survive while its colours are replaced wholesale. */
function recolorSprite(base, variant) {
  const canvas = document.createElement("canvas");
  canvas.width = base.width;
  canvas.height = base.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(base, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    const l = (max + min) / 2;
    let h = 0;
    let sat = 0;
    if (diff > 0.0001) {
      sat = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);
      if (max === r) h = (g - b) / diff + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / diff + 2;
      else h = (r - g) / diff + 4;
      h *= 60;
    }
    if (variant.hueMap) {
      const sector = Math.floor(h / 30) % 12;
      const target = variant.hueMap[sector];
      if (typeof target === "number") h = (target + (h % 30)) % 360;
    }
    if (typeof variant.targetHue === "number") {
      const delta = ((variant.targetHue - h + 540) % 360) - 180;
      h = (h + delta * (variant.hueMix ?? 0.7) + 360) % 360;
    }
    sat = Math.min(1, sat * (variant.sat ?? 1));
    let nl = variant.invert ? 1 - l : l;
    nl = Math.min(1, Math.max(0, nl * (variant.light ?? 1)));
    let out = hslToRgb(h, sat, nl);
    /* hue moved, brightness did not: each shade is lifted toward white (or
       pulled down) until it carries the luminance the source pixel had, so a
       pale highlight stays pale and an outline stays dark after the swap */
    if (!variant.invert && !variant.ramp && !variant.swap && (variant.hueMap || typeof variant.targetHue === "number")) {
      const srcY = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      let c0 = out[0] / 255;
      let c1 = out[1] / 255;
      let c2 = out[2] / 255;
      const gotY = 0.2126 * c0 + 0.7152 * c1 + 0.0722 * c2;
      if (srcY > 0.004 && gotY < srcY) {
        const mix = (srcY - gotY) / Math.max(0.02, 1 - gotY); /* toward white */
        c0 += (1 - c0) * mix;
        c1 += (1 - c1) * mix;
        c2 += (1 - c2) * mix;
      } else if (gotY > 0.004 && gotY > srcY) {
        const k = srcY / gotY;
        c0 *= k;
        c1 *= k;
        c2 *= k;
      }
      out = [Math.round(c0 * 255), Math.round(c1 * 255), Math.round(c2 * 255)];
    }
    if (variant.ramp) out = rampColor(variant.ramp, nl);
    if (variant.swap) {
      const v = [out[0], out[1], out[2]];
      out = [v[variant.swap[0]], v[variant.swap[1]], v[variant.swap[2]]];
    }
    data[i] = out[0];
    data[i + 1] = out[1];
    data[i + 2] = out[2];
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

const chromaCache = new Map();

export async function chromaSprite(id, variant) {
  const key = `${id}:${variant.key}`;
  if (chromaCache.has(key)) return chromaCache.get(key);
  const base = await loadSprite(id);
  const out = recolorSprite(base, variant);
  chromaCache.set(key, out);
  return out;
}

export async function spriteFor(card) {
  if (card.variant) return chromaSprite(card.id, card.variant);
  return card.shiny ? loadShiny(card.id) : loadSprite(card.id);
}
