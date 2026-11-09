/* The catching arena: one Phaser 3 scene, three wandering specimens and a
   Poké Ball thrown across a shallow pocket of depth.

   Deliberately framework-free. React mounts it, hands over the roster and
   listens for state snapshots; nothing that moves, bounces or shakes ever
   touches the page tree. Phaser is imported dynamically so its megabyte
   stays out of the first paint. */

import { playSfx } from "../audio";
import { fetchSpecies, pixelSpriteUrl, pixelSpriteRawUrl } from "../api";
import { fetchPmd, facingRow, installPmdTextures } from "./sprites";

const W = 720;
const H = 420;

/* The field is a ground plane seen from a low seat: z = 0 is the front edge
   under the player, z = 1 the far edge. Anything standing further back is
   drawn smaller and higher up, and the same goes for a ball in flight. */
const NEAR_Y = H - 26;
const FAR_Y = 128;
const Z_SPAN = NEAR_Y - FAR_Y;
const SHRINK = 0.46;
/* How hard the field narrows toward the back: the sides pull in toward the
   centre line, so travel into the scene runs diagonally. */
const CONVERGE = 0.24;
const Z_NEAR = 0.05;
const Z_FAR = 1;

const MON_SCALE = 2.55;
/* 32 cells across, drawn at 36px: the ball is nearly one pixel per pixel,
   so the outline and the button stay sharp. */
const BALL_CELLS = 32;
const BALL_R = 18;
const CATCH_R = 44;
const BALL_HOME = { x: W / 2, z: Z_NEAR };

/* Throw feel: the ball lands where the swipe ends, and the arc is a real
   projectile lob over that distance. */
const GRAVITY = 1500;
/* Air time: even a short flick is a visible lob, and a long throw hangs long
   enough to see the ball cross the whole field. */
const FLIGHT_BASE = 0.46;
const FLIGHT_PER_PX = 560;
const SPIN_CURVE = 0.035;

const ROUNDS = 6;
const BALLS_PER_ROUND = 3;

/* A species' capture rate is the 0-255 number the games roll against, and
   this is the figure a throw falls back to before the species has answered:
   roughly the middle of the range. */
const DEFAULT_CAPTURE_RATE = 120;
/* Nothing weakens a creature before a throw here, so a plain field ball
   carries a modest multiplier to keep six rounds winnable. Stubborn species
   stay stubborn at this bonus; it only lifts the middle of the range. */
const FIELD_BONUS = 2.5;
const SHAKE_EXPONENT = 0.1875;
/* How near the landing spot has to fall before the HUD quotes the odds of
   the creature standing there. */
const ODDS_RADIUS = 150;

/* The five balls, each with the modifier the games give it. A round draws one
   rack, so all three throws in a round use the same ball, and the better the
   ball the rarer it is to be handed: a Master Ball is a one-in-fifty round,
   which is why most runs never see one. Premier is a Premier Ball in name and
   finish only — a multiplier of 1, exactly as in the games. */
const BALL_TYPES = [
  {
    id: "poke",
    name: "Poké Ball",
    multiplier: 1,
    chance: 0.6,
    ink: { crown: "#e5342c", crownShade: "#bd231e" },
  },
  {
    id: "great",
    name: "Great Ball",
    multiplier: 1.5,
    chance: 0.24,
    ink: {
      crown: "#2f74d8",
      crownShade: "#1f55a8",
      patch: "#d8452f",
      patchShade: "#a8321f",
    },
  },
  {
    id: "ultra",
    name: "Ultra Ball",
    multiplier: 2,
    chance: 0.1,
    ink: {
      crown: "#1f2126",
      crownShade: "#0c0e11",
      patch: "#f0c419",
      patchShade: "#c39c0c",
    },
  },
  {
    id: "premier",
    name: "Premier Ball",
    multiplier: 1,
    chance: 0.04,
    ink: {
      crown: "#f1f1ee",
      crownShade: "#cdcdc9",
      patch: "#d8452f",
      patchShade: "#a8321f",
    },
  },
  {
    id: "master",
    name: "Master Ball",
    multiplier: 255,
    chance: 0.02,
    ink: {
      crown: "#8b46c4",
      crownShade: "#652f96",
      patch: "#ec7ac0",
      patchShade: "#bd5793",
    },
  },
];

/* Where the three stand when the round opens: spread across the middle and
   the back of the field, never close enough to the hand to be caught by a
   throw that was not even aimed at them. */
const ZONES = [
  { x: 158, z: 0.46 },
  { x: 372, z: 0.76 },
  { x: 566, z: 0.5 },
];

/* Nothing walks nearer than this to the throwing hand. */
const Z_MIN = 0.28;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

/* The games' catch check, reduced to what this arena knows: a capture rate
   and a ball. At full health the HP term collapses to rate / 3, each shake
   passes with b = 65536 / (255 / a)^0.1875, and three passed shakes are a
   catch — so this returns the real product of the three checks rather than
   a single flat dice roll. */
export function catchOdds(captureRate, ballMultiplier = 1) {
  const rate = clamp(Number(captureRate) || DEFAULT_CAPTURE_RATE, 1, 255);
  /* the ball's modifier sits exactly where the games put it, so a Master
     Ball drives a through the roof and its odds land on 100% */
  const a = Math.max(1, (rate * FIELD_BONUS * ballMultiplier) / 3);
  const shake = clamp(65536 / Math.pow(255 / a, SHAKE_EXPONENT) / 65536, 0, 1);
  const chance = shake ** 3;
  return {
    rate,
    shake,
    chance,
    percent: Math.max(1, Math.round(chance * 100)),
  };
}

