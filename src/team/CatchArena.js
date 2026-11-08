/* The catching arena: one Phaser 3 scene, powered by Matter.js.

   Deliberately framework-free. React mounts it, hands over the roster and
   listens for state snapshots; nothing that moves, bounces or shakes ever
   touches the page tree. Phaser is imported dynamically so its megabyte
   stays out of the first paint. */

import { playSfx } from "../audio";
import { pixelSpriteUrl, pixelSpriteRawUrl } from "../api";

const W = 720;
const H = 420;

/* Sprites are drawn at a whole 2× so the source pixels stay square; the
   ball is drawn at 3px a cell to sit at the same visual weight. */
const SPRITE_SCALE = 2;
const BALL_R = 28;
const BALL_HOME = { x: W / 2, y: H - 52 };
const GROUND = H - 64;

/* Left, back, right — the three places a specimen can stand. */
const SPOTS = [
  { x: 166, y: 262 },
  { x: 360, y: 168 },
  { x: 554, y: 246 },
];

const ROUNDS = 6;
const BALLS = 3;
const MAX_SPEED = 1250;
/* Matter integrates in 60Hz steps: px/step in, px/s out. */
const MAX_STEP_SPEED = MAX_SPEED / 60;
const GRAVITY_STEP = 0.277;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const spriteKey = (id) => `mon-${id}`;

/* A 20×20 Poké Ball drawn a pixel at a time and doubled: the same blocky
   grammar as the sprites, not a smooth vector circle. */
function ballCells() {
  const cells = [];
  const cx = 9.5;
  const cy = 9.5;
  for (let y = 0; y < 20; y += 1) {
    for (let x = 0; x < 20; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.hypot(dx, dy);
      if (r > 9.4) continue;
      let color;
      if (r > 8.1) color = "#0e1417";
      else if (Math.abs(dy) <= 1.15) color = "#0e1417";
      else if (r <= 3.6) color = r <= 2.5 ? "#f2f5f4" : "#0e1417";
      else color = dy < 0 ? "#d8452f" : "#eef0ef";
      /* two specular pixels, the way the original ball has them */
      if ((x === 5 && y === 4) || (x === 6 && y === 3)) color = "#f2896f";
      if ((x === 6 && y === 4) || (x === 7 && y === 3)) color = "#e85a42";
      cells.push([x, y, color]);
    }
  }
  return cells;
}

export class CatchArena {
  constructor(container, { roster = [], onState, onEvent } = {}) {
    this.container = container;
    this.roster = roster;
    this.onState = onState || (() => {});
    this.onEvent = onEvent || (() => {});

    this.round = 1;
    this.balls = BALLS;
    this.team = [];
    this.phase = "loading";
    this.roundMons = [];
    this.mons = [];
    this.message = "";
    this.destroyed = false;
    this.awake = true;
    this.scene = null;
    this.game = null;
    this.aim = null;
    this.spin = 0;
    this.throwStart = 0;
  }

  emit(patch = {}) {
    Object.assign(this, patch);
    /* A parked arena stays parked between throws, but never mid-capture. */
    if (!this.awake) this.setAwake(false);
    this.onState({
      round: this.round,
      rounds: ROUNDS,
      balls: this.balls,
      team: this.team.slice(),
      phase: this.phase,
      message: this.message,
      mons: this.roundMons.map((mon) => ({ id: mon.id, name: mon.name })),
    });
  }

  alive() {
    return !this.destroyed && !!this.scene;
  }

  /* Off-screen the arena has nothing to show, so its render loop parks. */
  setAwake(awake) {
    this.awake = awake;
    const loop = this.game?.loop;
    if (!loop || this.destroyed) return;
    const idle = ["ready", "roundOver", "complete"].includes(this.phase);
    if (!awake && idle) loop.sleep();
    else if (awake && !loop.running) loop.wake(true);
  }

  /* ---------- boot ---------- */

