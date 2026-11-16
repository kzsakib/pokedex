/* Seeded pack generation: composition, stats, moves, effects, rarity. */
import { makeRng, hashSeed } from "./rng.js";

const LEGEND_IDS = [144, 145, 146, 150, 151];

const TYPE_MAP = {
  normal: "Colorless",
  flying: "Colorless",
  dragon: "Colorless",
  fire: "Fire",
  water: "Water",
  ice: "Water",
  grass: "Grass",
  bug: "Grass",
  poison: "Grass",
  electric: "Lightning",
  psychic: "Psychic",
  ghost: "Psychic",
  fighting: "Fighting",
  ground: "Fighting",
  rock: "Fighting",
};

import { hueLabel } from "./lore.js";

export const RARITY_ORDER = { common: 0, uncommon: 1, rare: 2, holo: 3, chroma: 4, legend: 5 };
export const RARITY_LABEL = { common: "COMMON", uncommon: "UNCOMMON", rare: "RARE", holo: "HOLO RARE", legend: "LEGEND", chroma: "CHROMA" };
export const RARITY_MARK = { common: "●", uncommon: "◆", rare: "★", holo: "★", legend: "★" };

const MOVES = {
  Fire: ["EMBER", "FLAMETHROWER", "FIRE SPIN", "FIRE BLAST", "FIRE PUNCH", "SMOKESCREEN"],
  Water: ["WATER GUN", "BUBBLE", "BUBBLEBEAM", "SURF", "HYDRO PUMP", "WATERFALL", "CLAMP", "WITHDRAW"],
  Grass: ["VINE WHIP", "RAZOR LEAF", "SOLAR BEAM", "LEECH SEED", "STUN SPORE", "SLEEP POWDER", "POISONPOWDER", "MEGA DRAIN"],
  Lightning: ["THUNDER SHOCK", "THUNDERBOLT", "THUNDER WAVE", "THUNDER", "SPARK"],
  Psychic: ["CONFUSION", "PSYBEAM", "PSYCHIC", "HYPNOSIS", "DREAM EATER", "KINESIS", "TELEPORT", "PSYWAVE"],
  Fighting: ["KARATE CHOP", "LOW KICK", "SEISMIC TOSS", "SUBMISSION", "ROCK THROW", "EARTHQUAKE", "DIG", "BONE CLUB"],
  Colorless: ["TACKLE", "SCRATCH", "POUND", "QUICK ATTACK", "SLAM", "HEADBUTT", "GUST", "WING ATTACK", "BITE", "SLASH", "HYPER BEAM", "BODY SLAM", "SWIFT", "TAKE DOWN", "DOUBLE KICK"],
};

const WEAKNESS = { Fire: "Water", Water: "Lightning", Grass: "Fire", Lightning: "Fighting", Fighting: "Psychic", Psychic: "Psychic" };
const ALL_TYPES = ["Fire", "Water", "Grass", "Lightning", "Psychic", "Fighting", "Colorless"];

const STATUS = ["HEADS: PARALYZED", "HEADS: ASLEEP", "HEADS: CONFUSED", "POISONED"];

/* Chroma forms get a palette invented at pack time: the twelve hue sectors are
   shuffled and re-pointed, while saturation and lightness stay exactly as they
   were, so only the colours move. */
function randomHueMap(rng) {
  const targets = [...Array(12).keys()];
  for (let i = targets.length - 1; i > 0; i -= 1) {
    const j = rng.int(0, i);
    [targets[i], targets[j]] = [targets[j], targets[i]];
  }
  const map = {};
  targets.forEach((target, source) => {
    map[source] = (target * 30 + rng.int(0, 15)) % 360;
  });
  return map;
}

export function tcgType(pokemon) {
  const slots = pokemon.types.map((t) => TYPE_MAP[t]).filter(Boolean);
  const preferred = slots.find((t) => t !== "Colorless");
  return preferred || "Colorless";
}

export function classify(pokemon) {
  if (LEGEND_IDS.includes(pokemon.id)) return "legend";
  if (pokemon.bst >= 455) return "rare";
  if (pokemon.bst >= 340) return "uncommon";
  return "common";
}

