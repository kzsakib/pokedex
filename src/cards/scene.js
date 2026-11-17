/* Low-res pixel renderer + shared Bayer-dithered material. */
import * as THREE from "three";

export const BAYER_GLSL = `
float bayer4(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  float m[16];
  m[0]=0.0;  m[1]=8.0;  m[2]=2.0;  m[3]=10.0;
  m[4]=12.0; m[5]=4.0;  m[6]=14.0; m[7]=6.0;
  m[8]=3.0;  m[9]=11.0; m[10]=1.0; m[11]=9.0;
  m[12]=15.0;m[13]=7.0; m[14]=13.0;m[15]=5.0;
  return m[y*4+x] / 16.0;
}
`;

const VERT = `
varying vec2 vUv;
varying vec3 vNormal;
void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = `
${BAYER_GLSL}
uniform sampler2D uMap;
uniform sampler2D uBack;
uniform float uTwoSided;
/* foil layers dodge the print: they multiply brightness and keep the print's
   own colour, which stays crisp instead of veiling it in white */
vec3 dodge(vec3 base, vec3 layer, float amt) {
  vec3 l = clamp(layer * amt, 0.0, 0.9);
  return clamp(base / max(1.0 - l, 0.1), 0.0, 1.0);
}

uniform sampler2D uMask;
uniform float uHolo;
uniform float uHoloDensity;
uniform vec3 uTypeCol;
uniform vec2 uTilt;
uniform float uOpacity;
uniform float uGlint;
uniform float uGlintOn;
uniform float uDim;
uniform float uFade;
uniform vec3 uTint;
uniform float uUseTint;
uniform float uFlat;
uniform float uSheen;
uniform float uEffect;
uniform float uTime;
varying vec2 vUv;
varying vec3 vNormal;

vec3 rainbow(float i) {
  if (i < 1.0) return vec3(1.0, 0.43, 0.78);
  if (i < 2.0) return vec3(1.0, 0.82, 0.25);
  if (i < 3.0) return vec3(0.48, 1.0, 0.48);
  if (i < 4.0) return vec3(0.31, 0.85, 1.0);
  if (i < 5.0) return vec3(0.54, 0.48, 1.0);
  return vec3(1.0, 0.60, 0.35);
}