  async mount() {
    if (this.destroyed) return;
    let Phaser;
    try {
      Phaser = (await import("phaser")).default;
    } catch {
      this.emit({ phase: "error", message: "The arena could not load." });
      return;
    }
    if (this.destroyed) return;

    const arena = this;
    class ArenaScene extends Phaser.Scene {
      create() {
        arena._createScene(this);
      }

      update(_time, delta) {
        if (!arena.destroyed) arena._update(delta);
      }
    }

    this.Phaser = Phaser;
    this.startRound({ silent: true });

    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: this.container,
      width: W,
      height: H,
      transparent: true,
      antialias: false,
      pixelArt: true,
      roundPixels: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: W,
        height: H,
      },
      physics: {
        default: "matter",
        matter: { gravity: { y: 1 }, debug: false },
      },
      scene: ArenaScene,
    });
  }

  /* ---------- round flow ---------- */

  startRound({ silent = false } = {}) {
    this.roundMons = this.pickRound();
    this.balls = BALLS;
    this.phase = "ready";
    this.message = "";
    if (!silent) this.emit();
    this.loadRound(this.roundMons);
  }

  nextRound() {
    if (this.round >= ROUNDS) return;
    this.round += 1;
    this.startRound();
  }

  resetGame() {
    this.round = 1;
    this.team = [];
    this.startRound();
  }

  pickRound() {
    const pool = this.roster.length ? this.roster : [];
    const caught = new Set(this.team.map((mon) => mon.id));
    const fresh = pool.filter((mon) => !caught.has(mon.id));
    const bag = (fresh.length >= 3 ? fresh : pool).slice();
    const picked = [];
    while (picked.length < 3 && bag.length) {
      picked.push(bag.splice(Math.floor(Math.random() * bag.length), 1)[0]);
    }
    return picked;
  }

  finishRound() {
    const complete = this.round >= ROUNDS;
    this.phase = complete ? "complete" : "roundOver";
    this.message = complete
      ? `Run complete — ${this.team.length} of 6 slots filled.`
      : "Round closed. Next three are waiting.";
    this.emit();
  }

  /* ---------- scene ---------- */

  _createScene(scene) {
    this.scene = scene;
    scene.cameras.main.setBackgroundColor("#131b1f");

    this.makeTextures(scene);
    this.drawStage(scene);
    this.createBall(scene);
    this.bindInput(scene);
    scene.matter.world.on("collisionstart", (event) => this.onCollision(event));

    if (this.roundMons.length) this.loadRound(this.roundMons);
    this.emit();
  }

  makeTextures(scene) {
    if (!scene.textures.exists("ball")) {
      const g = scene.make.graphics({ add: false });
      ballCells().forEach(([x, y, color]) => {
        g.fillStyle(parseInt(color.slice(1), 16), 1);
        g.fillRect(x * 3, y * 3, 3, 3);
      });
      g.generateTexture("ball", 60, 60);
      g.destroy();
    }
    if (!scene.textures.exists("spark")) {
      const g = scene.make.graphics({ add: false });
      g.fillStyle(0xf7d774, 1);
      g.fillRect(0, 0, 3, 3);
      g.generateTexture("spark", 3, 3);
      g.destroy();
    }
  }

  drawStage(scene) {
    const rings = scene.add.graphics().setDepth(-5);
    rings.lineStyle(1, 0x35474f, 0.55);
    rings.strokeEllipse(W / 2, 288, 540, 196);
    rings.lineStyle(1, 0x2d3d45, 0.45);
    rings.strokeEllipse(W / 2, 294, 336, 122);
    rings.lineStyle(1, 0x27343b, 0.4);
    rings.strokeEllipse(W / 2, 300, 158, 58);

    scene.add.rectangle(W / 2, H - 9, W, 2, 0x2c3b43, 0.7).setDepth(-4);

    /* Rebuilt on every pointer move while the ball is held. */
    this.guide = scene.add.graphics().setDepth(3);
  }

  createBall(scene) {
    this.ball = scene.matter.add.image(BALL_HOME.x, BALL_HOME.y, "ball", null, {
      shape: { type: "circle", radius: BALL_R },
      restitution: 0.56,
      friction: 0.05,
      frictionAir: 0.007,
      density: 0.0016,
      label: "ball",
    });
    this.ball.setDepth(6);
    this.parkBall();
  }

  parkBall() {
    const scene = this.scene;
    if (!scene || !this.ball) return;
    const body = this.ball.body;
    scene.matter.body.setStatic(body, true);
    scene.matter.body.setPosition(body, { x: BALL_HOME.x, y: BALL_HOME.y });
    scene.matter.body.setAngle(body, 0);
    this.ball.setPosition(BALL_HOME.x, BALL_HOME.y);
    this.ball.setAngle(0).setAlpha(1).setScale(1).setVisible(true);
  }

  loadRound(mons) {
    const scene = this.scene;
    if (!scene || !scene.matter) return;

    this.mons.forEach((entry) => {
      entry.sprite?.destroy();
      entry.shadow?.destroy();
      if (entry.marker?.body) scene.matter.world.remove(entry.marker);
    });
    this.mons = [];

    mons.forEach((mon, index) => {
      const spot = SPOTS[index] || SPOTS[0];

      const shadow = scene.add
        .ellipse(spot.x + 2, spot.y + 52, 86, 18, 0x070d10, 0.55)
        .setDepth(spot.y - 1);

      const sprite = scene.add
        .image(spot.x, spot.y, "__DEFAULT")
        .setDepth(spot.y)
        .setVisible(false);

      const marker = scene.matter.add.circle(spot.x, spot.y, 38, {
        isStatic: true,
        restitution: 0.3,
        label: `mon-${mon.id}`,
      });

      const entry = { ...mon, sprite, shadow, marker, spot };
      this.mons.push(entry);

      this.loadSprite(mon.id).then((key) => {
        if (!key || !this.alive() || !sprite.active) return;
        sprite.setTexture(key).setScale(SPRITE_SCALE).setVisible(true);
        scene.tweens.add({
          targets: sprite,
          y: spot.y - 6,
          duration: 1500 + index * 190,
          yoyo: true,
          repeat: -1,
          ease: "Sine.inOut",
        });
        entry.shadowTween = scene.tweens.add({
          targets: shadow,
          alpha: 0.3,
          scaleX: 0.86,
          duration: 1500 + index * 190,
          yoyo: true,
          repeat: -1,
          ease: "Sine.inOut",
        });
      });
    });

    this.parkBall();
  }

  async loadSprite(id) {
    const scene = this.scene;
    const key = spriteKey(id);
    if (!scene || scene.textures.exists(key)) return key;
    for (const url of [pixelSpriteUrl(id), pixelSpriteRawUrl(id)]) {
      try {
        const image = await new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = url;
        });
        if (this.destroyed) return null;
        scene.textures.addImage(key, image);
        return key;
      } catch {
        /* fall through to the next source */
      }
    }
    return null;
  }

  /* ---------- gesture: swipe forward to throw ---------- */

  /* Phaser's own input reads mouse events; driving the gesture from pointer
     events on the canvas instead gives touch and pen the same path as a
     mouse, keeps pointer capture working when a swipe leaves the canvas, and
     costs one rect read per event. */
  bindInput(scene) {
    if (import.meta.env?.DEV) window.__catchArena = this;
    const canvas = scene.game.canvas;
    this.canvas = canvas;

    this.toWorld = (event) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * W,
        y: ((event.clientY - rect.top) / rect.height) * H,
      };
    };

    this.handleDown = (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (event.isPrimary === false) return;
      /* Capture keeps the swipe alive if it wanders off the canvas. */
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        /* Safari can refuse capture on a synthetic pointer */
      }
      this.onDown(this.toWorld(event), event.pointerType === "touch");
    };
    this.handleMove = (event) => {
      if (!this.aim || event.isPrimary === false) return;
      this.onMove(this.toWorld(event), event);
    };
    this.handleUp = (event) => {
      if (!this.aim) return;
      this.onUp();
    };

    canvas.addEventListener("pointerdown", this.handleDown);
    window.addEventListener("pointermove", this.handleMove, { passive: true });
    window.addEventListener("pointerup", this.handleUp);
    window.addEventListener("pointercancel", this.handleUp);
  }

  onDown(point, touched) {
    if (this.phase !== "ready" || this.aim) return;
    const nearBall = Math.hypot(point.x - BALL_HOME.x, point.y - BALL_HOME.y) < 170;
    if (!nearBall && point.y < H - 150) return;

    this.aim = { samples: [{ x: point.x, y: point.y, t: performance.now() }], touched };
    this.scene.matter.body.setStatic(this.ball.body, true);
    this.placeBall(point.x, point.y);
    playSfx("grab");
    this.emit({ phase: "aim", message: "" });
  }

  onMove(point, event) {
    if (!this.aim || !this.alive()) return;
    /* A finger hides what it is aiming at, so the ball rides above it. */
    const lift = this.aim.touched ? 46 : 0;
    const x = clamp(point.x, 26, W - 26);
    const y = clamp(point.y + lift, 44, H - 26);
    const now = performance.now();
    if (event?.pointerId !== undefined) this.lastPointerId = event.pointerId;
    this.placeBall(x, y);
    this.aim.samples.push({ x, y, t: now });
    this.aim.samples = this.aim.samples.filter((sample) => now - sample.t < 320);
    this.drawGuide();
  }

  placeBall(x, y) {
    const scene = this.scene;
    if (!scene) return;
    scene.matter.body.setPosition(this.ball.body, { x, y });
    this.ball.x = x;
    this.ball.y = y;
  }

  onUp() {
    if (!this.aim || !this.alive()) return;
    const samples = this.aim.samples;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const travel = Math.hypot(last.x - first.x, last.y - first.y);
    this.aim = null;
    this.guide?.clear();

    /* A press that never moved is not a throw: put the ball back rather than
       lobbing it for the player and spending one of their three. */
    if (travel < 12) {
      this.parkBall();
      playSfx("close");
      this.emit({ phase: "ready", message: "" });
      return;
    }

    this.launch(this.measureThrow());
  }

  /* Velocity from the last ~140ms of travel, curvature from the signed turn
     between consecutive samples inside that window. */
  measureThrow() {
    const samples = this.aim?.samples || [];
    const now = performance.now();
    const recent = samples.filter((sample) => now - sample.t < 140);
    const tail = recent.length >= 3 ? recent : samples.slice(-3);

    let vx = 0;
    let vy = 0;
    let speed = 0;
    if (tail.length >= 2) {
      const first = tail[0];
      const last = tail[tail.length - 1];
      const dt = Math.max(16, last.t - first.t);
      vx = ((last.x - first.x) / dt) * 1000;
      vy = ((last.y - first.y) / dt) * 1000;
      speed = Math.hypot(vx, vy);
    }

    /* A press with no travel still has to go somewhere: lob it away from the
       release point rather than dropping it on the player's feet. */
    if (speed < 320) {
      const from = samples[0] || BALL_HOME;
      const to = samples[samples.length - 1] || from;
      let dx = to.x - from.x;
      let dy = to.y - from.y;
      if (Math.hypot(dx, dy) < 14) {
        dx = 0;
        dy = -1;
      }
      const len = Math.hypot(dx, dy) || 1;
      vx = (dx / len) * 620;
      vy = (dy / len) * 620;
      speed = 620;
    }

    if (speed > MAX_SPEED) {
      vx = (vx / speed) * MAX_SPEED;
      vy = (vy / speed) * MAX_SPEED;
    }

    let turn = 0;
    let count = 0;
    for (let i = 2; i < tail.length; i += 1) {
      const a = tail[i - 2];
      const b = tail[i - 1];
      const c = tail[i];
      const ax = b.x - a.x;
      const ay = b.y - a.y;
      const bx = c.x - b.x;
      const by = c.y - b.y;
      const la = Math.hypot(ax, ay);
      const lb = Math.hypot(bx, by);
      if (la < 2 || lb < 2) continue;
      turn += Math.asin(clamp((ax * by - ay * bx) / (la * lb), -1, 1));
      count += 1;
    }
    const curl = count ? turn / count : 0;

    return { vx, vy, spin: clamp(curl * 2.2, -0.4, 0.4) };
  }

  /* Dashed arc from the ball's nose, using the same numbers the launch will
     use — the guide is a prediction, not decoration. */
  drawGuide() {
    const guide = this.guide;
    if (!guide || !this.aim) return;
    guide.clear();
    const { vx, vy } = this.measureThrow();
    if (Math.hypot(vx, vy) < 140) return;

    let x = this.ball.x;
    let y = this.ball.y;
    let stepX = vx / 60;
    let stepY = vy / 60;

    for (let step = 0; step < 60; step += 1) {
      stepY += GRAVITY_STEP;
      x += stepX;
      y += stepY;
      if (y > GROUND + 6 || x < 8 || x > W - 8) break;
      if (step % 2 === 0) {
        guide.fillStyle(0xf5f8f9, Math.max(0.14, 0.62 - step * 0.008));
        guide.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
      }
    }
  }

  launch({ vx, vy, spin }) {
    const scene = this.scene;
    this.balls = Math.max(0, this.balls - 1);
    this.throwStart = performance.now();
    this.emit({ phase: "flying", balls: this.balls, message: "" });

    scene.matter.body.setStatic(this.ball.body, false);
    scene.matter.body.setVelocity(this.ball.body, {
      x: vx / 60,
      y: vy / 60,
    });
    scene.matter.body.setAngularVelocity(this.ball.body, spin);
    this.spin = spin;
    playSfx("throw");
  }

  /* ---------- per-frame ---------- */

  _update() {
    const ball = this.ball;
    if (!ball?.body) return;
    const body = ball.body;

    /* Magnus: spin left by a curved swipe curls the flight. Small enough to
       stay aimable, big enough to feel earned. */
    if (this.phase === "flying" && Math.abs(this.spin) > 0.03) {
      const speed = Math.hypot(body.velocity.x, body.velocity.y);
      if (speed > 1) {
        const curl = this.spin * 0.022;
        body.velocity.x += (-body.velocity.y / speed) * curl;
        body.velocity.y += (body.velocity.x / speed) * curl;
      }
    }

    ball.x = body.position.x;
    ball.y = body.position.y;
    ball.rotation = body.angle;

    if (this.phase === "flying") {
      const speed = Math.hypot(body.velocity.x, body.velocity.y);
      const elapsed = performance.now() - this.throwStart;
      if ((speed < 0.4 && elapsed > 380) || elapsed > 5200) this.settle();
    }
  }

  onCollision(event) {
    if (this.phase !== "flying") return;
    for (const pair of event.pairs) {
      const label = [pair.bodyA.label, pair.bodyB.label].find((value) =>
        value?.startsWith("mon-"),
      );
      if (!label) continue;
      const target = this.mons.find((mon) => mon.id === Number(label.slice(4)));
      if (target) this.catchSequence(target);
      return;
    }
  }

  /* The throw stopped short: whatever sits nearest still counts if close. */
  settle() {
    if (this.phase !== "flying") return;
    const body = this.ball.body;
    let nearest = null;
    let best = Infinity;
    this.mons.forEach((mon) => {
      const distance = Math.hypot(
        mon.marker.position.x - body.position.x,
        mon.marker.position.y - body.position.y,
      );
      if (distance < best) {
        best = distance;
        nearest = mon;
      }
    });
    if (nearest && best < 104) this.catchSequence(nearest);
    else this.missed();
  }

  /* ---------- capture sequence ---------- */

  async catchSequence(target) {
    const scene = this.scene;
    if (!scene || this.phase === "catching" || this.phase === "caught") return;
    this.emit({ phase: "catching", message: `Ball on ${target.name}…` });

    const body = this.ball.body;
    const at = { x: target.marker.position.x, y: target.marker.position.y };
    scene.matter.body.setStatic(body, true);
    scene.matter.body.setPosition(body, at);
    this.ball.setPosition(at.x, at.y);

    playSfx("impact");
    const flash = scene.add.circle(at.x, at.y, 34, 0xffffff, 0.85).setDepth(7);
    scene.tweens.add({
      targets: flash,
      scale: 3.4,
      alpha: 0,
      duration: 320,
      onComplete: () => flash.destroy(),
    });
    scene.cameras.main.shake(120, 0.004);

    await wait(130);
    if (!this.alive()) return;
    playSfx("absorb");
    /* The idle loops own these properties, so they have to stop first or the
       bob keeps dragging the sprite (and its shadow) back into view. */
    target.bob?.stop();
    target.shadowTween?.stop();
    scene.tweens.add({
      targets: target.sprite,
      alpha: 0,
      scale: 0.08,
      angle: 420,
      duration: 420,
      ease: "back.in",
    });
    scene.tweens.add({ targets: target.shadow, alpha: 0, scaleX: 0.2, duration: 280 });

    await wait(430);
    if (!this.alive()) return;
    playSfx("close");
    const landing = clamp(at.x, 52, W - 52);
    scene.tweens.add({
      targets: this.ball,
      x: landing,
      y: GROUND,
      duration: 420,
      ease: "bounce.out",
      onUpdate: () => {
        scene.matter.body.setPosition(body, { x: this.ball.x, y: this.ball.y });
      },
    });
    await wait(500);
    if (!this.alive()) return;

    for (let shake = 0; shake < 3; shake += 1) {
      playSfx(["shake", "shake2", "shake3"][shake]);
      await this.tweenBallAngle(scene, -16, 16, 110, true, 1);
      await wait(170);
      if (!this.alive()) return;
    }

    this.emit({ phase: "caught", message: `Gotcha! ${target.name} joined the team.` });
    this.team = [...this.team, { id: target.id, name: target.name }];
    playSfx("caught");

    const burst = scene.add.particles(0, 0, "spark", {
      x: this.ball.x,
      y: this.ball.y,
      speed: { min: 70, max: 220 },
      angle: { min: 0, max: 360 },
      lifespan: 640,
      gravityY: 240,
      scale: { start: 2, end: 0 },
      emitting: false,
    });
    burst.setDepth(8);
    burst.explode(28);
    scene.time.delayedCall(900, () => burst.destroy());

    scene.tweens.add({
      targets: this.ball,
      scale: { from: 1, to: 1.2 },
      duration: 170,
      yoyo: true,
      repeat: 1,
      ease: "Sine.inOut",
    });

    await wait(950);
    if (!this.alive()) return;
    this.ball.setVisible(false);
    this.emit({ team: this.team.slice() });
    this.finishRound();
  }

  /* The body owns rotation, so the shake has to be applied to both the body
     and the sprite; tweening the sprite alone gets overwritten next step. */
  tweenBallAngle(scene, from, to, duration, yoyo, repeat) {
    const body = this.ball.body;
    const state = { angle: from };
    return new Promise((resolve) => {
      scene.tweens.add({
        targets: state,
        angle: to,
        duration,
        yoyo,
        repeat,
        ease: "Sine.inOut",
        onUpdate: () => {
          scene.matter.body.setAngle(body, state.angle);
          this.ball.setAngle(state.angle);
        },
        onComplete: () => {
          scene.matter.body.setAngle(body, 0);
          this.ball.setAngle(0);
          resolve();
        },
      });
    });
  }

  async missed() {
    if (!this.alive() || this.phase !== "flying") return;
    this.emit({
      phase: "missed",
      message: this.balls > 0 ? "Missed. Throw again." : "Missed — out of balls.",
    });
    playSfx("miss");

    const scene = this.scene;
    scene.tweens.add({
      targets: this.ball,
      alpha: 0.25,
      duration: 240,
      yoyo: true,
      repeat: 1,
    });
    await wait(720);
    if (!this.alive()) return;

    if (this.balls > 0) {
      this.parkBall();
      scene.tweens.add({
        targets: this.ball,
        scale: { from: 0.4, to: 1 },
        duration: 240,
        ease: "back.out",
      });
      this.emit({
        phase: "ready",
        message:
          this.balls === 1 ? "Missed — 1 ball left." : `Missed — ${this.balls} balls left.`,
      });
    } else {
      this.ball.setVisible(false);
      this.finishRound();
    }
  }

  destroy() {
    this.destroyed = true;
    this.aim = null;
    if (this.canvas) {
      this.canvas.removeEventListener("pointerdown", this.handleDown);
      window.removeEventListener("pointermove", this.handleMove);
      window.removeEventListener("pointerup", this.handleUp);
      window.removeEventListener("pointercancel", this.handleUp);
    }
    try {
      this.game?.destroy(true);
    } catch {
      /* the canvas is already gone */
    }
    this.game = null;
    this.scene = null;
    this.mons = [];
  }
}

export { ROUNDS };
