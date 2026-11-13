/* Angling Station data. Everything the game balances lives here: the five
   dioramas, their species pools, the rod and bait kit, and the scoring
   constants. No fetching and no DOM, so the numbers can be read in one pass. */

export const STORAGE_KEY = "pokedex-fishing:v1";

export const CASTS_PER_LEVEL = 10;
export const ZONES = [
  { id: "shallow", label: "Shallow", from: 0, to: 0.4 },
  { id: "mid", label: "Mid", from: 0.4, to: 0.75 },
  { id: "deep", label: "Deep", from: 0.75, to: 1 },
];

/* Zone depth in world units: the bobber is thrown further out and further
   down the diorama as the cast gets stronger. */
export const ZONE_DEPTH = { shallow: 1.6, mid: -2.6, deep: -7.4 };

export const RARITY = {
  common: { base: 100, weight: 6, label: "Common" },
  uncommon: { base: 250, weight: 3, label: "Uncommon" },
  rare: { base: 600, weight: 1.2, label: "Rare" },
  epic: { base: 1500, weight: 0.45, label: "Epic" },
};

/* Zone weighting: shallow water is mostly the common pool, deep water tilts
   hard toward the rare and epic entries. */
const ZONE_WEIGHT = {
  shallow: { common: 1, uncommon: 0.35, rare: 0.12, epic: 0.03 },
  mid: { common: 0.7, uncommon: 1, rare: 0.55, epic: 0.16 },
  deep: { common: 0.3, uncommon: 0.7, rare: 1, epic: 0.55 },
};

export const SPECIES = {
  54: { name: "Psyduck", rarity: "uncommon" },
  55: { name: "Golduck", rarity: "uncommon" },
  60: { name: "Poliwag", rarity: "common" },
  61: { name: "Poliwhirl", rarity: "uncommon" },
  72: { name: "Tentacool", rarity: "common" },
  79: { name: "Slowpoke", rarity: "uncommon" },
  86: { name: "Seel", rarity: "common" },
  87: { name: "Dewgong", rarity: "uncommon" },
  90: { name: "Shellder", rarity: "common" },
  91: { name: "Cloyster", rarity: "rare" },
  98: { name: "Krabby", rarity: "common" },
  99: { name: "Kingler", rarity: "uncommon" },
  116: { name: "Horsea", rarity: "common" },
  117: { name: "Seadra", rarity: "rare" },
  118: { name: "Goldeen", rarity: "uncommon" },
  119: { name: "Seaking", rarity: "uncommon" },
  120: { name: "Staryu", rarity: "common" },
  121: { name: "Starmie", rarity: "rare" },
  129: { name: "Magikarp", rarity: "common" },
  130: { name: "Gyarados", rarity: "epic" },
  131: { name: "Lapras", rarity: "epic" },
  134: { name: "Vaporeon", rarity: "epic" },
  138: { name: "Omanyte", rarity: "uncommon" },
  140: { name: "Kabuto", rarity: "uncommon" },
  147: { name: "Dratini", rarity: "epic" },
  148: { name: "Dragonair", rarity: "epic" },
};

export const RODS = [
  {
    id: "old",
    name: "Old Rod",
    blurb: "Plain bamboo. Slow reel, narrow band.",
    price: 0,
    wait: 1,
    band: [0.35, 0.7],
    window: 700,
    progress: 1,
  },
  {
    id: "good",
    name: "Good Rod",
    blurb: "Graphite blank. Faster reel, wider band.",
    price: 300,
    wait: 0.8,
    band: [0.32, 0.73],
    window: 600,
    progress: 1.15,
  },
  {
    id: "super",
    name: "Super Rod",
    blurb: "Instrument grade. Quickest reel, calmest wait.",
    price: 900,
    wait: 0.62,
    band: [0.28, 0.78],
    window: 500,
    progress: 1.3,
  },
];

export const BAIT = [
  {
    id: "none",
    name: "No bait",
    blurb: "Bare hook.",
    price: 0,
    wait: 1,
    thrash: 1,
    rare: 1,
  },
  {
    id: "oran",
    name: "Oran Bait",
    blurb: "Fish come sooner.",
    price: 40,
    wait: 0.72,
    thrash: 1,
    rare: 1,
  },
  {
    id: "pecha",
    name: "Pecha Bait",
    blurb: "Calmer thrashes.",
    price: 60,
    wait: 0.9,
    thrash: 0.6,
    rare: 1,
  },
  {
    id: "razz",
    name: "Razz Bait",
    blurb: "Tilts the pool toward rare species.",
    price: 120,
    wait: 0.9,
    thrash: 1.05,
    rare: 1.9,
  },
];

export const SCORE = {
  sizeMin: 0.7,
  sizeMax: 1.6,
  perfectMultiplier: 0.5,
  hookBonus: 1.2,
  comboStep: 0.25,
  comboCap: 2.5,
  shinyMultiplier: 10,
  shinyChance: 1 / 64,
  recordBonus: 500,
  luckyRefundChance: 1,
  bossBase: 3000,
  junkChance: 0.06,
  tentacoolSteal: 0.15,
  surveyBonus: 1000,
  coinsPerPoint: 0.1,
};

/* The five stages. `art` names the bake routine in game.js; everything else
   is data. thresholds are the 1/2/3-star score gates. */