void main() {
  bool backside = uTwoSided > 0.5 && !gl_FrontFacing;
  vec4 frontTex = texture2D(uMap, vUv);
  vec2 backUv = vec2(1.0 - vUv.x, vUv.y);
  vec4 backTex = texture2D(uBack, backUv);
  vec4 t = backside ? backTex : frontTex;
  if (t.a < 0.5) discard;
  float light = dot(normalize(vNormal), normalize(vec3(-0.45, 0.65, 0.9))) * 0.5 + 0.5;
  float band = floor(light * 4.0) / 4.0;
  vec3 col = uFlat > 0.5 ? t.rgb : t.rgb * (0.88 + band * 0.26);

  if (uUseTint > 0.5) col *= uTint;

  /* the foil itself is iridescent: hue slides across the card with the tilt */
  vec3 irid = rainbow(floor(fract(vUv.x * 0.35 + vUv.y * 0.55 + uTilt.x * 0.4 + uTime * 0.004) * 6.0));
  vec3 typecol = uTypeCol;

  if (!backside && uSheen > 0.5) {
    float a = uTime * 0.05 + uTilt.x * 0.6;
    float dir = cos(a), dy = sin(a);
    float sweep = fract((vUv.x * dir + vUv.y * dy) * 1.15 + uTilt.y * 0.4);
    float band = smoothstep(0.0, 0.18, sweep) * (1.0 - smoothstep(0.2, 0.5, sweep));
    float sweep2 = fract((vUv.x * -dy + vUv.y * dir) * 2.1 - uTime * 0.03);
    float band2 = smoothstep(0.0, 0.1, sweep2) * (1.0 - smoothstep(0.12, 0.3, sweep2));
    /* step the glare into three hard tones with a per-pixel dither */
    float dith = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
    band = floor(band * 3.0 + dith) / 3.0;
    band2 = floor(band2 * 2.0 + dith) / 2.0;
    col = mix(col, vec3(1.0, 0.985, 0.94), band * 0.10 + band2 * 0.03);
    float tint = 0.035 * (1.0 - smoothstep(0.0, 0.5, abs(fract(vUv.y * 1.3 + vUv.x * 0.6 + uTilt.x) - 0.5) * 2.0));
    col = mix(col, rainbow(floor(fract(vUv.x * 0.5 + vUv.y * 0.7 + uTilt.x * 0.4) * 6.0)), tint);
    col = mix(col, vec3(0.72, 0.62, 0.95), 0.03 * band);
  }

  /* the foil sheet covers the whole face: art, frame and text box alike */
  float inArt = 1.0;
  float onFrame = 1.0;

  if (!backside && uEffect > 0.5) {
    float t = uTime;
    vec2 tilt = uTilt * vec2(0.55, 0.35); /* foil slides with the pointer, parallax between layers */

    if (uEffect < 1.5) {
      /* reverse holo: the card's own type colour washes over the print as a
         gradient, sliding with the tilt and banded in hard steps */
      float grad = fract(vUv.y * 0.85 - vUv.x * 0.3 + tilt.y * 0.5 + t * 0.008);
      float bandA = smoothstep(0.0, 0.35, grad) * (1.0 - smoothstep(0.45, 0.95, grad));
      float bandB = smoothstep(0.86, 1.0, grad);
      col = dodge(col, typecol, (0.12 + 0.16 * bandA) * onFrame);
      col = dodge(col, mix(typecol, irid, 0.35), onFrame * bandB * 0.22);
      float streak = sin((vUv.x * 0.6 - vUv.y * 1.7) * 78.0 + tilt.x * 22.0) * 0.5 + 0.5;
      col = dodge(col, typecol * 1.25, onFrame * smoothstep(0.72, 1.0, streak) * 0.10);
      vec2 stamp = fract((vUv * vec2(160.0, 224.0)) / 26.0 + tilt * 0.15) - 0.5;
      float ring = smoothstep(0.30, 0.26, length(stamp)) * smoothstep(0.14, 0.20, length(stamp));
      col = dodge(col, mix(typecol, irid, 0.35), onFrame * ring * 0.16);
    } else if (uEffect < 2.5) {
      /* cosmos holo: dots and circles of different sizes inside the art, in two
         parallax layers that slide against each other as the card tilts */
      float ang = 0.6 + tilt.x * 0.5;
      vec2 uv = vUv - 0.5;
      uv = mat2(cos(ang), sin(ang), -sin(ang), cos(ang)) * uv + 0.5;
      /* the sheet itself: broad rainbow bands drifting with the tilt, plus a
         hard iridescent edge where two bands cross */
      float sheen = fract(uv.x * 0.5 + uv.y * 0.42 + tilt.x * 0.85 + t * 0.01);
      float wave = sin(sheen * 6.2831 + tilt.y * 2.0) * 0.5 + 0.5;
      col = dodge(col, rainbow(floor(sheen * 6.0)), inArt * (0.10 + 0.14 * wave));
      col = dodge(col, rainbow(floor(fract(sheen * 3.0 + 0.33) * 6.0)), inArt * smoothstep(0.55, 0.5, abs(sheen - 0.5)) * 0.10);
      float rim = smoothstep(0.88, 1.0, fract(sheen * 2.0 + uv.y * 0.18));
      col = dodge(col, mix(irid, irid, 0.30), inArt * rim * 0.12);
      /* sparkle: two parallax layers of hard pixel stars that twinkle in step */
      vec2 p1 = fract(uv * vec2(13.0, 18.0) + tilt * 0.55) - 0.5;
      vec2 p2 = fract(uv * vec2(23.0, 31.0) - tilt * 0.95) - 0.5;
      float s1 = smoothstep(0.13, 0.05, max(abs(p1.x), abs(p1.y)));
      float s2 = smoothstep(0.10, 0.04, max(abs(p2.x), abs(p2.y)));
      float twinkle = step(0.5, fract(sin(dot(floor(uv * 46.0), vec2(12.9898, 78.233))) * 437.58 + t * 0.35));
      col = dodge(col, rainbow(floor(fract(sheen + 0.5) * 6.0)), (s1 * 0.6 + s2 * 0.4) * twinkle * 0.55);
      col = dodge(col, irid, (s1 + s2 * 0.7) * (1.0 - twinkle * 0.6) * 0.42);
    } else if (uEffect < 3.5) {
      /* rainbow rare: the printed rainbow runs over the whole face, radial from the centre */
      vec2 c = vUv - 0.5;
      float r = length(c * vec2(0.72, 1.0));
      float hue = fract(r * 1.9 + atan(c.y, c.x) * 0.08 + tilt.y * 0.35 + t * 0.01);
      col = dodge(col, rainbow(floor(hue * 6.0)), 0.15);
      col = dodge(col, irid, smoothstep(0.06, 0.0, abs(fract(hue * 2.0) - 0.5)) * 0.10);
    } else if (uEffect < 4.5) {
      /* gold secret rare: engraved horizontals under an amber lift */
      col = dodge(col, vec3(1.0, 0.82, 0.42), 0.09);
      float engrave = sin(vUv.y * 300.0 + tilt.y * 20.0) * 0.5 + 0.5;
      col = dodge(col, vec3(1.0, 0.93, 0.62), engrave * 0.06);
      float gloss = smoothstep(0.35, 0.5, abs(fract(vUv.y * 1.1 - tilt.x * 0.4 + t * 0.02) - 0.5));
      col = dodge(col, vec3(1.0, 0.97, 0.85), gloss * 0.10);
      col = dodge(col, vec3(0.48, 0.32, 0.10), 0.03);
    } else if (uEffect < 5.5) {
      /* starlight holo: blurry starbursts of different sizes, each on its own plane */
      vec2 p = vUv * vec2(9.0, 12.0);
      vec2 cell = floor(p);
      float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
      vec2 g = fract(p) - 0.5 - tilt * (0.35 + h * 0.5);
      float d = length(g);
      float burst = smoothstep(0.34, 0.02, d) * step(0.35, h);
      float rays = smoothstep(0.06, 0.0, abs(sin(atan(g.y, g.x) * 2.5 + h * 6.0)) * d) * burst;
      col = dodge(col, vec3(0.94, 0.96, 1.0), inArt * (burst * 0.12 + rays * 0.14));
      col = dodge(col, irid, inArt * smoothstep(0.05, 0.0, d) * 0.18);
    } else if (uEffect < 6.5) {
      /* galaxy holo: spiral arms of stars inside the art */
      vec2 c = vUv - 0.5;
      float r = length(c);
      float sw = sin(atan(c.y, c.x) * 2.0 + r * 26.0 - tilt.x * 3.0 + t * 0.05);
      col = dodge(col, vec3(0.34, 0.24, 0.62), inArt * smoothstep(0.3, 1.0, sw) * 0.10);
      vec2 cell = floor(vUv * vec2(40.0, 56.0) + tilt * 0.4);
      float h = fract(sin(dot(cell, vec2(35.13, 91.7))) * 24634.63);
      if (h > 0.984) col = dodge(col, vec3(1.0, 0.98, 0.9), inArt * 0.5);
    } else if (uEffect < 7.5) {
      /* ember: cinders drift up behind the art only */
      float heat = fract(vUv.y * 1.6 + t * 0.05 + tilt.x * 0.4);
      col = dodge(col, vec3(1.0, 0.48, 0.16), inArt * smoothstep(0.86, 1.0, heat) * 0.10);
      vec2 cell = floor(vUv * vec2(26.0, 38.0) + vec2(tilt.x, t * 0.6));
      float h = fract(sin(dot(cell, vec2(78.233, 12.9898))) * 43758.5453);
      if (h > 0.975) col = dodge(col, vec3(1.0, 0.84, 0.4), inArt * 0.45);
    } else if (uEffect < 8.5) {
      /* cracked ice: facet seams sliding against each other */
      float f1 = abs(fract((vUv.x + vUv.y * 0.65) * 4.0 + tilt.x * 0.6) - 0.5);
      float f2 = abs(fract((vUv.x * 1.4 - vUv.y) * 6.0 - tilt.y * 0.5) - 0.5);
      col = dodge(col, vec3(0.72, 0.9, 1.0), inArt * smoothstep(0.46, 0.5, f1) * 0.12);
      col = dodge(col, vec3(0.9, 0.98, 1.0), inArt * smoothstep(0.47, 0.5, f2) * 0.08);
      col = dodge(col, rainbow(floor(fract(vUv.x + vUv.y + tilt.x * 0.5) * 6.0)), inArt * 0.03);
    } else if (uEffect < 9.5) {
      /* lightning: one forked bolt in the art, struck on a slow cycle */
      float cycle = fract(t * 0.22 + 0.35);
      float pulse = smoothstep(0.0, 0.15, cycle) * smoothstep(0.4, 0.2, cycle);
      float x = fract(vUv.x * 1.6 + sin(vUv.y * 22.0 + t * 0.5) * 0.1 + tilt.x * 0.3);
      float core = smoothstep(0.03, 0.0, abs(x - 0.5));
      col = dodge(col, vec3(0.92, 0.97, 1.0), inArt * core * pulse * 0.55);
      col = dodge(col, vec3(0.6, 0.78, 1.0), inArt * smoothstep(0.09, 0.0, abs(x - 0.5)) * pulse * 0.15);
    } else if (uEffect < 10.5) {
      /* bubbles: rings rising inside the art */
      vec2 p = vUv * vec2(9.0, 12.0) + vec2(tilt.x * 0.4, -t * 0.06);
      vec2 cell = floor(p);
      float h = fract(sin(dot(cell, vec2(41.7, 17.3))) * 3847.31);
      vec2 g = fract(p) - 0.5;
      float rad = 0.18 + h * 0.16;
      float ring = smoothstep(rad, rad - 0.05, length(g)) * smoothstep(rad - 0.13, rad - 0.06, length(g));
      col = dodge(col, vec3(0.84, 0.97, 1.0), inArt * ring * 0.22);
      col = dodge(col, irid, inArt * smoothstep(0.05, 0.0, length(g - vec2(-0.1, -0.12))) * 0.2);
    } else if (uEffect < 11.5) {
      /* etched grid: hairlines pressed into the frame only */
      float gx = abs(fract(vUv.x * 26.0 + tilt.x * 0.5) - 0.5);
      float gy = abs(fract(vUv.y * 36.0 - tilt.y * 0.4) - 0.5);
      float line = max(smoothstep(0.47, 0.5, gx), smoothstep(0.47, 0.5, gy));
      col = dodge(col, vec3(0.86, 0.9, 1.0), onFrame * line * 0.10);
      col = dodge(col, irid, onFrame * smoothstep(0.9, 1.0, fract(vUv.y * 0.9 + tilt.x * 0.4)) * 0.05);
    } else if (uEffect < 12.5) {
      /* confetti: flecks that tumble only behind the art */
      vec2 p = vUv * vec2(26.0, 36.0) + tilt * 0.8;
      vec2 cell = floor(p);
      float h = fract(sin(dot(cell, vec2(23.1, 71.7))) * 9137.13);
      if (h > 0.93) {
        vec2 g = fract(p) - 0.5 - tilt * (h - 0.5);
        float flake = smoothstep(0.28, 0.12, abs(g.x) + abs(g.y) * 1.6);
        vec3 pick = h > 0.975 ? vec3(1.0, 0.44, 0.54) : h > 0.955 ? vec3(1.0, 0.86, 0.36) : vec3(0.5, 0.74, 1.0);
        col = dodge(col, pick, inArt * flake * 0.35);
      }
    } else if (uEffect < 13.5) {
      /* aurora: ribbons of light drifting up the art, each one out of phase */
      float ribbons = 0.0;
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float x = vUv.x * (3.0 + fi * 1.4) + sin(vUv.y * (7.0 - fi) + t * (0.25 + fi * 0.08) + tilt.x * 2.0 + fi * 2.1) * 0.35;
        float ribbon = smoothstep(0.42, 0.0, abs(fract(x) - 0.5));
        float lift = smoothstep(0.05, 0.5, vUv.y) * smoothstep(0.95, 0.55, vUv.y);
        ribbons += ribbon * lift * (0.55 + 0.45 * sin(t * 0.6 + fi * 2.0));
      }
      vec3 aur = mix(vec3(0.35, 1.0, 0.62), vec3(0.62, 0.52, 1.0), smoothstep(0.2, 0.8, vUv.x));
      col = dodge(col, aur, inArt * min(ribbons, 1.0) * 0.16);
      col = dodge(col, vec3(0.92, 1.0, 0.95), inArt * smoothstep(0.85, 1.0, ribbons) * 0.10);
    } else if (uEffect < 14.5) {
      /* rain of glyphs: columns of blocks falling at different speeds */
      float colX = floor(vUv.x * 22.0);
      float hc = fract(sin(colX * 12.9898) * 43758.5453);
      float speed = 0.25 + hc * 0.55;
      float drop = fract(vUv.y * 1.0 + t * speed + hc * 7.0);
      float head = smoothstep(0.36, 0.3, drop) * step(drop, 0.36);
      float trail = smoothstep(0.9, 0.34, drop) * 0.55;
      vec2 q = fract(vec2(vUv.x * 22.0, vUv.y * 26.0 - t * speed * 26.0));
      float glyph = step(0.42, fract(sin(floor(q.x) * 1.7 + floor(q.y) * 17.0) * 43758.5453));
      vec3 neon = vec3(0.45, 1.0, 0.55);
      col = dodge(col, neon, inArt * trail * glyph * 0.18);
      col = dodge(col, vec3(0.86, 1.0, 0.9), inArt * head * glyph * 0.42);
    } else if (uEffect < 15.5) {
      /* petals: layered blossoms drifting and spinning across the art */
      for (int i = 0; i < 2; i++) {
        float fi = float(i);
        float speed = 0.05 + fi * 0.03;
        vec2 p = vUv * vec2(6.0 + fi * 3.0, 9.0 + fi * 4.0) + vec2(t * speed * 3.0, -t * speed * 5.0) + tilt * (0.5 + fi * 0.4);
        vec2 cell = floor(p);
        float h = fract(sin(dot(cell, vec2(21.7, 63.1))) * 5234.27);
        if (h > 0.55) {
          vec2 g = fract(p) - 0.5;
          float a = t * (0.6 + h) + h * 6.28;
          g = mat2(cos(a), sin(a), -sin(a), cos(a)) * g;
          float petal = smoothstep(0.30, 0.06, abs(g.x) * 1.6 + abs(g.y) * 0.9) * smoothstep(0.32, 0.16, length(g));
          vec3 tint = h > 0.85 ? vec3(1.0, 0.86, 0.92) : h > 0.7 ? vec3(1.0, 0.72, 0.80) : vec3(0.98, 0.92, 1.0);
          col = dodge(col, tint, inArt * petal * 0.34);
        }
      }
    } else if (uEffect < 16.5) {
      /* ripples: rings spreading from the centre, each one tinted on its own */
      vec2 c = (vUv - vec2(0.5, 0.55)) * vec2(0.62, 1.0);
      float r = length(c);
      float wave = fract(r * 6.0 - t * 0.22 + tilt.x * 0.3);
      float ring = smoothstep(0.34, 0.42, wave) * smoothstep(0.5, 0.44, wave);
      float fade = smoothstep(0.05, 0.5, r);
      vec3 tint = rainbow(floor(fract(r * 1.4 + t * 0.03) * 6.0));
      col = dodge(col, tint, inArt * ring * fade * 0.14);
      col = dodge(col, irid, inArt * smoothstep(0.46, 0.5, wave) * smoothstep(0.5, 0.48, wave) * fade * 0.10);
      col = dodge(col, irid, inArt * smoothstep(0.08, 0.0, r) * 0.12);
    } else if (uEffect < 17.5) {
      /* honeycomb: a hex lattice that catches the light cell by cell */
      vec2 p = vUv * vec2(14.0, 19.0);
      p.x *= 1.1547;
      p.y += mod(floor(p.x), 2.0) * 0.5;
      vec2 f = fract(p) - 0.5;
      float d = max(abs(f.x) * 0.866 + abs(f.y) * 0.5, abs(f.y));
      float edge = smoothstep(0.40, 0.47, d);
      vec2 cell = floor(p);
      float h = fract(sin(dot(cell, vec2(19.3, 7.7))) * 8314.13);
      float lit = smoothstep(0.6, 1.0, sin(t * 1.2 + h * 6.28 + tilt.x * 2.0) * 0.5 + 0.5);
      col = dodge(col, vec3(1.0, 0.86, 0.44), inArt * edge * 0.16);
      col = dodge(col, vec3(1.0, 0.95, 0.70), inArt * (1.0 - edge) * lit * 0.10);
      col = dodge(col, irid, inArt * smoothstep(0.47, 0.5, d) * 0.06);
    } else if (uEffect < 18.5) {
      /* star chart: a faint constellation net that twinkles */
      vec2 p = vUv * vec2(18.0, 25.0) + tilt * 0.35;
      vec2 cell = floor(p);
      vec2 g = fract(p) - 0.5;
      float h = fract(sin(dot(cell, vec2(13.7, 91.3))) * 4721.9);
      float star = smoothstep(0.14, 0.0, length(g)) * step(0.62, h);
      float twinkle = 0.55 + 0.45 * sin(t * 2.0 + h * 12.0);
      float lx = smoothstep(0.42, 0.5, abs(fract(p.x / 3.0) - 0.5));
      float ly = smoothstep(0.42, 0.5, abs(fract(p.y / 3.0) - 0.5));
      float net = max(lx, ly) * 0.5;
      col = dodge(col, vec3(0.72, 0.82, 1.0), inArt * net * 0.07);
      col = dodge(col, vec3(1.0, 0.98, 0.9), inArt * star * twinkle * 0.42);
      col = dodge(col, rainbow(floor(h * 6.0)), inArt * star * 0.10);
    } else if (uEffect < 19.5) {
      /* shattered glass: hard facets, each catching a different colour */
      vec2 p = vUv * vec2(7.0, 9.0);
      vec2 i = floor(p);
      vec2 f = fract(p);
      float d1 = 8.0;
      float d2 = 8.0;
      vec2 id = i;
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec2 nb = vec2(float(x), float(y));
          vec2 o = vec2(fract(sin(dot(i + nb, vec2(41.7, 28.9))) * 9137.3), fract(sin(dot(i + nb, vec2(11.3, 73.1))) * 4157.7));
          float d = length(nb + o - f);
          if (d < d1) { d2 = d1; d1 = d; id = i + nb; }
          else if (d < d2) { d2 = d; }
        }
      }
      float seam = smoothstep(0.06, 0.0, d2 - d1);
      float h = fract(sin(dot(id, vec2(63.1, 21.7))) * 1731.7);
      vec3 facet = rainbow(floor(h * 6.0));
      col = dodge(col, facet, inArt * 0.10);
      col = dodge(col, irid, inArt * seam * (0.16 + 0.14 * abs(uTilt.x)));
      col = dodge(col, vec3(0.82, 0.94, 1.0), inArt * smoothstep(0.4, 0.0, d1) * 0.04);
    }
  }

  if (!backside && uGlintOn > 0.5) {
    float g = fract(vUv.x * 0.7 + vUv.y * 0.35 - uGlint);
    if (g < 0.02) col = mix(col, vec3(1.0, 0.98, 0.92), 0.16);
  }

  col *= backside ? 0.94 : uDim;
  float a = uOpacity;
  a *= clamp(uFade, 0.0, 1.0);
  gl_FragColor = vec4(col, a);
}
`;

export function makeMaterial({ map, back = null, mask = null, holo = false, holoDensity = 0.33, effect = 0, glint = false, tint = null, typeColor = null, dim = 1, flat = false, opaque = false }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uBack: { value: back || map },
      uTwoSided: { value: back ? 1 : 0 },
      uMask: { value: mask },
      uHolo: { value: holo ? 1 : 0 },
      uHoloDensity: { value: holoDensity },
      uTypeCol: { value: new THREE.Color(typeColor ?? 0xffffff) },
      uTilt: { value: new THREE.Vector2(0, 0) },
      uOpacity: { value: 1 },
      uGlint: { value: 0 },
      uGlintOn: { value: glint ? 1 : 0 },
      uDim: { value: dim },
      uFade: { value: 1 },
      uTint: { value: new THREE.Color(tint || 0xffffff) },
      uUseTint: { value: tint ? 1 : 0 },
      uFlat: { value: flat ? 1 : 0 },
      uSheen: { value: 1 },
      uEffect: { value: effect },
      uTime: { value: 0 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: !opaque,
    depthWrite: opaque,
    side: THREE.DoubleSide,
  });
}

const BG_FRAG = `
${BAYER_GLSL}
uniform vec2 uSize;
uniform float uTime;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 px = vUv * uSize;
  vec3 col = vec3(0.078, 0.071, 0.165);
  float d = distance(vUv, vec2(0.5));
  float v = smoothstep(0.62, 0.76, d);
  col = mix(col, vec3(0.035, 0.031, 0.09), v * 0.85);

  vec2 cell = floor(px / 6.0);
  float t = floor(uTime * 8.0);
  float h = hash(cell + t * 7.13);
  if (h > 0.9965) {
    float tw = 0.45 + 0.55 * step(0.5, hash(cell + floor(t * 0.5)));
    col = mix(col, vec3(0.72, 0.70, 0.9), tw * 0.75);
  }
  float beam = 0.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

