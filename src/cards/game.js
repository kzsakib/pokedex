/* Kanto Packs — state machine, 3D scene wiring, input and HUD. */
import * as THREE from "three";
import { PixelScene } from "./scene.js";
import { createPack } from "./pack3d.js";
import { createCardMesh } from "./cards3d.js";
import { makeHoloMask } from "./holo.js";
import { loadGen1, preloadSprites, loadSprite, spriteFor } from "./assets.js";
import { generatePack, RARITY_LABEL } from "./generate.js";
import { chromaLore } from "./lore.js";
import { cardSpriteLayout, renderCard } from "./cardRenderer.js";
import { loadTypeIcons } from "./icons.js";
import { TYPE_COL, keyOf } from "./theme.js";
import { renderPackFront, renderPackBack, renderStrip, VARIANTS } from "./packArt.js";

const FINISH_TAG = { reverse: " · REVERSE", holo: "", prism: " · PRISM", gold: " · GOLD", foil: " · FOIL", star: " · STARLIGHT", ember: " · EMBER", crystal: " · CRYSTAL", lightning: " · STORM", bubble: " · AQUA", grid: " · CIRCUIT", confetti: " · FESTIVAL", shiny: "" };
import { freshSeed } from "./rng.js";
import { KantoAudio } from "./audio.js";
import { loadBinder, recordPack, resetBinder, backfillNote } from "./storage.js";
import { fallbackLore } from "./lore.js";

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
    /* older saves kept the flavour line but not the generated entry */
    for (const pull of this.binder.pulls || []) {
      const c = pull.card;
      if (c?.variant && !c.variant.note) c.variant.note = fallbackLore(c);
    }
    this.seed = this.readSeedFromUrl() || freshSeed();
    this.force = this.readForceFromUrl();
    this.phase = "idle";
    this.focusIndex = -1;
    this.suppressPick = false;
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
    this.container.classList.add("kp-loading");
    this.drawLoaderBall();
    this.loaderText("BOOTING THE REGISTRY");
    const minBoot = new Promise((resolve) => setTimeout(resolve, 900));
    this.data = await loadGen1();
    this.loaderText("LOADING SPRITES");
    await preloadSprites((done) => {
      const pct = Math.min(100, Math.round((done / 151) * 100));
      this.loaderProgress(pct);
      if (done % 25 === 0) this.hint(`loading sprites… ${pct}%`);
    });
    await minBoot;
    this.container.classList.remove("kp-loading");
    this.resetLoader();
    this.ready = true;
    this.hint("hover to tilt · swipe the dotted line to slice");
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
      <div class="kp-loader" aria-hidden="true">
        <div class="kp-loader-ring" aria-hidden="true"></div>
        <canvas class="kp-loader-ball" width="32" height="32" aria-hidden="true"></canvas>
        <div class="kp-loader-bar"><i></i></div>
        <p class="kp-loader-text">SEALING THE PACK</p>
      </div>
      <div class="kp-dialog kp-binder" role="dialog" aria-modal="true" aria-labelledby="kp-binder-title" hidden>
        <div class="kp-dialog-inner kp-binder-inner">
          <h2 id="kp-binder-title">BINDER</h2>
          <div class="kp-binder-stats"></div>
          <nav class="kp-binder-tabs" role="tablist">
            <button type="button" class="kp-tab is-on" data-tab="species" role="tab">species</button>
            <button type="button" class="kp-tab" data-tab="cards" role="tab">my cards</button>
          </nav>
          <div class="kp-binder-grid"></div>
          <div class="kp-binder-pulls" hidden></div>
          <div class="kp-binder-foot">
            <button type="button" class="kp-btn kp-close-binder">close</button>
            <button type="button" class="kp-btn kp-reset">reset binder</button>
          </div>
        </div>
      </div>
    `;
    this.container.appendChild(hud);
    this.entryEl = document.createElement("p");
    this.entryEl.className = "kp-entry";
    this.entryEl.setAttribute("aria-live", "polite");
    this.container.appendChild(this.entryEl);

    this.pickEl = document.createElement("div");
    this.pickEl.className = "kp-pick";
    this.pickEl.hidden = true;
    this.container.insertAdjacentElement("afterend", this.pickEl);

    this.captionEl = document.createElement("div");
    this.captionEl.className = "kp-caption kp-caption--flow";
    this.captionEl.setAttribute("aria-live", "polite");
    this.container.insertAdjacentElement("afterend", this.captionEl);
    this.hud = hud;
    this.el = {
      packs: hud.querySelector(".kp-packs"),
      seed: hud.querySelector(".kp-seed"),
      hint: hud.querySelector(".kp-hint"),
      flash: hud.querySelector(".kp-flash"),
      sparkles: hud.querySelector(".kp-sparkles"),
      caption: this.captionEl,
      summary: hud.querySelector(".kp-summary-actions"),
      sound: hud.querySelector(".kp-sound"),
      help: hud.querySelector(".kp-help"),
      binder: hud.querySelector(".kp-binder"),
      binderStats: hud.querySelector(".kp-binder-stats"),
      binderGrid: hud.querySelector(".kp-binder-grid"),
      binderPulls: hud.querySelector(".kp-binder-pulls"),
      binderTabs: [...hud.querySelectorAll(".kp-tab")],
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
      if (!this.audio.muted) this.audio.startMusic();
      this.el.sound.textContent = this.audio.muted ? "sound off" : "sound on";
      this.el.sound.setAttribute("aria-pressed", String(this.audio.muted));
    });
    hud.querySelector(".kp-again").addEventListener("click", () => this.newPack());
    hud.querySelector(".kp-binder-btn").addEventListener("click", () => this.openBinder());
    for (const tab of this.el.binderTabs) {
      tab.addEventListener("click", () => {
        this.binderTab = tab.dataset.tab;
        this.renderBinder();
      });
    }
    hud.querySelector(".kp-close-binder").addEventListener("click", () => {
      this.el.binder.hidden = true;
    });
    hud.querySelector(".kp-reset").addEventListener("click", () => {
      this.binder = resetBinder();
      this.el.packs.textContent = "0";
      this.renderBinder();
    });
  }

  drawLoaderBall() {
    const canvas = this.container.querySelector(".kp-loader-ball");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const px = (x, y, w, h, colour) => {
      ctx.fillStyle = colour;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    ctx.clearRect(0, 0, 32, 32);
    for (let y = 0; y < 32; y += 1) {
      for (let x = 0; x < 32; x += 1) {
        const dx = x - 15.5;
        const dy = y - 15.5;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r > 15.2) continue;
        if (r > 13.4) {
          px(x, y, 1, 1, "#1a1220");
        } else if (dy < -1.6) {
          px(x, y, 1, 1, dx + dy < -12 ? "#ff6a4d" : "#d8321f");
        } else if (dy > 1.6) {
          px(x, y, 1, 1, dx > 6 ? "#efe6cf" : "#d9cfb4");
        } else {
          px(x, y, 1, 1, "#1a1220");
        }
      }
    }
    px(12, 12, 8, 8, "#1a1220");
    px(13, 13, 6, 6, "#efe6cf");
    px(14, 14, 3, 3, "#c9c0a8");
  }

  loaderText(text) {
    const el = this.container.querySelector(".kp-loader-text");
    if (el) el.textContent = text;
  }

  loaderProgress(pct) {
    const bar = this.container.querySelector(".kp-loader-bar i");
    if (!bar) return;
    bar.style.animation = "none";
    bar.style.width = `${pct}%`;
  }

  resetLoader() {
    const bar = this.container.querySelector(".kp-loader-bar i");
    if (bar) {
      bar.style.animation = "";
      bar.style.width = "";
    }
    this.loaderText("SEALING THE PACK");
  }

  hint(text) {
    if (this.el) this.el.hint.textContent = text;
  }

  setPhase(phase) {
    this.phase = phase;
    this.phaseTime = 0;
    const hints = {
      choose: "three packs — tap one to open it",
      idle: "hover to tilt · swipe the dotted line to slice",
      tearing: "keep going…",
      flash: "",
      emerge: "",
      stack: "click to flip",
      reveal: "click to flip · drag to tilt",
      summary: this.scene?.portrait ? "drag up and down to browse · open another or check the binder" : "five cards · open another or check the binder",
    };
    this.hint(hints[phase] || "");
    this.container.classList.toggle("kp-browsing", phase === "summary" && !!this.scene?.portrait);
    this.el.summary.classList.toggle("kp-show", phase === "summary");
    this.el.caption.classList.toggle("kp-show", phase === "reveal" && this.flipped[this.revealIndex]);
  }

  /* ---------- scene ---------- */

  clearScene() {
    for (const entry of this.packs || []) {
      this.scene.root.remove(entry.pack.group);
      entry.pack.dispose();
    }
    this.packs = [];
    this.hoverPack = -1;
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
  }

  async newPack(keepSeed = false) {
    if (this.newPackBusy) return;
    this.newPackBusy = true;
    try {
      await this.buildPack(keepSeed);
    } finally {
      this.newPackBusy = false;
    }
  }

  async buildPack(keepSeed) {
    this.closePullView();
    this.el.binder.hidden = true;
    this.el.help.hidden = true;
    this.el.summary.classList.remove("kp-show");
    this.el.caption.classList.remove("kp-show");
    this.el.caption.innerHTML = "";
    if (this.entryEl) this.entryEl.textContent = "";
    if (this.typeTimer) {
      clearInterval(this.typeTimer);
      this.typeTimer = null;
    }
    this.dragging = false;
    this.slicing = false;
    this.summaryDragging = false;
    this.focusIndex = -1;
    this.suppressPick = false;
    this.summaryScroll = 0;
    this.hoverYaw = 0;
    this.hoverPitch = 0;
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
    const shuffled = keys.sort(() => Math.random() - 0.5).slice(0, 3);
    const built = [];
    for (const key of shuffled) {
      const variant = VARIANTS[key];
      const mascot = await loadSprite(variant.mascot);
      const front = renderPackFront(variant, mascot);
      const back = renderPackBack(variant);
      const strip = renderStrip(variant);
      built.push({ variant, pack: createPack({ front, back, strip }) });
    }
    this.packs = built;
    this.hoverPack = -1;
    this.pack = null;
    for (const entry of this.packs) this.scene.root.add(entry.pack.group);
    this.layoutPacks();
    this.setPhase("choose");
    this.packKick = 0;
    this.showPickMenu();
  }

  async generate() {
    if (this.generating) return;
    this.generating = true;
    this.container.classList.add("kp-loading");
    this.drawLoaderBall();
    this.resetLoader();
    const minShow = new Promise((resolve) => setTimeout(resolve, 1100));
    await loadTypeIcons();
    const pack = generatePack(this.data, this.seed, { force: this.force });
    this.packData = pack;
    this.cards = pack.cards;
    this.binder = recordPack(this.binder, this.cards);
    this.el.packs.textContent = this.binder.packs;

    for (const card of this.cards) {
      const sprite = await spriteFor(card);
      const front = renderCard(card, sprite, { omitSprite: true });
      const mask = makeHoloMask(card.finish === "reverse" ? "holo" : card.rarity);
      /* every pokemon rides its own layer so it moves against the card */
      const spriteLayout = cardSpriteLayout(card, sprite);
      const mesh = createCardMesh({
        front,
        spriteLayout,
        mask,
        rarity: card.rarity,
        finish: card.finish,
        typeColor: TYPE_COL[keyOf(card.tcg)],
      });
      mesh.group.position.set(0, 40, 70 + this.meshes.length * 0.6);
      mesh.group.scale.setScalar(1);
      mesh.group.visible = false;
      this.meshes.push(mesh);
      this.scene.root.add(mesh.group);
    }

    /* one line per chroma card, written while the loader is up */
    await Promise.all(
      this.cards
        .filter((card) => card.variant)
        .map(async (card) => {
          const line = await chromaLore(card);
          if (line) {
            card.variant.note = line;
            backfillNote(this.binder, card);
          }
        })
    );

    /* the pack has served its purpose once the cards exist */
    if (this.pack) this.pack.group.visible = false;
    await minShow;
    this.generating = false;
    this.container.classList.remove("kp-loading");

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

  typeEntry(text, card) {
    if (!this.entryEl) return;
    if (this.typeTimer) clearInterval(this.typeTimer);
    const full = String(text || "").replace(/\s+/g, " ").trim();
    this.entryEl.textContent = "";
    this.entryEl.classList.toggle("kp-entry--chroma", !!(card && card.variant));
    if (!full) return;
    let i = 0;
    this.typeTimer = setInterval(() => {
      i += 1;
      this.entryEl.textContent = full.slice(0, i);
      if (i >= full.length) {
        clearInterval(this.typeTimer);
        this.typeTimer = null;
      }
    }, 16);
  }

  showCaption(card) {
    const stats = `HT ${fmtHeight(card.height)}  WT ${card.weight ? `${Math.round(card.weight * 2.2046)} LB` : "??"}`;
    this.el.caption.innerHTML = `
      <strong>${card.name}</strong>
      <span>${RARITY_LABEL[card.rarity]}${card.shiny ? " · SHINY ✦" : FINISH_TAG[card.finish] || ""}</span>
      <span>${stats}</span>
      <span>seed ${this.seed}</span>
    `;
    const entry = card.variant && card.variant.note ? card.variant.note : card.flavour || "";
    this.typeEntry(entry, card);
    this.el.caption.classList.add("kp-show");
  }

  /* ---------- pack interaction ---------- */

  bindInput() {
    const canvas = this.scene.canvas;
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", (e) => {
      this.audio.unlock();
      this.audio.startMusic();
      canvas.setPointerCapture?.(e.pointerId);
      const p = this.toLocal(e);
      this.lastPointer = { x: e.clientX, y: e.clientY, t: performance.now() };
      this.pressAt = { x: e.clientX, y: e.clientY };

      if (this.phase === "choose") {
        const idx = this.packAt(p);
        if (idx >= 0) this.choosePack(idx);
        return;
      }
      if (this.phase === "idle" || this.phase === "tearing") {
        if (this.nearTear(e)) {
          this.slicing = true;
          this.lastSliceX = null;
          this.setPhase("tearing");
          this.tearAt(p, e);
          return;
        }
        /* the pack is not draggable: it only leans toward the cursor */
        this.packKick = 1;
        return;
      }
      if (this.phase === "summary") {
        if (this.focusIndex >= 0) {
          this.suppressPick = true;
          this.unfocusCard();
          return;
        }
        if (this.scene.portrait) {
          this.dragging = false;
          this.summaryDragging = true;
          this.summaryStartY = e.clientY;
          this.summaryStartScroll = this.summaryScroll || 0;
        }
        return;
      }
      if (this.phase === "reveal") {
        if (!this.flipped[this.revealIndex]) this.startFlip();
        return;
      }
      if (this.phase === "stack") {
        this.startFlip();
      }
    });

    canvas.addEventListener("pointermove", (e) => {
      if (this.summaryDragging) {
        const dy = e.clientY - this.summaryStartY;
        this.summaryScroll = clamp(this.summaryStartScroll + dy, -80, 1900);
        return;
      }
      const p = this.toLocal(e);
      if (this.phase === "choose") {
        this.hoverPack = this.packAt(p);
        return;
      }
      if (this.slicing) {
        this.tearAt(p, e);
        return;
      }
      if (this.phase === "idle" || this.phase === "tearing") {
        const rect = this.scene.canvas.getBoundingClientRect();
        const nx = clamp((e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2), -1, 1);
        const ny = clamp((e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2), -1, 1);
        this.hoverYaw = -nx * 0.38;
        this.hoverPitch = -ny * 0.24;
      }
      if ((this.phase === "reveal" || this.phase === "stack" || this.phase === "summary") && !this.dragging) {
        /* lean away from the pointer: the side under the cursor sinks back */
        const rect = this.scene.canvas.getBoundingClientRect();
        const nx = clamp((e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2), -1, 1);
        const ny = clamp((e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2), -1, 1);
        this.tilt.targetX = -nx * 0.44;
        this.tilt.targetY = -ny * 0.3;
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

    canvas.addEventListener("pointerleave", () => {
      if (this.phase === "reveal" || this.phase === "stack") {
        this.tilt.targetX = 0;
        this.tilt.targetY = 0;
      }
    });

    const release = (e) => {
      const moved = this.pressAt ? Math.hypot(e.clientX - this.pressAt.x, e.clientY - this.pressAt.y) : 99;
      if (!this.slicing && moved < 8 && this.phase === "reveal" && this.flipped[this.revealIndex]) {
        this.advanceReveal();
      }
      if (this.suppressPick) {
        this.suppressPick = false;
      } else if (this.phase === "summary" && moved < 8 && this.focusIndex < 0) {
        const hit = this.pickSummary(e);
        if (hit >= 0) this.focusCard(hit);
      }
      if (this.slicing) {
        this.slicing = false;
        if (this.tear < 1 && this.phase === "tearing") {
          /* flap stays partly open; it can resume */
          this.hint("swipe the tear again to finish");
        }
      }
      this.dragging = false;
      this.summaryDragging = false;
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
        if (this.pullView) {
          this.closePullView();
          return;
        }
        this.el.help.hidden = true;
        this.el.binder.hidden = true;
        if (this.focusIndex >= 0) this.unfocusCard();
      }
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      if (e.code === "Space") {
        e.preventDefault();
        this.audio.unlock();
        this.audio.startMusic();
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

  layoutPacks() {
    if (!this.packs?.length) return;
    const W = this.scene?.W || 288;
    const packW = 176;
    const fit = (W - 14) / (3 * packW * 0.82);
    const scale = Math.max(0.4, Math.min(1, fit));
    const gap = packW * scale * 0.82;
    this.packs.forEach((entry, i) => {
      entry.home = {
        x: (i - 1) * gap,
        y: i === 1 ? 8 : -6,
        z: i === 1 ? 10 : -30,
        rot: (i - 1) * 0.26,
        scale,
      };
      const g = entry.pack.group;
      g.position.set(entry.home.x, entry.home.y, entry.home.z);
      g.rotation.set(0, entry.home.rot, 0);
      g.scale.setScalar(scale);
    });
  }

  showPickMenu() {
    if (!this.pickEl || !this.packs?.length) return;
    const rows = this.packs
      .map((entry, i) => {
        const v = entry.variant;
        return `<button class="kp-pick-btn" data-pack="${i}" style="--pack:${v.base};--pack-foil:${v.foil}">
          <span class="kp-pick-num">0${i + 1}</span>
          <span class="kp-pick-name">${v.name}</span>
          <span class="kp-pick-tag">${v.label} · 5 CARDS</span>
        </button>`;
      })
      .join("");
    this.pickEl.innerHTML = `<span class="kp-pick-title">CHOOSE A SET</span><span class="kp-pick-row">${rows}</span>`;
    this.pickEl.hidden = false;
    for (const btn of this.pickEl.querySelectorAll(".kp-pick-btn")) {
      btn.addEventListener("click", () => {
        this.audio.unlock();
        this.audio.startMusic();
        this.audio.click();
        this.choosePack(Number(btn.dataset.pack));
      });
    }
  }

  packAt(p) {
    if (!this.packs?.length) return -1;
    const wx = p.x - (this.scene?.W || 288) / 2;
    const wy = (this.scene?.H || 560) / 2 - p.y;
    let best = -1;
    let bestD = Infinity;
    this.packs.forEach((entry, i) => {
      const g = entry.pack.group;
      const dx = wx - g.position.x;
      const dy = wy - g.position.y;
      const d = Math.hypot(dx, dy);
      const reach = 176 * 0.5 * (entry.home?.scale || 1) * 1.3;
      if (d < reach && d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  choosePack(index) {
    const chosen = this.packs[index];
    if (!chosen) return;
    this.packs.forEach((entry, i) => {
      if (i === index) return;
      this.scene.root.remove(entry.pack.group);
      entry.pack.dispose();
    });
    const g = chosen.pack.group;
    g.position.set(0, 0, 0);
    g.rotation.set(0, 0, 0);
    g.scale.setScalar(1);
    this.pack = chosen.pack;
    this.packs = [];
    this.hoverPack = -1;
    if (this.pickEl) {
      this.pickEl.hidden = true;
      this.pickEl.innerHTML = "";
    }
    this.packKick = 1;
    this.packTilt = { yaw: 0, pitch: 0, vy: 0, vp: 0 };
    this.setPhase("idle");
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

  tearAt(p, e) {
    if (!this.pack) return;
    /* the cut follows the hand: distance swiped along the dotted line, not a jump */
    const step = this.lastSliceX == null ? 0 : Math.abs(p.x - this.lastSliceX);
    this.lastSliceX = p.x;
    const gained = step / (this.scene.W * 0.42);
    if (gained > 0.0004) {
      this.tearTarget = clamp(this.tearTarget + gained, 0, 1);
      this.spawnSpark(e, p);
      if (this.cutClock == null || this.time - this.cutClock > 0.05) {
        this.cutClock = this.time;
        this.audio.tear(this.tearTarget);
      }
    }
    if (this.tearTarget >= 1) this.tear = Math.max(this.tear, 0.999);
  }

  /* paper flecks kicked out of the cut, straight DOM so it costs nothing */
  spawnSpark(e, p) {
    const stage = this.el?.stage || this.container.querySelector(".kp-stage") || this.container;
    if (!stage) return;
    const rect = this.scene.canvas.getBoundingClientRect();
    const host = stage.getBoundingClientRect();
    const clientX = e && e.clientX ? e.clientX : rect.left + (p.x / this.scene.W) * rect.width;
    const clientY = e && e.clientY ? e.clientY : rect.top + (p.y / this.scene.H) * rect.height;
    const spark = document.createElement("i");
    spark.className = "kp-spark";
    spark.style.left = `${clientX - host.left}px`;
    spark.style.top = `${clientY - host.top}px`;
    spark.style.setProperty("--dx", `${(Math.random() - 0.5) * 60}px`);
    spark.style.setProperty("--dy", `${-30 - Math.random() * 70}px`);
    spark.style.setProperty("--spin", `${(Math.random() - 0.5) * 540}deg`);
    stage.appendChild(spark);
    spark.addEventListener("animationend", () => spark.remove(), { once: true });
    setTimeout(() => spark.remove(), 700);
  }

  completeTear() {
    if (this.phase !== "tearing") return;
    this.slicing = false;
    this.tear = 1;
    this.tearTarget = 1;
    this.lastSliceX = null;
    this.container.classList.add("kp-rip");
    setTimeout(() => this.container.classList.remove("kp-rip"), 280);
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
    this.summaryScroll = 0;
    this.focusIndex = -1;
    this.suppressPick = false;
    this.setPhase("summary");
    this.el.caption.classList.remove("kp-show");
    if (this.beamMesh) this.beamMesh.visible = false;
    this.audio.stopBeam();
    this.layoutSummary();
    this.meshes.forEach((mesh) => {
      mesh.group.position.set(mesh.summaryTarget.x, mesh.summaryTarget.y, 90);
      mesh.group.scale.setScalar(mesh.summaryTarget.scale);
      mesh.setTilt(0, 0);
    });
    this.el.caption.innerHTML = "";
  }

  layoutSummary() {
    const portrait = this.scene.portrait;
    /* five cards plus a margin on both sides has to fit the render width */
    const n = this.meshes.length || 5;
    const gap = 12;
    const fit = Math.min(1, (this.scene.W - 40 - gap * (n - 1)) / (152 * n));
    const step = 152 * fit + gap;
    const scale = portrait ? 2 : fit;
    this.meshes.forEach((mesh, i) => {
      mesh.group.visible = true;
      mesh.setFlipWithTilt(0, 0, 0);
      mesh.summaryTarget = portrait
        ? { x: 0, y: 0, scale: 2, portraitIndex: i }
        : { x: (i - (this.meshes.length - 1) / 2) * step, y: 0, scale };
    });
  }

  /* which summary card sits under the pointer (landscape layout) */
  pickSummary(e) {
    const p = this.toLocal(e);
    const sx = p.x - this.scene.W / 2;
    const sy = this.scene.H / 2 - p.y;
    let hit = -1;
    let best = Infinity;
    this.meshes.forEach((mesh, i) => {
      const target = mesh.summaryTarget;
      if (!target) return;
      const s = mesh.group.scale.x || 1;
      const dx = Math.abs(sx - mesh.group.position.x);
      const dy = Math.abs(sy - mesh.group.position.y);
      if (dx < 82 * s && dy < 114 * s && dx + dy < best) {
        best = dx + dy;
        hit = i;
      }
    });
    return hit;
  }

  focusCard(i) {
    if (i < 0 || !this.meshes[i]) return;
    this.focusIndex = i;
    this.audio.click();
    this.meshes.forEach((mesh, j) => {
      mesh.group.visible = true;
      mesh.summaryTarget =
        j === i
          ? { x: 0, y: 12, scale: this.scene.portrait ? 1.65 : 1.7 }
          : { x: 0, y: 0, scale: 0.001 };
    });
    this.showCaption(this.cards[i]);
    this.el.caption.classList.add("kp-show");
    this.hint("click anywhere to close");
  }

  unfocusCard() {
    if (this.focusIndex < 0) return;
    this.focusIndex = -1;
    this.el.caption.classList.remove("kp-show");
    this.layoutSummary();
    this.hint(this.scene.portrait ? "tap a card to enlarge · drag to browse" : "tap a card to enlarge it");
  }

  openBinder() {
    this.renderBinder();
    this.el.binder.hidden = false;
    this.audio.click();
  }

  async renderBinderCards() {
    const wrap = this.el.binderPulls;
    if (!wrap) return;
    const pulls = this.binder.pulls || [];
    if (!pulls.length) {
      wrap.innerHTML = `<p class="kp-binder-empty">nothing pulled yet — open a pack</p>`;
      return;
    }
    const seen = new Set();
    const list = [];
    for (const entry of pulls) {
      const card = entry.card || entry;
      if (!card || !card.moves) continue;
      const key = `${card.id}:${card.finish}:${card.shiny ? 1 : 0}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(card);
      if (list.length >= 60) break;
    }
    wrap.innerHTML = `<p class="kp-binder-empty">developing film…</p>`;
    const cells = [];
    for (const card of list) {
      const sprite = await spriteFor(card).catch(() => null);
      if (!wrap.isConnected) return;
      const canvas = renderCard(card, sprite);
      canvas.className = "kp-pull";
      const cell = document.createElement("figure");
      cell.className = `kp-pull-cell kp-${card.rarity}`;
      cell.tabIndex = 0;
      cell.setAttribute("role", "button");
      cell.setAttribute("aria-label", `view ${card.name || ""}`);
      cell.addEventListener("click", () => this.openPullView(card));
      cell.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.openPullView(card);
        }
      });
      cell.appendChild(canvas);
      const cap = document.createElement("figcaption");
      cap.textContent = card.variant
        ? `${card.name || ""} · ${card.variant.label}`
        : `${card.name || ""}${FINISH_TAG[card.finish] || ""}`;
      cell.appendChild(cap);
      cells.push(cell);
    }
    if (!wrap.isConnected) return;
    wrap.replaceChildren(...cells);
  }

  async openPullView(card) {
    this.closePullView();
    const sprite = await spriteFor(card).catch(() => null);
    const wrap = document.createElement("div");
    wrap.className = "kp-pull-view";
    wrap.innerHTML = `
      <div class="kp-pull-view-inner">
        <button type="button" class="kp-pull-view-close" aria-label="close">×</button>
        <div class="kp-pull-view-card"></div>
        <div class="kp-pull-view-meta">
          <strong>${card.name || ""}</strong>
          <span>${RARITY_LABEL[card.rarity] || ""}${card.variant ? ` · ${card.variant.label} FORM` : ""}${card.shiny ? " · SHINY ✦" : ""}</span>
          ${card.variant ? `<span class="kp-pull-view-note">${card.variant.label} FORM</span>` : ""}
          <span>${card.special === "full" ? "FULL ART" : card.special === "ex" ? "EX · BREAKS THE FRAME" : `${(FINISH_TAG[card.finish] || "").replace(/^ · /, "").toLowerCase() || "standard"} finish`}</span>
          ${(() => {
            const line = (card.variant && card.variant.note) || card.flavour || "";
            return line ? `<span class="kp-pull-view-entry">${line}</span>` : "";
          })()}
        </div>
      </div>
    `;
    this.pullViewer = this.buildPullViewer(wrap.querySelector(".kp-pull-view-card"), card, sprite);
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap || e.target.closest(".kp-pull-view-close")) this.closePullView();
    });
    this.container.appendChild(wrap);
    this.pullView = wrap;
  }

  /* the enlarged binder card is the same mesh as the pack one: live foil and tilt */
  buildPullViewer(holder, card, sprite) {
    const scene = new PixelScene(holder);
    scene.renderer.setClearColor(0x0d0b1e, 1);
    scene.bg.visible = false;

    const W = 176;
    const H = 246;
    scene.W = W;
    scene.H = H;
    scene.renderer.setSize(W, H, false);
    scene.camera.left = -W / 2;
    scene.camera.right = W / 2;
    scene.camera.top = H / 2;
    scene.camera.bottom = -H / 2;
    scene.camera.updateProjectionMatrix();
    scene.canvas.style.width = "100%";
    scene.canvas.style.height = "auto";
    scene.canvas.style.imageRendering = "pixelated";

    const front = renderCard(card, sprite, { omitSprite: true });
    const mask = makeHoloMask(card.finish === "reverse" ? "holo" : card.rarity);
    const spriteLayout = cardSpriteLayout(card, sprite);
    const mesh = createCardMesh({
      front,
      spriteLayout,
      mask,
      rarity: card.rarity,
      finish: card.finish,
      typeColor: TYPE_COL[keyOf(card.tcg)],
    });
    mesh.group.position.set(0, 6, 0);
    mesh.group.scale.setScalar(0.94); /* room for the slab edge and its shadow */
    scene.root.add(mesh.group);

    let yaw = 0;
    let pitch = 0;
    let targetYaw = 0;
    let targetPitch = 0;
    let hover = 0;
    let raf = 0;
    const started = performance.now();

    const onMove = (e) => {
      const rect = holder.getBoundingClientRect();
      const nx = clamp((e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2), -1, 1);
      const ny = clamp((e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2), -1, 1);
      targetYaw = nx * 0.55;
      targetPitch = -ny * 0.38;
      hover = 1;
    };
    const onLeave = () => {
      hover = 0;
    };
    holder.addEventListener("pointermove", onMove);
    holder.addEventListener("pointerleave", onLeave);

    const loop = (now) => {
      const t = (now - started) / 1000;
      if (!hover) {
        /* keep it alive while idle: a slow sway instead of a frozen print */
        targetYaw = Math.sin(t * 0.8) * 0.22;
        targetPitch = Math.cos(t * 0.62) * 0.13;
      }
      yaw += (targetYaw - yaw) * 0.12;
      pitch += (targetPitch - pitch) * 0.12;
      mesh.setTilt(yaw, pitch);
      scene.render(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return {
      dispose() {
        cancelAnimationFrame(raf);
        holder.removeEventListener("pointermove", onMove);
        holder.removeEventListener("pointerleave", onLeave);
        mesh.dispose();
        scene.dispose();
      },
    };
  }

  closePullView() {
    if (this.pullViewer) {
      this.pullViewer.dispose();
      this.pullViewer = null;
    }
    if (this.pullView) {
      this.pullView.remove();
      this.pullView = null;
    }
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
    const tab = this.binderTab || "species";
    for (const button of this.el.binderTabs || []) button.classList.toggle("is-on", button.dataset.tab === tab);
    if (this.el.binderGrid) this.el.binderGrid.hidden = tab !== "species";
    if (this.el.binderPulls) this.el.binderPulls.hidden = tab !== "cards";
    if (tab === "cards") {
      this.renderBinderCards();
      return;
    }
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
          ${entry ? `<span class="kp-cell-mark">${entry.shiny ? "✦" : entry.rarity === "chroma" ? "◇" : entry.rarity === "legend" ? "★" : entry.rarity === "holo" ? "★" : entry.rarity === "rare" ? "★" : ""}</span>` : ""}
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
      this.tearTarget = Math.min(1, (this.tearTarget || 0) + dt / 0.9);
      if (Math.random() < 0.25) this.audio.tear(this.tear);
      if (this.tear >= 1) this.completeTear();
    }

    if (this.phase === "tearing" && this.tear < this.tearTarget) {
      /* the tear eases to the cut instead of snapping with the cursor */
      this.tear = Math.min(this.tearTarget, this.tear + Math.max(dt * 1.6, 0.004));
      this.pack?.setTear(this.tear);
      if (this.tear >= 1) this.completeTear();
    }

    if (this.phase === "choose" && this.packs?.length) {
      this.packs.forEach((entry, i) => {
        const home = entry.home;
        const hover = this.hoverPack === i;
        const g = entry.pack.group;
        const ty = home.y + Math.sin(this.time * 1.2 + i * 1.9) * 4 + (hover ? 10 : 0);
        const tz = home.z + (hover ? 22 : 0);
        const ts = home.scale * (hover ? 1.06 : 1);
        g.position.x += (home.x - g.position.x) * 0.16;
        g.position.y += (ty - g.position.y) * 0.16;
        g.position.z += (tz - g.position.z) * 0.16;
        g.rotation.y += ((home.rot + (hover ? this.hoverYaw * 0.5 : 0)) - g.rotation.y) * 0.16;
        const sc = g.scale.x + (ts - g.scale.x) * 0.16;
        g.scale.setScalar(sc);
        entry.pack.update(dt, this.time);
      });
    }

    if (pack) {
      if (this.phase === "idle" || this.phase === "tearing" || this.phase === "flash" || this.phase === "emerge") {
        this.packTilt.yaw += ((this.hoverYaw || 0) - this.packTilt.yaw) * 0.07;
        this.packTilt.pitch += ((this.hoverPitch || 0) - this.packTilt.pitch) * 0.07;
      } else if (!this.dragging) {
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
          mesh.group.visible = false;
          mesh.group.position.lerp(new THREE.Vector3(-this.scene.W * 0.36 + (i % 2) * 18, -90, 20 + i), 0.12);
          mesh.group.scale.lerp(new THREE.Vector3(0.6, 0.6, 0.6), 0.12);
          mesh.setFlip(1);
          return;
        }
        mesh.group.visible = i === this.revealIndex;
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

      if (this.flipping) {
        this.flip = clamp(this.flip + dt / 0.34, 0, 1);
        if (this.flip >= 1) this.finishReveal();
      }
      if (this.phase === "reveal" && this.flipped[this.revealIndex]) {
        meshes[this.revealIndex].setFlipWithTilt(0, this.tilt.x, this.tilt.y);
      }
    }

    /* tilt eases every frame so hover works in the summary too */
    this.tilt.x = lerp(this.tilt.x, this.tilt.targetX, 0.12);
    this.tilt.y = lerp(this.tilt.y, this.tilt.targetY, 0.12);

    if (this.holdBeforeSummary && this.time > this.holdBeforeSummary) {
      this.holdBeforeSummary = 0;
      this.showSummary();
    }

    if (this.phase === "summary") {
      meshes.forEach((mesh, i) => {
        if (!mesh.summaryTarget) return;
        let tx = mesh.summaryTarget.x;
        let ty = mesh.summaryTarget.y;
        if (this.scene.portrait && this.focusIndex < 0) {
          ty = 0 - i * 460 + (this.summaryScroll || 0);
          tx = 0;
        }
        mesh.group.visible =
          this.focusIndex >= 0
            ? i === this.focusIndex
            : !this.scene.portrait || Math.abs(ty) < 330;
        mesh.group.position.lerp(new THREE.Vector3(tx, ty, 90), 0.12);
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
    this.pickEl?.remove();
    this.captionEl?.remove();
  }
}

function fmtHeight(height) {
  if (!height) return "??";
  const total = Math.round(height * 39.3701);
  const feet = Math.floor(total / 12);
  const inches = total % 12;
  return `${feet}'${String(inches).padStart(2, "0")}"`;
}
