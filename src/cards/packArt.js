/* Booster-pack textures at 176x352, drawn on whole pixels with solid fills and
   ordered dithering. Each set carries its own name, motif and foil. */
import { drawText, textWidth } from "./pixelfont.js";

export const PACK_W = 176;
export const PACK_H = 352;
export const TEAR_Y = 30;

export const VARIANTS = {
  fire: {
    id: "fire",
    label: "FIRE",
    name: "CINNABAR EMBER",
    short: "EMBER",
    mascot: 6,
    base: "#cf5a24",
    light: "#ef8a45",
    deep: "#8c3315",
    foil: "#ffd39a",
    accent: "#ffe07a",
  },
  water: {
    id: "water",
    label: "WATER",
    name: "SEAFOAM TIDE",
    short: "TIDE",
    mascot: 9,
    base: "#2f74bd",
    light: "#5ea6e0",
    deep: "#123c68",
    foil: "#bfe6ff",
    accent: "#cdeeff",
  },
  grass: {
    id: "grass",
    label: "GRASS",
    name: "VIRIDIAN BLOOM",
    short: "BLOOM",
    mascot: 3,
    base: "#3a8f43",
    light: "#67b055",
    deep: "#174d22",
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

/* two-tone dithered fill: `tone(x, y)` returns 0..1 coverage of the light tone */
function ditherFill(ctx, x0, y0, w, h, dark, light, tone) {
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const t = tone(x0 + x, y0 + y);
      if (t <= 0) continue;
      ctx.fillStyle = bayer(x0 + x, y0 + y) < t ? light : dark;
      ctx.fillRect(x0 + x, y0 + y, 1, 1);
    }
  }
}

