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
uniform sampler2D uMask;
uniform float uHolo;
uniform float uHoloDensity;
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
    col = mix(col, vec3(1.0, 0.985, 0.94), band * 0.14 + band2 * 0.05);
    float tint = 0.035 * (1.0 - smoothstep(0.0, 0.5, abs(fract(vUv.y * 1.3 + vUv.x * 0.6 + uTilt.x) - 0.5) * 2.0));
    col = mix(col, rainbow(floor(fract(vUv.x * 0.5 + vUv.y * 0.7 + uTilt.x * 0.4) * 6.0)), tint);
    col = mix(col, vec3(0.72, 0.62, 0.95), 0.03 * band);
  }

  if (!backside && uEffect > 0.5) {
    float t = uTime;
    if (uEffect < 1.5) {
      /* 1 reverse: cold silver brushed metal, diagonal grain drifting left */
      float grain = sin((vUv.x * 1.4 + vUv.y * 0.2) * 70.0 - t * 1.6 + sin(vUv.y * 9.0 + t * 0.7) * 2.0) * 0.5 + 0.5;
      float sweep = fract(vUv.x * 0.55 + vUv.y * 0.9 - uTilt.x * 1.1 - t * 0.09);
      col = mix(col, vec3(0.76, 0.84, 1.0), grain * 0.07 + (1.0 - sweep) * 0.07);
      col = mix(col, vec3(1.0), smoothstep(0.93, 1.0, grain) * 0.12);
    } else if (uEffect < 2.5) {
      /* 2 holo: cyan-into-magenta bands, tilted 30 degrees, always travelling */
      float s = fract((vUv.x * 0.62 + vUv.y * 0.78) * 1.35 - uTilt.x * 0.9 + t * 0.055);
      vec3 duo = mix(vec3(0.16, 0.88, 0.94), vec3(0.96, 0.24, 0.78), smoothstep(0.0, 1.0, s));
      col = mix(col, duo, 0.10 + 0.10 * (0.5 + 0.5 * sin(s * 6.2832 + t * 0.9)));
    } else if (uEffect < 3.5) {
      /* 3 prism: full spectrum plus twinkling stars */
      float s = fract(vUv.x * 0.5 + vUv.y * 0.7 + uTilt.x * 0.9 - t * 0.04);
      col = mix(col, rainbow(floor(s * 6.0)), 0.22);
      vec2 cell = floor(vUv * vec2(46.0, 64.0));
      float h = fract(sin(dot(cell, vec2(12.9898, 78.233)) + floor(t * 2.5)) * 43758.5453);
      if (h > 0.988) col = mix(col, vec3(1.0), 0.85);
    } else if (uEffect < 4.5) {
      /* 4 gold: amber with a wide embossed band rolling upwards */
      col = mix(col, vec3(1.0, 0.80, 0.36), 0.11);
      float band = smoothstep(0.38, 0.5, abs(fract(vUv.y * 1.5 - t * 0.06 + uTilt.x * 0.4) - 0.5));
      col = mix(col, vec3(1.0, 0.96, 0.78), band * 0.16);
      col = mix(col, vec3(0.55, 0.36, 0.08), 0.05);
    } else if (uEffect < 5.5) {
      /* 5 foil: stamped silver laminate, crosshatch with a rotating glint */
      float hatch = sin((vUv.x + vUv.y) * 150.0) * 0.5 + 0.5;
      float cross = sin((vUv.x - vUv.y) * 150.0) * 0.5 + 0.5;
      float sweep = fract((vUv.x - vUv.y) * 0.35 + t * 0.05 + uTilt.y * 0.6);
      col = mix(col, vec3(0.90, 0.93, 1.0), (hatch * 0.5 + cross * 0.5) * 0.06);
      col = mix(col, vec3(1.0), smoothstep(0.82, 1.0, sweep) * 0.16);
    } else {
      /* 6 star: deep violet night with twinkling stars and a slow sweep */
      col = mix(col, vec3(0.30, 0.22, 0.58), 0.12);
      vec2 cell = floor(vUv * vec2(38.0, 54.0));
      float h = fract(sin(dot(cell, vec2(35.13, 91.7)) + floor(t * 1.7)) * 24634.6345);
      if (h > 0.978) col = mix(col, vec3(1.0, 0.98, 0.86), 0.8);
      float s = fract(vUv.x * 0.4 - vUv.y * 0.6 + t * 0.035 + uTilt.x * 0.5);
      col = mix(col, vec3(0.58, 0.76, 1.0), smoothstep(0.78, 1.0, s) * 0.12);
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

export function makeMaterial({ map, back = null, mask = null, holo = false, holoDensity = 0.33, effect = 0, glint = false, tint = null, dim = 1, flat = false, opaque = false }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uBack: { value: back || map },
      uTwoSided: { value: back ? 1 : 0 },
      uMask: { value: mask },
      uHolo: { value: holo ? 1 : 0 },
      uHoloDensity: { value: holoDensity },
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
    this.W = portrait ? 360 : 960;
    this.H = portrait ? 700 : 700;
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
