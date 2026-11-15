/* Card meshes: crisp front/back planes, stepped flip, tilt and holo shimmer. */
import * as THREE from "three";
import { makeMaterial } from "./scene.js";
import { holoDensityFor } from "./holo.js";
import { CARD_W, CARD_H, renderCardBack, renderSpriteLayer, ART } from "./cardRenderer.js";

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

export function createCardMesh({ front, sprite, mask, rarity, finish = "plain", dim = 1 }) {
  const group = new THREE.Group();
  const effect =
    finish === "reverse" ? 1 :
    finish === "holo" ? 2 :
    finish === "prism" ? 3 :
    finish === "gold" ? 4 :
    finish === "foil" ? 5 :
    finish === "star" ? 6 :
    finish === "shiny" ? 3 : 0;
  const holo = false;
  const density = holoDensityFor(rarity);
  const frontMat = makeMaterial({
    map: texture(front),
    back: cardBackTexture(),
    mask: mask ? texture(mask) : null,
    holo,
    holoDensity: density,
    effect,
    dim,
    flat: true,
    opaque: true,
  });

  const face = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), frontMat);
  face.position.z = 0;
  group.add(face);

  /* sprite floats a few pixels in front of the frame so tilting separates them */
  let spriteMesh = null;
  if (sprite) {
    const layer = renderSpriteLayer(null, sprite);
    const spriteMat = makeMaterial({
      map: texture(layer),
      dim,
      flat: true,
      opaque: false,
    });
    spriteMesh = new THREE.Mesh(
      new THREE.PlaneGeometry((ART.inner.w / CARD_W) * CARD_W, (ART.inner.h / CARD_H) * CARD_H),
      spriteMat
    );
    spriteMesh.position.set(
      ART.inner.x + ART.inner.w / 2 - CARD_W / 2,
      CARD_H / 2 - (ART.inner.y + ART.inner.h / 2),
      6
    );
    group.add(spriteMesh);
  }

  return {
    group,
    face,
    frontMat,
    rarity,
    setFlip(t) {
      group.rotation.y = Math.PI * t;
      group.position.z = Math.sin(Math.PI * t) * 8;
      if (spriteMesh) spriteMesh.visible = t < 0.5;
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
      if (spriteMesh) spriteMesh.visible = flip < 0.5;
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
