/* Card meshes: crisp front/back planes, stepped flip, tilt and holo shimmer. */
import * as THREE from "three";
import { makeMaterial } from "./scene.js";
import { holoDensityFor } from "./holo.js";
import { CARD_W, CARD_H, renderCardBack } from "./cardRenderer.js";

function texture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let sharedBack = null;
export function cardBackTexture() {
  if (!sharedBack) sharedBack = texture(renderCardBack());
  return sharedBack;
}

export function createCardMesh({ front, mask, rarity, dim = 1 }) {
  const group = new THREE.Group();
  const holo = holoDensityFor(rarity) > 0;
  const frontMat = makeMaterial({
    map: texture(front),
    mask: mask ? texture(mask) : null,
    holo,
    holoDensity: holoDensityFor(rarity),
    dim,
    flat: true,
  });
  const backMat = makeMaterial({ map: cardBackTexture(), flat: true, dim: 0.96 });

  const face = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), frontMat);
  face.position.z = 1;
  group.add(face);

  const rear = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), backMat);
  rear.rotation.y = Math.PI;
  rear.position.z = -1;
  group.add(rear);

  return {
    group,
    face,
    frontMat,
    rarity,
    setFlip(t) {
      group.rotation.y = Math.PI * t;
      group.position.z = Math.sin(Math.PI * t) * 8;
    },
    setTilt(x, y) {
      group.rotation.y = x;
      group.rotation.x = y;
      frontMat.uniforms.uTilt.value.set(x, y);
    },
    setFlipWithTilt(flip, x, y) {
      group.rotation.y = Math.PI * flip + x;
      group.rotation.x = y;
      group.position.z = Math.sin(Math.PI * flip) * 8;
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

export { CARD_W, CARD_H };