/* One second of PMD animation is 60 ticks; a creature crossing a room should
   not shuffle through its walk cycle that fast. */
const ANIM_TICK = 1 / 60;
const WALK_RATE = 2.3;
const RUN_RATE = 1.4;
const IDLE_RATE = 2.6;

/* The shell every ball is drawn on: a black outline a cell thick, a black
   equator band carrying a white button, a pale base shaded grey where it
   turns under, and a plus-shaped glint on the upper-left shoulder. The crown
   and its pair of shoulder patches come from each ball's own ink. */
const BALL_INK = {
  outline: "#0f1417",
  base: "#ededed",
  baseShade: "#c2c5c8",
  baseDeep: "#9ea3a7",
  shine: "#ffffff",
};

function ballCells(ink) {
  const n = BALL_CELLS;
  const c = (n - 1) / 2;
  const R = c - 0.4;
  const cells = [];

  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const dx = x - c;
      const dy = y - c;
      const r = Math.hypot(dx, dy);
      if (r > R) continue;

      const button = r <= 4.3;
      const rim = r > R - 1.5;
      const band = Math.abs(dy) <= 1.1;

      let color;
      if (button) color = r <= 3.1 ? BALL_INK.shine : BALL_INK.outline;
      else if (rim || band) color = BALL_INK.outline;
      else if (dy < 0) color = ink.crown;
      else color = BALL_INK.base;

      /* shading: the crown darkens at its outer edge, the base under its own
         bulge, and the underside is the darkest part of the ball */
      if (color === ink.crown) {
        if (r > R - 4 || (dx > 6 && dy > -3)) color = ink.crownShade;
      }
      /* Every ball but the plain one wears a patch of its accent colour on
         each shoulder, mirrored either side of the seam. */
      if (ink.patch && (color === ink.crown || color === ink.crownShade)) {
        const px = Math.abs(dx) - 7.6;
        const py = dy + 5.4;
        const patch = px * px + py * py;
        if (patch < 6.2) color = ink.patch;
        else if (patch < 9.8) color = ink.patchShade;
      }
      if (color === BALL_INK.base) {
        if (r > R - 3) color = BALL_INK.baseDeep;
        else if (dy > 5) color = BALL_INK.baseShade;
      }

      /* the plus-shaped glint on the upper-left shoulder */
      const gx = Math.abs(dx + 5);
      const gy = Math.abs(dy + 5.4);
      if ((gx <= 1.2 && gy <= 3) || (gx <= 3 && gy <= 1.2)) {
        color = BALL_INK.shine;
      }

      cells.push([x, y, color]);
    }
  }
  return cells;
}

/* A rack for the round, weighted by each ball's chance. */
function pickBall() {
  let roll = Math.random();
  for (const type of BALL_TYPES) {
    roll -= type.chance;
    if (roll <= 0) return type;
  }
  return BALL_TYPES[0];
}

const BALL_ICONS = new Map();

/* The cells the arena renders, drawn into a canvas once per ball and handed
   back as a data URL, so the HUD can wear the sprite that is actually in the
   player's hand rather than a separate drawing of it. */
export function ballDataUrl(id, scale = 4) {
  if (BALL_ICONS.has(id)) return BALL_ICONS.get(id);
  const type = BALL_TYPES.find((entry) => entry.id === id) || BALL_TYPES[0];
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = BALL_CELLS * scale;
  canvas.height = BALL_CELLS * scale;
  const ctx = canvas.getContext("2d");
  ballCells(type.ink).forEach(([x, y, color]) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * scale, y * scale, scale, scale);
  });
  const url = canvas.toDataURL("image/png");
  BALL_ICONS.set(id, url);
  return url;
}

