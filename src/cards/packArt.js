/* Booster-pack textures at 176x352. Risograph-style: three flat tones stepped
   with a 4x4 ordered dither, hand-authored 5x7 pixel type, and one piece of
   art per set instead of a stack of labels. */
import { drawText as pixelText, textWidth as pixelWidth } from "./font.js";
import { typeIcon } from "./theme.js";

export const PACK_W = 176;
export const PACK_H = 352;
export const TEAR_Y = 30;

export const VARIANTS = {
  fire: {
    id: "fire",
    type: "fire",
    label: "FIRE",
    name: "CINNABAR EMBER",
    short: "EMBER",
    mascot: 6,
    base: "#cf5a24",
    light: "#ef8a45",
    deep: "#7d2c12",
    foil: "#ffd39a",
    accent: "#ffe07a",
  },
  water: {
    id: "water",
    type: "water",
    label: "WATER",
    name: "SEAFOAM TIDE",
    short: "TIDE",
    mascot: 9,
    base: "#2f74bd",
    light: "#5ea6e0",
    deep: "#10335c",
    foil: "#bfe6ff",
    accent: "#cdeeff",
  },
  grass: {
    id: "grass",
    type: "grass",
    label: "GRASS",
    name: "VIRIDIAN BLOOM",
    short: "BLOOM",
    mascot: 3,
    base: "#3a8f43",
    light: "#67b055",
    deep: "#123f1d",
    foil: "#c8efa0",
    accent: "#d8f5b4",
  },
};

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
  const A = rgb(a);
  const B = rgb(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

/* 4x4 ordered dither, the same lattice the cards use */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const bayer = (x, y) => (BAYER[y & 3][x & 3] + 0.5) / 16;
const dot = (ctx, x, y, colour) => {
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, 1, 1);
};

/* three flat tones stacked into one banded field, darker at both crimps */
function field(ctx, v) {
  const top = 22;
  const bottom = PACK_H - 22;
  const tones = [
    mix(v.deep, "#07090f", 0.62),
    mix(v.deep, "#07090f", 0.24),
    mix(v.deep, v.base, 0.55),
    v.base,
  ];
  for (let y = top; y < bottom; y += 1) {
    const ramp = ((y - top) / (bottom - top)) * 3;
    const edge = Math.min(y - top, bottom - 1 - y) / 46;
    const dim = edge < 1 ? (1 - edge) * 1.1 : 0;
    for (let x = 0; x < PACK_W; x += 1) {
      const lean = (x - PACK_W / 2) * 0.0032;
      const side = Math.max(0, (Math.abs(x - PACK_W / 2) - 62) / 26) * 0.7;
      const lvl = ramp - dim - side + lean + (bayer(x, y) - 0.5) * 0.85;
      const i = Math.max(0, Math.min(3, Math.round(lvl)));
      dot(ctx, x, y, tones[i]);
    }
  }
}

/* per-set motif, full bleed behind the hero */
function motif(ctx, v) {
  const top = 140;
  const bottom = PACK_H - 22;
  const ink = mix(v.light, v.deep, 0.32);
  const inkLit = mix(v.foil, v.deep, 0.14);

  if (v.id === "fire") {
    const tongues = [
      { cx: 30, h: 120, w: 30 },
      { cx: 92, h: 176, w: 40 },
      { cx: 150, h: 108, w: 26 },
    ];
    for (const t of tongues) {
      for (let yy = 0; yy < t.h; yy += 1) {
        const y = bottom - yy;
        if (y < top) continue;
        const k = yy / t.h;
        const half = Math.max(1, Math.round((t.w / 2) * (1 - k) ** 0.75));
        const wob = Math.round(Math.sin(yy * 0.11 + t.cx) * 3 * (1 - k));
        for (let x = t.cx - half + wob; x <= t.cx + half + wob; x += 1) {
          const edge = 1 - Math.abs(x - (t.cx + wob)) / (half + 1);
          if (bayer(x, y) < (0.26 + 0.62 * edge) * (1 - k * 0.55)) {
            dot(ctx, x, y, bayer(x + 1, y) < 0.3 ? inkLit : ink);
          }
        }
      }
    }
    for (let i = 0; i < 30; i += 1) {
      const x = (i * 61) % PACK_W;
      const y = top + ((i * 43) % (bottom - top));
      dot(ctx, x, y, mix(v.accent, "#ffffff", 0.25));
    }
  } else if (v.id === "water") {
    for (let band = 0; band < 6; band += 1) {
      const baseY = 176 + band * 27;
      for (let x = 0; x < PACK_W; x += 1) {
        const wave = Math.round(Math.sin(x * 0.075 + band * 0.8) * 6 + Math.sin(x * 0.019 + band) * 3);
        const y = baseY + wave;
        for (let d = 0; d < 8; d += 1) {
          if (bayer(x, y + d) < (1 - d / 8) * 0.7) dot(ctx, x, y + d, d < 2 ? inkLit : ink);
        }
      }
    }
    for (let i = 0; i < 40; i += 1) {
      const x = (i * 47) % PACK_W;
      const y = top + ((i * 67) % (bottom - top));
      dot(ctx, x, y, mix(v.accent, "#ffffff", 0.3));
    }
  } else {
    for (let i = 0; i < 8; i += 1) {
      const cx = 16 + ((i * 53) % 150);
      const cy = 150 + ((i * 79) % 170);
      const len = 40 + (i % 3) * 16;
      for (let k = 0; k < len; k += 1) {
        const x = cx + Math.round(k * 0.8);
        const y = cy + Math.round(k * 0.34);
        const half = Math.max(1, Math.round((1 - Math.abs(k - len / 2) / (len / 2)) * 10));
        for (let d = -half; d <= half; d += 1) {
          if (bayer(x, y + d) < (1 - Math.abs(d) / (half + 1)) * 0.78) {
            dot(ctx, x, y + d, Math.abs(d) < 2 ? inkLit : ink);
          }
        }
      }
    }
  }
}

