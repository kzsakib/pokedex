import { runBattle } from "./gen1Battle.js";

/* Red/Blue move values, kept exactly as the cartridge had them. PokéAPI's
   /move endpoint reports the modern numbers, so anything that changed is
   pinned here: Tackle is 35/95, Vine Whip is 35 power for 10 PP, Bubble is 20
   power, Rock Throw is 65% accurate and Bind is 75%. The real loader will read
   these from past_values; this fixture exists so the engine can be exercised
   before that loader is wired up. */
const TACKLE = { name: "Tackle", type: "normal", power: 35, accuracy: 95 };
const GROWL = { name: "Growl", type: "normal", power: 0, accuracy: 100 };
const DEFENSE_CURL = { name: "Defense Curl", type: "normal", power: 0, accuracy: 100 };
const SCREECH = { name: "Screech", type: "normal", power: 0, accuracy: 85 };
const VINE_WHIP = { name: "Vine Whip", type: "grass", power: 35, accuracy: 100 };
const LEECH_SEED = { name: "Leech Seed", type: "grass", power: 0, accuracy: 90 };
const TAIL_WHIP = { name: "Tail Whip", type: "normal", power: 0, accuracy: 100 };
const BUBBLE = { name: "Bubble", type: "water", power: 20, accuracy: 100 };
const SCRATCH = { name: "Scratch", type: "normal", power: 40, accuracy: 100 };
const EMBER = { name: "Ember", type: "fire", power: 40, accuracy: 100 };

/* Brock, Pewter Gym. Parties from pret/pokered data/trainers/parties.asm;
   moves are the last four level-up moves at that level, plus his one
   special_moves.asm entry (Bide, Onix). Bide is non-damaging, so the v1
   engine never selects it. */
export const BROCK = {
  gym: "Pewter Gym",
  leader: "Brock",
  town: "Pewter City",
  type: "rock",
  badge: "boulder",
  badgeName: "Boulder Badge",
  team: [
    {
      id: 74,
      name: "Geodude",
      level: 12,
      types: ["rock", "ground"],
      base: { hp: 40, attack: 80, defense: 100, special: 30, speed: 20 },
      moves: [TACKLE, DEFENSE_CURL],
    },
    {
      id: 95,
      name: "Onix",
      level: 14,
      types: ["rock", "ground"],
      base: { hp: 35, attack: 45, defense: 160, special: 30, speed: 70 },
      moves: [TACKLE, SCREECH],
      specialMoves: ["Bide"],
    },
  ],
};

/* A stand-in player team at the gym's level cap (14). The caught team will
   replace this in the UI milestone. */
export const SAMPLE_TEAM = [
  {
    id: 1,
    name: "Bulbasaur",
    level: 14,
    types: ["grass", "poison"],
    base: { hp: 45, attack: 49, defense: 49, special: 65, speed: 45 },
    moves: [TACKLE, GROWL, LEECH_SEED, VINE_WHIP],
  },
  {
    id: 7,
    name: "Squirtle",
    level: 14,
    types: ["water"],
    base: { hp: 44, attack: 48, defense: 65, special: 50, speed: 43 },
    moves: [TACKLE, TAIL_WHIP, BUBBLE],
  },
  {
    id: 4,
    name: "Charmander",
    level: 14,
    types: ["fire"],
    base: { hp: 39, attack: 52, defense: 43, special: 60, speed: 65 },
    moves: [SCRATCH, GROWL, EMBER],
  },
];

export function brockFight(seed = 1337) {
  return runBattle(SAMPLE_TEAM, BROCK.team, { seed });
}

const percent = (mon) =>
  `${mon.hpLeft}/${mon.maxHp} HP${mon.fainted ? " · fainted" : ""}`;

export function formatEntry(entry) {
  if (entry.kind === "faint") return `  ${entry.actor} fainted.`;
  if (entry.kind === "switch") return `  ${entry.actor} was sent out.`;

  const who = entry.side === "player" ? "YOU" : "BROCK";
  const hit = entry.miss
    ? "missed"
    : `hit for ${entry.damage}${entry.crit ? " CRIT" : ""}${
        entry.effectiveness !== 1 ? ` (${entry.effectiveness}×)` : ""
      }`;

  return `T${entry.turn} ${who} ${entry.actor} — ${entry.move} ${hit} → ${entry.target} ${percent(
    { hpLeft: entry.hpAfter, maxHp: entry.hpMax, fainted: entry.faint },
  )}`;
}

export function logBrockFight(seed = 1337) {
  const result = brockFight(seed);

  console.log(`\n${BROCK.leader.toUpperCase()} — ${BROCK.gym} · seed ${seed}\n`);
  result.log.forEach((entry) => console.log(formatEntry(entry)));

  console.log(
    `\n${result.winner === "player" ? "YOU WIN" : "BROCK WINS"} in ${result.turns} turns`,
  );
  console.table(
    result.summary.perPokemon.map((mon) => ({
      side: mon.side,
      pokemon: mon.name,
      lv: mon.level,
      dealt: mon.damageDealt,
      taken: mon.damageTaken,
      kos: mon.kos,
      hp: `${mon.hpLeft}/${mon.maxHp}`,
    })),
  );
  result.summary.keyMoments.forEach((moment) => console.log(`· ${moment.text}`));

  return result;
}