export function buildPools(data) {
  const pools = { common: [], uncommon: [], rare: [], legend: [] };
  for (const mon of data) pools[classify(mon)].push(mon);
  for (const key of Object.keys(pools)) pools[key].sort((a, b) => a.id - b.id);
  return pools;
}

const snap10 = (n) => Math.max(10, Math.round(n / 10) * 10);
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

function randomVariant(rng) {
  const hueMap = randomHueMap(rng);
  const tcg = rng.pick(ALL_TYPES);
  const labelSource = rng.int(0, 11);
  return { key: `hue-${rng.int(1000, 9999)}`, hueMap, tcg, labelSource, label: hueLabel(hueMap, labelSource), note: "" };
}

function rarityBonus(rarity) {
  if (rarity === "legend") return 20;
  if (rarity === "chroma") return 15;
  if (rarity === "holo" || rarity === "rare") return 10;
  return 0;
}

function rollCost(rng, tcg, stage, rarity) {
  const weights = stage === 0 ? [0.34, 0.36, 0.22, 0.08] : stage === 1 ? [0.16, 0.34, 0.34, 0.16] : [0.06, 0.24, 0.4, 0.3];
  if (rarity === "legend") weights.splice(0, 4, 0.04, 0.2, 0.4, 0.36);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng.random() * total;
  let count = 1;
  for (let i = 0; i < weights.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) {
      count = i + 1;
      break;
    }
  }
  const cost = [tcg];
  for (let i = 1; i < count; i += 1) cost.push(rng.chance(0.66) ? tcg : "Colorless");
  return cost;
}

function rollDamage(rng, cost, stage, rarity) {
  const count = cost.length;
  const base = { 1: [10, 20], 2: [20, 40], 3: [40, 60], 4: [60, 90] }[clamp(count, 1, 4)];
  let value = rng.int(base[0] / 10, base[1] / 10) * 10;
  if (stage === 2) value += 10;
  if (rarity === "rare" || rarity === "holo" || rarity === "legend") value += 10;
  value = snap10(value);
  const roll = rng.random();
  if (roll < 0.12) return { damage: value, form: "none", display: "-" };
  if (roll < 0.28) return { damage: value, form: "multiplier", display: `${value}x`, coins: rng.int(2, 4) };
  if (roll < 0.4) return { damage: value, form: "bonus", display: `${value}+` };
  return { damage: value, form: "fixed", display: String(value) };
}

function pickMoves(rng, pokemon, tcg, count, stage, rarity) {
  const pools = [MOVES[tcg] || MOVES.Colorless, MOVES.Colorless];
  const chosen = [];
  let guard = 0;
  while (chosen.length < count && guard < 40) {
    guard += 1;
    const pool = rng.chance(0.7) ? pools[0] : pools[1];
    const name = rng.pick(pool);
    if (chosen.some((m) => m.name === name)) continue;
    const cost = rollCost(rng, tcg, stage, rarity);
    const dmg = rollDamage(rng, cost, stage, rarity);
    let effect = "";
    const roll = rng.random();
    if (dmg.form === "multiplier") {
      effect = `FLIP ${dmg.coins} COINS`;
    } else if (dmg.form === "bonus") {
      effect = rng.chance(0.5) ? "+10 IF DAMAGED" : "HEADS: +20";
    } else if (roll < 0.45) {
      effect = rng.pick(STATUS);
    } else if (roll < 0.8) {
      effect = "HEAL 10 DAMAGE";
    } else if (roll < 0.9) {
      effect = "DISCARD 1 ENERGY";
    } else {
      effect = "RECOIL: 10 DAMAGE";
    }
    chosen.push({
      name,
      cost,
      damage: dmg.damage,
      display: dmg.display,
      form: dmg.form,
      effect: effect.slice(0, 21),
    });
  }
  return chosen;
}

function rollWeakness(rng, tcg) {
  if (tcg !== "Colorless" && rng.chance(0.7)) return WEAKNESS[tcg] || rng.pick(ALL_TYPES);
  const others = ALL_TYPES.filter((t) => t !== tcg);
  return rng.pick(others);
}

function rollResistance(rng, tcg, weakness) {
  if (!rng.chance(0.35)) return null;
  const options = ALL_TYPES.filter((t) => t !== tcg && t !== weakness);
  return rng.pick(options);
}

