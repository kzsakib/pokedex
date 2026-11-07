/* Type effectiveness, Gen VI onward (18 types, Fairy included).
   Only non-neutral matchups are stored; everything else is 1×. */

export const TYPES = [
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
];

export const TYPE_ABBREVIATIONS = {
  normal: "NOR",
  fire: "FIR",
  water: "WAT",
  electric: "ELEC",
  grass: "GRA",
  ice: "ICE",
  fighting: "FIG",
  poison: "POI",
  ground: "GRO",
  flying: "FLY",
  psychic: "PSY",
  bug: "BUG",
  rock: "ROC",
  ghost: "GHO",
  dragon: "DRA",
  dark: "DAR",
  steel: "STE",
  fairy: "FAI",
};

const CHART = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: {
    fire: 0.5,
    water: 0.5,
    grass: 2,
    ice: 2,
    bug: 2,
    rock: 0.5,
    dragon: 0.5,
    steel: 2,
  },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: {
    water: 2,
    electric: 0.5,
    grass: 0.5,
    ground: 0,
    flying: 2,
    dragon: 0.5,
  },
  grass: {
    fire: 0.5,
    water: 2,
    grass: 0.5,
    poison: 0.5,
    ground: 2,
    flying: 0.5,
    bug: 0.5,
    rock: 2,
    dragon: 0.5,
    steel: 0.5,
  },
  ice: {
    fire: 0.5,
    water: 0.5,
    grass: 2,
    ice: 0.5,
    ground: 2,
    flying: 2,
    dragon: 2,
    steel: 0.5,
  },
  fighting: {
    normal: 2,
    ice: 2,
    poison: 0.5,
    flying: 0.5,
    psychic: 0.5,
    bug: 0.5,
    rock: 2,
    ghost: 0,
    dark: 2,
    steel: 2,
    fairy: 0.5,
  },
  poison: {
    grass: 2,
    poison: 0.5,
    ground: 0.5,
    rock: 0.5,
    ghost: 0.5,
    steel: 0,
    fairy: 2,
  },
  ground: {
    fire: 2,
    electric: 2,
    grass: 0.5,
    poison: 2,
    flying: 0,
    bug: 0.5,
    rock: 2,
    steel: 2,
  },
  flying: {
    electric: 0.5,
    grass: 2,
    fighting: 2,
    bug: 2,
    rock: 0.5,
    steel: 0.5,
  },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: {
    fire: 0.5,
    grass: 2,
    fighting: 0.5,
    poison: 0.5,
    flying: 0.5,
    psychic: 2,
    ghost: 0.5,
    dark: 2,
    steel: 0.5,
    fairy: 0.5,
  },
  rock: {
    fire: 2,
    ice: 2,
    fighting: 0.5,
    ground: 0.5,
    flying: 2,
    bug: 2,
    steel: 0.5,
  },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

/* Combined multiplier for an attacking type against one or two defenders. */
export function multiplierAgainst(attack, defenders) {
  const row = CHART[attack] ?? {};
  return defenders.reduce((product, defend) => product * (row[defend] ?? 1), 1);
}

/* The full 18-cell strip for a specimen: incoming damage per attacking type. */
export function matchupStrip(defenders) {
  return TYPES.map((attack) => ({
    type: attack,
    short: TYPE_ABBREVIATIONS[attack],
    multiplier: multiplierAgainst(attack, defenders),
  }));
}

export function multiplierTone(multiplier) {
  if (multiplier === 0) return "immune";
  if (multiplier < 0.5) return "resist-low";
  if (multiplier < 1) return "resist";
  if (multiplier === 1) return "neutral";
  if (multiplier < 4) return "weak";
  return "weak-high";
}

/* Decimal multipliers throughout: a fraction glyph is pretty but it reads
   slower than the number it stands for. */
export const formatMultiplier = (multiplier) => `${multiplier}×`;
