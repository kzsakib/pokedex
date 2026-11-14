/* Crisp 1-bit text: system type rendered once, alpha-thresholded, cached.
   Every glyph becomes solid pixels, so it stays sharp at 1x and 2x. */
const cache = new Map();
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:;!?'\"-+/()&%x×♀♂●◆★✦#@*";

function glyph(ch, size, weight, colour) {
  const key = `${ch}|${size}|${weight}|${colour}`;
  if (cache.has(key)) return cache.get(key);
  const font = `${weight} ${size}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
  const probe = glyph.probe || (glyph.probe = document.createElement("canvas").getContext("2d"));
  probe.font = font;
  const w = Math.max(1, Math.ceil(probe.measureText(ch).width) + 1);
  const h = Math.ceil(size * 1.4);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.font = font;
  ctx.textBaseline = "top";
  ctx.fillStyle = colour;
  ctx.fillText(ch, 0, Math.round(size * 0.1));
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 110) {
      px[i + 3] = 0;
    } else {
      px[i + 3] = 255;
    }
  }
  ctx.putImageData(data, 0, 0);
  const entry = { canvas, width: w, height: h, top: 0 };
  cache.set(key, entry);
  return entry;
}

export function textWidth(text, size = 8, scale = 1, tracking = 1, weight = 700) {
  let width = 0;
  const str = normalise(text);
  for (let i = 0; i < str.length; i += 1) {
    const ch = str[i];
    if (ch === " ") {
      width += Math.round(size * 0.42) * scale + tracking;
      continue;
    }
    const g = glyph(CHARS.includes(ch) ? ch : "?", size, weight, "#fff");
    width += g.width * scale + tracking;
  }
  return Math.max(0, width - tracking);
}

const ACCENTS = { "É": "E", "È": "E", "Ê": "E", "Á": "A", "À": "A", "Ä": "A", "Í": "I", "Ó": "O", "Ö": "O", "Ú": "U", "Ü": "U", "Ñ": "N", "Ç": "C" };
function normalise(text) {
  return String(text)
    .toUpperCase()
    .replace(/[ÉÈÊÁÀÄÍÓÖÚÜÑÇ]/g, (c) => ACCENTS[c] || c);
}

export function drawText(ctx, text, x, y, { size = 8, scale = 1, color = "#000", tracking = 1, weight = 700 } = {}) {
  const str = normalise(text);
  ctx.imageSmoothingEnabled = false;
  let cursor = Math.round(x);
  const top = Math.round(y);
  for (let i = 0; i < str.length; i += 1) {
    const ch = str[i];
    if (ch === " ") {
      cursor += Math.round(size * 0.42) * scale + tracking;
      continue;
    }
    const g = glyph(CHARS.includes(ch) ? ch : "?", size, weight, color);
    ctx.drawImage(g.canvas, cursor, top, g.width * scale, g.height * scale);
    cursor += g.width * scale + tracking;
  }
  return cursor - x;
}

export function fitText(ctx, text, maxWidth, size = 8, scale = 1, tracking = 1, weight = 700) {
  let str = normalise(text);
  if (textWidth(str, size, scale, tracking, weight) <= maxWidth) return str;
  while (str.length > 2 && textWidth(`${str}..`, size, scale, tracking, weight) > maxWidth) {
    str = str.slice(0, -1);
  }
  return `${str.trim()}..`;
}

/** Convenience: draw right-aligned text and return its width. */
export function drawRight(ctx, text, right, y, opts = {}) {
  const w = textWidth(text, opts.size ?? 8, opts.scale ?? 1, opts.tracking ?? 1, opts.weight ?? 700);
  drawText(ctx, text, right - w, y, opts);
  return w;
}