const BG_VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

export class PixelScene {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "kp-canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    container.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: false });
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x14122a, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    /* orthographic: texture pixels map 1:1 to canvas pixels at any depth */
    this.camera = new THREE.OrthographicCamera(-480, 480, 270, -270, -2000, 3000);
    this.camera.position.set(0, 0, 1000);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.W = 960;
    this.H = 540;

    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        uniforms: { uSize: { value: new THREE.Vector2(960, 540) }, uTime: { value: 0 } },
        vertexShader: BG_VERT,
        fragmentShader: BG_FRAG,
        depthWrite: false,
      })
    );
    bg.position.z = -500;
    bg.scale.set(3000, 3000, 1);
    this.bg = bg;
    this.scene.add(bg);

    this.resize();
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    const portrait = rect.height > rect.width * 1.05;
    /* fewer world units across the same box = a physically bigger card and pack */
    this.W = portrait ? 288 : 790;
    this.H = portrait ? 560 : 560;
    this.renderer.setSize(this.W, this.H, false);
    this.camera.left = -this.W / 2;
    this.camera.right = this.W / 2;
    this.camera.top = this.H / 2;
    this.camera.bottom = -this.H / 2;
    this.camera.updateProjectionMatrix();
    this.bg.material.uniforms.uSize.value.set(this.W, this.H);
    this.bg.scale.set(this.W * 1.4, this.H * 1.4, 1);
    this.portrait = portrait;
    this.fit();
  }

  fit() {
    const rect = this.container.getBoundingClientRect();
    const scale = Math.max(1, Math.min(Math.floor(rect.width / this.W), Math.floor(rect.height / this.H)));
    this.canvas.style.width = `${this.W * scale}px`;
    this.canvas.style.height = `${this.H * scale}px`;
  }

  render(time) {
    this.bg.material.uniforms.uTime.value = time;
    this.root.traverse((obj) => {
      const u = obj.material && obj.material.uniforms;
      if (u && u.uTime) u.uTime.value = time;
    });
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
    this.canvas.remove();
  }
}