/* sharp diagonal gloss: one bright stripe and two soft ones, all dithered */
function gloss(ctx, v, y0, y1) {
  const hot = mix(v.foil, "#ffffff", 0.55);
  const soft = mix(v.foil, v.base, 0.4);
  for (let y = y0; y < y1; y += 1) {
    for (let x = 0; x < PACK_W; x += 1) {
      const s = (x * 0.6 + y * 1.4) % 340;
      let cover = 0;
      let colour = soft;
      if (s > 88 && s < 118) {
        cover = 0.3;
      } else if (s >= 118 && s < 132) {
        cover = 0.52;
        colour = hot;
      } else if (s >= 132 && s < 150) {
        cover = 0.24;
      }
      if (cover > 0 && bayer(x, y) < cover) dot(ctx, x, y, colour);
    }
  }
}

/* printed sleeve: a solid foil strip down the left edge with tick marks */
function spine(ctx, v) {
  const x = 0;
  const w = 7;
  const top = 26;
  const bottom = PACK_H - 26;
  ctx.fillStyle = mix(v.deep, "#07090f", 0.5);
  ctx.fillRect(x, top, w, bottom - top);
  ctx.fillStyle = mix(v.foil, v.deep, 0.15);
  ctx.fillRect(x + w - 3, top, 1, bottom - top);
  ctx.fillStyle = mix(v.foil, "#ffffff", 0.35);
  for (let y = top + 8; y < bottom - 8; y += 14) ctx.fillRect(x + 2, y, 2, 5);
}

function crimp(ctx, v, top) {
  const h = 22;
  const y0 = top ? 0 : PACK_H - h;
  ctx.fillStyle = mix(v.deep, "#080a12", 0.55);
  ctx.fillRect(0, y0, PACK_W, h);
  for (let x = 0; x < PACK_W; x += 4) {
    ctx.fillStyle = mix(v.deep, v.base, 0.3);
    ctx.fillRect(x, y0 + 4, 2, h - 8);
    ctx.fillStyle = mix(v.deep, "#000000", 0.4);
    ctx.fillRect(x + 2, y0 + 4, 1, h - 8);
  }
  ctx.fillStyle = mix(v.foil, v.deep, 0.45);
  ctx.fillRect(0, top ? h - 1 : y0, PACK_W, 1);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(0, top ? h : y0 - 1, PACK_W, 1);
}

/* 1px chamfered border, drawn on whole pixels */
function frame(ctx, x, y, w, h, cut, colour) {
  ctx.fillStyle = colour;
  for (let k = 0; k < cut; k += 1) {
    ctx.fillRect(x + cut - k - 1, y, 1, 1);
    ctx.fillRect(x + w - cut + k, y, 1, 1);
    ctx.fillRect(x + cut - k - 1, y + h - 1, 1, 1);
    ctx.fillRect(x + w - cut + k, y + h - 1, 1, 1);
    ctx.fillRect(x, y + cut - k - 1, 1, 1);
    ctx.fillRect(x + w - 1, y + cut - k - 1, 1, 1);
    ctx.fillRect(x, y + h - cut + k, 1, 1);
    ctx.fillRect(x + w - 1, y + h - cut + k, 1, 1);
  }
  ctx.fillRect(x + cut, y, w - cut * 2, 1);
  ctx.fillRect(x + cut, y + h - 1, w - cut * 2, 1);
  ctx.fillRect(x, y + cut, 1, h - cut * 2);
  ctx.fillRect(x + w - 1, y + cut, 1, h - cut * 2);
}