function retreatFor(pokemon, rarity, rng) {
  const w = pokemon.weight;
  let cost = w < 10 ? 0 : w < 50 ? 1 : w < 100 ? 2 : w < 200 ? 3 : 4;
  if (rarity === "legend") cost = Math.max(0, cost - 1);
  if (rng.chance(0.08)) cost = clamp(cost + (rng.chance(0.5) ? 1 : -1), 0, 4);
  return cost;
}

function rollFinish(rng, table) {
  let r = rng.random();
  for (const [name, w] of table) {
    if (r < w) return name;
    r -= w;
  }
  return table[table.length - 1][0];
}

/* every premium finish, so legend cards never repeat the same look twice in a row */
const PREMIUM = [
  ["prism", 0.096], ["gold", 0.084], ["star", 0.078], ["ember", 0.06], ["crystal", 0.06],
  ["lightning", 0.06], ["bubble", 0.036], ["grid", 0.06], ["confetti", 0.066],
  ["aurora", 0.07], ["matrix", 0.05], ["petals", 0.06], ["ripple", 0.06],
  ["hex", 0.06], ["zodiac", 0.06], ["shatter", 0.04],
];

function weightedInt(rng, table) {
  let r = rng.random();
  for (const [n, w] of table) {
    if (r < w) return n;
    r -= w;
  }
  return table[table.length - 1][0];
}

/* a pack can carry several foil cards; the better the top pull, the more of them */
function promoFinish(rng, rarity) {
  if (rarity === "legend") return rollFinish(rng, PREMIUM);
  if (rarity === "holo") return rollFinish(rng, [["holo", 0.28], ["crystal", 0.18], ["lightning", 0.14], ["grid", 0.14], ["aurora", 0.10], ["ripple", 0.08], ["zodiac", 0.08]]);
  if (rarity === "rare") return rollFinish(rng, [["foil", 0.22], ["ember", 0.15], ["confetti", 0.14], ["grid", 0.2], ["petals", 0.1], ["hex", 0.1], ["shatter", 0.09]]);
  return rollFinish(rng, [["reverse", 0.3], ["ember", 0.12], ["crystal", 0.14], ["bubble", 0.12], ["confetti", 0.12], ["petals", 0.1], ["matrix", 0.1]]);
}

function spreadFoils(rng, cards) {
  const best = cards.reduce((acc, c) => (RARITY_ORDER[c.rarity] > RARITY_ORDER[acc] ? c.rarity : acc), "common");
  const target =
    best === "legend" ? weightedInt(rng, [[3, 0.3], [4, 0.4], [5, 0.3]])
    : best === "holo" ? weightedInt(rng, [[2, 0.45], [3, 0.35], [4, 0.2]])
    : weightedInt(rng, [[1, 0.35], [2, 0.45], [3, 0.2]]);
  let have = cards.filter((c) => c.finish !== "plain").length;
  const order = [...cards].sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]);
  for (const card of order) {
    if (have >= target) break;
    if (card.finish !== "plain") continue;
    card.finish = promoFinish(rng, card.rarity);
    have += 1;
  }
  return cards;
}

function makeCard(rng, pokemon, rarity, shiny, opts = {}) {
  const tcg = opts.tcg || tcgType(pokemon);
  const stage = Math.min(2, pokemon.stage || 0);
  const level = rarity === "legend" ? rng.int(45, 70) : stage === 0 ? rng.int(8, 25) : stage === 1 ? rng.int(18, 40) : rng.int(30, 60);
  const stageBonus = stage === 0 ? 0 : stage === 1 ? 15 : 30;
  const hp = clamp(snap10(20 + pokemon.stats.hp * 0.55 + stageBonus + rng.int(-10, 20) + rarityBonus(rarity)), 30, 140);
  const twoMoves = stage === 2 || rarity === "legend" ? true : stage === 1 ? rng.chance(0.7) : rng.chance(0.4);
  const moves = pickMoves(rng, pokemon, tcg, twoMoves ? 2 : 1, stage, rarity);
  const weakness = rollWeakness(rng, tcg);
  const resistance = rollResistance(rng, tcg, weakness);
  const retreat = retreatFor(pokemon, rarity, rng);
  const finish = shiny
    ? "shiny"
    : rarity === "legend"
    ? rollFinish(rng, PREMIUM)
    : rarity === "holo"
    ? rollFinish(rng, [["holo", 0.34], ["crystal", 0.16], ["lightning", 0.12], ["grid", 0.14], ["aurora", 0.08], ["ripple", 0.06], ["zodiac", 0.06], ["plain", 0.04]])
    : rarity === "rare"
    ? rollFinish(rng, [["foil", 0.24], ["ember", 0.08], ["confetti", 0.06], ["grid", 0.07], ["petals", 0.06], ["hex", 0.05], ["plain", 0.44]])
    : rollFinish(rng, [["reverse", 0.14], ["crystal", 0.04], ["ember", 0.04], ["bubble", 0.04], ["matrix", 0.04], ["shatter", 0.03], ["plain", 0.67]]);
  return {
    ...pokemon,
    tcg,
    stage,
    level,
    hp,
    rarity,
    shiny,
    moves,
    weakness,
    resistance,
    retreat,
    finish,
    seed: rng.seedCode || "",
  };
}

