/* Card meshes: textured front/back, stepped flip, tilt and holo shimmer. */
import * as THREE from "three";
import { makeMaterial } from "./scene.js";
import { holoDensityFor } from "./holo.js";

const CARD_W = 100;
const CARD_H = 140;

function texture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCardMesh({ front, back, mask, rarity, dim = 1 }) {
  const group = new THREE.Group();
  const holo = holoDensityFor(rarity) > 0;
  const frontMat = makeMaterial({
    map: texture(front),
    mask: mask ? texture(mask) : null,
    holo,
    holoDensity: holoDensityFor(rarity),
    dim,
  });
  const backMat = makeMaterial({ map: texture(back) });

  const face = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), frontMat);
  face.position.z = 0.8;
  group.add(face);

  const rear = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), backMat);
  rear.rotation.y = Math.PI;
  rear.position.z = -0.8;
  group.add(rear);

  return {
    group,
    face,
    frontMat,
    rarity,
    setFlip(t) {
      group.rotation.y = Math.PI * t;
      group.position.z = Math.sin(Math.PI * t) * 6;
    },
    setTilt(x, y) {
      group.rotation.y = x;
      group.rotation.x = y;
      frontMat.uniforms.uTilt.value.set(x, y);
    },
    setFlipWithTilt(flip, x, y) {
      group.rotation.y = Math.PI * flip + x;
      group.rotation.x = y;
      group.position.z = Math.sin(Math.PI * flip) * 6;
      frontMat.uniforms.uTilt.value.set(x, y);
    },
    setDim(value) {
      frontMat.uniforms.uDim.value = value;
      backMat.uniforms.uDim.value = value;
    },
    setOpacity(value) {
      frontMat.uniforms.uOpacity.value = value;
      backMat.uniforms.uOpacity.value = value;
    },
    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    },
  };
}

export function createCardBackTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#1a2440";
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = "#121a30";
  ctx.fillRect(2, 2, CARD_W - 4, CARD_H - 4);
  ctx.fillStyle = "#2b3a63";
  ctx.fillRect(4, 4, CARD_W - 8, CARD_H - 8);
  /* dithered diamond pattern */
  for (let y = 7; y < CARD_H - 7; y += 1) {
    for (let x = 7; x < CARD_W - 7; x += 1) {
      const dx = Math.abs(((x + y) % 12) - 6);
      const dy = Math.abs(((x - y + 240) % 12) - 6);
      if (dx + dy < 5) {
        ctx.fillStyle = "#22304f";
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  /* emblem */
  const cx = CARD_W / 2;
  const cy = CARD_H / 2 - 6;
  ctx.fillStyle = "#1a1a2e";
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c8281e";
  ctx.beginPath();
  ctx.arc(cx, cy, 19, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f4ecd0";
  ctx.beginPath();
  ctx.arc(cx, cy, 19, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(cx - 19, cy - 2, 38, 4);
  ctx.beginPath();
  ctx.arc(cx, cy, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f4ecd0";
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
  /* label */
  ctx.fillStyle = "#f4ecd0";
  ctx.font = "bold 9px monospace";
  ctx.textAlign = "center";
  ctx.fillText("KANTO", cx, cy + 42);
  ctx.fillText("151", cx, cy + 53);
  return canvas;
}

export { CARD_W, CARD_H };
