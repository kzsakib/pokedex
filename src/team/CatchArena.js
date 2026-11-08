/* The catching arena: one Phaser 3 scene, powered by Matter.js.

   Deliberately framework-free. React mounts it, hands over the roster and
   listens for state snapshots; nothing that moves, bounces or shakes ever
   touches the page tree. Phaser is imported dynamically so its megabyte
   stays out of the first paint. */

import { playSfx } from "../audio";
import { pixelSpriteUrl, pixelSpriteRawUrl } from "../api";

const W = 720;
const H = 420;

/* Sprites sit on a whole 1.5× so three of them fit the arena without
   crowding; the ball is a 30-cell pixel ball scaled to match. */
const SPRITE_SCALE = 1.5;
const BALL_CELLS = 30;
const BALL_R = 22;
const FLOOR = H - 40;
const BALL_HOME = { x: W / 2, y: FLOOR - BALL_R - 1 };
const MON_R = 40;
const CATCH_R = BALL_R + MON_R;

/* Left, back, right — the three places a specimen can stand. */
const SPOTS = [
  { x: 176, y: 248 },
  { x: 360, y: 174 },
  { x: 544, y: 242 },
];

const ROUNDS = 6;
const BALLS = 3;
const MAX_SPEED = 1320;
/* Gravity per step², and how hard a spinning ball curves its own path
   (Magnus): lateral acceleration is spin × speed × this. */
const GRAVITY_Y = 1.3;
const MAGNUS = 0.00022;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const spriteKey = (id) => `mon-${id}`;

/* A 30-cell Poké Ball, one pixel a cell: black shell, red crown, white base,
   the equator band and a button ringed in black. Drawn from the geometry
   rather than by hand so the circle stays even at this size. */