export const LEVELS = [
  {
    id: "viridian",
    short: "L1 · VIRIDIAN POND",
    name: "Viridian Pond",
    look: "Reed bank, lily pads, one swaying tree.",
    art: "pond",
    targets: [118, 54, 98],
    thresholds: [1500, 3500, 6000],
    palette: {
      water: [62, 134, 132],
      waterDeep: [40, 104, 116],
      shore: [96, 132, 66],
      grass: [128, 162, 76],
      sand: [232, 223, 196],
      rock: [150, 148, 130],
      leaf: { deep: [42, 72, 56], mid: [74, 108, 64], silver: [116, 142, 86] },
    },
    pool: [129, 60, 118, 54, 98],
  },
  {
    id: "cerulean",
    short: "L2 · CERULEAN CAPE",
    name: "Cerulean Cape",
    look: "Open blue water, cliff shelf, small lighthouse.",
    art: "cape",
    targets: [116, 90, 79],
    thresholds: [2000, 4200, 7000],
    palette: {
      water: [56, 122, 168],
      waterDeep: [38, 92, 140],
      shore: [104, 136, 78],
      grass: [124, 158, 82],
      sand: [232, 224, 198],
      rock: [146, 150, 138],
      leaf: { deep: [40, 66, 52], mid: [72, 100, 66], silver: [118, 140, 96] },
    },
    pool: [118, 119, 116, 120, 72, 90, 79],
  },
  {
    id: "vermilion",
    short: "L3 · VERMILION DOCK",
    name: "Vermilion Dock",
    look: "Sunset water, plank pier, crates and a lantern.",
    art: "dock",
    targets: [99, 117, 121],
    thresholds: [2500, 5000, 8000],
    palette: {
      water: [108, 96, 96],
      waterDeep: [70, 70, 92],
      shore: [120, 116, 66],
      grass: [146, 152, 80],
      sand: [236, 214, 178],
      rock: [150, 132, 110],
      leaf: { deep: [64, 60, 52], mid: [112, 92, 58], silver: [170, 134, 76] },
    },
    pool: [98, 99, 72, 117, 121, 55, 61],
  },
  {
    id: "seafoam",
    short: "L4 · SEAFOAM CAVERN",
    name: "Seafoam Cavern",
    look: "Cold water, ice floes, icicles, cave shadow.",
    art: "cavern",
    targets: [86, 91, 131],
    thresholds: [3000, 6000, 9500],
    palette: {
      water: [70, 112, 138],
      waterDeep: [46, 78, 106],
      shore: [140, 156, 164],
      grass: [150, 168, 170],
      sand: [222, 234, 238],
      rock: [158, 174, 182],
      leaf: { deep: [46, 62, 74], mid: [92, 112, 120], silver: [166, 190, 194] },
    },
    pool: [86, 87, 90, 91, 147, 131],
  },
  {
    id: "cinnabar",
    short: "L5 · CINNABAR NIGHT TIDE",
    name: "Cinnabar Night Tide",
    look: "Violet night, moon reflection, glowing jellies.",
    art: "night",
    targets: [130, 138, 140],
    thresholds: [3500, 7000, 11000],
    palette: {
      water: [42, 48, 92],
      waterDeep: [26, 30, 62],
      shore: [52, 60, 74],
      grass: [44, 52, 66],
      sand: [92, 96, 120],
      rock: [70, 72, 92],
      leaf: { deep: [30, 38, 58], mid: [54, 62, 94], silver: [104, 96, 132] },
    },
    pool: [148, 130, 134, 138, 140, 131, 121],
  },
];

/* --- helpers --------------------------------------------------------- */

export function zoneFor(power) {
  const value = Math.max(0, Math.min(1, power));
  return ZONES.find((zone) => value < zone.to) ?? ZONES[ZONES.length - 1];
}

export function speciesInfo(id) {
  return SPECIES[id] ?? { name: `#${id}`, rarity: "common" };
}

export function canUnlock(index, progress) {
  if (index === 0) return true;
  const previous = LEVELS[index - 1];
  return (progress?.levels?.[previous.id]?.stars ?? 0) >= 1;
}

export function starsFor(level, score) {
  const [one, two, three] = level.thresholds;
  if (score >= three) return 3;
  if (score >= two) return 2;
  if (score >= one) return 1;
  return 0;
}

export function rodById(id) {
  return RODS.find((rod) => rod.id === id) ?? RODS[0];
}

export function baitById(id) {
  return BAIT.find((bait) => bait.id === id) ?? BAIT[0];
}

/* Species weights for one zone, after bait and the shiny-free rarity tilt. */
export function poolFor(level, zoneId, rareTilt = 1) {
  const zoneWeights = ZONE_WEIGHT[zoneId] ?? ZONE_WEIGHT.mid;
  return level.pool
    .map((id) => {
      const rarity = speciesInfo(id).rarity;
      const zoneWeight = zoneWeights[rarity] ?? 1;
      const tilt = rarity === "epic" || rarity === "rare" ? rareTilt : 1;
      return { id, rarity, weight: RARITY[rarity].weight * zoneWeight * tilt };
    })
    .filter((entry) => entry.weight > 0);
}

export function pickWeighted(entries, roll) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let ticket = roll * total;
  for (const entry of entries) {
    ticket -= entry.weight;
    if (ticket <= 0) return entry;
  }
  return entries[entries.length - 1];
}
