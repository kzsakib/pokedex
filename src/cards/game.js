/* Kanto Packs — state machine, 3D scene wiring, input and HUD. */
import * as THREE from "three";
import { PixelScene } from "./scene.js";
import { createPack } from "./pack3d.js";
import { createCardMesh } from "./cards3d.js";
import { makeHoloMask } from "./holo.js";
import { loadGen1, preloadSprites, loadSprite, spriteFor } from "./assets.js";
import { generatePack, RARITY_LABEL } from "./generate.js";
import { renderCard } from "./cardRenderer.js";
import { renderPackFront, renderPackBack, renderStrip, VARIANTS } from "./packArt.js";
import { freshSeed } from "./rng.js";
import { KantoAudio } from "./audio.js";
import { loadBinder, recordPack, resetBinder } from "./storage.js";

const ORDER = ["common", "uncommon", "rare", "holo", "legend"];
const SPARKLES = { uncommon: "silver", rare: "gold", holo: "rainbow", legend: "legend" };
const BEST = { common: 0, uncommon: 1, rare: 2, holo: 3, legend: 4 };

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class KantoPacksGame {
  constructor(container) {
    this.container = container;
    this.audio = new KantoAudio();
    this.binder = loadBinder();
    this.seed = this.readSeedFromUrl() || freshSeed();
    this.force = this.readForceFromUrl();
    this.phase = "idle";
    this.phaseTime = 0;
    this.cards = [];
    this.meshes = [];
    this.revealIndex = 0;
    this.flip = 0;
    this.flipping = false;
    this.flipped = [];
    this.tilt = { x: 0, y: 0, targetX: 0, targetY: 0 };
    this.packTilt = { yaw: 0, pitch: 0, vy: 0, vp: 0 };
    this.tear = 0;
    this.dragging = false;
    this.slicing = false;
    this.lastPointer = null;
    this.time = 0;
    this.ambient = 0;
    this.holds = { beam: 0 };

    this.scene = new PixelScene(container);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.buildHud();
    this.bindInput();
    this.boot();
    this.onResize = () => this.scene.resize();
    window.addEventListener("resize", this.onResize);
    this.raf = requestAnimationFrame(this.loop);
  }

  readSeedFromUrl() {
    try {
      const seed = new URLSearchParams(window.location.search).get("seed");
      return seed ? seed.toUpperCase().slice(0, 12) : null;
    } catch {
      return null;
    }
  }

  readForceFromUrl() {
    try {
      const force = new URLSearchParams(window.location.search).get("force");
      return force && ORDER.includes(force) ? force : null;
    } catch {
      return null;
    }
  }

  async boot() {
    this.hint("loading card data…");
    this.data = await loadGen1();
    await preloadSprites((done) => {
      if (done % 25 === 0) this.hint(`loading sprites… ${Math.round((done / 151) * 100)}%`);
    });
    this.ready = true;
    this.hint("drag to rotate · swipe the dotted line to slice");
    this.newPack();
    this.loop();
  }

  /* ---------- HUD ---------- */

  buildHud() {
    const hud = document.createElement("div");
    hud.className = "kp-hud";
    hud.innerHTML = `
      <div class="kp-top">
        <div class="kp-stat">
          <span class="kp-label">PACKS</span>
          <span class="kp-packs">0</span>
          <span class="kp-seed">${this.seed}</span>
        </div>
        <div class="kp-actions">
          <button type="button" class="kp-btn kp-sound" aria-pressed="false">sound on</button>
          <button type="button" class="kp-btn kp-help-btn">help</button>
        </div>
      </div>
      <div class="kp-flash" aria-hidden="true"></div>
      <div class="kp-sparkles" aria-hidden="true"></div>
      <div class="kp-caption" aria-live="polite"></div>
      <div class="kp-bottom">
        <div class="kp-hint">loading…</div>
        <div class="kp-summary-actions">
          <button type="button" class="kp-btn kp-again">open another pack</button>
          <button type="button" class="kp-btn kp-binder-btn">binder</button>
        </div>
      </div>
      <div class="kp-dialog kp-help" role="dialog" aria-modal="true" aria-labelledby="kp-help-title" hidden>
        <div class="kp-dialog-inner">
          <h2 id="kp-help-title">HOW TO OPEN</h2>
          <p>drag the pack to rotate it</p>
          <p>swipe across the dotted line to slice the crimp</p>
          <p>space holds the tear if you prefer keys</p>
          <p>click the face-down card to flip it</p>
          <p>drag a revealed card to tilt it — holo foil follows</p>
          <p class="kp-dim">arrow keys rotate · space tears and flips · esc closes</p>
          <button type="button" class="kp-btn kp-close-help">close</button>
        </div>
      </div>
      <div class="kp-dialog kp-binder" role="dialog" aria-modal="true" aria-labelledby="kp-binder-title" hidden>
        <div class="kp-dialog-inner kp-binder-inner">
          <h2 id="kp-binder-title">BINDER</h2>
          <div class="kp-binder-stats"></div>
          <div class="kp-binder-grid"></div>
          <div class="kp-binder-foot">
            <button type="button" class="kp-btn kp-close-binder">close</button>
            <button type="button" class="kp-btn kp-reset">reset binder</button>
          </div>
        </div>
      </div>
    `;
    this.container.appendChild(hud);
    this.hud = hud;
    this.el = {
      packs: hud.querySelector(".kp-packs"),
      seed: hud.querySelector(".kp-seed"),
      hint: hud.querySelector(".kp-hint"),
      flash: hud.querySelector(".kp-flash"),
      sparkles: hud.querySelector(".kp-sparkles"),
      caption: hud.querySelector(".kp-caption"),
      summary: hud.querySelector(".kp-summary-actions"),
      sound: hud.querySelector(".kp-sound"),
      help: hud.querySelector(".kp-help"),
      binder: hud.querySelector(".kp-binder"),
      binderStats: hud.querySelector(".kp-binder-stats"),
      binderGrid: hud.querySelector(".kp-binder-grid"),
    };
    this.el.packs.textContent = this.binder.packs;
    this.el.sound.textContent = this.audio.muted ? "sound off" : "sound on";

    hud.querySelector(".kp-help-btn").addEventListener("click", () => {
      this.el.help.hidden = false;
      this.audio.click();
    });
    hud.querySelector(".kp-close-help").addEventListener("click", () => {
      this.el.help.hidden = true;
    });
    hud.querySelector(".kp-sound").addEventListener("click", () => {
      this.audio.unlock();
      this.audio.setMuted(!this.audio.muted);
      this.el.sound.textContent = this.audio.muted ? "sound off" : "sound on";
      this.el.sound.setAttribute("aria-pressed", String(this.audio.muted));
    });
    hud.querySelector(".kp-again").addEventListener("click", () => this.newPack());
    hud.querySelector(".kp-binder-btn").addEventListener("click", () => this.openBinder());
    hud.querySelector(".kp-close-binder").addEventListener("click", () => {
      this.el.binder.hidden = true;
    });
    hud.querySelector(".kp-reset").addEventListener("click", () => {
      this.binder = resetBinder();
      this.el.packs.textContent = "0";
      this.renderBinder();
    });
  }

  hint(text) {
    if (this.el) this.el.hint.textContent = text;
  }

  setPhase(phase) {
    this.phase = phase;
    this.phaseTime = 0;
    const hints = {
      idle: "drag to rotate · swipe the dotted line to slice",
      tearing: "keep going…",
      flash: "",
      emerge: "",
      stack: "click to flip",
      reveal: "click to flip · drag to tilt",
      summary: "five cards · open another or check the binder",
    };
    this.hint(hints[phase] || "");
    this.el.summary.classList.toggle("kp-show", phase === "summary");
    this.el.caption.classList.toggle("kp-show", phase === "reveal" && this.flipped[this.revealIndex]);
  }

  /* ---------- scene ---------- */

  clearScene() {
    if (this.pack) {
      this.scene.root.remove(this.pack.group);
      this.pack.dispose();
      this.pack = null;
    }
    for (const mesh of this.meshes) {
      this.scene.root.remove(mesh.group);
      mesh.dispose();
    }
    this.meshes = [];
    if (this.beamMesh) {
      this.scene.root.remove(this.beamMesh);
      this.beamMesh.geometry.dispose();
      this.beamMesh.material.dispose();
      this.beamMesh = null;
    }
  }

  async newPack(keepSeed = false) {
    this.clearScene();
    if (!keepSeed) this.seed = freshSeed();
    this.tear = 0;
    this.tearTarget = 0;
    this.packTilt = { yaw: 0, pitch: 0, vy: 0, vp: 0 };
    this.tilt = { x: 0, y: 0, targetX: 0, targetY: 0 };
    this.cards = [];
    this.flipped = [];
    this.revealIndex = 0;
    this.flip = 0;
    this.flipping = false;
    this.suspenseDone = false;
    this.lastSuspense = false;
    this.el.seed.textContent = this.seed;
    this.el.caption.classList.remove("kp-show");
    this.el.sparkles.innerHTML = "";

    const keys = Object.keys(VARIANTS);
    const variant = VARIANTS[keys[Math.floor(Math.random() * keys.length)]];
    const mascot = await loadSprite(variant.mascot);
    const front = renderPackFront(variant, mascot);
    const back = renderPackBack(variant);
    const strip = renderStrip(variant);
    this.pack = createPack({ front, back, strip });
    this.pack.group.position.set(0, 0, 0);
    this.pack.group.scale.setScalar(1);
    this.scene.root.add(this.pack.group);
    this.setPhase("idle");
    this.packKick = 0;
  }

  async generate() {
    const pack = generatePack(this.data, this.seed, { force: this.force });
    this.packData = pack;
    this.cards = pack.cards;
    this.binder = recordPack(this.binder, this.cards);
    this.el.packs.textContent = this.binder.packs;

    for (const card of this.cards) {
      const sprite = await spriteFor(card);
      const front = renderCard(card, sprite);
      const mask = makeHoloMask(card.rarity);
      const mesh = createCardMesh({ front, mask, rarity: card.rarity });
      mesh.group.position.set(0, 40, 60 + this.meshes.length * 0.6);
      mesh.group.scale.setScalar(1);
      mesh.group.visible = false;
      this.meshes.push(mesh);
      this.scene.root.add(mesh.group);
    }

    /* light beam hints at the best pull */
    const best = this.cards.reduce((acc, card) => (BEST[card.rarity] > BEST[acc] ? card.rarity : acc), "common");
    const colour = best === "legend" ? 0xffd76a : best === "holo" ? 0x9be8ff : best === "rare" ? 0xffc94a : 0xbfd8ff;
    const beamMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColour: { value: new THREE.Color(colour) }, uFade: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform vec3 uColour;
        uniform float uFade;
        float bayer(vec2 p){ int x=int(mod(p.x,4.0)); int y=int(mod(p.y,4.0));
          float m[16]; m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;
          m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.; return m[y*4+x]/16.0; }
        void main(){
          float edge = smoothstep(0.0,0.35,vUv.x) * smoothstep(1.0,0.65,vUv.x);
          float bands = step(0.45, fract(vUv.y*3.0 - uTime*1.2));
          float a = edge * (0.35 + bands*0.25) * uFade;
          if (bayer(gl_FragCoord.xy) > a) discard;
          gl_FragColor = vec4(uColour, 0.55);
        }
      `,
    });
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(220, 760), beamMat);
    beam.position.set(0, 200, 40);
    beam.visible = false;
    this.beamMesh = beam;
    this.scene.root.add(beam);
  }

  triggerFlash() {
    this.el.flash.classList.remove("kp-run");
    void this.el.flash.offsetWidth;
    this.el.flash.classList.add("kp-run");
    this.audio.flash();
  }

  spawnSparkles(rarity) {
    const kind = SPARKLES[rarity];
    if (!kind) return;
    this.el.sparkles.innerHTML = "";
    const count = rarity === "legend" ? 26 : rarity === "holo" ? 18 : rarity === "rare" ? 12 : 6;
    for (let i = 0; i < count; i += 1) {
      const dot = document.createElement("i");
      dot.className = `kp-spark kp-${kind}`;
      dot.style.left = `${8 + Math.random() * 84}%`;
      dot.style.top = `${12 + Math.random() * 66}%`;
      dot.style.animationDelay = `${(Math.random() * 0.5).toFixed(2)}s`;
      dot.style.setProperty("--s", `${2 + Math.floor(Math.random() * 3)}px`);
      this.el.sparkles.appendChild(dot);
    }
    setTimeout(() => {
      this.el.sparkles.innerHTML = "";
    }, 1600);
  }

  showCaption(card) {
    const stats = `HT ${fmtHeight(card.height)}  WT ${card.weight ? `${Math.round(card.weight * 2.2046)} LB` : "??"}`;
    this.el.caption.innerHTML = `
      <strong>${card.name}</strong>
      <span>${RARITY_LABEL[card.rarity]}${card.shiny ? " · SHINY ✦" : ""}</span>
      <span>${stats}</span>
      <span>seed ${this.seed}</span>
    `;
    this.el.caption.classList.add("kp-show");
  }

  /* ---------- pack interaction ---------- */

  bindInput() {
    const canvas = this.scene.canvas;
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", (e) => {
      this.audio.unlock();
      canvas.setPointerCapture?.(e.pointerId);
      const p = this.toLocal(e);
      this.lastPointer = { x: e.clientX, y: e.clientY, t: performance.now() };
      this.pressAt = { x: e.clientX, y: e.clientY };

      if (this.phase === "idle" || this.phase === "tearing") {
        if (this.nearTear(e)) {
          this.slicing = true;
          this.setPhase("tearing");
          this.tearAt(p);
          this.audio.tear(this.tear);
          return;
        }
        this.dragging = true;
        this.packTilt.vy = 0;
        this.packTilt.vp = 0;
        this.packKick = 1;
        return;
      }
      if (this.phase === "reveal") {
        if (this.flipped[this.revealIndex]) {
          this.dragging = true;
          this.tilt.targetX = 0;
          this.tilt.targetY = 0;
        } else {
          this.startFlip();
        }
        return;
      }
      if (this.phase === "stack") {
        this.startFlip();
      }
    });

    canvas.addEventListener("pointermove", (e) => {
      const p = this.toLocal(e);
      if (this.slicing) {
        this.tearAt(p);
        return;
      }
      if (this.dragging) {
        const dx = e.clientX - this.lastPointer.x;
        const dy = e.clientY - this.lastPointer.y;
        this.lastPointer = { x: e.clientX, y: e.clientY };
        if (this.phase === "idle" || this.phase === "tearing") {
          this.packTilt.yaw += dx * 0.012;
          this.packTilt.pitch = clamp(this.packTilt.pitch + dy * 0.009, -0.44, 0.44);
          this.packTilt.vy = dx * 0.012;
          this.packTilt.vp = dy * 0.009;
          this.packKick = 0.6;
          if (Math.random() < 0.12) this.audio.crinkle();
        } else if (this.phase === "reveal") {
          this.tilt.targetX = clamp(this.tilt.targetX + dx * 0.012, -0.36, 0.36);
          this.tilt.targetY = clamp(this.tilt.targetY + dy * 0.01, -0.3, 0.3);
        }
      }
    });

    const release = (e) => {
      const moved = this.pressAt ? Math.hypot(e.clientX - this.pressAt.x, e.clientY - this.pressAt.y) : 99;
      if (!this.slicing && moved < 8 && this.phase === "reveal" && this.flipped[this.revealIndex]) {
        this.advanceReveal();
      }
      if (this.slicing) {
        this.slicing = false;
        if (this.tear < 1 && this.phase === "tearing") {
          /* flap stays partly open; it can resume */
          this.hint("swipe the tear again to finish");
        }
      }
      this.dragging = false;
      this.packKick = 0;
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("pointerleave", () => {
      this.dragging = false;
      this.packKick = 0;
    });
    canvas.addEventListener("dblclick", () => {
      this.packTilt = { yaw: 0, pitch: 0, vy: 0, vp: 0 };
    });

    this.spaceHeld = false;
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.el.help.hidden = true;
        this.el.binder.hidden = true;
      }
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      if (e.code === "Space") {
        e.preventDefault();
        this.audio.unlock();
        if (this.phase === "idle" || this.phase === "tearing") {
          this.spaceHeld = true;
        } else if (this.phase === "stack" || (this.phase === "reveal" && !this.flipped[this.revealIndex])) {
          this.startFlip();
        }
      }
      if (e.key === "ArrowLeft") this.packTilt.yaw -= 0.12;
      if (e.key === "ArrowRight") this.packTilt.yaw += 0.12;
      if (e.key === "ArrowUp") this.packTilt.pitch = clamp(this.packTilt.pitch - 0.08, -0.44, 0.44);
      if (e.key === "ArrowDown") this.packTilt.pitch = clamp(this.packTilt.pitch + 0.08, -0.44, 0.44);
    });
    window.addEventListener("keyup", (e) => {
      if (e.code === "Space") this.spaceHeld = false;
    });
  }

  toLocal(e) {
    const rect = this.scene.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * this.scene.W,
      y: ((e.clientY - rect.top) / rect.height) * this.scene.H,
    };
  }

  nearTear(e) {
    if (!this.pack) return false;
    const v = new THREE.Vector3(0, 176 - 30, 0).applyMatrix4(this.pack.group.matrixWorld).project(this.scene.camera);
    const sx = (v.x * 0.5 + 0.5) * this.scene.W;
    const sy = (-v.y * 0.5 + 0.5) * this.scene.H;
    const rect = this.scene.canvas.getBoundingClientRect();
    const py = ((e.clientY - rect.top) / rect.height) * this.scene.H;
    const px = ((e.clientX - rect.left) / rect.width) * this.scene.W;
    return Math.abs(py - sy) < 18 && Math.abs(px - sx) < this.scene.W * 0.4;
  }

  tearAt(p) {
    if (!this.pack) return;
    const rect = this.scene.canvas.getBoundingClientRect();
    const nx = clamp((p.x / this.scene.W) * 2 - 1, -0.6, 0.6);
    const next = clamp(Math.abs(nx) * 1.6 + 0.12, 0, 1);
    if (next > this.tear) {
      this.tear = next;
      this.pack.setTear(this.tear);
      if (Math.random() < 0.5) this.audio.tear(this.tear);
    }
    if (this.tear >= 1) this.completeTear();
  }

  completeTear() {
    if (this.phase !== "tearing") return;
    this.slicing = false;
    this.tear = 1;
    this.pack.detachStrip();
    this.audio.rip();
    this.setPhase("flash");
    this.triggerFlash();
    this.generate().then(() => {
      this.audio.beam();
      if (this.beamMesh) this.beamMesh.visible = true;
    });
  }

  startFlip() {
    if (this.phase !== "stack" && this.phase !== "reveal") return;
    if (this.flipped[this.revealIndex]) return;
    if (this.flipLock) return;
    if (this.cards.length === 0) return;
    if (this.revealIndex === this.cards.length - 1 && !this.suspenseDone) {
      this.suspenseDone = true;
      this.lastSuspense = true;
      this.audio.suspense();
      this.lastSuspenseAt = this.time;
      this.hint("one card left…");
      return;
    }
    if (this.flipping) return;
    this.flipping = true;
    this.flip = 0;
    this.audio.flipTick();
    if (this.beamMesh) this.beamMesh.visible = true;
  }

  finishReveal() {
    const card = this.cards[this.revealIndex];
    this.flipped[this.revealIndex] = true;
    this.flipping = false;
    this.audio.flipLand();
    this.audio.sparkle(card.rarity);
    if (card.shiny) this.audio.shiny();
    this.spawnSparkles(card.rarity);
    this.showCaption(card);
    if (card.rarity === "legend") {
      this.container.classList.add("kp-shake");
      setTimeout(() => this.container.classList.remove("kp-shake"), 320);
    }
    this.setPhase("reveal");
    if (this.revealIndex === this.cards.length - 1) {
      this.holdBeforeSummary = this.time + 1.1;
    }
  }

  advanceReveal() {
    if (!this.flipped[this.revealIndex]) return;
    if (this.revealIndex >= this.cards.length - 1) {
      this.showSummary();
      return;
    }
    this.revealIndex += 1;
    this.flip = 0;
    this.lastSuspense = false;
    this.el.caption.classList.remove("kp-show");
    this.setPhase("stack");
    this.hint(this.revealIndex === this.cards.length - 1 ? "click for the final card" : "click to flip");
  }

  showSummary() {
    this.setPhase("summary");
    this.el.caption.classList.remove("kp-show");
    if (this.beamMesh) this.beamMesh.visible = false;
    this.audio.stopBeam();
    const count = this.meshes.length;
    const gap = 10;
    const totalW = count * 160 + (count - 1) * gap;
    this.meshes.forEach((mesh, i) => {
      mesh.group.visible = true;
      mesh.setFlipWithTilt(0, 0, 0);
      const portrait = this.scene.portrait;
      if (portrait) {
        /* a fanned hand: every card keeps its native pixels */
        mesh.summaryTarget = {
          x: (i - 2) * 74,
          y: -Math.abs(i - 2) * 10,
          scale: 1,
        };
      } else {
        mesh.summaryTarget = {
          x: -totalW / 2 + 80 + i * 170,
          y: 0,
          scale: 1,
        };
      }
      mesh.group.position.set(mesh.summaryTarget.x, mesh.summaryTarget.y, 90);
      mesh.group.scale.setScalar(mesh.summaryTarget.scale);
      mesh.setTilt(0, 0);
      this.el.caption.innerHTML = "";
    });
  }

  openBinder() {
    this.renderBinder();
    this.el.binder.hidden = false;
    this.audio.click();
  }

  renderBinder() {
    const owned = this.binder.owned;
    const ownedCount = Object.keys(owned).length;
    const rarest = this.binder.rarest;
    this.el.binderStats.innerHTML = `
      <span><strong>${this.binder.packs}</strong> packs opened</span>
      <span><strong>${ownedCount}</strong><i>/151</i> species</span>
      <span><strong>${this.binder.shinies || 0}</strong> shiny pulls</span>
      <span>rarest <strong>${rarest ? `${rarest.name}${rarest.shiny ? " ✦" : ""}` : "—"}</strong></span>
    `;
    const base = import.meta.env.BASE_URL || "/";
    const cells = [];
    for (let id = 1; id <= 151; id += 1) {
      const key = String(id);
      const entry = owned[key];
      const mon = this.data.find((m) => m.id === id);
      const cls = entry ? `kp-cell kp-owned kp-${entry.rarity}` : "kp-cell";
      cells.push(`
        <div class="${cls}" title="${mon ? mon.name : key}">
          <img src="${base}cards/sprites/${String(id).padStart(3, "0")}.png" alt="" loading="lazy" />
          <span class="kp-cell-no">${String(id).padStart(3, "0")}</span>
          ${entry ? `<span class="kp-cell-mark">${entry.shiny ? "✦" : entry.rarity === "legend" ? "★" : entry.rarity === "holo" ? "★" : entry.rarity === "rare" ? "★" : ""}</span>` : ""}
        </div>
      `);
    }
    this.el.binderGrid.innerHTML = cells.join("");
  }

  /* ---------- frame ---------- */

  loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    this.frame();
  };

  frame() {
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, this.lastTime ? now - this.lastTime : 0.016);
    this.lastTime = now;
    this.step(dt);
    this.scene.render(now);
  }

  step(dt) {
    this.time += dt;
    this.phaseTime += dt;
    const { pack, meshes, scene } = this;

    if (this.spaceHeld && (this.phase === "idle" || this.phase === "tearing")) {
      if (this.phase === "idle") {
        this.setPhase("tearing");
        this.pack.setTear(0.001);
      }
      this.tear = Math.min(1, this.tear + dt / 0.9);
      this.pack?.setTear(this.tear);
      if (Math.random() < 0.25) this.audio.tear(this.tear);
      if (this.tear >= 1) this.completeTear();
    }

    if (pack) {
      if (!this.dragging) {
        this.packTilt.yaw += this.packTilt.vy;
        this.packTilt.pitch = clamp(this.packTilt.pitch + this.packTilt.vp, -0.44, 0.44);
        this.packTilt.vy *= 0.92;
        this.packTilt.vp *= 0.92;
      }
      const bob = Math.sin(this.time * 1.1) * 3;
      const sway = Math.sin(this.time * 0.7) * 0.05;
      pack.setTilt(this.packTilt.yaw + sway, this.packTilt.pitch);
      pack.group.position.y = bob + (this.packKick ? 6 : 0);
      pack.group.scale.setScalar(1 * (this.packKick ? 1.02 : 1));
      pack.update(dt, this.time);
    }

    if (this.phase === "flash") {
      if (this.beamMesh) {
        this.beamMesh.material.uniforms.uTime.value = this.time;
        this.beamMesh.position.y = 200;
      }
      if (this.phaseTime > 0.45 && meshes.length === 5) {
        this.setPhase("emerge");
        this.emergeStart = this.time;
        meshes.forEach((m, i) => {
          m.group.visible = true;
          m.group.position.set(0, 30, 50 + i * 1.5);
          m.group.scale.setScalar(1);
        });
        if (pack) pack.group.visible = false;
      }
    }

    if (this.phase === "emerge") {
      const t = (this.time - this.emergeStart) / 0.9;
      meshes.forEach((mesh, i) => {
        const delay = i * 0.07;
        const local = clamp((this.time - this.emergeStart - delay) / 0.55, 0, 1);
        const eased = 1 - Math.pow(1 - local, 3);
        mesh.group.position.y = lerp(30, 2 + i * 1.8, eased) + Math.sin(local * Math.PI) * 10;
        mesh.group.position.z = lerp(50, 70 + i * 1.5, eased);
        mesh.group.scale.setScalar(lerp(1, 1, eased));
        mesh.group.rotation.y = Math.PI;
        if (local > 0 && local < 0.08) this.audio.whoosh(i);
      });
      if (this.beamMesh) this.beamMesh.material.uniforms.uFade.value = clamp(1 - t * 0.7, 0.15, 1);
      if (t >= 1) {
        this.setPhase("stack");
        this.audio.stopBeam();
        if (this.beamMesh) this.beamMesh.visible = false;
      }
    }

    if ((this.phase === "stack" || this.phase === "reveal") && meshes.length === 5) {
      /* stack: face-down cards sit behind the active one */
      const active = meshes[this.revealIndex];
      meshes.forEach((mesh, i) => {
        if (i < this.revealIndex) {
          mesh.group.visible = true;
          mesh.group.position.lerp(new THREE.Vector3(-320 + (i % 2) * 18, -90, 20 + i), 0.12);
          mesh.group.scale.lerp(new THREE.Vector3(0.6, 0.6, 0.6), 0.12);
          mesh.setFlip(1);
          return;
        }
        mesh.group.visible = true;
        const offset = i - this.revealIndex;
        const targetScale = i === this.revealIndex ? 2 : 1;
        mesh.group.position.lerp(
          new THREE.Vector3(offset * 2, -offset * 3, 70 + offset * -4),
          0.14
        );
        mesh.group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.16);
        if (i === this.revealIndex) {
          mesh.setFlipWithTilt(1 - this.flip, this.tilt.x, this.tilt.y);
        } else {
          mesh.setFlip(1);
        }
      });

      this.tilt.x = lerp(this.tilt.x, this.tilt.targetX, 0.18);
      this.tilt.y = lerp(this.tilt.y, this.tilt.targetY, 0.18);
      if (this.flipping) {
        this.flip = clamp(this.flip + dt / 0.34, 0, 1);
        if (this.flip >= 1) this.finishReveal();
      }
      if (this.phase === "reveal" && this.flipped[this.revealIndex]) {
        meshes[this.revealIndex].setFlipWithTilt(0, this.tilt.x, this.tilt.y);
      }
    }

    if (this.holdBeforeSummary && this.time > this.holdBeforeSummary) {
      this.holdBeforeSummary = 0;
      this.showSummary();
    }

    if (this.phase === "summary") {
      meshes.forEach((mesh, i) => {
        if (!mesh.summaryTarget) return;
        mesh.group.position.lerp(new THREE.Vector3(mesh.summaryTarget.x, mesh.summaryTarget.y, 90), 0.12);
        mesh.group.scale.lerp(new THREE.Vector3(mesh.summaryTarget.scale, mesh.summaryTarget.scale, mesh.summaryTarget.scale), 0.12);
        mesh.setTilt(this.tilt.x * 0.4, this.tilt.y * 0.4);
      });
    }

    if (this.lastSuspense && this.time - this.lastSuspenseAt > 0.9 && !this.flipping && !this.flipped[this.revealIndex]) {
      this.lastSuspense = false;
      this.startFlip();
    }
  }

  /* ---------- test hooks ---------- */

  openSeed(seed) {
    this.seed = String(seed).toUpperCase().slice(0, 12);
    this.el.seed.textContent = this.seed;
    this.newPack(true).then(() => {
      this.setPhase("tearing");
      this.tear = 1;
      this.pack?.setTear(1);
      this.completeTear();
    });
  }

  forceRarity(rarity) {
    this.force = ORDER.includes(rarity) ? rarity : null;
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    this.clearScene();
    this.scene.dispose();
    this.hud.remove();
  }
}

function fmtHeight(height) {
  if (!height) return "??";
  const total = Math.round(height * 39.3701);
  const feet = Math.floor(total / 12);
  const inches = total % 12;
  return `${feet}'${String(inches).padStart(2, "0")}"`;
}