/* body ground: deep panel, dithered motif, darker towards the crimps */
function ground(ctx, v) {
  const top = 22;
  const bottom = PACK_H - 22;
  const darkA = mix(v.deep, "#07090f", 0.62);
  const darkB = mix(v.deep, "#07090f", 0.44);
  for (let y = top; y < bottom; y += 1) {
    for (let x = 0; x < PACK_W; x += 1) {
      ctx.fillStyle = bayer(x, y) < 0.5 ? darkA : darkB;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  const motif = mix(v.base, darkA, 0.55);
  const motifLit = mix(v.light, darkA, 0.35);

  if (v.id === "fire") {
    /* three flame tongues licking up from the bottom of the sheet */
    const tongues = [
      { cx: 44, h: 132, w: 26 },
      { cx: 92, h: 176, w: 34 },
      { cx: 140, h: 118, w: 24 },
    ];
    for (const t of tongues) {
      for (let yy = 0; yy < t.h; yy += 1) {
        const y = bottom - yy;
        const k = yy / t.h;
        const half = Math.max(1, Math.round((t.w / 2) * (1 - k) ** 0.7));
        const wob = Math.round(Math.sin(yy * 0.12 + t.cx) * 3 * (1 - k));
        for (let x = t.cx - half + wob; x <= t.cx + half + wob; x += 1) {
          const edge = 1 - Math.abs(x - (t.cx + wob)) / (half + 1);
          const cover = (0.25 + 0.6 * edge) * (1 - k * 0.55);
          if (bayer(x, y) < cover) {
            ctx.fillStyle = bayer(x + 1, y) < cover * 0.6 ? motifLit : motif;
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
      /* embers */
      for (let i = 0; i < 26; i += 1) {
        const x = t.cx + Math.round(Math.sin(i * 2.4) * 22);
        const y = bottom - 20 - ((i * 37) % (t.h - 30));
        ctx.fillStyle = mix(v.accent, "#ffffff", 0.15);
        ctx.fillRect(x, y, 1, 1);
      }
    }
  } else if (v.id === "water") {
    /* stacked wave bands, dithered so the crests break up into pixels */
    for (let band = 0; band < 7; band += 1) {
      const baseY = 74 + band * 34;
      for (let x = 0; x < PACK_W; x += 1) {
        const wave = Math.round(Math.sin(x * 0.09 + band * 0.9) * 7 + Math.sin(x * 0.021 + band) * 4);
        const y = baseY + wave;
        for (let d = 0; d < 9; d += 1) {
          const cover = 1 - d / 9;
          if (bayer(x, y + d) < cover * 0.85) {
            ctx.fillStyle = d < 2 ? motifLit : motif;
            ctx.fillRect(x, y + d, 1, 1);
          }
        }
      }
    }
    for (let i = 0; i < 46; i += 1) {
      const x = (i * 53) % PACK_W;
      const y = 60 + ((i * 71) % 250);
      ctx.fillStyle = mix(v.accent, "#ffffff", 0.2);
      ctx.fillRect(x, y, 1, 1);
    }
  } else {
    /* overlapping leaves on a diagonal lattice */
    for (let i = 0; i < 9; i += 1) {
      const cx = 20 + ((i * 47) % 150);
      const cy = 50 + ((i * 83) % 240);
      const len = 34 + (i % 3) * 14;
      for (let k = 0; k < len; k += 1) {
        const x = cx + Math.round(k * 0.75);
        const y = cy + Math.round(k * 0.45);
        const half = Math.max(1, Math.round((1 - k / len) * 9));
        for (let d = -half; d <= half; d += 1) {
          const cover = 1 - Math.abs(d) / (half + 1);
          if (bayer(x, y + d) < cover * 0.8) {
            ctx.fillStyle = Math.abs(d) < 2 ? motifLit : motif;
            ctx.fillRect(x, y + d, 1, 1);
          }
        }
      }
    }
  }

  /* edge shade so the motif fades out under the crimps */
  for (let y = top; y < bottom; y += 1) {
    const edge = Math.min(y - top, bottom - 1 - y);
    const cover = edge < 26 ? 1 - edge / 26 : 0;
    if (cover <= 0) continue;
    for (let x = 0; x < PACK_W; x += 1) {
      if (bayer(x, y) < cover * 0.9) {
        ctx.fillStyle = mix(darkA, "#000000", 0.45);
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

/* hard stepped shine: three tones along a diagonal, dithered between them */
function shine(ctx, v, y0, y1) {
  const bandA = mix(v.foil, "#ffffff", 0.45);
  const bandB = mix(v.foil, v.base, 0.35);
  for (let y = y0; y < y1; y += 1) {
    for (let x = 0; x < PACK_W; x += 1) {
      const s = (x * 0.55 + y * 1.35) % 300;
      let cover = 0;
      let colour = bandA;
      if (s > 60 && s < 96) {
        cover = 0.34;
        colour = bandB;
      } else if (s >= 96 && s < 112) {
        cover = 0.72;
        colour = bandA;
      } else if (s >= 112 && s < 128) {
        cover = 0.28;
        colour = bandB;
      }
      if (cover <= 0) continue;
      if (bayer(x, y) < cover) {
        ctx.fillStyle = colour;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

function crimp(ctx, v, top) {
  const h = 22;
  const y0 = top ? 0 : PACK_H - h;
  ctx.fillStyle = mix(v.deep, "#080a12", 0.55);
  ctx.fillRect(0, y0, PACK_W, h);
  for (let x = 0; x < PACK_W; x += 4) {
    ctx.fillStyle = mix(v.deep, v.base, 0.28);
    ctx.fillRect(x, y0 + 4, 2, h - 8);
    ctx.fillStyle = mix(v.deep, "#000000", 0.42);
    ctx.fillRect(x + 2, y0 + 4, 1, h - 8);
  }
  ctx.fillStyle = mix(v.foil, v.deep, 0.5);
  ctx.fillRect(0, top ? h - 1 : y0, PACK_W, 1);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, top ? h : y0 - 1, PACK_W, 1);
}

function chamferPath(ctx, x, y, w, h, cut) {
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + w - cut, y);
  ctx.lineTo(x + w, y + cut);
  ctx.lineTo(x + w, y + h - cut);
  ctx.lineTo(x + w - cut, y + h);
  ctx.lineTo(x + cut, y + h);
  ctx.lineTo(x, y + h - cut);
  ctx.lineTo(x, y + cut);
  ctx.closePath();
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
  ctx.fillStyle = mix(v.deep, "#000000", 0.55);
  ctx.fillRect(0, TEAR_Y - 2, PACK_W, 1);
  for (let x = 6; x < PACK_W - 6; x += 1) {
    if (x % 6 < 3) {
      ctx.fillStyle = mix(v.foil, "#ffffff", 0.35);
      ctx.fillRect(x, TEAR_Y, 1, 2);
    }
  }
  const sx = PACK_W - 26;
  const sy = TEAR_Y - 6;
  ctx.fillStyle = "#fdfbf4";
  ctx.fillRect(sx, sy, 6, 2);
  ctx.fillRect(sx + 6, sy + 2, 5, 2);
  ctx.fillRect(sx + 2, sy + 4, 3, 2);
  ctx.fillRect(sx + 7, sy + 6, 6, 2);
  ctx.fillStyle = v.deep;
  ctx.fillRect(sx + 11, sy + 2, 2, 2);
  ctx.fillRect(sx + 12, sy + 6, 2, 2);
}

function header(ctx, v) {
  const kicker = "151 · SERIES 01";
  const kw = textWidth(kicker, 8, 1, 2);
  drawText(ctx, kicker, Math.round((PACK_W - kw) / 2), 40, { size: 8, color: mix(v.foil, "#ffffff", 0.25), tracking: 2 });

  const words = v.name.split(" ");
  const line1 = words[0];
  const line2 = words.slice(1).join(" ");
  let s1 = 30;
  while (s1 > 15 && textWidth(line1, s1, 1, 2) > 132) s1 -= 1;
  const w1 = textWidth(line1, s1, 1, 2);
  const x1 = Math.round((PACK_W - w1) / 2);
  drawText(ctx, line1, x1 + 2, 56, { size: s1, color: mix(v.deep, "#000000", 0.45), tracking: 2 });
  drawText(ctx, line1, x1, 54, { size: s1, color: "#fdfbf4", tracking: 2 });

  let s2 = 15;
  while (s2 > 9 && textWidth(line2, s2, 1, 3) > 132) s2 -= 1;
  const w2 = textWidth(line2, s2, 1, 3);
  const x2 = Math.round((PACK_W - w2) / 2);
  drawText(ctx, line2, x2, 94, { size: s2, color: mix(v.accent, v.deep, 0.15), tracking: 3 });
}

function rule(ctx, v, y) {
  ctx.fillStyle = mix(v.foil, v.deep, 0.55);
  ctx.fillRect(16, y, 56, 1);
  ctx.fillRect(PACK_W - 72, y, 56, 1);
  ctx.fillStyle = mix(v.foil, "#ffffff", 0.4);
  ctx.fillRect(PACK_W / 2 - 5, y, 10, 1);
}

function mascotPlate(ctx, v, mascot) {
  const w = 150;
  const h = 148;
  const x = Math.round((PACK_W - w) / 2);
  const y = 120;
  const cut = 10;

  ditherFill(ctx, x, y, w, h, mix(v.deep, "#080a12", 0.5), mix(v.deep, "#080a12", 0.18), (px, py) => {
    const across = Math.min(px - x, x + w - 1 - px) / (w * 0.5);
    const down = (py - y) / h;
    return 0.35 + 0.55 * down * (1 - across * 0.5);
  });
  frame(ctx, x, y, w, h, cut, mix(v.foil, v.deep, 0.25));
  frame(ctx, x + 3, y + 3, w - 6, h - 6, cut - 2, mix(v.foil, v.base, 0.55));

  if (mascot) {
    const scale = mascot.width * 2 <= w - 22 && mascot.height * 2 <= h - 24 ? 2 : 1;
    const mw = mascot.width * scale;
    const mh = mascot.height * scale;
    const mx = Math.round(PACK_W / 2 - mw / 2);
    const my = y + h - 12 - mh;
    /* dithered contact shadow */
    for (let sy = 0; sy < 5; sy += 1) {
      const cover = 1 - sy / 5;
      for (let sx = 0; sx < mw; sx += 1) {
        if (bayer(mx + sx, my + mh + sy) < cover * 0.5) {
          ctx.fillStyle = "rgba(6,8,14,0.5)";
          ctx.fillRect(mx + Math.round(sx * 0.92) + 4, my + mh + sy, 1, 1);
        }
      }
    }
    ctx.drawImage(mascot, mx, my, mw, mh);
  }

  /* specular corner on the plate */
  ctx.fillStyle = mix(v.foil, "#ffffff", 0.5);
  for (let k = 0; k < 22; k += 1) ctx.fillRect(x + 4 + k, y + 4 + Math.floor(k / 2), 1, 1);
}

export function renderPackFront(v, mascot) {
  const canvas = document.createElement("canvas");
  canvas.width = PACK_W;
  canvas.height = PACK_H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  ground(ctx, v);
  shine(ctx, v, 22, PACK_H - 22);
  header(ctx, v);
  rule(ctx, v, 112);
  mascotPlate(ctx, v, mascot);

  tearLine(ctx, v);

  /* footer ribbon */
  const ry = PACK_H - 58;
  ctx.fillStyle = mix(v.deep, "#080a12", 0.35);
  ctx.fillRect(0, ry, PACK_W, 22);
  ctx.fillStyle = mix(v.foil, v.deep, 0.35);
  ctx.fillRect(0, ry, PACK_W, 1);
  const l1 = "5 CARDS";
  const l2 = "1 RARE OR BETTER";
  const w1 = textWidth(l1, 9, 1, 2);
  const w2 = textWidth(l2, 7, 1, 1);
  drawText(ctx, l1, Math.round((PACK_W - w1) / 2), ry + 5, { size: 9, color: "#fdfbf4", tracking: 2 });
  drawText(ctx, l2, Math.round((PACK_W - w2) / 2), ry + 14, { size: 7, color: mix(v.foil, v.base, 0.2), tracking: 1 });

  /* outer edge + crimps over the top */
  frame(ctx, 3, 26, PACK_W - 6, PACK_H - 52, 9, mix(v.foil, v.deep, 0.2));
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

  ground(ctx, v);
  frame(ctx, 3, 26, PACK_W - 6, PACK_H - 52, 9, mix(v.foil, v.deep, 0.2));

  /* fin seal */
  ctx.fillStyle = mix(v.deep, "#000000", 0.35);
  ctx.fillRect(PACK_W / 2 - 9, 26, 18, PACK_H - 52);
  for (let y = 30; y < PACK_H - 30; y += 3) {
    ctx.fillStyle = mix(v.base, v.deep, 0.55);
    ctx.fillRect(PACK_W / 2 - 7, y, 14, 1);
  }

  drawText(ctx, v.name, 18, 60, { size: 13, color: "#fdfbf4", tracking: 2 });
  drawText(ctx, `${v.label} SET · 5 CARDS`, 18, 80, { size: 8, color: mix(v.foil, "#ffffff", 0.25), tracking: 1 });

  /* barcode plaque */
  ctx.fillStyle = "#fdfbf4";
  ctx.fillRect(18, 100, 74, 40);
  for (let i = 0; i < 24; i += 1) {
    const w = i % 4 === 0 ? 3 : i % 3 === 0 ? 2 : 1;
    ctx.fillStyle = "#161022";
    ctx.fillRect(22 + i * 2.7, 105, w, 30);
  }
  drawText(ctx, "KANTO 151", 18, 152, { size: 9, color: mix(v.foil, "#ffffff", 0.2), tracking: 1 });

  const note = "EACH PACK HOLDS FIVE CARDS, ONE OF THEM RARE OR BETTER. CHROMA AND FULL ART PRINTS HIDE IN ANY SET.";
  let line = "";
  let y = 176;
  for (const word of note.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next, 8, 1, 0) > 138) {
      drawText(ctx, line, 18, y, { size: 8, color: "rgba(253,251,244,0.75)", tracking: 0 });
      y += 11;
      line = word;
    } else {
      line = next;
    }
  }
  if (line) drawText(ctx, line, 18, y, { size: 8, color: "rgba(253,251,244,0.75)", tracking: 0 });

  drawText(ctx, "SEALED IN KANTO", 18, PACK_H - 48, { size: 9, color: v.accent, tracking: 0 });

  crimp(ctx, v, true);
  crimp(ctx, v, false);
  return canvas;
}

export function renderStrip(v) {
  const canvas = document.createElement("canvas");
  canvas.width = PACK_W;
  canvas.height = TEAR_Y;
  const ctx = canvas.getContext("2d");
  ground(ctx, v);
  crimp(ctx, v, true);
  for (let x = 0; x < PACK_W; x += 1) {
    const jag = Math.round(Math.sin(x * 0.6) * 1.4 + Math.sin(x * 0.19) * 1);
    ctx.clearRect(x, TEAR_Y - 3 + jag, 1, 4);
    ctx.fillStyle = "rgba(8,10,18,0.75)";
    ctx.fillRect(x, TEAR_Y - 4 + jag, 1, 1);
  }
  return canvas;
}