/** Generate an ordered pack (reveal order: weakest first). */
export function generatePack(data, seed, options = {}) {
  const rng = makeRng(seed);
  rng.seedCode = seed;
  const pools = buildPools(data);
  const force = options.force || null;
  const used = new Set();
  const pickUnique = (pool) => {
    for (let i = 0; i < 80; i += 1) {
      const mon = rng.pick(pool);
      if (!used.has(mon.id)) {
        used.add(mon.id);
        return mon;
      }
    }
    const fallback = pool.find((m) => !used.has(m.id));
    if (fallback) {
      used.add(fallback.id);
      return fallback;
    }
    return rng.pick(pool);
  };

  const slots = [];
  for (let i = 0; i < 3; i += 1) slots.push({ mon: pickUnique(pools.common), rarity: "common" });
  const upgrade = rng.chance(0.08);
  slots.push({ mon: pickUnique(upgrade ? pools.rare : pools.uncommon), rarity: upgrade ? "rare" : "uncommon" });
  const roll = rng.random();
  let rareRarity = roll < 0.45 ? "rare" : roll < 0.86 ? "holo" : "legend";
  if (force && ["rare", "holo", "legend"].includes(force)) rareRarity = force;
  slots.push({ mon: pickUnique(pools[rareRarity === "legend" ? "legend" : "rare"]), rarity: rareRarity });

  if (force === "shiny") slots[slots.length - 1].forceShiny = true;

  /* two of the five slots are chroma forms: same pokemon, re-rolled palette */
  const cards = slots.map((slot, index) => {
    const shiny = slot.forceShiny || rng.chance(1 / 40);
    const chroma = index < 2 ? randomVariant(rng) : null;
    const card = makeCard(rng, slot.mon, chroma ? "chroma" : slot.rarity, shiny, chroma ? { tcg: chroma.tcg } : {});
    if (chroma) {
      card.variant = { ...chroma }; /* the hue map rides along: the sprite needs it */
      card.finish = rollFinish(rng, PREMIUM);
    } else {
      /* premium printings: full art bleeds to the edges, EX breaks out of the window */
      const special = rng.random();
      if (card.rarity === "legend") card.special = special < 0.6 ? "full" : "ex";
      else if (card.rarity === "holo") card.special = special < 0.38 ? "full" : special < 0.56 ? "ex" : null;
      else if (card.rarity === "rare") card.special = special < 0.26 ? "full" : special < 0.38 ? "ex" : null;
      else if (card.rarity === "uncommon") card.special = special < 0.1 ? "full" : null;
    }
    card.slot = index;
    return card;
  });

  spreadFoils(rng, cards);
  cards.sort((a, b) => {
    const r = RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
    if (r !== 0) return r;
    if (a.shiny !== b.shiny) return a.shiny ? -1 : 1;
    return a.slot - b.slot;
  });
  if (force === "full" || force === "ex") cards[cards.length - 1].special = force;
  const best = cards.reduce((acc, card) => (RARITY_ORDER[card.rarity] > RARITY_ORDER[acc] ? card.rarity : acc), "common");
  return { seed, cards, best, hash: hashSeed(seed) };
}