function tearLine(ctx, v) {
  ctx.fillStyle = mix(v.deep, "#000000", 0.5);
  ctx.fillRect(0, TEAR_Y - 3, PACK_W, 1);
  for (let x = 9; x < PACK_W - 9; x += 1) {
    if (x % 7 < 4) {
      ctx.fillStyle = mix(v.foil, "#ffffff", 0.3);
      ctx.fillRect(x, TEAR_Y, 1, 2);
    }
  }
  /* small scissors: two blades and a handle bar */
  const sx = PACK_W - 22;
  const sy = TEAR_Y - 7;
  ctx.fillStyle = "#fdfbf4";
  for (let k = 0; k < 7; k += 1) {
    ctx.fillRect(sx + k, sy, 2, 2);
    ctx.fillRect(sx + 5 - k, sy + 6, 2, 2);
  }
  ctx.fillRect(sx + 6, sy + 2, 2, 4);
  ctx.fillStyle = v.deep;
  ctx.fillRect(sx + 3, sy + 4, 2, 2);
}

/* the set emblem: a chamfered foil plate holding the type glyph at 3x */
function emblem(ctx, v, x, y) {
  const s = 39;
  ctx.fillStyle = mix(v.deep, "#080a12", 0.35);
  ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
  frame(ctx, x, y, s, s, 6, mix(v.foil, "#ffffff", 0.2));
  const icon = typeIcon(v.type);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(icon, x + 4, y + 4, 33, 33);
  /* cut corner highlight */
  ctx.fillStyle = mix(v.foil, "#ffffff", 0.4);
  for (let k = 0; k < 5; k += 1) ctx.fillRect(x + 5 + k, y + 5 + k, 1, 1);
}

/* pixel type: 5x7 at 3x for the big word, 2x for the second */
function title(ctx, v, x, y, scale = 3, colour = "#fdfbf4", shadow = true) {
  const words = v.name.split(" ");
  let best = scale;
  while (best > 1 && pixelWidth(words[0], 5, best, 1) > 148) best -= 1;
  const w1 = pixelWidth(words[0], 5, best, 1);
  if (shadow) pixelText(ctx, words[0], x + best, y + best, { size: 5, scale: best, color: mix(v.deep, "#05070d", 0.5), tracking: 1 });
  pixelText(ctx, words[0], x, y, { size: 5, scale: best, color: colour, tracking: 1 });
  return { w: w1, h: 7 * best, scale: best };
}

function secondLine(ctx, v, x, y) {
  const rest = v.name.split(" ").slice(1).join(" ");
  let s = 2;
  while (s > 1 && pixelWidth(rest, 5, s, 2) > 148) s -= 1;
  const w = pixelWidth(rest, 5, s, 2);
  pixelText(ctx, rest, x + s, y + s, { size: 5, scale: s, color: mix(v.deep, "#05070d", 0.55), tracking: 2 });
  pixelText(ctx, rest, x, y, { size: 5, scale: s, color: mix(v.foil, "#ffffff", 0.15), tracking: 2 });
  return { w, h: 7 * s };
}

/* halo behind the hero: hard dithered rings, so it reads as a sunburst */
function halo(ctx, v, cx, cy, r) {
  const warm = mix(v.foil, v.base, 0.45);
  const hot = mix(v.foil, "#ffffff", 0.25);
  for (let y = cy - r; y <= cy + r; y += 1) {
    for (let x = cx - r; x <= cx + r; x += 1) {
      if (x < 8 || x >= PACK_W || y < 26 || y >= PACK_H - 26) continue;
      const d = Math.hypot(x - cx, (y - cy) * 0.9) / r;
      if (d > 1) continue;
      const ring = Math.floor(d * 3.4) % 2;
      const cover = (ring ? 0.62 : 0.22) * (1 - d * 0.3);
      if (bayer(x, y) < cover) dot(ctx, x, y, d < 0.34 ? hot : warm);
    }
  }
}

/* footer: a dithered shelf the mascot stands on, no lettering */
function shelf(ctx, v) {
  const y0 = PACK_H - 56;
  const y1 = PACK_H - 22;
  const lit = mix(v.foil, v.base, 0.55);
  const dark = mix(v.deep, "#07090f", 0.45);
  for (let y = y0; y < y1; y += 1) {
    const k = (y - y0) / (y1 - y0);
    for (let x = 8; x < PACK_W; x += 1) {
      if (bayer(x, y) < 0.25 + k * 0.5) dot(ctx, x, y, k < 0.4 ? lit : dark);
    }
  }
  ctx.fillStyle = mix(v.foil, v.deep, 0.3);
  ctx.fillRect(8, y0 - 1, PACK_W - 8, 1);
}