function ballCells() {
  const cells = [];
  const c = (BALL_CELLS - 1) / 2;
  const R = 14.4;

  for (let y = 0; y < BALL_CELLS; y += 1) {
    for (let x = 0; x < BALL_CELLS; x += 1) {
      const dx = x - c;
      const dy = y - c;
      const r = Math.hypot(dx, dy);
      if (r > R + 0.4) continue;

      /* The real ball's button is about a quarter of its width and the band
         a couple of pixels at this size — get those two ratios right and the
         whole thing reads as a Poké Ball. */
      let color;
      if (r > R - 1.7) {
        color = "#0b1114"; /* shell */
      } else if (r <= 3.9) {
        color = r <= 2.5 ? "#f1f4f3" : "#0b1114"; /* button: face, ring */
      } else if (Math.abs(dy) <= 1.05) {
        color = "#0b1114"; /* equator band */
      } else if (dy < 0) {
        color = dx > 3.5 ? "#b5301f" : "#d8412c"; /* crown, shaded right */
      } else {
        color = dx > 5 ? "#d2d8d7" : "#eef1f0"; /* base, shaded right */
      }

      /* two highlight pixels on the shoulder, the way the sprite art does it */
      if ((dx === -5 && dy === -7) || (dx === -4 && dy === -8)) color = "#ee7257";
      if (dx === -5 && dy === -8) color = "#f4917a";

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
    this.spinRate = 0;
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

  alive(roundId) {
    if (this.destroyed || !this.scene) return false;
    return roundId === undefined || roundId === this.roundId;
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
        matter: { gravity: { y: GRAVITY_Y }, debug: false },
      },
      scene: ArenaScene,
    });
  }

  /* ---------- round flow ---------- */

  startRound({ silent = false } = {}) {
    /* Bumped on every round so a capture animation left over from the last
       round cannot finish inside this one. */
    this.roundId = (this.roundId || 0) + 1;
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
    this.createBounds(scene);
    this.createBall(scene);
    this.bindInput(scene);
    this.clock = 0;
    scene.matter.world.on("collisionstart", (event) => this.onCollision(event));
    scene.matter.world.on("beforeupdate", () => this.beforeStep());

    if (this.roundMons.length) this.loadRound(this.roundMons);
    this.emit();
  }

  makeTextures(scene) {
    if (!scene.textures.exists("ball")) {
      const g = scene.make.graphics({ add: false });
      ballCells().forEach(([x, y, color]) => {
        g.fillStyle(parseInt(color.slice(1), 16), 1);
        g.fillRect(x, y, 1, 1);
      });
      g.generateTexture("ball", BALL_CELLS, BALL_CELLS);
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

    /* the floor line the ball actually rests on */
    scene.add.rectangle(W / 2, FLOOR, W, 2, 0x2c3b43, 0.8).setDepth(-4);
  }

  /* Floor and three walls, so a hard throw rattles around the arena instead
     of leaving it. The mon volumes are sensors: the ball never bounces off a
     specimen, contact is a catch. */
  createBounds(scene) {
    const wall = (x, y, w, h, restitution = 0.52) =>
      scene.matter.add.rectangle(x, y, w, h, {
        isStatic: true,
        restitution,
        friction: 0.4,
        label: "wall",
      });

    this.walls = [
      wall(W / 2, FLOOR + 40, W * 3, 80, 0.34), /* floor, deadens the bounce */
      wall(-30, H / 2 - 60, 60, H * 3, 0.52), /* left */
      wall(W + 30, H / 2 - 60, 60, H * 3, 0.52), /* right */
      wall(W / 2, -30, W * 3, 60, 0.52), /* top */
    ];
  }

  createBall(scene) {
    this.ballScale = (BALL_R * 2) / BALL_CELLS;
    this.ball = scene.matter.add.image(BALL_HOME.x, BALL_HOME.y, "ball", null, {
      shape: { type: "circle", radius: BALL_R },
      restitution: 0.44,
      friction: 0.16,
      frictionAir: 0.009,
      frictionStatic: 0.3,
      density: 0.0019,
      label: "ball",
    });
    /* In front of the specimens: a ball in flight should never hide behind
       the thing it is aimed at. */
    this.ball.setDepth(900).setScale(this.ballScale);
    this.parkBall();
  }

  parkBall() {
    const scene = this.scene;
    if (!scene || !this.ball) return;
    const body = this.ball.body;
    scene.matter.body.setStatic(body, true);
    scene.matter.body.setPosition(body, { x: BALL_HOME.x, y: BALL_HOME.y });
    scene.matter.body.setAngle(body, 0);
    scene.matter.body.setAngularVelocity(body, 0);
    this.ball.setPosition(BALL_HOME.x, BALL_HOME.y);
    this.ball
      .setAngle(0)
      .setAlpha(1)
      .setScale(this.ballScale || 1)
      .setVisible(true);
    this.spinRate = 0;
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
        .ellipse(spot.x + 2, spot.y + 44, 62, 13, 0x070d10, 0.5)
        .setDepth(spot.y - 1);

      const sprite = scene.add
        .image(spot.x, spot.y, "__DEFAULT")
        .setDepth(spot.y)
        .setVisible(false);

      /* A sensor: the ball passes through and the catch is the contact. */
      const marker = scene.matter.add.circle(spot.x, spot.y, MON_R, {
        isStatic: true,
        isSensor: true,
        label: `mon-${mon.id}`,
      });

      const entry = { ...mon, sprite, shadow, marker, spot, bob: index * 2.1 };
      this.mons.push(entry);

      this.loadSprite(mon.id).then((key) => {
        if (!key || !this.alive() || !sprite.active) return;
        sprite.setTexture(key).setScale(SPRITE_SCALE).setVisible(true);
        entry.loaded = true;
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
    const nearBall = Math.hypot(point.x - BALL_HOME.x, point.y - BALL_HOME.y) < 150;
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
    const lift = this.aim.touched ? 42 : 0;
    const x = clamp(point.x, BALL_R + 3, W - BALL_R - 3);
    const y = clamp(point.y + lift, BALL_R + 4, FLOOR - BALL_R - 2);
    const now = performance.now();
    if (event?.pointerId !== undefined) this.lastPointerId = event.pointerId;
    this.placeBall(x, y);
    this.aim.samples.push({ x, y, t: now });
    this.aim.samples = this.aim.samples.filter((sample) => now - sample.t < 320);
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
    /* Read the gesture before dropping it: the throw is measured from the
       samples this press collected. */
    const throwVec = this.measureThrow();
    this.aim = null;

    /* A press that never moved is not a throw: put the ball back rather than
       lobbing it for the player and spending one of their three. */
    if (travel < 12) {
      this.parkBall();
      playSfx("close");
      this.emit({ phase: "ready", message: "" });
      return;
    }

    this.launch(throwVec);
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
    /* Samples land ~16ms apart, so the mean turn per sample becomes a turn
       per second: a flick that curls a quarter turn in a fifth of a second
       is a hard spin, a nearly straight pull is almost none. */
    const curl = count ? turn / count : 0;
    const turnRate = (curl / 16) * 1000;

    return {
      vx,
      vy,
      spin: clamp(turnRate, -16, 16), /* radians per second */
    };
  }

  launch({ vx, vy, spin }) {
    const scene = this.scene;
    const body = this.ball.body;
    this.balls = Math.max(0, this.balls - 1);
    this.throwStart = performance.now();
    this.emit({ phase: "flying", balls: this.balls, message: "" });

    scene.matter.body.setStatic(body, false);
    scene.matter.body.setVelocity(body, { x: vx / 60, y: vy / 60 });
    /* Matter turns in radians per step; the throw spins in per second. */
    scene.matter.body.setAngularVelocity(body, spin / 60);
    this.spinRate = spin;
    playSfx("throw");
  }

  /* ---------- per-frame ---------- */

  _update(delta) {
    const ball = this.ball;
    if (!ball?.body) return;
    const body = ball.body;

    this.clock = (this.clock || 0) + (delta || 16);
    this.hover();

    ball.x = body.position.x;
    ball.y = body.position.y;
    ball.rotation = body.angle;

    if (this.phase !== "flying") return;

    /* A ball still at the release point is not a catch: give it a beat to
       clear the hand first. */
    if (performance.now() - this.throwStart < 90) return;

    /* Contact is the catch. The volumes are sensors and the check runs every
       frame, so a fast ball cannot slip through one. */
    for (const mon of this.mons) {
      if (!mon.marker) continue;
      const distance = Math.hypot(
        mon.marker.position.x - body.position.x,
        mon.marker.position.y - body.position.y,
      );
      if (distance < CATCH_R) {
        this.catchSequence(mon);
        return;
      }
    }

    const speed = Math.hypot(body.velocity.x, body.velocity.y);
    const elapsed = performance.now() - this.throwStart;
    if ((speed < 0.6 && elapsed > 450) || elapsed > 6000) this.settle();
  }

  /* Idle float, a frame at a time: no tween sitting on a long duration, and
     the shadow breathes with the sprite. */
  hover() {
    const t = (this.clock || 0) / 1000;
    this.mons.forEach((mon) => {
      if (!mon.loaded || !mon.sprite?.active) return;
      const wave = Math.sin(t * 1.75 + mon.bob);
      mon.sprite.y = mon.spot.y - 4 + wave * 4.5;
      mon.shadow.setScale(1 - wave * 0.07, 1);
    });
  }

  /* Runs inside the physics step before Matter integrates: the spin bends the
     flight sideways and bleeds off, so a curled throw arcs and then straightens
     like a real spinning ball. */
  beforeStep() {
    const body = this.ball?.body;
    if (!body || this.phase !== "flying") return;
    if (Math.abs(this.spinRate) < 0.2) return;

    const { x: vx, y: vy } = body.velocity;
    const speed = Math.hypot(vx, vy);
    if (speed < 1.5) return;

    const push = this.spinRate * speed * MAGNUS;
    this.scene.matter.body.setVelocity(body, {
      x: vx + (-vy / speed) * push,
      y: vy + (vx / speed) * push,
    });
    this.spinRate *= 0.994;
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

  /* The throw came to rest without touching anything: that is a miss. */
  settle() {
    if (this.phase !== "flying") return;
    this.missed();
  }

  /* ---------- capture sequence ---------- */

  async catchSequence(target) {
    const scene = this.scene;
    if (!scene || this.phase === "catching" || this.phase === "caught") return;
    const roundId = this.roundId;
    this.emit({ phase: "catching", message: `Ball on ${target.name}…` });

    const body = this.ball.body;
    /* The ball stops where it touched, not at the specimen's centre: a catch
       should not look like a teleport. */
    const at = { x: this.ball.x, y: this.ball.y };
    scene.matter.body.setStatic(body, true);
    scene.matter.body.setVelocity(body, { x: 0, y: 0 });
    scene.matter.body.setAngularVelocity(body, 0);

    playSfx("impact");
    const flash = scene.add.circle(at.x, at.y, 26, 0xffffff, 0.85).setDepth(950);
    scene.tweens.add({
      targets: flash,
      scale: 3.4,
      alpha: 0,
      duration: 320,
      onComplete: () => flash.destroy(),
    });
    scene.cameras.main.shake(120, 0.004);

    await wait(130);
    if (!this.alive(roundId)) return;
    playSfx("absorb");
    target.loaded = false; /* stops the idle float fighting the tween */
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
    if (!this.alive(roundId)) return;
    playSfx("close");
    const landing = clamp(at.x, BALL_R + 14, W - BALL_R - 14);
    scene.tweens.add({
      targets: this.ball,
      x: landing,
      y: FLOOR - BALL_R,
      duration: 420,
      ease: "bounce.out",
      onUpdate: () => {
        scene.matter.body.setPosition(body, { x: this.ball.x, y: this.ball.y });
      },
    });
    await wait(500);
    if (!this.alive(roundId)) return;

    for (let shake = 0; shake < 3; shake += 1) {
      playSfx(["shake", "shake2", "shake3"][shake]);
      await this.tweenBallAngle(scene, -16, 16, 110, true, 1);
      await wait(170);
      if (!this.alive(roundId)) return;
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
    burst.setDepth(950);
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
    if (!this.alive(roundId)) return;
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