export class CatchArena {
  constructor(container, { roster = [], onState, onEvent } = {}) {
    this.container = container;
    this.roster = roster;
    this.onState = onState || (() => {});
    this.onEvent = onEvent || (() => {});

    this.round = 1;
    this.balls = BALLS_PER_ROUND;
    this.ballStock = BALL_TYPES[0];
    this.team = [];
    this.phase = "loading";
    this.roundMons = [];
    this.nextMons = [];
    this.mons = [];
    this.message = "";
    this.destroyed = false;
    this.awake = true;
    this.scene = null;
    this.game = null;
    this.aim = null;
    this.clock = 0;

    /* The ball lives in field space: x across, z into the scene, h above
       the ground. The sprite is only its shadow on the screen. */
    this.ballState = {
      x: BALL_HOME.x,
      z: BALL_HOME.z,
      h: BALL_R,
      vx: 0,
      vz: 0,
      vh: 0,
      angle: 0,
      spin: 0,
      live: false,
      frozen: false,
      still: 0,
    };
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
      /* quoted only while aiming, and only when the landing spot is actually
         near a creature */
      odds:
        this.phase === "aim" && this.markerTarget
          ? this.markerTarget.odds.percent
          : null,
      ball: {
        id: this.ballStock.id,
        name: this.ballStock.name,
        multiplier: this.ballStock.multiplier,
        icon: ballDataUrl(this.ballStock.id),
      },
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

  /* ---------- field geometry ---------- */

  /* Screen position and scale of a point on (or above) the field. */
  project(x, z, h = 0) {
    const s = 1 - SHRINK * z;
    /* perspective pull: the same x lands nearer the centre line the deeper
       it is, so a throw into the field tracks diagonally, not straight up */
    const nx = W / 2 + (x - W / 2) * (1 - CONVERGE * z);
    return { x: nx, y: NEAR_Y - Z_SPAN * z - h * s, s };
  }

  groundAt(z) {
    return NEAR_Y - Z_SPAN * z;
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
      scene: ArenaScene,
    });
  }

  /* ---------- round flow ---------- */

  startRound({ silent = false } = {}) {
    /* Bumped on every round so a capture animation left over from the last
       round cannot finish inside this one. */
    this.roundId = (this.roundId || 0) + 1;

    const queued = (this.nextMons || []).filter(
      (mon) => !this.team.some((caught) => caught.id === mon.id),
    );
    this.roundMons = queued.length === 3 ? queued : this.pickRound();
    /* Decide the next three now, so their sheets can download while this
       round is being played instead of during it. */
    this.nextMons = this.pickRound(this.roundMons.map((mon) => mon.id));

    /* One rack per round: the better the ball, the rarer it is to be handed. */
    this.ballStock = pickBall();
    this.balls = BALLS_PER_ROUND;
    this.phase = "ready";
    this.message = `${this.ballStock.name} ×${BALLS_PER_ROUND} this round.`;
    if (this.ball) this.ball.setTexture(`ball-${this.ballStock.id}`);
    if (!silent) this.emit();
    this.loadRound(this.roundMons);
    this.warm(this.nextMons);
  }

  nextRound() {
    if (this.round >= ROUNDS) return;
    this.round += 1;
    this.startRound();
  }

  resetGame() {
    this.round = 1;
    this.team = [];
    this.nextMons = [];
    this.startRound();
  }

  pickRound(exclude = []) {
    const pool = (this.roster.length ? this.roster : []).filter(
      (mon) =>
        !this.team.some((caught) => caught.id === mon.id) &&
        !exclude.includes(mon.id),
    );
    const bag = pool.slice();
    const picked = [];
    while (picked.length < 3 && bag.length) {
      picked.push(bag.splice(Math.floor(Math.random() * bag.length), 1)[0]);
    }
    return picked;
  }

  /* Download the next round's three while the browser is otherwise idle. */
  warm(mons) {
    if (!mons.length) return;
    const run = () => mons.forEach((mon) => fetchPmd(mon.id).catch(() => {}));
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      window.requestIdleCallback(run, { timeout: 4000 });
    } else {
      setTimeout(run, 1200);
    }
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
    this.drawField(scene);
    this.createBall(scene);
    this.bindInput(scene);

    if (this.roundMons.length) this.loadRound(this.roundMons);
    this.emit();
  }

  makeTextures(scene) {
    /* one texture per ball, drawn from the same cell grid, so whichever rack
       a round draws can be swapped in without redrawing anything */
    BALL_TYPES.forEach((type) => {
      const key = `ball-${type.id}`;
      if (scene.textures.exists(key)) return;
      const g = scene.make.graphics({ add: false });
      ballCells(type.ink).forEach(([x, y, color]) => {
        g.fillStyle(parseInt(color.slice(1), 16), 1);
        g.fillRect(x, y, 1, 1);
      });
      g.generateTexture(key, BALL_CELLS, BALL_CELLS);
      g.destroy();
    });
    if (!scene.textures.exists("spark")) {
      const g = scene.make.graphics({ add: false });
      g.fillStyle(0xf7d774, 1);
      g.fillRect(0, 0, 3, 3);
      g.generateTexture("spark", 3, 3);
      g.destroy();
    }
  }

  /* A depth grid instead of flat rings: rails running away from the player
     and rungs that bunch up toward the back. */
  drawField(scene) {
    const g = scene.add.graphics().setDepth(-5);

    [0.08, 0.34, 0.66, 0.92].forEach((t) => {
      const nearX = W * t;
      const farX = W / 2 + (nearX - W / 2) * 0.46;
      g.lineStyle(1, 0x2f424b, 0.45);
      g.lineBetween(nearX, this.groundAt(0), farX, this.groundAt(1));
    });

    [0, 0.16, 0.36, 0.6, 0.82, 1].forEach((z, index) => {
      const y = this.groundAt(z);
      const inset = 46 * z;
      g.lineStyle(1, 0x2b3c44, index === 0 ? 0.85 : 0.32);
      g.lineBetween(inset, y, W - inset, y);
    });

    /* the near edge, where the ball is thrown from */
    scene.add.rectangle(W / 2, this.groundAt(0), W, 2, 0x2c3b43, 0.9).setDepth(-4);
  }

  createBall(scene) {
    this.ballScale = (BALL_R * 2) / BALL_CELLS;
    this.ball = scene.add.image(
      BALL_HOME.x,
      NEAR_Y - BALL_R,
      `ball-${this.ballStock.id}`,
    );
    this.ball.setDepth(600).setScale(this.ballScale);
    /* its shadow on the ground is what tells the eye how high the ball is */
    this.ballShadow = scene.add
      .ellipse(BALL_HOME.x, this.groundAt(BALL_HOME.z), 34, 10, 0x05090b, 0.42)
      .setDepth(1);
    /* Where the throw is aimed: four corner ticks that ride the ground under
       the finger, so the player can see the landing spot before releasing. */
    const marker = scene.add.graphics().setDepth(40).setVisible(false);
    marker.lineStyle(2, 0xf6f6ef, 0.92);
    const out = 15;
    const arm = 7;
    [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ].forEach(([sx, sy]) => {
      marker.beginPath();
      marker.moveTo(sx * out, sy * (out - arm));
      marker.lineTo(sx * out, sy * out);
      marker.lineTo(sx * (out - arm), sy * out);
      marker.strokePath();
    });
    this.marker = marker;
    this.parkBall();
  }

  parkBall() {
    const state = this.ballState;
    state.x = BALL_HOME.x;
    state.z = BALL_HOME.z;
    state.h = BALL_R;
    state.vx = 0;
    state.vz = 0;
    state.vh = 0;
    state.angle = 0;
    state.spin = 0;
    state.live = false;
    state.frozen = false;
    state.still = 0;

    if (!this.ball) return;
    const point = this.project(state.x, state.z, state.h);
    this.ball
      .setPosition(point.x, point.y)
      .setScale(this.ballScale * point.s)
      .setAngle(0)
      .setAlpha(1)
      .setVisible(true)
      .setDepth(600 - state.z * 400);
    this.ballShadow?.setVisible(true);
    this.marker?.setVisible(false);
    this.drawBall();
  }

  /* ---------- the three specimens ---------- */

  loadRound(mons) {
    const scene = this.scene;
    if (!scene) return;

    this.mons.forEach((entry) => {
      entry.sprite?.destroy();
      entry.shadow?.destroy();
    });
    this.mons = [];

    mons.forEach((mon, index) => {
      const zone = ZONES[index] || ZONES[0];

      const shadow = scene.add
        .ellipse(zone.x, this.groundAt(zone.z), 46, 11, 0x070d10, 0.5)
        .setDepth(1);

      const sprite = scene.add
        .image(zone.x, this.groundAt(zone.z), "__DEFAULT")
        .setOrigin(0.5, 1)
        .setDepth(2)
        .setVisible(false);

      this.mons.push({
        ...mon,
        x: zone.x,
        z: zone.z,
        zone,
        dir: 1,
        face: 0,
        state: "idle",
        timer: 0.3 + index * 0.45,
        speed: 0,
        target: { x: zone.x, z: zone.z },
        parts: null,
        animName: "idle",
        animT: 0,
        frame: 0,
        sprite,
        shadow,
        loaded: false,
        caught: false,
        odds: catchOdds(DEFAULT_CAPTURE_RATE, this.ballStock.multiplier),
      });
    });

    this.parkBall();
    this.fillMons();
    this.loadRates();
  }

  /* Species capture rates, the 0-255 figure the games roll against. api.js
     caches each response, so a creature met in an earlier round costs
     nothing, and a failed request simply leaves the default in place. */
  loadRates() {
    const roundId = this.roundId;
    this.mons.forEach(async (entry) => {
      try {
        const species = await fetchSpecies(entry.id);
        if (!this.alive(roundId)) return;
        entry.odds = catchOdds(species?.capture_rate, this.ballStock.multiplier);
      } catch {
        /* offline, or a species that has no record yet: keep the default */
      }
    });
  }

  /* The creature the landing spot is nearest, if one is close enough for the
     quote to mean anything. */
  nearestMon(x, z) {
    let best = null;
    let bestDistance = ODDS_RADIUS;
    for (const mon of this.mons) {
      if (!mon.loaded || mon.caught) continue;
      const distance = Math.hypot(x - mon.x, (z - mon.z) * Z_SPAN);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = mon;
      }
    }
    return best;
  }

  async fillMons() {
    const roundId = this.roundId;
    const entries = this.mons.slice();

    await Promise.all(
      entries.map(async (entry) => {
        if (!entry?.sprite) return;
        let parts = null;
        try {
          const data = await fetchPmd(entry.id);
          if (!this.alive(roundId)) return;
          parts = installPmdTextures(this.scene, entry.id, data);
        } catch {
          parts = null;
        }
        if (!this.alive(roundId) || !entry.sprite?.active) return;

        if (parts) {
          entry.parts = parts;
          entry.pmd = true;
          this.setAnim(entry, parts.walk ? "walk" : parts.idle ? "idle" : "run");
          entry.sprite.setVisible(true);
          entry.loaded = true;
          this.placeMon(entry);
          return;
        }

        /* No sheet: fall back to the still dex sprite so the round runs. */
        const key = await this.loadStill(entry.id);
        if (!key || !this.alive(roundId) || !entry.sprite?.active) return;
        entry.parts = { still: { key, durations: null, frames: 1 } };
        entry.pmd = false;
        this.setAnim(entry, "still");
        entry.sprite.setVisible(true).setTexture(key);
        entry.loaded = true;
        this.placeMon(entry);
      }),
    );
  }

  async loadStill(id) {
    const scene = this.scene;
    const key = `still-${id}`;
    if (!scene) return null;
    if (scene.textures.exists(key)) return key;
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
        /* next source */
      }
    }
    return null;
  }

  setAnim(entry, name) {
    const part = entry.parts?.[name];
    if (!part || entry.animName === name) return;
    entry.animName = name;
    entry.animT = 0;
    entry.frame = 0;
    if (entry.sprite?.texture?.key !== part.key) {
      entry.sprite.setTexture(part.key, 0);
    }
    this.applyFrame(entry);
  }

  /* Every PMD sheet holds all eight facings, one row per direction, so the
     frame is the row for the way it is walking plus its step in the cycle. */
  applyFrame(entry) {
    const part = entry.parts?.[entry.animName];
    if (!part || !entry.sprite?.active) return;
    const rows = part.rows || 1;
    const perRow = part.perRow || part.frames || 1;
    const row = Math.min(entry.face || 0, rows - 1);
    const step = Math.min(entry.frame || 0, (part.frames || 1) - 1);
    entry.sprite.setFrame(row * perRow + step);
  }

  /* Screen position, scale and shadow for wherever the creature stands. */
  placeMon(entry) {
    const point = this.project(entry.x, entry.z, 0);
    const scale = MON_SCALE * point.s;
    /* the frame's empty bottom margin is scaled too, so the feet — not the
       cell — are what touches the ground */
    const foot = (entry.parts?.[entry.animName]?.foot || 0) * scale;
    entry.sprite
      .setPosition(point.x, point.y + foot + 1)
      .setScale(scale)
      .setDepth(300 - entry.z * 250)
      /* a lean into the walk, so a crossing creature is not a sliding decal */
      .setRotation((entry.lean || 0) * 0.012);
    this.applyFrame(entry);
    entry.shadow
      .setPosition(point.x, point.y)
      .setScale(0.7 * point.s, 0.7 * point.s)
      .setAlpha(0.45)
      .setDepth(300 - entry.z * 250 - 1);
    entry.height = entry.sprite.displayHeight - foot;
  }

  tickAnim(entry, delta) {
    const part = entry.parts?.[entry.animName];
    if (!part?.durations || !entry.sprite?.active) return;
    /* Most Gen 1 creatures have no separate run strip, so a run is the walk
       cycle played quicker — the legs still keep up with the ground. */
    const rate =
      entry.animName === "run"
        ? RUN_RATE
        : entry.animName === "walk"
          ? entry.state === "run"
            ? WALK_RATE * 0.62
            : WALK_RATE
          : IDLE_RATE;

    entry.animT += (delta / 1000) * rate;
    let guard = 0;
    while (entry.animT >= part.durations[entry.frame] * ANIM_TICK && guard < 8) {
      entry.animT -= part.durations[entry.frame] * ANIM_TICK;
      entry.frame = (entry.frame + 1) % part.frames;
      this.applyFrame(entry);
      guard += 1;
    }
  }

  /* Wander: pick a spot inside the creature's zone, cross to it, then stand
     for a moment — and sometimes turn around or break into a run. */
  roam(entry, delta) {
    if (!entry.loaded || entry.caught) return;
    const dt = Math.min(delta, 50) / 1000;

    if (entry.state === "idle") {
      entry.lean = 0;
      entry.timer -= dt;
      if (entry.timer <= 0) this.crossField(entry);
      return;
    }

    const dx = entry.target.x - entry.x;
    const dz = (entry.target.z - entry.z) * Z_SPAN;
    const distance = Math.hypot(dx, dz);

    if (distance < 6) {
      entry.state = "idle";
      entry.timer = 0.15 + Math.random() * 0.5;
      this.setAnim(entry, "idle");
      return;
    }

    /* a change of mind mid-stride: new heading, no pause */
    if (Math.random() < dt * 0.35) {
      this.crossField(entry);
      return;
    }

    const step = Math.min(distance, entry.speed * dt);
    const nx = (dx / distance) * step;
    const nz = (dz / distance) * step;
    entry.x = clamp(entry.x + nx, 44, W - 44);
    entry.z = clamp(entry.z + nz / Z_SPAN, Z_MIN, 0.95);
    if (Math.abs(nx) > 0.05) entry.dir = nx < 0 ? -1 : 1;
    entry.lean = clamp(nx * 1.4, -4.5, 4.5);
    /* Whichever way it is walking is the way it faces. Depth runs the other
       way on screen — z grows away from the viewer while screen y shrinks —
       so the heading is measured with -nz, or a creature walking away is
       drawn facing the camera. */
    entry.face = facingRow(nx, -nz);

    this.placeMon(entry);
  }

  /* Anywhere on the field is fair game: the whole plane, all four ways. */
  crossField(entry) {
    let x = 56 + Math.random() * (W - 112);
    let z = Z_MIN + 0.03 + Math.random() * 0.62;
    /* don't pick a spot it is already standing on */
    if (Math.hypot(x - entry.x, (z - entry.z) * Z_SPAN) < 90) {
      x = W - x;
      z = clamp(1.26 - z, Z_MIN + 0.03, 0.94);
    }
    entry.target = { x, z };
    const running = Math.random() < 0.42;
    entry.state = running ? "run" : "walk";
    entry.speed = running ? 138 : 82;
    this.setAnim(entry, running && entry.parts?.run ? "run" : "walk");
  }

  /* ---------- gesture: swipe forward to throw ---------- */

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
    const home = this.project(BALL_HOME.x, BALL_HOME.z, BALL_R);
    const nearBall = Math.hypot(point.x - home.x, point.y - home.y) < 130;
    if (!nearBall && point.y < NEAR_Y - 170) return;

    this.aim = {
      samples: [{ x: point.x, y: point.y, t: performance.now() }],
      touched,
      last: point,
      spin: 0,
      target: { x: BALL_HOME.x, z: 0.4 },
    };
    this.ballState.live = false;
    this.aimAt(point.x, point.y);
    playSfx("grab");
    this.emit({ phase: "aim", message: "" });

    /* the ball gives a little hop when it is picked up */
    this.scene.tweens.add({
      targets: this.ball,
      angle: { from: -8, to: 8 },
      duration: 90,
      yoyo: true,
      repeat: 1,
      ease: "Sine.inOut",
      onComplete: () => this.ball?.setAngle(this.ballState.angle * 57.3),
    });
  }

  /* The ball stays in the hand at the near edge; the finger only paints the
     landing spot. That way the throw always leaves from where the player can
     see the ball, and the arc runs in the direction they swiped. */
  aimAt(x, y) {
    if (!this.aim) return;
    const ground = this.groundAt(Z_NEAR);
    const target = {
      x: clamp(x, BALL_R, W - BALL_R),
      z: clamp((ground - y) / Z_SPAN, 0.08, 0.94),
    };
    this.aim.target = target;
    /* Quote the odds of whatever the spot is nearest, so a species' rate is
       visible before the throw rather than only after it gets away. */
    const near = this.nearestMon(target.x, target.z);
    if (near !== this.markerTarget) {
      this.markerTarget = near;
      if (this.phase === "aim") this.emit();
    }
    const point = this.project(target.x, target.z, 0);
    this.marker?.setPosition(point.x, point.y).setScale(point.s).setVisible(true);
    /* the ball tips toward the spot it is about to be thrown at */
    this.ballState.angle = (target.x - BALL_HOME.x) * 0.0025;
    this.drawBall();
  }

  onMove(point, event) {
    if (!this.aim || !this.alive()) return;
    const now = performance.now();
    const dt = Math.max(8, now - this.aim.samples[this.aim.samples.length - 1].t);
    const vx = ((point.x - this.aim.last.x) / dt) * 1000;

    this.aim.last = point;
    this.aim.spin += (vx / 900) * 0.12;
    this.aim.spin = clamp(this.aim.spin * 0.94, -0.6, 0.6);

    if (event?.pointerId !== undefined) this.lastPointerId = event.pointerId;
    this.aimAt(point.x, point.y);

    this.aim.samples.push({ x: point.x, y: point.y, t: now });
    this.aim.samples = this.aim.samples.filter((sample) => now - sample.t < 320);
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
    const target = this.aim.target;
    this.aim = null;
    this.marker?.setVisible(false);

    /* A press that never moved is not a throw: put the ball back rather than
       lobbing it for the player and spending one of their three. */
    if (travel < 12) {
      this.parkBall();
      playSfx("close");
      this.emit({ phase: "ready", message: "" });
      return;
    }

    this.launch({ ...throwVec, target });
  }

  /* Velocity from the last ~140ms of travel, curvature from the signed turn
     between consecutive samples inside that window. */
  measureThrow() {
    const samples = this.aim?.samples || [];
    const now = performance.now();
    const recent = samples.filter((sample) => now - sample.t < 140);
    const tail = recent.length >= 3 ? recent : samples.slice(-3);

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

    return { spin: clamp((curl / 16) * 12, -12, 12) };
  }

  launch({ spin, target }) {
    const state = this.ballState;
    const goal = target || { x: BALL_HOME.x, z: 0.4 };

    /* it leaves the hand upright, at the height of a held ball, so the whole
       arc happens in front of the player */
    state.h = BALL_R;
    state.angle = 0;

    const dz = (goal.z - state.z) * Z_SPAN;
    const distance = Math.hypot(goal.x - state.x, dz);
    /* a longer throw takes a little longer and arcs higher */
    const flight = clamp(FLIGHT_BASE + distance / FLIGHT_PER_PX, 0.46, 1.05);

    state.vx = (goal.x - state.x) / flight;
    state.vz = dz / Z_SPAN / flight;
    state.vh = (GRAVITY * flight) / 2;
    state.spin = spin;
    state.live = true;
    state.still = 0;
    this.throwStart = performance.now();

    this.balls = Math.max(0, this.balls - 1);
    this.emit({ phase: "flying", balls: this.balls, message: "" });
    playSfx("throw");
  }

  /* ---------- per-frame ---------- */

  _update(delta) {
    if (!this.ball) return;
    this.clock += delta || 16;

    this.mons.forEach((entry) => {
      this.roam(entry, delta);
      this.tickAnim(entry, delta);
      if (entry.loaded && !entry.caught) this.placeMon(entry);
    });

    if (this.ballState.live) this.stepBall(Math.min(delta, 50) / 1000);

    /* A ball held in the hand shivers and sways with the clock. */
    const wobble = this.aim
      ? Math.sin(this.clock / 120) * 4.5 + this.aim.spin * 40
      : 0;
    this.drawBall(wobble);
  }

  stepBall(dt) {
    const state = this.ballState;
    const body = state;

    body.vh -= GRAVITY * dt;

    /* a spinning ball curves across the field instead of flying straight */
    if (Math.abs(body.spin) > 0.2) {
      const speed = Math.hypot(body.vx, body.vz);
      if (speed > 20) {
        const push = body.spin * speed * SPIN_CURVE * dt;
        body.vx += (-body.vz / speed) * push;
        body.vz += (body.vx / speed) * push;
      }
    }

    body.x += body.vx * dt;
    body.z += body.vz * dt;
    body.h += body.vh * dt;

    /* the field is walled: the ball rattles off the edges, not off the screen */
    if (body.x < BALL_R) {
      body.x = BALL_R;
      body.vx = Math.abs(body.vx) * 0.55;
    } else if (body.x > W - BALL_R) {
      body.x = W - BALL_R;
      body.vx = -Math.abs(body.vx) * 0.55;
    }
    if (body.z < 0.02) {
      body.z = 0.02;
      body.vz = Math.abs(body.vz) * 0.5;
    } else if (body.z > Z_FAR) {
      body.z = Z_FAR;
      body.vz = -Math.abs(body.vz) * 0.5;
    }

    /* Ground contact: it hits, hops, then rolls — and each contact kicks up
       a little dust, which is what sells the height it just fell from. */
    if (body.h <= BALL_R) {
      body.h = BALL_R;
      const impact = Math.abs(body.vh);
      if (impact > 190) {
        body.vh = impact * 0.4;
        this.puff(impact);
      } else if (impact > 45) {
        body.vh = impact * 0.16;
        this.puff(impact * 0.55);
      } else {
        body.vh = 0;
        const drag = Math.exp(-2.1 * dt);
        body.vx *= drag;
        body.vz *= drag;
      }
    }

    body.vx *= 1 - 0.22 * dt;
    body.vz *= 1 - 0.22 * dt;

    /* A slight roll, not a tumble: the ball has a face, and turning it over
       makes it unreadable at this size. */
    body.angle += (body.vx / (BALL_R * 9)) * dt;

    this.checkCatch();

    const speed = Math.hypot(body.vx, body.vz) + Math.abs(body.vh);
    const settled = body.h <= BALL_R + 0.6 && speed < 26;
    body.still = settled ? body.still + dt : 0;

    if (body.still > 0.35) this.settle();
    else if (performance.now() - this.throwStart > 6500) this.settle();
  }

  /* Contact is a catch: the ball has to come down inside the creature's
     footprint, at or below its shoulders. */
  checkCatch() {
    if (performance.now() - this.throwStart < 120) return;
    const state = this.ballState;
    /* A ball still climbing sails over everyone. It only catches on the way
       down, or once it is rolling across the ground. */
    if (state.vh > 0) return;

    for (const mon of this.mons) {
      if (!mon.loaded || mon.caught) continue;
      const dx = state.x - mon.x;
      const dz = (state.z - mon.z) * Z_SPAN;
      const top = (mon.height || 90) * 0.95;
      if (Math.hypot(dx, dz) < CATCH_R && state.h < top) {
        this.catchSequence(mon);
        return;
      }
    }
  }

  /* A ring of grit at the point of impact, sized by how hard it landed. */
  puff(strength = 120) {
    const scene = this.scene;
    if (!scene) return;
    const state = this.ballState;
    const point = this.project(state.x, state.z, 0);
    const reach = clamp(strength / 5, 10, 30);
    for (let i = 0; i < 5; i += 1) {
      const angle = (Math.PI * 2 * i) / 5 + Math.random() * 0.6;
      const dot = scene.add
        .circle(point.x, point.y, 2.4, 0xb9c6cc, 0.55)
        .setDepth(300 - state.z * 250 - 3);
      scene.tweens.add({
        targets: dot,
        x: point.x + Math.cos(angle) * reach,
        y: point.y + Math.sin(angle) * reach * 0.4 - 4,
        scale: 0.3,
        alpha: 0,
        duration: 320 + Math.random() * 180,
        ease: "Quad.out",
        onComplete: () => dot.destroy(),
      });
    }
  }

  drawBall(extraAngle = 0) {
    if (!this.ball || this.ballState.frozen) return;
    const state = this.ballState;
    const point = this.project(state.x, state.z, state.h);
    this.ball
      .setPosition(point.x, point.y)
      .setScale(this.ballScale * point.s)
      .setAngle(state.angle * 57.3 + extraAngle)
      .setDepth(600 - state.z * 400);

    if (this.ballShadow) {
      const ground = this.project(state.x, state.z, 0);
      const lift = Math.max(0, state.h - BALL_R);
      const spread = 1 + Math.min(1.4, lift / 110);
      this.ballShadow
        .setPosition(ground.x, ground.y)
        .setScale(
          (BALL_R * 1.7 * point.s * spread) / 34,
          (BALL_R * 0.6 * point.s) / 10,
        )
        .setAlpha(0.4 / spread)
        .setDepth(300 - state.z * 250 - 2);
    }
  }

  /* The throw came to rest without touching anything: that is a miss. */
  settle() {
    if (this.phase !== "flying") return;
    /* it comes to rest the right way up */
    this.ballState.angle = 0;
    this.missed();
  }

  /* ---------- capture sequence ---------- */

  async catchSequence(target) {
    const scene = this.scene;
    if (!scene || this.phase === "catching" || this.phase === "caught") return;
    const roundId = this.roundId;
    this.emit({ phase: "catching", message: `Ball on ${target.name}…` });

    const state = this.ballState;
    state.live = false;
    state.frozen = true; /* the tweens below own the sprite from here */
    target.caught = true;

    const at = this.project(state.x, state.z, state.h);
    playSfx("impact");
    const flash = scene.add
      .circle(at.x, at.y, 24, 0xffffff, 0.85)
      .setDepth(950);
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

    /* A white flash on the silhouette, twice, then the creature is drawn
       into the ball — no spinning, the sprite never turns over. */
    const glow = scene.add
      .circle(at.x, at.y, Math.max(26, (target.height || 90) * 0.34), 0xffffff, 0.9)
      .setDepth(960);
    scene.tweens.add({
      targets: glow,
      scale: 2.4,
      alpha: 0,
      duration: 460,
      ease: "Quad.out",
      onComplete: () => glow.destroy(),
    });

    target.sprite.setTintFill(0xffffff);
    scene.tweens.add({
      targets: target.sprite,
      alpha: { from: 1, to: 0.4 },
      duration: 110,
      yoyo: true,
      repeat: 1,
      ease: "Quad.inOut",
      onComplete: () => {
        target.sprite?.clearTint();
        scene.tweens.add({
          targets: target.sprite,
          alpha: 0,
          scaleX: target.sprite.scaleX * 0.12,
          scaleY: target.sprite.scaleY * 0.12,
          y: at.y,
          duration: 300,
          ease: "Quad.in",
          onComplete: () => target.sprite?.clearTint(),
        });
      },
    });
    scene.tweens.add({
      targets: target.shadow,
      alpha: 0,
      scaleX: 0.2,
      duration: 280,
    });

    /* and the ball settles onto the ground at that spot */
    const landing = this.project(
      clamp(target.x, BALL_R + 10, W - BALL_R - 10),
      clamp(target.z, 0.08, 0.94),
      BALL_R,
    );
    state.x = landing.x;
    state.z = clamp(target.z, 0.08, 0.94);
    state.h = BALL_R;
    scene.tweens.add({
      targets: this.ball,
      x: landing.x,
      y: landing.y,
      scale: this.ballScale * landing.s,
      duration: 380,
      ease: "Quad.out",
    });

    await wait(430);
    if (!this.alive(roundId)) return;
    playSfx("close");

    await wait(420);
    if (!this.alive(roundId)) return;

    const odds =
      target.odds || catchOdds(DEFAULT_CAPTURE_RATE, this.ballStock.multiplier);
    for (let shake = 0; shake < 3; shake += 1) {
      playSfx(["shake", "shake2", "shake3"][shake]);
      await this.tweenBallAngle(scene, -16, 16, 110, true, 1);
      await wait(170);
      if (!this.alive(roundId)) return;
      /* One check per shake, as the games run it: the shell can open after
         the first wobble, the second or the third. */
      if (Math.random() > odds.shake) {
        await this.breakFree(target);
        return;
      }
    }

    this.emit({
      phase: "caught",
      message: `Gotcha! ${target.label || target.name} joined the team.`,
    });
    this.team = [
      ...this.team,
      { id: target.id, name: target.label || target.name },
    ];
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
      scale: this.ball.scale * 1.2,
      duration: 170,
      yoyo: true,
      repeat: 1,
      ease: "Sine.inOut",
    });

    await wait(950);
    if (!this.alive(roundId)) return;
    this.ball.setVisible(false);
    this.ballShadow?.setVisible(false);
    this.emit({ team: this.team.slice() });
    this.finishRound();
  }

  /* The ball lost a shake check. Red flash over the field, the shell pops,
     and the creature comes back out and bolts — it keeps the rate it had, so
     a stubborn one can be tried again but will likely shrug the next ball
     off as well. */
  async breakFree(target) {
    const scene = this.scene;
    if (!scene) return;
    const roundId = this.roundId;
    const at = this.project(
      this.ballState.x,
      this.ballState.z,
      this.ballState.h,
    );

    const name = target.label || target.name;
    const percent = target.odds.percent;
    this.emit({ phase: "broke", message: `${name} broke free — ${percent}% catch.` });
    playSfx("breakout");
    /* The red flash is the whole tell. It is a wash over the field rather
       than a camera flash: the camera's own flash sits at full opacity and
       would hide the creature coming back out of the shell underneath it. */
    const wash = scene.add
      .rectangle(W / 2, H / 2, W, H, 0xff2f24, 0.34)
      .setDepth(980);
    scene.tweens.add({
      targets: wash,
      alpha: 0,
      duration: 320,
      ease: "Quad.out",
      onComplete: () => wash.destroy(),
    });
    scene.cameras.main.shake(160, 0.005);

    const bloom = scene.add.circle(at.x, at.y, 22, 0xff2f24, 0.95).setDepth(970);
    scene.tweens.add({
      targets: bloom,
      scale: 3.2,
      alpha: 0,
      duration: 380,
      ease: "Quad.out",
      onComplete: () => bloom.destroy(),
    });
    for (let i = 0; i < 10; i += 1) {
      const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.4;
      const spark = scene.add
        .circle(at.x, at.y, 2.6, 0xff6a4d, 0.9)
        .setDepth(965);
      scene.tweens.add({
        targets: spark,
        x: at.x + Math.cos(angle) * (26 + Math.random() * 34),
        y: at.y + Math.sin(angle) * (16 + Math.random() * 22),
        alpha: 0,
        scale: 0.2,
        duration: 360 + Math.random() * 200,
        ease: "Quad.out",
        onComplete: () => spark.destroy(),
      });
    }
    scene.tweens.add({
      targets: this.ball,
      scale: this.ball.scale * 1.28,
      duration: 90,
      yoyo: true,
      repeat: 1,
      ease: "Quad.out",
    });

    /* back onto the field, flashing red out of the shell, then running */
    target.caught = false;
    target.sprite?.setAlpha(1).clearTint().setTint(0xff5a44);
    target.shadow?.setAlpha(0.45);
    scene.time.delayedCall(240, () => target.sprite?.clearTint());
    this.flee(target);

    await wait(520);
    if (!this.alive(roundId)) return;

    this.parkBall();
    if (this.balls > 0) {
      this.emit({
        phase: "ready",
        message: `${name} broke free (${percent}% catch) — ${
          this.balls === 1 ? "1 ball" : `${this.balls} balls`
        } left.`,
      });
    } else {
      this.ball?.setVisible(false);
      this.ballShadow?.setVisible(false);
      this.emit({ message: `${name} broke free — out of balls.` });
      this.finishRound();
    }
  }

  /* Straight away from the ball, at a run: a creature that just escaped
     should not stand on the spot and invite the next throw. */
  flee(entry) {
    const away = entry.x <= this.ballState.x ? -1 : 1;
    entry.target = {
      x: clamp(entry.x + away * (120 + Math.random() * 70), 44, W - 44),
      z: clamp(entry.z + (Math.random() - 0.5) * 0.34, Z_MIN, 0.94),
    };
    entry.state = "run";
    entry.speed = 150;
    this.setAnim(entry, entry.parts?.run ? "run" : "walk");
  }

  tweenBallAngle(scene, from, to, duration, yoyo, repeat) {
    const state = { angle: from };
    const base = this.ball.scale;
    return new Promise((resolve) => {
      scene.tweens.add({
        targets: state,
        angle: to,
        duration,
        yoyo,
        repeat,
        ease: "Sine.inOut",
        onUpdate: () => {
          this.ball.setAngle(state.angle);
          this.ball.setScale(base * (1 + Math.abs(state.angle) / 240));
        },
        onComplete: () => {
          this.ball.setAngle(0).setScale(base);
          resolve();
        },
      });
    });
  }

  async missed() {
    if (!this.alive() || this.phase !== "flying") return;
    this.ballState.live = false;
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
        scale: { from: this.ballScale * 0.4, to: this.ballScale },
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
      this.ballShadow?.setVisible(false);
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
