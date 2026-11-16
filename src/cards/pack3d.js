/* The 3D booster pack: bulged foil planes, detachable crimp strip, glint. */
import * as THREE from "three";
import { makeMaterial } from "./scene.js";

const PACK_W = 176;
const PACK_H = 352;
const TEAR_Y = 30;

function texture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function bulgedPlane(w, h, segX, segY, amount) {
  const geo = new THREE.PlaneGeometry(w, h, segX, segY);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const u = (pos.getX(i) / w) + 0.5;
    const v = (pos.getY(i) / h) + 0.5;
    const bulge = Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
    pos.setZ(i, bulge * amount);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createPack({ front, back, strip }) {
  const group = new THREE.Group();
  const frontMat = makeMaterial({ map: texture(front), glint: true });
  frontMat.uniforms.uSheen.value = 0; /* no foil film over the pack art */
  const backMat = makeMaterial({ map: texture(back) });
  backMat.uniforms.uSheen.value = 0;
  const body = new THREE.Mesh(bulgedPlane(PACK_W, PACK_H, 10, 20, 6), frontMat);
  group.add(body);

  const rear = new THREE.Mesh(bulgedPlane(PACK_W, PACK_H, 10, 20, 6), backMat);
  rear.rotation.y = Math.PI;
  rear.position.z = -3;
  group.add(rear);

  const stripTex = texture(strip);
  const stripMat = makeMaterial({ map: stripTex });
  stripMat.uniforms.uSheen.value = 0;
  const stripMesh = new THREE.Mesh(new THREE.PlaneGeometry(PACK_W, TEAR_Y), stripMat);
  stripMesh.position.set(0, PACK_H / 2 - TEAR_Y / 2 + 0.02, 6.4);
  group.add(stripMesh);

  /* dark interior visible once the strip peels */
  const insideMat = new THREE.MeshBasicMaterial({ color: 0x0b0912 });
  const inside = new THREE.Mesh(new THREE.PlaneGeometry(PACK_W, TEAR_Y), insideMat);
  inside.position.set(0, PACK_H / 2 - TEAR_Y / 2, 6.0);
  inside.visible = false;
  group.add(inside);

  /* top edge of the stack peeking out of the opening */
  const peekMat = new THREE.MeshBasicMaterial({ color: 0x2a2a4a });
  const peek = new THREE.Mesh(new THREE.PlaneGeometry(PACK_W - 24, 8), peekMat);
  peek.position.set(0, PACK_H / 2 - TEAR_Y - 2, 6.1);
  peek.visible = false;
  group.add(peek);

  const state = { tear: 0, stripLift: 0, stripFade: 1 };

  return {
    group,
    body,
    strip: stripMesh,
    inside,
    peek,
    setTilt(yaw, pitch) {
      group.rotation.y = yaw;
      group.rotation.x = pitch;
      frontMat.uniforms.uTilt.value.set(yaw, pitch);
      frontMat.uniforms.uGlint.value = 0.5 + Math.sin(yaw * 2.1 + 0.6) * 0.55;
    },
    setGlint(value) {
      frontMat.uniforms.uGlint.value = value;
    },
    setTear(p) {
      state.tear = p;
      if (p > 0.001) {
        inside.visible = true;
        peek.visible = true;
      }
      stripMesh.position.y = PACK_H / 2 - TEAR_Y / 2 + p * p * 14;
      stripMesh.position.z = 6.4 + p * 12;
      stripMesh.rotation.x = -p * 1.1;
      stripMesh.rotation.z = p * 0.25 * Math.sin(p * 9);
      frontMat.uniforms.uFade.value = 1 - p * 0.55;
    },
    detachStrip() {
      state.detached = true;
    },
    update(dt, time) {
      if (state.detached) {
        stripMesh.position.y += dt * 90;
        stripMesh.position.x += dt * 55;
        stripMesh.rotation.z += dt * 4;
        stripMesh.material.uniforms.uFade.value = Math.max(0, stripMesh.material.uniforms.uFade.value - dt * 1.1);
        if (stripMesh.material.uniforms.uFade.value <= 0) stripMesh.visible = false;
      }
      frontMat.uniforms.uGlint.value = 0.5 + Math.sin(time * 1.4) * 0.4;
      frontMat.uniforms.uTilt.value.set(group.rotation.y, group.rotation.x);
    },
    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    },
  };
}
