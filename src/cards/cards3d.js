/* Card meshes: crisp front/back planes, stepped flip, tilt and holo shimmer. */
import * as THREE from "three";
import { makeMaterial } from "./scene.js";
import { holoDensityFor } from "./holo.js";
import { CARD_W, CARD_H, renderCardBack, renderSpriteLayer, renderContactShadow, ART } from "./cardRenderer.js";

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
    finish === "ember" ? 7 :
    finish === "crystal" ? 8 :
    finish === "shiny" ? 3 : 0;
  const density = holoDensityFor(rarity);

  /* opaque card face: frame, panel, text and the baked backdrop */
  const frontMat = makeMaterial({
    map: texture(front),
    back: cardBackTexture(),
    mask: mask ? texture(mask) : null,
    holo: false,
    holoDensity: density,
    effect,
    dim,
    flat: true,
    opaque: true,
  });

  const face = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), frontMat);
  face.position.z = 0;
  group.add(face);

  /* sprite floats in front so tilting separates it from the card */
  let spriteMesh = null;
  if (sprite) {
    const spriteMat = makeMaterial({ map: texture(renderSpriteLayer(null, sprite)), dim, flat: true, opaque: false });
    spriteMat.transparent = true;
    spriteMat.depthWrite = false;
    spriteMesh = new THREE.Mesh(new THREE.PlaneGeometry(ART.inner.w, ART.inner.h), spriteMat);
    spriteMesh.position.set(
      ART.inner.x + ART.inner.w / 2 - CARD_W / 2,
      CARD_H / 2 - (ART.inner.y + ART.inner.h / 2),
      6
    );
    spriteMesh.renderOrder = 3;
    group.add(spriteMesh);
  }

  /* hard slab for the card's thickness */
  const slabMat = new THREE.MeshBasicMaterial({ color: 0x0d0b1e });
  const slab = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W - 1.5, CARD_H - 1.5), slabMat);
  slab.position.z = -5;
  group.add(slab);

  /* dithered contact shadow under the card */
  const shadowMat = new THREE.MeshBasicMaterial({
    map: texture(renderContactShadow()),
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(140, 28), shadowMat);
  shadow.position.set(0, -CARD_H / 2 - 8, -8);
  shadow.renderOrder = -1;
  group.add(shadow);

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
      shadow.position.x = -x * 90;
      shadow.position.y = -CARD_H / 2 - 8 + y * 40;
      const k = 1 - Math.min(0.16, (Math.abs(x) + Math.abs(y)) * 0.5);
      shadow.scale.set(k, k, 1);
      shadowMat.opacity = 0.55 + Math.min(0.2, (Math.abs(x) + Math.abs(y)) * 0.5);
    },
    setFlipWithTilt(flip, x, y) {
      group.rotation.y = Math.PI * flip + x;
      group.rotation.x = y;
      group.position.z = Math.sin(Math.PI * flip) * 8;
      frontMat.uniforms.uTilt.value.set(x, y);
      if (spriteMesh) spriteMesh.visible = flip < 0.5;
    },
    setDim(value) {
      frontMat.uniforms.uDim.value = value;
    },
    setOpacity(value) {
      frontMat.uniforms.uOpacity.value = value;
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