function hero(ctx, v, mascot, feet) {
  halo(ctx, v, 92, feet - 54, 60);
  shelf(ctx, v);

  if (!mascot) return;
  const fitW = PACK_W - 22;
  const fitH = feet - 128;
  let scale = 3;
  while (scale > 1 && (mascot.width * scale > fitW || mascot.height * scale > fitH)) scale -= 1;
  const mw = mascot.width * scale;
  const mh = mascot.height * scale;
  const mx = Math.round(PACK_W / 2 - mw / 2);
  const my = feet - mh;

  /* contact shadow */
  for (let sy = 0; sy < 6; sy += 1) {
    const cover = 1 - sy / 6;
    for (let sx = 0; sx < mw; sx += 1) {
      const x = mx + Math.round(sx * 0.9) + 4;
      if (bayer(x, my + mh + sy) < cover * 0.45) dot(ctx, x, my + mh + sy, "rgba(6,8,14,0.55)");
    }
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(mascot, mx, my, mw, mh);
}

export function renderPackFront(v, mascot) {
  const canvas = document.createElement("canvas");
  canvas.width = PACK_W;
  canvas.height = PACK_H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  field(ctx, v);
  motif(ctx, v);
  gloss(ctx, v, 22, PACK_H - 22);

  hero(ctx, v, mascot, PACK_H - 58);

  emblem(ctx, v, 15, 42);
  const t = title(ctx, v, 15, 94, 3);
  secondLine(ctx, v, 15, 94 + t.h + 8);

  /* short foil rule under the name block */
  const ruleY = 94 + t.h + 8 + 7 * 2 + 9;
  ctx.fillStyle = mix(v.foil, "#ffffff", 0.35);
  ctx.fillRect(15, ruleY, 34, 2);
  for (let x = 15; x < 64; x += 1) {
    if (bayer(x, ruleY) < ((x - 15) / 49) * 0.9) ctx.clearRect(x, ruleY + 2, 1, 1);
  }

  spine(ctx, v);
  frame(ctx, 3, 26, PACK_W - 6, PACK_H - 52, 9, mix(v.foil, v.deep, 0.15));
  tearLine(ctx, v);
  crimp(ctx, v, true);
  crimp(ctx, v, false);
  return canvas;
}

export function renderPackBack(v) {
  const canvas = document.createElement("canvas");
  canvas.width = PACK_W;
  canvas.height = PACK_H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  field(ctx, v);
  gloss(ctx, v, 22, PACK_H - 22);

  /* centred emblem, four rings of dither around it */
  const cx = PACK_W / 2;
  const cy = 208;
  halo(ctx, v, cx, cy, 68);
  ctx.imageSmoothingEnabled = false;
  const icon = typeIcon(v.type);
  ctx.drawImage(icon, Math.round(cx - 33), cy - 33, 66, 66);
  frame(ctx, Math.round(cx - 40), cy - 40, 80, 80, 10, mix(v.foil, "#ffffff", 0.15));

  emblem(ctx, v, 15, 44);
  const t = title(ctx, v, 15, 96, 2);
  secondLine(ctx, v, 15, 96 + t.h + 7);

  /* footer: foil rail with a dithered underside, keeps the back graphic-only */
  const ry = PACK_H - 74;
  ctx.fillStyle = mix(v.deep, v.base, 0.18);
  ctx.fillRect(0, ry, PACK_W, 20);
  ctx.fillStyle = mix(v.foil, "#ffffff", 0.35);
  ctx.fillRect(0, ry, PACK_W, 2);
  for (let x = 10; x < PACK_W - 6; x += 16) {
    ctx.fillStyle = mix(v.foil, v.deep, 0.25);
    ctx.fillRect(x, ry + 6, 3, 3);
    ctx.fillRect(x + 5, ry + 10, 3, 3);
  }

  spine(ctx, v);
  frame(ctx, 3, 26, PACK_W - 6, PACK_H - 52, 9, mix(v.foil, v.deep, 0.15));
  crimp(ctx, v, true);
  crimp(ctx, v, false);
  return canvas;
}

export function renderStrip(v) {
  const canvas = document.createElement("canvas");
  canvas.width = PACK_W;
  canvas.height = TEAR_Y;
  const ctx = canvas.getContext("2d");
  field(ctx, v);
  crimp(ctx, v, true);
  for (let x = 0; x < PACK_W; x += 1) {
    const jag = Math.round(Math.sin(x * 0.6) * 1.4 + Math.sin(x * 0.19) * 1);
    ctx.clearRect(x, TEAR_Y - 3 + jag, 1, 4);
    ctx.fillStyle = "rgba(8,10,18,0.75)";
    ctx.fillRect(x, TEAR_Y - 4 + jag, 1, 1);
  }
  return canvas;
}
