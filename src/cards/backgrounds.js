/* Card art backgrounds: three hand-drawn scenes per TCG type, authored in the
   70x51 pixel buffer the art window scales up, so every dither step is a real
   pixel rather than a filter. */

const W = 70;
const H = 51;

/* 4x4 ordered dither: 0..16 levels of the second colour */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function px(ctx, x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

function dither(ctx, x, y, w, h, a, b, level) {
  const n = Math.max(0, Math.min(16, Math.round(level)));
  if (n === 0) return px(ctx, x, y, w, h, a);
  if (n === 16) return px(ctx, x, y, w, h, b);
  px(ctx, x, y, w, h, a);
  ctx.fillStyle = b;
  for (let yy = 0; yy < h; yy += 1) {
    for (let xx = 0; xx < w; xx += 1) {
      if (BAYER[(y + yy) % 4][(x + xx) % 4] < n) ctx.fillRect(x + xx, y + yy, 1, 1);
    }
  }
}

/* vertical ramp across stops, dithered so it reads as pixel art */
function ramp(ctx, x, y, w, h, stops) {
  const bands = stops.length - 1;
  const bandH = h / bands;
  for (let i = 0; i < bands; i += 1) {
    const top = Math.round(i * bandH);
    const bottom = Math.round((i + 1) * bandH);
    px(ctx, x, y + top, w, bottom - top, stops[i]);
    /* only the seam is dithered, so the band stays a clean colour */
    const fade = Math.max(2, Math.round((bottom - top) * 0.5));
    for (let k = 0; k < fade; k += 1) {
      dither(ctx, x, y + bottom - fade + k, w, 1, "transparent", stops[i + 1], Math.round((k / fade) * 11));
    }
  }
}

function disc(ctx, cx, cy, r, c) {
  ctx.fillStyle = c;
  for (let yy = -r; yy <= r; yy += 1) {
    const half = Math.round(Math.sqrt(Math.max(0, r * r - yy * yy)));
    if (half > 0) ctx.fillRect(cx - half, cy + yy, half * 2, 1);
  }
}

function glow(ctx, cx, cy, r, c, level = 5) {
  for (let i = r; i > 0; i -= 1) {
    dither(ctx, cx - i, cy - i, i * 2, i * 2, "transparent", c, level);
  }
}

function seedOf(card, salt = 0) {
  let s = (card.id * 2654435761 + salt * 40503 + 12345) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function stars(ctx, rnd, count, yMax, c) {
  ctx.fillStyle = c;
  for (let i = 0; i < count; i += 1) {
    const x = Math.floor(rnd() * W);
    const y = Math.floor(rnd() * yMax);
    ctx.fillRect(x, y, 1, 1);
    if (rnd() > 0.82) ctx.fillRect(x + 1, y, 1, 1);
  }
}

function ridge(ctx, baseY, amp, period, color, phase = 0, fillTo = H) {
  for (let x = 0; x < W; x += 1) {
    const y = Math.round(baseY - Math.abs(Math.sin((x + phase) / period)) * amp - Math.sin((x + phase) / (period * 3)) * 2);
    px(ctx, x, y, 1, fillTo - y, color);
  }
}

function softCloud(ctx, x, y, w, c, c2) {
  dither(ctx, x, y + 2, w, 3, "transparent", c2, 6);
  disc(ctx, x + 5, y + 2, 3, c);
  disc(ctx, x + 11, y + 1, 4, c);
  disc(ctx, x + 17, y + 2, 3, c);
  px(ctx, x + 4, y + 3, 15, 2, c);
  dither(ctx, x + 3, y + 5, w - 4, 2, "transparent", c2, 4);
}

function tuft(ctx, x, y, h, c) {
  px(ctx, x, y - h, 1, h, c);
  px(ctx, x + 1, y - h + 1, 1, h - 1, c);
  px(ctx, x - 1, y - h + 2, 1, h - 2, c);
}

/* ---------------- scenes ---------------- */

const SCENES = {
  Fire: [
    /* volcano at dusk */
    (ctx, r, rnd) => {
      ramp(ctx, 0, 0, W, 34, ["#2a0f1d", "#6b1f27", "#b8402a", "#e8834a"]);
      disc(ctx, 52, 26, 5, "#f9c96a");
      dither(ctx, 47, 21, 11, 11, "transparent", "#ffdf95", 5);
      ridge(ctx, 34, 12, 9, "#3a1620", rnd() * 20);
      ridge(ctx, 36, 6, 13, "#25101a", rnd() * 20);
      px(ctx, 0, 40, W, 11, "#1b0c14");
      for (let i = 0; i < 9; i += 1) {
        const x = 14 + Math.round(rnd() * 42);
        px(ctx, x, 30 + Math.round(rnd() * 6), 2, 6 + Math.round(rnd() * 6), "#ff7a2f");
        px(ctx, x, 30 + Math.round(rnd() * 6), 1, 4, "#ffd07a");
      }
      for (let i = 0; i < 26; i += 1) {
        ctx.fillStyle = i % 3 === 0 ? "#ff9a4a" : "#ffd894";
        ctx.fillRect(Math.floor(rnd() * W), 6 + Math.floor(rnd() * 26), 1, 1);
      }
    },
    /* ember ridge, low sun */
    (ctx, r, rnd) => {
      ramp(ctx, 0, 0, W, 30, ["#ffd9a2", "#ff9c52", "#d0522c"]);
      disc(ctx, 22, 20, 7, "#fff0c4");
      dither(ctx, 14, 12, 17, 17, "transparent", "#ffe6a8", 6);
      ridge(ctx, 30, 8, 13, "#a8432a", 6);
      ridge(ctx, 34, 6, 9, "#6d2a22", 3);
      px(ctx, 0, 40, W, 11, "#38141a");
      dither(ctx, 0, 38, W, 4, "#6d2a22", "#38141a", 8);
      for (let i = 0; i < 20; i += 1) tuft(ctx, Math.floor(rnd() * W), 44 + Math.floor(rnd() * 5), 2 + Math.floor(rnd() * 3), "#250d12");
      for (let i = 0; i < 3; i += 1) {
        const sx = 42 + i * 9;
        for (let y = 6; y < 22; y += 1) {
          dither(ctx, sx + Math.round(Math.sin(y / 3) * 3) + Math.round(i * 2), y, 4 + i, 1, "transparent", "#e08a55", 4 - i);
        }
      }
      softCloud(ctx, 4, 4, 24, "#ffe3b8", "#f0a86a");
    },
    /* forge cavern */
    (ctx, r, rnd) => {
      ramp(ctx, 0, 0, W, H, ["#170d12", "#2a1418", "#170d12"]);
      for (let i = 0; i < 26; i += 1) {
        dither(ctx, Math.round(rnd() * W), Math.round(rnd() * 40), 3 + Math.round(rnd() * 5), 1, "transparent", "#3d1f21", 5);
      }
      px(ctx, 0, 36, W, 15, "#ff8a2a");
      for (let y = 34; y < H; y += 1) {
        dither(ctx, 0, y, W, 1, "#5a1d16", "#ff8a2a", Math.round(((y - 34) / 17) * 14));
      }
      for (let i = 0; i < 16; i += 1) {
        px(ctx, Math.floor(rnd() * W), 32 + Math.floor(rnd() * 12), 2 + Math.floor(rnd() * 5), 1, "#ffe6a0");
      }
      for (let i = 0; i < 3; i += 1) {
        const x = 8 + i * 22;
        px(ctx, x, 30, 3, 8, "#3d1f21");
        px(ctx, x + 1, 28, 1, 3, "#5a1d16");
      }
      for (let i = 0; i < 22; i += 1) {
        ctx.fillStyle = "#ffcf7a";
        ctx.fillRect(Math.floor(rnd() * W), 6 + Math.floor(rnd() * 26), 1, 1);
      }
    },
  ],

  Water: [
    /* open sea */
    (ctx, r, rnd) => {
      ramp(ctx, 0, 0, W, 26, ["#bfe6f7", "#8ecbe8", "#5aa8d6"]);
      softCloud(ctx, 6, 5, 22, "#ffffff", "#dbeefb");
      softCloud(ctx, 40, 9, 22, "#f4fbff", "#cfe8f8");
      px(ctx, 0, 26, W, H - 26, "#2f77b8");
      dither(ctx, 0, 26, W, 3, "#2f77b8", "#8ecbe8", 8);
      for (let i = 0; i < 22; i += 1) {
        const y = 30 + Math.floor(rnd() * 18);
        const x = Math.floor(rnd() * (W - 8));
        px(ctx, x, y, 2 + Math.floor(rnd() * 5), 1, y < 38 ? "#7cc0e8" : "#1f5c98");
      }
      px(ctx, 46, 24, 12, 2, "#e8f6ff");
      dither(ctx, 44, 22, 16, 5, "transparent", "#ffffff", 4);
    },
    /* reef shallows, light shafts */
    (ctx, r, rnd) => {
      ramp(ctx, 0, 0, W, H, ["#59b9d8", "#2f86b8", "#1b4f80", "#123457"]);
      for (let i = 0; i < 4; i += 1) {
        const x = 8 + i * 17;
        for (let y = 0; y < 24; y += 1) {
          const wide = 5 - Math.round(y / 6);
          dither(ctx, x + Math.round(y / 5), y, wide, 1, "transparent", "#bfe9f5", 5 - Math.round(y / 8));
        }
      }
      dither(ctx, 0, 26, W, 25, "transparent", "#0f2c47", 6);
      px(ctx, 0, 44, W, 7, "#d9c48c");
      dither(ctx, 0, 42, W, 3, "#123457", "#d9c48c", 7);
      for (let i = 0; i < 16; i += 1) {
        const x = Math.floor(rnd() * W);
        const y = 8 + Math.floor(rnd() * 32);
        ctx.fillStyle = i % 4 === 0 ? "#ffffff" : "#bfe9f5";
        ctx.fillRect(x, y, 1, 1);
      }
      for (let i = 0; i < 5; i += 1) {
        const x = 4 + Math.round(rnd() * 60);
        px(ctx, x, 40, 2, 6, "#1f7a5c");
        px(ctx, x + 3, 38, 2, 8, "#2a8f68");
      }
    },
    /* rain squall */
    (ctx, r, rnd) => {
      ramp(ctx, 0, 0, W, 30, ["#8d9fb5", "#6c8099", "#4d6079"]);
      softCloud(ctx, 2, 2, 26, "#a9b8ca", "#8395ab");
      softCloud(ctx, 26, 0, 30, "#9fb0c3", "#7b8da3");
      softCloud(ctx, 48, 5, 22, "#b3c1d1", "#8b9cb1");
      px(ctx, 0, 30, W, H - 30, "#3c4f66");
      dither(ctx, 0, 30, W, 4, "#3c4f66", "#6c8099", 7);
      for (let i = 0; i < 60; i += 1) {
        const x = Math.floor(rnd() * W);
        const y = 6 + Math.floor(rnd() * 34);
        px(ctx, x, y, 1, 2, "#c3d4e4");
      }
      for (let i = 0; i < 12; i += 1) {
        const x = Math.floor(rnd() * (W - 6));
        const y = 38 + Math.floor(rnd() * 8);
        px(ctx, x, y, 4, 1, "#587092");
      }
    },
  ],

  Grass: [
    /* meadow */
    (ctx, r, rnd) => {
      ramp(ctx, 0, 0, W, 24, ["#d8f2c4", "#a9d98a", "#7cc25e"]);
      disc(ctx, 58, 10, 4, "#fff6c9");
      dither(ctx, 54, 6, 9, 9, "transparent", "#fffad9", 5);
      ridge(ctx, 26, 6, 12, "#6aa84f", 12);
      ridge(ctx, 30, 4, 8, "#558b3f", 4);
      ramp(ctx, 0, 32, W, H - 32, ["#4f8a3c", "#3c6e2e"]);
      for (let i = 0; i < 30; i += 1) tuft(ctx, Math.floor(rnd() * W), 38 + Math.floor(rnd() * 10), 2, "#2f5a25");
      for (let i = 0; i < 12; i += 1) {
        const x = Math.floor(rnd() * W);
        const y = 34 + Math.floor(rnd() * 12);
        ctx.fillStyle = i % 3 === 0 ? "#fff2a8" : i % 3 === 1 ? "#f5b6c8" : "#ffffff";
        ctx.fillRect(x, y, 1, 1);
      }
    },
    /* deep forest canopy */
    (ctx, r, rnd) => {
      px(ctx, 0, 0, W, H, "#1d3a22");
      ramp(ctx, 0, 18, W, 20, ["#2d5730", "#497a3f", "#6d9c4d"]);
      for (let i = 0; i < 5; i += 1) {
        const x = 6 + i * 14 + Math.round(rnd() * 4);
        px(ctx, x, 8, 3, 34, "#2a2118");
        px(ctx, x + 3, 8, 1, 34, "#3d3022");
      }
      for (let i = 0; i < 10; i += 1) {
        const x = Math.round(rnd() * W);
        const y = Math.round(rnd() * 12);
        disc(ctx, x, y, 3 + Math.round(rnd() * 2), "#3f6f36");
      }
      dither(ctx, 0, 0, W, 12, "#1d3a22", "#3f6f36", 7);
      for (let i = 0; i < 3; i += 1) {
        const x = 16 + i * 18;
        for (let y = 2; y < 28; y += 1) dither(ctx, x + Math.round(y / 3), y, 3, 1, "transparent", "#d7e8a0", 5);
      }
      px(ctx, 0, 42, W, 9, "#243a1d");
      for (let i = 0; i < 16; i += 1) tuft(ctx, Math.floor(rnd() * W), 46 + Math.floor(rnd() * 3), 3, "#3d5e2c");
    },
    /* fern hollow */
    (ctx, r, rnd) => {
      ramp(ctx, 0, 0, W, 30, ["#bfe6a2", "#88c46a", "#5d9a45"]);
      px(ctx, 0, 30, W, H - 30, "#4b7f38");
      dither(ctx, 0, 28, W, 4, "#5d9a45", "#4b7f38", 8);
      for (let i = 0; i < 4; i += 1) {
        const x = 5 + i * 18;
        px(ctx, x + 2, 12, 2, 22, "#3a6b2a");
        disc(ctx, x + 3, 11, 4, "#4d8440");
        px(ctx, x, 20, 3, 1, "#3a6b2a");
        px(ctx, x + 4, 24, 3, 1, "#3a6b2a");
      }
      for (let i = 0; i < 6; i += 1) {
        const fx = 2 + i * 12;
        const lift = 20 + (i % 2) * 6;
        for (let b = 0; b < 6; b += 1) {
          px(ctx, fx + 1 + b * 2, 46 - lift - b, 3, 1, "#2f5a25");
          px(ctx, fx + 5 - b * 2, 46 - lift - b - 1, 3, 1, "#2f5a25");
        }
        px(ctx, fx + 7, 34 - (i % 2) * 4, 1, 14, "#244a1d");
      }
      for (let i = 0; i < 6; i += 1) {
        const x = Math.floor(rnd() * (W - 10));
        px(ctx, x, 6 + Math.floor(rnd() * 8), 6, 1, "#eef7d0");
        px(ctx, x + 1, 7 + Math.floor(rnd() * 8), 4, 1, "#d8eab0");
      }
    },
  ],

  Lightning: [
    /* thunderhead */
    (ctx, r, rnd) => {
      ramp(ctx, 0, 0, W, 30, ["#3a3550", "#544a72", "#7b6b96"]);
      softCloud(ctx, 0, 3, 30, "#6b5f8c", "#4c4268");
      softCloud(ctx, 24, 0, 32, "#7d7099", "#574c74");
      softCloud(ctx, 46, 4, 24, "#6b5f8c", "#4c4268");
      for (let i = 0; i < 5; i += 1) {
        let x = 12 + Math.round(rnd() * 26);
        let y = 12;
        for (let s = 0; s < 16; s += 1) {
          px(ctx, x, y, 1, 3, "#fff6b0");
          y += 3;
          x += rnd() > 0.5 ? -2 : 2;
        }
      }
      px(ctx, 0, 32, W, H - 32, "#241f36");
      dither(ctx, 0, 32, W, 4, "#241f36", "#544a72", 6);
      px(ctx, 6, 34, 2, 8, "#3a3550");
      px(ctx, 30, 36, 2, 9, "#3a3550");
      px(ctx, 58, 33, 2, 7, "#3a3550");
    },
    /* storm plain under a bolt */
    (ctx, r, rnd) => {
      ramp(ctx, 0, 0, W, 34, ["#2b2b45", "#454572", "#6f6fa0"]);
      dither(ctx, 0, 28, W, 8, "#6f6fa0", "#a3a3c9", 6);
      let x = 34;
      let y = 6;
      for (let s = 0; s < 17; s += 1) {
        px(ctx, x, y, 2, 4, "#ffffff");
        px(ctx, x - 1, y, 4, 2, "#dbe6ff");
        y += 3;
        x += s % 3 === 0 ? -3 : 2;
      }
      px(ctx, 0, 36, W, H - 36, "#1e1e30");
      for (let i = 0; i < 24; i += 1) tuft(ctx, Math.floor(rnd() * W), 44 + Math.floor(rnd() * 5), 2, "#2e2e46");
      px(ctx, 0, 36, W, 1, "#3d3d5c");
    },
    /* charge field */
    (ctx, r, rnd) => {
      ramp(ctx, 0, 0, W, 26, ["#12101f", "#26224a", "#453f7a"]);
      stars(ctx, rnd, 30, 20, "#8a86d6");
      px(ctx, 0, 26, W, H - 26, "#181530");
      for (let x = 0; x < W; x += 7) px(ctx, x, 30, 1, 16, "#3b3770");
      for (let y = 30; y < 48; y += 6) px(ctx, 0, y, W, 1, "#3b3770");
      for (let i = 0; i < 4; i += 1) {
        const x = 8 + i * 16;
        px(ctx, x, 12, 1, 10, "#b8b4ff");
        px(ctx, x + 1, 14, 1, 8, "#e6e4ff");
        px(ctx, x - 2, 16, 5, 1, "#b8b4ff");
      }
      dither(ctx, 0, 24, W, 4, "#181530", "#453f7a", 7);
    },
  ],

  Psychic: [
    /* astral void with islands */
    (ctx, r, rnd) => {
      ramp(ctx, 0, 0, W, H, ["#241640", "#3c2a63", "#59408a", "#2d1d4f"]);
      stars(ctx, rnd, 44, 30, "#d9c8ff");
      disc(ctx, 16, 12, 6, "#8f7ad6");
      disc(ctx, 18, 10, 4, "#6b57b0");
      for (let i = 0; i < 3; i += 1) {
        const x = 30 + i * 14;
        const y = 24 + i * 6;
        px(ctx, x, y, 8, 2, "#7157a8");
        px(ctx, x + 1, y + 2, 6, 2, "#4a3572");
        px(ctx, x + 2, y + 4, 4, 1, "#362450");
      }
      dither(ctx, 0, 40, W, 11, "#2d1d4f", "#1a1130", 7);
    },
    /* spiral eye */
    (ctx, r, rnd) => {
      ramp(ctx, 0, 0, W, H, ["#4a2f6e", "#6d4a96", "#3b255a"]);
      for (let ring = 14; ring > 0; ring -= 2) {
        const c = ring % 4 === 0 ? "#8f6fc4" : "#6a4a9e";
        for (let a = 0; a < 360; a += 3) {
          const rad = (a * Math.PI) / 180;
          const px2 = Math.round(W / 2 + Math.cos(rad) * ring);
          const py2 = Math.round(26 + Math.sin(rad) * ring * 0.72);
          px(ctx, px2, py2, 1, 1, c);
        }
      }
      disc(ctx, 35, 26, 4, "#f4e9ff");
      disc(ctx, 35, 26, 2, "#3b255a");
      dither(ctx, 0, 0, W, 6, "#4a2f6e", "#8f6fc4", 4);
      dither(ctx, 0, 44, W, 7, "#3b255a", "#241640", 7);
    },
    /* dream terrace */
    (ctx, r, rnd) => {
      ramp(ctx, 0, 0, W, 28, ["#ffd7f0", "#d8a8e8", "#9a6fc4"]);
      for (let i = 0; i < 4; i += 1) softCloud(ctx, i * 18 - 4, 2 + (i % 2) * 5, 22, "#fff0fb", "#e8c4f2");
      px(ctx, 0, 28, W, H - 28, "#6a4a9e");
      for (let y = 28; y < H; y += 4) {
        for (let x = 0; x < W; x += 4) {
          const on = ((x / 4) + (y / 4)) % 2 === 0;
          if (on) px(ctx, x, y, 4, 4, "#563c86");
        }
      }
      dither(ctx, 0, 26, W, 5, "transparent", "#d8a8e8", 6);
      for (let i = 0; i < 10; i += 1) {
        ctx.fillStyle = "#fff8ff";
        ctx.fillRect(Math.floor(rnd() * W), 6 + Math.floor(rnd() * 18), 1, 1);
      }
    },
  ],

  Fighting: [
    /* mesa canyon */
    (ctx, r, rnd) => {
      ramp(ctx, 0, 0, W, 24, ["#ffd9a8", "#f0ac74", "#cf8352"]);
      disc(ctx, 14, 16, 5, "#fff0cc");
      ridge(ctx, 24, 8, 10, "#b06a44", 8);
      ridge(ctx, 27, 5, 6, "#8a4f36", 2);
      px(ctx, 0, 30, W, H - 30, "#a86d47");
      dither(ctx, 0, 30, W, 4, "#a86d47", "#cf9a6a", 8);
      for (let i = 0; i < 4; i += 1) {
        const x = 8 + i * 17;
        px(ctx, x, 34, 8, 6, "#94603f");
        px(ctx, x + 1, 33, 6, 1, "#b78355");
      }
      for (let i = 0; i < 20; i += 1) {
        ctx.fillStyle = "#8a5b3c";
        ctx.fillRect(Math.floor(rnd() * W), 38 + Math.floor(rnd() * 10), 2, 1);
      }
    },
    /* karst cave */
    (ctx, r, rnd) => {
      px(ctx, 0, 0, W, H, "#2a2026");
      ramp(ctx, 0, 22, W, 24, ["#4a3a38", "#6d554a", "#8f6f57"]);
      for (let i = 0; i < 8; i += 1) {
        const x = 3 + i * 9;
        const len = 4 + Math.round(rnd() * 9);
        px(ctx, x, 0, 3, len, "#3a2c2e");
        px(ctx, x + 1, len, 2, 2, "#4a3a38");
      }
      for (let i = 0; i < 5; i += 1) {
        const x = 8 + i * 14;
        px(ctx, x, 44, 3, 7, "#3a2c2e");
      }
      dither(ctx, 0, 20, W, 8, "#2a2026", "#8f6f57", 6);
      dither(ctx, 0, 40, W, 11, "#2a2026", "#6d554a", 5);
      for (let i = 0; i < 6; i += 1) {
        ctx.fillStyle = "#c9a97a";
        ctx.fillRect(Math.floor(rnd() * W), 10 + Math.floor(rnd() * 8), 1, 1);
      }
    },
    /* dust arena */
    (ctx, r, rnd) => {
      ramp(ctx, 0, 0, W, 20, ["#f6e0b4", "#e2c48a", "#c8a465"]);
      for (let i = 0; i < 3; i += 1) {
        const y = 12 + i * 3;
        dither(ctx, 0, y, W, 2, "transparent", "#b08d4f", 4 + i * 2);
      }
      px(ctx, 0, 24, W, H - 24, "#c9a468");
      for (let y = 24; y < H; y += 1) {
        dither(ctx, 0, y, W, 1, "#c9a468", "#a8834c", Math.round(((y - 24) / (H - 24)) * 10));
      }
      for (let i = 0; i < 18; i += 1) {
        ctx.fillStyle = "#b9955c";
        ctx.fillRect(Math.floor(rnd() * W), 30 + Math.floor(rnd() * 18), 3, 1);
      }
      for (let i = 0; i < 3; i += 1) {
        const px1 = 5 + i * 30;
        px(ctx, px1, 27, 2, 20, "#6d5330");
        px(ctx, px1, 26, 2, 2, "#8f6f42");
      }
      px(ctx, 6, 30, 58, 1, "#7d5f36");
      px(ctx, 6, 31, 58, 1, "#e6c88f");
      px(ctx, 6, 36, 58, 1, "#7d5f36");
      px(ctx, 6, 37, 58, 1, "#b9955c");
      for (let i = 0; i < 4; i += 1) {
        const sx = 12 + i * 16;
        dither(ctx, sx, 34 + i, 8, 2, "transparent", "#241a12", 3);
      }
    },
  ],

  Colorless: [
    /* cloud sea */
    (ctx, r, rnd) => {
      ramp(ctx, 0, 0, W, 30, ["#cfe4f5", "#a9cbe8", "#7fa8d0"]);
      softCloud(ctx, 2, 8, 26, "#ffffff", "#e2eefa");
      softCloud(ctx, 34, 12, 30, "#f7fbff", "#dbe9f7");
      softCloud(ctx, 16, 22, 34, "#ffffff", "#e6f0fa");
      px(ctx, 0, 34, W, H - 34, "#f2f7fc");
      dither(ctx, 0, 32, W, 5, "transparent", "#cfe4f5", 7);
      for (let i = 0; i < 4; i += 1) {
        const y = 38 + i * 3;
        dither(ctx, 0, y, W, 2, "transparent", "#a9cbe8", 3);
      }
      for (let i = 0; i < 3; i += 1) {
        const x = 10 + i * 22;
        const y = 10 + (i % 2) * 6;
        px(ctx, x, y, 1, 1, "#5c7fa8");
        px(ctx, x + 1, y, 1, 1, "#5c7fa8");
        px(ctx, x + 2, y, 1, 1, "#7f9bbd");
      }
    },
    /* skyline dusk */
    (ctx, r, rnd) => {
      ramp(ctx, 0, 0, W, 34, ["#f4c9a0", "#dfa07c", "#a9716a"]);
      disc(ctx, 50, 22, 6, "#ffe9bd");
      dither(ctx, 0, 28, W, 10, "transparent", "#c98d7c", 5);
      let x = 0;
      while (x < W) {
        const bw = 5 + Math.round(rnd() * 7);
        const bh = 10 + Math.round(rnd() * 14);
        px(ctx, x, 44 - bh, bw, bh, "#3f3350");
        for (let wy = 46 - bh; wy < 42; wy += 3) {
          for (let wx = x + 1; wx < x + bw - 1; wx += 2) {
            if (rnd() > 0.55) px(ctx, wx, wy, 1, 1, "#ffd98a");
          }
        }
        x += bw + 1;
      }
      px(ctx, 0, 44, W, H - 44, "#2b2438");
      dither(ctx, 0, 42, W, 4, "#2b2438", "#5a4a6e", 5);
    },
    /* open plain */
    (ctx, r, rnd) => {
      ramp(ctx, 0, 0, W, 26, ["#fff0cf", "#f5d79c", "#dfb877"]);
      disc(ctx, 12, 14, 5, "#fffbe6");
      dither(ctx, 6, 8, 14, 14, "transparent", "#fff8d8", 5);
      ridge(ctx, 28, 4, 14, "#c9a463", 20);
      px(ctx, 0, 30, W, H - 30, "#d9b877");
      dither(ctx, 0, 30, W, 4, "#d9b877", "#efe0b0", 7);
      for (let i = 0; i < 5; i += 1) {
        const x = 6 + i * 14 + Math.round(rnd() * 3);
        px(ctx, x, 34, 1, 6, "#7a5f33");
        px(ctx, x - 2, 31, 6, 3, "#8f7040");
        px(ctx, x - 1, 30, 4, 1, "#a8864f");
      }
      for (let i = 0; i < 24; i += 1) tuft(ctx, Math.floor(rnd() * W), 40 + Math.floor(rnd() * 9), 2, "#b99a5f");
    },
  ],
};

const cache = new Map();

export function backgroundFor(card) {
  const set = SCENES[card.tcg] || SCENES.Colorless;
  const variant = Math.abs(card.id) % set.length;
  const key = `${card.tcg || "Colorless"}:${variant}`;
  if (cache.has(key)) return cache.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  set[variant](ctx, null, seedOf(card, variant));
  for (let i = 0; i < 4; i += 1) {
    dither(ctx, 0, i, W, 1, "transparent", "#1b1630", 6 - i);
    dither(ctx, 0, H - 1 - i, W, 1, "transparent", "#1b1630", 6 - i);
    dither(ctx, i, 0, 1, H, "transparent", "#1b1630", 5 - i);
    dither(ctx, W - 1 - i, 0, 1, H, "transparent", "#1b1630", 5 - i);
  }
  cache.set(key, canvas);
  return canvas;
}
