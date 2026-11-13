/* Fishing engine adapted from Pixel Plays by AmirMushich (MIT).
   https://github.com/amirmushichge/pixel-plays

   MIT License

   Copyright (c) 2026 Amir Mushich

   Permission is hereby granted, free of charge, to any person obtaining a copy
   of this software and associated documentation files (the "Software"), to deal
   in the Software without restriction, including without limitation the rights
   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   copies of the Software, and to permit persons to whom the Software is
   furnished to do so, subject to the following conditions:

   The above copyright notice and this permission notice shall be included in all
   copies or substantial portions of the Software.

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   SOFTWARE.

   The original is a page of globals (W, H, S, canvas, ctx, clamp, lerp...).
   Here the same rasteriser lives inside createEngine(canvas, scene) so nothing
   touches window, and the five games' constants never collide with the site. */

const PixelEngine = (() => {
  const W = 360;
  const H = 280;
  const S = 10;
  const SIN = 0.5;
  const COS = Math.sqrt(3) / 2;
  const R2 = Math.SQRT2;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(
    (v) => (v + 0.5) / 16,
  );
  const COOL = [46, 38, 84];
  const WARM = [255, 232, 180];
  const SHOE = [226, 222, 212];
  const BARK = [92, 74, 60];
  const GRASS = [
    [34, 62, 50],
    [52, 88, 52],
    [82, 118, 54],
    [124, 146, 62],
    [168, 172, 76],
  ];
  const GRADIENT_Y = COS / (S * SIN);
  const EDGE = 0.28;
  const GRID = 0.07;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t);
  const hash = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const noise = (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = ease(x - ix);
    const fy = ease(y - iy);
    return lerp(
      lerp(hash(ix, iy), hash(ix + 1, iy), fx),
      lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), fx),
      fy,
    );
  };
  const rgb = (r, g, b) =>
    ((255 << 24) |
      (Math.min(255, b | 0) << 16) |
      (Math.min(255, g | 0) << 8) |
      Math.min(255, r | 0)) >>>
    0;

  const KIND_NONE = 0;
  const KIND_GROUND = 1;
  const KIND_WATER = 2;
  const KIND_GRASS = 3;

  function createEngine(canvas, scene = {}) {
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    const image = ctx.createImageData(W, H);
    const pix = new Uint32Array(image.data.buffer);
    const zb = new Float32Array(W * H);
    const bakedPix = new Uint32Array(W * H);
    const bakedZ = new Float32Array(W * H);
    const ground = new Uint8Array(W * H);
    /* Float, not bytes: a leaf shadow asks for 0.4 strength and a byte array
       would truncate that to nothing. */
    const shadowMask = new Float32Array(W * H);
    const groundZ = new Float32Array(W * H);
    const kinds = new Uint8Array(W * H);
    const staticShadow = new Uint8Array(W * H);
    /* Sprites whose pixels could not be read (a tainted canvas) are drawn
       unmodified over the composited frame instead of being dropped. */
    const fallbacks = [];

    const ramps = new WeakMap();
    function rampOf(c) {
      let ramp = ramps.get(c);
      if (ramp) return ramp;
      const mix = (m, tint, k) =>
        rgb(
          lerp(c[0] * m, tint[0], k),
          lerp(c[1] * m, tint[1], k),
          lerp(c[2] * m, tint[2], k),
        );
      ramp = [
        mix(0.4, COOL, 0.34),
        mix(0.62, COOL, 0.18),
        mix(0.84, COOL, 0.05),
        mix(1, WARM, 0),
        mix(1.1, WARM, 0.22),
      ];
      ramps.set(c, ramp);
      return ramp;
    }

    /* plane() asks for a colour per world cell; keying the ramp by value
       keeps one ramp per shade instead of one per array instance. */
    const colorCache = new Map();
    function rampFor(r, g, b) {
      const key = `${r | 0},${g | 0},${b | 0}`;
      let ramp = colorCache.get(key);
      if (!ramp) {
        ramp = rampOf([r | 0, g | 0, b | 0]);
        colorCache.set(key, ramp);
      }
      return ramp;
    }

    const bayerAt = (ix, iy) => BAYER[(iy & 3) * 4 + (ix & 3)];
    function tint(i, r, g, b) {
      const c = pix[i];
      pix[i] = rgb((c & 255) * r, ((c >> 8) & 255) * g, ((c >> 16) & 255) * b);
    }

    const camera = {
      ox: W / 2,
      oy: H / 2 + (scene.originY || 0),
      s: scene.scale || S,
      shadowX: scene.shadowX == null ? 1.3 : scene.shadowX,
      shadowY: scene.shadowY == null ? -0.12 : scene.shadowY,
    };

    function project(x, y, z) {
      const u = (x - y) / R2;
      const v = (x + y) / R2;
      return {
        sx: camera.ox + u * camera.s,
        sy: camera.oy + (v * SIN - z * COS) * camera.s,
        d: v * COS + z * SIN,
      };
    }
    function unproject(sx, sy) {
      const u = (sx - camera.ox) / camera.s;
      const v = (sy - camera.oy) / (camera.s * SIN);
      return { x: (u + v) / R2, y: (v - u) / R2 };
    }

    let capture = null;
    function sphere(x, y, z, r, c, mode) {
      const ramp = rampOf(c);
      const p = project(x, y, z);
      const rp = Math.max(r * camera.s, 0.75);
      const y0 = Math.max(0, Math.floor(p.sy - rp));
      const y1 = Math.min(H - 1, Math.ceil(p.sy + rp));
      const x0 = Math.max(0, Math.floor(p.sx - rp));
      const x1 = Math.min(W - 1, Math.ceil(p.sx + rp));
      for (let iy = y0; iy <= y1; iy += 1)
        for (let ix = x0; ix <= x1; ix += 1) {
          const dx = (ix + 0.5 - p.sx) / rp;
          const dy = (iy + 0.5 - p.sy) / rp;
          const nn = dx * dx + dy * dy;
          if (nn > 1) continue;
          const nz = Math.sqrt(1 - nn);
          const d = p.d + r * nz;
          const i = iy * W + ix;
          if (d <= zb[i]) continue;
          let l = clamp(-0.55 * dx - 0.6 * dy + 0.58 * nz, 0, 1);
          if (mode === "rough") l += (hash(ix, iy) - 0.5) * 0.55;
          if (dy > 0.35) l = Math.max(l, 0.12 + dy * 0.24);
          if (capture) {
            capture.push(
              ix,
              iy,
              d,
              ramp[
                clamp(
                  Math.floor(
                    l * 4.4 + 0.2 + (bayerAt(ix, iy) - 0.5) * 0.7,
                  ),
                  0,
                  4,
                )
              ],
            );
            continue;
          }
          zb[i] = d;
          if (mode === "gloss" && l > 0.9) {
            pix[i] = rgb(255, 250, 232);
            continue;
          }
          if (mode === "solid") {
            pix[i] = ramp[clamp(Math.floor(l * 4.4 + 0.2), 1, 4)];
            continue;
          }
          pix[i] =
            ramp[
              clamp(
                Math.floor(l * 4.4 + 0.2 + (bayerAt(ix, iy) - 0.5) * 0.7),
                0,
                4,
              )
            ];
        }
    }

    function capsule(a, b, r0, r1, colorOf, mode) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const n = Math.max(1, Math.ceil(len / (Math.min(r0, r1) * 0.45)));
      for (let k = 0; k <= n; k += 1) {
        const t = k / n;
        const z = lerp(a[2], b[2], t);
        sphere(
          lerp(a[0], b[0], t),
          lerp(a[1], b[1], t),
          z,
          lerp(r0, r1, t),
          colorOf(z),
          mode,
        );
      }
    }

    function box(x0, y0, z0, x1, y1, z1, c, seed = 0) {
      const ramp = rampOf(c);
      const paint = (x, y, z, base, grain) => {
        const p = project(x, y, z);
        const ix = p.sx | 0;
        const iy = p.sy | 0;
        if (ix < 0 || iy < 0 || ix >= W || iy >= H) return;
        const i = iy * W + ix;
        if (p.d <= zb[i]) return;
        zb[i] = p.d;
        pix[i] =
          ramp[
            clamp(
              Math.floor(
                base + (grain - 0.5) * 1.3 + (bayerAt(ix, iy) - 0.5) * 0.5,
              ),
              0,
              4,
            )
          ];
      };
      const step = 0.045;
      const longX = x1 - x0 >= y1 - y0;
      for (let a = x0; a <= x1; a += step)
        for (let b = y0; b <= y1; b += step)
          paint(
            a,
            b,
            z1,
            3.4,
            longX ? noise(a * 0.8 + seed, b * 9) : noise(a * 9, b * 0.8 + seed),
          );
      for (let a = x0; a <= x1; a += step)
        for (let b = z0; b <= z1; b += step)
          paint(a, y1, b, 2.3, noise(a * 0.8 + seed, b * 9));
      for (let a = y0; a <= y1; a += step)
        for (let b = z0; b <= z1; b += step)
          paint(x1, a, b, 1.2, noise(a * 0.8 + seed, b * 9));
    }

    /* A flat slab of world painted straight into the buffers. The two games
       that need a sea and a shore use this instead of a mesh. */
    function plane(x0, y0, x1, y1, z, colorOf, kind = KIND_GROUND) {
      for (let a = x0; a <= x1; a += GRID)
        for (let b = y0; b <= y1; b += GRID) {
          const p = project(a, b, z);
          const ix = p.sx | 0;
          const iy = p.sy | 0;
          if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue;
          const i = iy * W + ix;
          if (p.d <= zb[i]) continue;
          const shade = colorOf(a, b);
          const ramp = rampFor(shade[0], shade[1], shade[2]);
          const step = noise(a * 0.9, b * 0.9) * 0.7 + (bayerAt(ix, iy) - 0.5) * 0.5;
          zb[i] = p.d;
          pix[i] = ramp[clamp(Math.floor(3.15 + step), 2, 4)];
          ground[i] = 1;
          groundZ[i] = p.d;
          if (kind) kinds[i] = kind;
        }
    }

    /* A shaped slab rather than a rectangle: the sample callback decides the
       height, colour and kind of each world cell, or returns null to leave it
       empty. Islands and ponds are built with this. */
    function field(x0, y0, x1, y1, step, sample) {
      for (let a = x0; a <= x1; a += step)
        for (let b = y0; b <= y1; b += step) {
          const cell = sample(a, b);
          if (!cell) continue;
          const p = project(a, b, cell.z || 0);
          const ix = p.sx | 0;
          const iy = p.sy | 0;
          if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue;
          const i = iy * W + ix;
          if (p.d <= zb[i]) continue;
          const ramp = rampFor(cell.color[0], cell.color[1], cell.color[2]);
          const grain =
            (bayerAt(ix, iy) - 0.5) * 0.55 + (cell.shade || 0);
          zb[i] = p.d;
          pix[i] = ramp[clamp(Math.floor(3.2 + grain), 2, 4)];
          if (cell.kind) {
            ground[i] = 1;
            groundZ[i] = p.d;
            kinds[i] = cell.kind;
          }
        }
    }

    function castShadow(x, y, z, r, strength = 1, dither = 0.4) {
      const p = project(
        x + camera.shadowX * z,
        y + camera.shadowY * z,
        0,
      );
      const rx = r * camera.s * 1.05;
      const ry = rx * SIN + 1;
      const y0 = Math.max(0, Math.floor(p.sy - ry));
      const y1 = Math.min(H - 1, Math.ceil(p.sy + ry));
      const x0 = Math.max(0, Math.floor(p.sx - rx));
      const x1 = Math.min(W - 1, Math.ceil(p.sx + rx));
      for (let iy = y0; iy <= y1; iy += 1)
        for (let ix = x0; ix <= x1; ix += 1) {
          const dx = (ix + 0.5 - p.sx) / rx;
          const dy = (iy + 0.5 - p.sy) / ry;
          if (dx * dx + dy * dy + (bayerAt(ix, iy) - 0.5) * dither > 1) continue;
          const i = iy * W + ix;
          if (shadowMask[i] < strength) shadowMask[i] = strength;
        }
    }

    function applyShadows(refZ = groundZ) {
      for (let i = 0; i < pix.length; i += 1) {
        const s = shadowMask[i];
        if (!s) continue;
        shadowMask[i] = 0;
        if (!ground[i] || zb[i] !== refZ[i]) continue;
        if (s >= 0.75) tint(i, 0.36, 0.34, 0.56);
        else tint(i, 0.62, 0.6, 0.78);
      }
    }

    function shadeEdges() {
      for (let iy = 1; iy < H - 1; iy += 1)
        for (let ix = 1; ix < W - 1; ix += 1) {
          const i = iy * W + ix;
          const d = zb[i];
          if (d < -1e8 || d === groundZ[i]) continue;
          const a = i - W;
          const b = i + W;
          const c = i - 1;
          const e = i + 1;
          if (
            zb[a] === groundZ[a] ||
            zb[b] === groundZ[b] ||
            zb[c] === groundZ[c] ||
            zb[e] === groundZ[e]
          ) {
            tint(i, 0.68, 0.66, 0.76);
          } else if (d - zb[a] - GRADIENT_Y > EDGE || d - zb[c] > EDGE) {
            const p = pix[i];
            pix[i] = rgb(
              lerp(p & 255, WARM[0], 0.3),
              lerp((p >> 8) & 255, WARM[1], 0.3),
              lerp((p >> 16) & 255, WARM[2], 0.22),
            );
          } else if (zb[e] - d > EDGE || zb[b] - GRADIENT_Y - d > EDGE) {
            tint(i, 0.74, 0.72, 0.82);
          }
        }
    }

    function bakeOcclusion() {
      const offsets = [];
      for (const r of [2, 4])
        for (let k = 0; k < 8; k += 1) {
          offsets.push([
            Math.round(Math.cos((k * Math.PI) / 4) * r),
            Math.round((Math.sin((k * Math.PI) / 4) * r) * 0.7),
          ]);
        }
      for (let iy = 4; iy < H - 4; iy += 1)
        for (let ix = 4; ix < W - 4; ix += 1) {
          const i = iy * W + ix;
          if (!ground[i] || zb[i] !== groundZ[i]) continue;
          let hits = 0;
          for (const [ox, oy] of offsets) {
            const j = (iy + oy) * W + ix + ox;
            if (zb[j] !== groundZ[j]) hits += 1;
          }
          if (!hits) continue;
          if (hits >= 8) tint(i, 0.56, 0.54, 0.72);
          else if (hits / 8 > bayerAt(ix, iy)) tint(i, 0.74, 0.72, 0.84);
        }
    }

    function plot(x, y, z, color) {
      const p = project(x, y, z);
      const ix = p.sx | 0;
      const iy = p.sy | 0;
      if (ix < 0 || iy < 0 || ix >= W || iy >= H) return;
      const i = iy * W + ix;
      if (p.d <= zb[i]) return;
      zb[i] = p.d;
      pix[i] = color;
    }

    /* Wipe every buffer for a new level: terrain, depth, wind and any baked
       foliage from the previous diorama. */
    function clear() {
      pix.fill(0);
      zb.fill(-1e9);
      ground.fill(0);
      groundZ.fill(0);
      kinds.fill(0);
      shadowMask.fill(0);
      tufts.length = 0;
      leaves.length = 0;
    }

    /* Freeze the static half of the diorama. The frame then starts from this
       copy, so only the water, the angler and the bobber cost anything. */
    function bake() {
      bakedPix.set(pix);
      bakedZ.set(zb);
      staticShadow.set(shadowMask);
      shadowMask.fill(0);
    }

    function resetFrame() {
      pix.set(bakedPix);
      zb.set(bakedZ);
      shadowMask.fill(0);
    }

    const WIND_FPS = 8;
    const STILL =
      typeof matchMedia === "function"
        ? matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;
    const tufts = [];
    const leaves = [];
    const tuftLit = GRASS.map((c) => rgb(...c));
    const tuftDark = GRASS.map((c) =>
      rgb(c[0] * 0.54, c[1] * 0.52, c[2] * 0.72),
    );

    function growGrass() {
      tufts.length = 0;
      for (let iy = 3; iy < H; iy += 1)
        for (let ix = 0; ix < W; ix += 1) {
          const i = iy * W + ix;
          if (kinds[i] !== KIND_GRASS || hash(ix * 3, iy * 5) > 0.17) continue;
          const height = 1 + ((hash(ix, iy * 2) * 3) | 0);
          tufts.push({
            ix,
            iy,
            i,
            height,
            base: Math.round(noise(ix * 0.09, iy * 0.18) * 2.2),
            phase: ix * 0.11 + iy * 0.19 + hash(ix, iy) * 0.9,
            bloom:
              hash(ix * 7, iy) < 0.022
                ? rgb(...(hash(ix, iy) > 0.5 ? [250, 246, 226] : [240, 200, 84]))
                : 0,
          });
        }
    }

    function drawTufts(t) {
      /* Whole pixels at 8 fps: the sway should look hand-animated. Under
         reduced motion the tufts still draw, just at rest. */
      t = STILL ? 0 : Math.floor(t * WIND_FPS) / WIND_FPS;
      for (const tuft of tufts) {
        const gust =
          Math.sin(t * 0.8 + tuft.phase) +
          0.5 * Math.sin(t * 2.1 + tuft.phase * 2.3);
        const colors = staticShadow[tuft.i] ? tuftDark : tuftLit;
        for (let k = 1; k <= tuft.height; k += 1) {
          const jx = tuft.ix + Math.round(((gust * 0.95) * k) / 3);
          const jy = tuft.iy - k;
          if (jx < 0 || jx >= W) continue;
          const j = jy * W + jx;
          if (
            (kinds[j] !== KIND_GRASS && kinds[j] !== KIND_NONE) ||
            zb[j] !== groundZ[j]
          )
            continue;
          pix[j] =
            tuft.bloom && k === tuft.height
              ? tuft.bloom
              : colors[clamp(tuft.base + k + (gust > 1 ? 1 : 0), 1, 4)];
        }
      }
    }

    function drawLeaves(t) {
      t = STILL ? 0 : Math.floor(t * WIND_FPS) / WIND_FPS;
      for (const leaf of leaves) {
        const reach = clamp((leaf.z - 2.5) / 3, 0.3, 1);
        const swayX =
          (Math.sin(t * 0.9 + leaf.x * 0.5 + leaf.z * 0.7) +
            0.55 * Math.sin(t * 2.3 + leaf.k * 1.7)) *
          reach;
        const dx = Math.round(swayX * 0.9);
        const dy = Math.round(
          Math.sin(t * 1.3 + leaf.y + leaf.k) * reach * 0.45,
        );
        const px = leaf.pixels;
        for (let n = 0; n < px.length; n += 4) {
          const ix = px[n] + dx;
          const iy = px[n + 1] + dy;
          if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue;
          const i = iy * W + ix;
          if (px[n + 2] <= zb[i]) continue;
          zb[i] = px[n + 2];
          pix[i] = px[n + 3];
        }
        /* Half the leaves, at less than full strength: the canopy still reads
           as a long hard shadow without turning into a black hole. */
        if (leaf.k % 2 === 0)
          castShadow(leaf.x + swayX * 0.12, leaf.y, leaf.z, leaf.r * 0.5, 0.32);
      }
    }

    const CROWN = [
      [0.1, 0, 3.7, 1.6],
      [-1.4, -0.7, 3.3, 1.2],
      [1.6, 0.7, 3.4, 1.25],
      [-0.6, 1.1, 3.9, 1.1],
      [0.9, -1.1, 4, 1.1],
      [0.2, 0.1, 4.9, 1.05],
    ];
    const LEAF_DEEP = [58, 84, 62];
    const LEAF_MID = [100, 126, 78];
    const LEAF_SILVER = [146, 162, 112];

    function growTree(x, y, scale = 1, count = 300, seed = 0, palette) {
      const leafDeep = palette?.deep ?? LEAF_DEEP;
      const leafMid = palette?.mid ?? LEAF_MID;
      const leafSilver = palette?.silver ?? LEAF_SILVER;
      const bark = () => palette?.bark ?? BARK;
      capsule(
        [x, y, 0],
        [x + 0.3 * scale, y + 0.1 * scale, 2.2 * scale],
        0.36 * scale,
        0.22 * scale,
        bark,
        "rough",
      );
      capsule(
        [x + 0.3 * scale, y + 0.1 * scale, 2.2 * scale],
        [x - 0.8 * scale, y - 0.4 * scale, 3.3 * scale],
        0.2 * scale,
        0.13 * scale,
        bark,
        "rough",
      );
      capsule(
        [x + 0.3 * scale, y + 0.1 * scale, 2.2 * scale],
        [x + 1.2 * scale, y + 0.4 * scale, 3.4 * scale],
        0.2 * scale,
        0.13 * scale,
        bark,
        "rough",
      );
      for (let n = 0; n < count; n += 1) {
        const k = n + seed;
        const [cx, cy, cz, spread] = CROWN[n % CROWN.length];
        const a = hash(k, 7) * 6.283;
        const tilt = hash(k, 8) * 2 - 1;
        const d = Math.cbrt(hash(k, 9)) * spread;
        const flat = Math.sqrt(1 - tilt * tilt);
        const rx = cx + Math.cos(a) * flat * d;
        const ry = cy + Math.sin(a) * flat * d;
        const rz = cz + tilt * d * 0.8;
        const tone =
          hash(k, 10) + (rz - 4.2) * 0.22 + (d / spread - 0.5) * 0.3;
        const leafTone =
          tone > 0.72 ? leafSilver : tone > 0.3 ? leafMid : leafDeep;
        capture = [];
        sphere(
          x + rx * scale,
          y + ry * scale,
          rz * scale,
          (0.2 + hash(k, 11) * 0.22) * scale,
          leafTone,
          "rough",
        );
        leaves.push({
          x: x + rx * scale,
          y: y + ry * scale,
          z: rz * scale,
          k,
          r: 0.42 * scale,
          pixels: capture,
        });
        capture = null;
      }
    }

    const pendingShadows = [];
    const dynamicAdd = (a, b, r0, r1, f) => {
      capsule(a, b, r0, r1, f, "solid");
      pendingShadows.push(a, r0, b, r1);
    };

    function flushShadows() {
      for (let i = 0; i < pendingShadows.length; i += 4) {
        const a = pendingShadows[i];
        const ra = pendingShadows[i + 1];
        const c = pendingShadows[i + 2];
        const n = Math.max(
          1,
          Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]) / 0.25),
        );
        for (let k = 0; k <= n; k += 1) {
          const t = k / n;
          castShadow(
            lerp(a[0], c[0], t),
            lerp(a[1], c[1], t),
            lerp(a[2], c[2], t),
            ra * 0.55,
            0.7,
            0,
          );
        }
        if (a[2] < 0.25) castShadow(a[0], a[1], 0, 0.24, 1.4, 0);
      }
      pendingShadows.length = 0;
    }

    function figure(px, py, yaw, pose, palette, addBone = dynamicAdd) {
      const fx = Math.cos(yaw);
      const fy = Math.sin(yaw);
      const sx = -fy;
      const sy = fx;
      const base = pose.z || 0;
      const k = pose.scale || 1;
      const P = (a, b, c) => [
        px + (fx * a + sx * b) * k,
        py + (fy * a + sy * b) * k,
        c * k + base,
      ];
      const add = (a, b, r0, r1, f) => addBone(a, b, r0 * k, r1 * k, f);
      const t = palette;
      const shirt = (z) => (Math.floor(z * 3.2) % 2 ? t.shirt : t.stripe);
      const legs = () => t.legs;
      const skin = () => t.skin;
      const crouch = pose.crouch || 0;
      const lean = pose.lean || 0;
      const hipZ = 1.28 - crouch * 0.4;
      const hipA = -crouch * 0.15;
      const shA = hipA + Math.sin(lean) * 0.95;
      const shZ = hipZ + Math.cos(lean) * 0.95;
      const neck = P(shA, 0, shZ + 0.08);
      const head = P(shA + Math.sin(lean) * 0.32, 0, shZ + 0.36);
      const stance = pose.stance == null ? 0.2 : pose.stance;
      const footB = P(-stance * 1.2, 0.2, 0.12);
      const footF = P(stance * 2, -0.2, 0.12);
      const kneeB = P(-stance * 0.4 + crouch * 0.12, 0.22, 0.68 - crouch * 0.1);
      const kneeF = P(
        stance * 1.2 + crouch * 0.34,
        -0.22,
        0.72 - crouch * 0.08,
      );
      const hipB = P(hipA, 0.15, hipZ);
      const hipF = P(hipA, -0.15, hipZ);
      add(hipB, kneeB, 0.17, 0.13, legs);
      add(kneeB, footB, 0.13, 0.1, legs);
      add(hipF, kneeF, 0.17, 0.13, legs);
      add(kneeF, footF, 0.13, 0.1, legs);
      add(footB, P(-stance * 1.2 + 0.16, 0.2, 0.08), 0.1, 0.09, () => SHOE);
      add(footF, P(stance * 2 + 0.16, -0.2, 0.08), 0.1, 0.09, () => SHOE);
      add(P(hipA, 0, hipZ), neck, 0.3, 0.32, shirt);
      add(neck, head, 0.11, 0.12, skin);
      add(head, head, 0.24, 0.24, () => t.skin);
      add(
        [head[0] - fx * 0.06, head[1] - fy * 0.06, head[2] + 0.08],
        [head[0] - fx * 0.06, head[1] - fy * 0.06, head[2] + 0.08],
        0.205,
        0.205,
        () => t.hair,
      );
      const shR = P(shA, 0.36, shZ - 0.03);
      const shL = P(shA, -0.36, shZ - 0.03);
      const armR = pose.armR == null ? 0 : pose.armR;
      const armL = pose.armL == null ? 0.08 : pose.armL;
      const elbowR = P(
        shA + Math.sin(armR) * 0.46,
        0.4,
        shZ - 0.03 - Math.cos(armR) * 0.46,
      );
      const handR = P(
        shA + Math.sin(armR + 0.18) * 0.95,
        0.42,
        shZ - 0.03 - Math.cos(armR + 0.18) * 0.95,
      );
      const elbowL = P(
        shA + Math.sin(armL) * 0.46,
        -0.42,
        shZ - 0.03 - Math.cos(armL) * 0.46,
      );
      const handL = P(
        shA + Math.sin(armL + 0.2) * 0.9,
        -0.43,
        shZ - 0.03 - Math.cos(armL + 0.2) * 0.9,
      );
      add(shR, elbowR, 0.12, 0.1, shirt);
      add(elbowR, handR, 0.09, 0.08, skin);
      add(shL, elbowL, 0.12, 0.1, shirt);
      add(elbowL, handL, 0.09, 0.08, skin);
      return handR;
    }

    /* A sprite is a Uint32Array of premultiplied-by-nothing RGBA pixels read
       back once from an <img>. Drawing walks the source pixels and writes the
       destination nearest-neighbour, so the art keeps its hard edges. */
    function drawSprite(sprite, ax, ay, height, opts = {}) {
      if (!sprite) return null;
      if (!sprite.data) {
        if (sprite.img) fallbacks.push({ img: sprite.img, ax, ay, height });
        return null;
      }
      /* Game Boy sprites are 56px; a 16px silhouette samples every third
         source pixel, a 120px portrait copies each one twice. */
      const step = height < sprite.h ? Math.max(1, Math.round(sprite.h / height)) : 1;
      const scale = step === 1 ? Math.max(1, Math.round(height / sprite.h)) : 1;
      const w = Math.ceil(sprite.w / step) * scale;
      const h = Math.ceil(sprite.h / step) * scale;
      const left = Math.round(ax - w / 2);
      const top = Math.round(ay - h);
      const data = sprite.data;
      const dither = opts.dither || 0;
      const tintColor = opts.tint || null;
      const alpha = opts.alpha == null ? 1 : opts.alpha;
      const flip = !!opts.flip;
      for (let sy = 0; sy < sprite.h; sy += step)
        for (let sx = 0; sx < sprite.w; sx += step) {
          const pixel = data[sy * sprite.w + sx];
          if ((pixel >>> 24) < 128) continue;
          let r = pixel & 255;
          let g = (pixel >> 8) & 255;
          let b = (pixel >> 16) & 255;
          if (tintColor) {
            r = lerp(r, tintColor[0], alpha);
            g = lerp(g, tintColor[1], alpha);
            b = lerp(b, tintColor[2], alpha);
          }
          const cellX = (flip ? sprite.w - 1 - sx : sx) / step;
          for (let oy = 0; oy < scale; oy += 1)
            for (let ox = 0; ox < scale; ox += 1) {
              const dx = left + cellX * scale + ox;
              const dy = top + (sy / step) * scale + oy;
              if (dx < 0 || dy < 0 || dx >= W || dy >= H) continue;
              const i = dy * W + dx;
              if (dither && (bayerAt(dx, dy) < dither)) continue;
              if (opts.depth != null && opts.depth <= zb[i]) continue;
              pix[i] = rgb(r, g, b);
            }
        }
      return { left, top, w, h };
    }

    /* Water moves as slow tone bands laid over the baked surface: two
       neighbouring tones and a sparse dither, never a gradient. */
    function animateWater(t, mask, strength = 1) {
      for (let iy = 0; iy < H; iy += 1)
        for (let ix = 0; ix < W; ix += 1) {
          const i = iy * W + ix;
          if (kinds[i] !== mask) continue;
          if (zb[i] !== groundZ[i]) continue;
          const wave =
            Math.sin(t * 0.9 + (ix * 0.06 + iy * 0.13)) * 0.55 +
            Math.sin(t * 1.7 - ix * 0.03) * 0.2;
          const band = wave * strength;
          if (band > 0.42) tint(i, 1.06, 1.05, 1.02);
          else if (band > 0.08 && bayerAt(ix, iy) < 0.45) tint(i, 1.04, 1.03, 1.01);
          else if (band < -0.42) tint(i, 0.9, 0.91, 0.97);
        }
    }

    /* Whole-pixel screen-space marks used by the bobber, line, gauges and
       splash droplets. */
    function dot(x, y, color) {
      const ix = x | 0;
      const iy = y | 0;
      if (ix < 0 || iy < 0 || ix >= W || iy >= H) return;
      pix[iy * W + ix] = color;
    }
    function line(x0, y0, x1, y1, color, thickness = 1) {
      const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
      for (let k = 0; k <= steps; k += 1) {
        const x = lerp(x0, x1, k / steps);
        const y = lerp(y0, y1, k / steps);
        for (let oy = 0; oy < thickness; oy += 1)
          for (let ox = 0; ox < thickness; ox += 1)
            dot(Math.round(x) + ox, Math.round(y) + oy, color);
      }
    }
    function ring(cx, cy, radius, squash, color, gap = 0) {
      if (radius <= 0) return;
      const steps = Math.max(8, Math.round(radius * 7));
      for (let k = 0; k < steps; k += 1) {
        if (gap && k % gap < gap / 2) continue;
        const a = (k / steps) * Math.PI * 2;
        dot(
          Math.round(cx + Math.cos(a) * radius),
          Math.round(cy + Math.sin(a) * radius * squash),
          color,
        );
      }
    }

    let shakeFrames = 0;
    let shakeAmount = 0;
    function shake(frames, amount) {
      shakeFrames = frames;
      shakeAmount = amount;
    }

    const edgeMask = new Float32Array(W * H);
    for (let iy = 0; iy < H; iy += 1)
      for (let ix = 0; ix < W; ix += 1) {
        const ex = Math.abs(ix - W / 2) / (W / 2 - 1);
        const ey = Math.abs(iy - H / 2) / (H / 2 - 1);
        const worst = Math.max(ex, ey);
        const grain = hash(ix * 0.7, iy * 0.7) * 0.16;
        edgeMask[iy * W + ix] = 1 - (worst - 0.8) / 0.2 + grain;
      }

    const stage = document.createElement("canvas");
    stage.width = W;
    stage.height = H;
    const stageCtx = stage.getContext("2d");
    const stageImage = stageCtx.createImageData(W, H);
    const stagePix = new Uint32Array(stageImage.data.buffer);

    /* Composite: the diorama dissolves into the page with a ragged, dithered
       edge, which is what makes it read as a small place rather than a video. */
    function present(backgroundColor) {
      let dx = 0;
      let dy = 0;
      if (shakeFrames > 0) {
        dx = (shakeFrames % 2 ? 1 : -1) * shakeAmount;
        dy = shakeFrames % 3 === 0 ? shakeAmount : 0;
        shakeFrames -= 1;
      }
      stagePix.set(pix);
      for (let iy = 0; iy < H; iy += 1)
        for (let ix = 0; ix < W; ix += 1) {
          const i = iy * W + ix;
          if (zb[i] < -1e8) {
            stagePix[i] = 0;
            continue;
          }
          const cover = edgeMask[i];
          if (cover < 1 && bayerAt(ix, iy) > cover) stagePix[i] = 0;
        }
      stageCtx.putImageData(stageImage, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (backgroundColor) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(stage, dx, dy);
      for (const fallback of fallbacks) {
        const ratio = fallback.img.naturalWidth / fallback.img.naturalHeight || 1;
        const h = fallback.height;
        const w = h * ratio;
        ctx.drawImage(
          fallback.img,
          Math.round(fallback.ax - w / 2),
          Math.round(fallback.ay - h),
          Math.round(w),
          Math.round(h),
        );
      }
      fallbacks.length = 0;
    }

    /* Integer device-pixel upscale: the canvas keeps its 360x280 buffer and
       only its CSS box grows by whole multiples. */
    function fit(width, maxScale = 4) {
      const factor = Math.max(1, Math.floor(width / W));
      const scale = Math.min(maxScale, factor);
      canvas.style.width = `${W * scale}px`;
      canvas.style.height = `${H * scale}px`;
      return scale;
    }

    return {
      W,
      H,
      S,
      KIND_NONE,
      KIND_GROUND,
      KIND_WATER,
      KIND_GRASS,
      camera,
      pix,
      zb,
      kinds,
      groundZ,
      STILL,
      rgb,
      rampOf,
      project,
      unproject,
      sphere,
      capsule,
      box,
      plane,
      field,
      canvas,
      plot,
      clear,
      ctx,
      castShadow,
      applyShadows,
      shadeEdges,
      bakeOcclusion,
      bake,
      resetFrame,
      growTree,
      growGrass,
      drawTufts,
      drawLeaves,
      figure,
      flushShadows,
      drawSprite,
      animateWater,
      dot,
      line,
      ring,
      shake,
      present,
      fit,
      hash,
      noise,
    };
  }

  return { createEngine };
})();

export default PixelEngine;
