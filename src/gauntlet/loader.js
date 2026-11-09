/* PokéAPI loading for the gauntlet. Everything is cached in memory for the
   life of the page: no localStorage, no files. A combatant is only assembled
   once the moves its level allows are known.

   Move values are the Red/Blue ones. PokéAPI reports the modern numbers, but
   every change also appears in `past_values`; applying those in reverse
   release order rewinds a move to its Gen 1 state (Tackle 35/95, Vine Whip 35
   power for 10 PP, Rock Throw 65% accuracy, and so on). */

import {
  fetchEvolution,
  fetchPokemon,
  fetchSpecies,
  formatNumber,
  pixelSpriteUrl,
  titleCase,
} from "../api.js";
import { GEN1_TYPES, statsFor } from "./gen1Battle.js";

const API_ROOT = "https://pokeapi.co/api/v2";
const SPRITE_ROOT =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

/* The badge sheet is the trainer-card strip from pret/pokered: sixteen 16x16
   tiles stacked vertically, badges on the odd indices. */
export const BADGE_SHEET =
  "https://raw.githubusercontent.com/pret/pokered/master/gfx/trainer_card/badges.png";

export const backSpriteUrl = (id) =>
  `${SPRITE_ROOT}/versions/generation-i/red-blue/back/${id}.png`;

/* Release order, oldest first. Used to rewind past_values to Gen 1. */
const VERSION_GROUPS = [
  "red-blue",
  "yellow",
  "gold-silver",
  "crystal",
  "ruby-sapphire",
  "emerald",
  "firered-leafgreen",
  "diamond-pearl",
  "platinum",
  "heartgold-soulsilver",
  "black-white",
  "black-2-white-2",
  "x-y",
  "omega-ruby-alpha-sapphire",
  "sun-moon",
  "ultra-sun-ultra-moon",
  "lets-go-pikachu-lets-go-eevee",
  "sword-shield",
  "brilliant-diamond-shining-pearl",
  "legends-arceus",
  "scarlet-violet",
];

const moveCache = new Map();

function request(url) {
  return fetch(url).then((response) => {
    if (!response.ok) throw new Error(`PokéAPI answered ${response.status}`);
    return response.json();
  });
}

/* Status moves the engine understands. The damage-first AI never selects
   them, but keeping the mapping here means a forced move still works. */
const EFFECTS = {
  "sleep-powder": { status: "sleep", chance: 100 },
  hypnosis: { status: "sleep", chance: 60 },
  sing: { status: "sleep", chance: 55 },
  spore: { status: "sleep", chance: 100 },
  "thunder-wave": { status: "paralysis", chance: 100 },
  "stun-spore": { status: "paralysis", chance: 75 },
  glare: { status: "paralysis", chance: 75 },
  "poison-powder": { status: "poison", chance: 75 },
  "poison-gas": { status: "poison", chance: 55 },
  toxic: { status: "toxic", chance: 90 },
  "body-slam": { status: "paralysis", chance: 30 },
};

export function gen1MoveValues(move) {
  const values = {
    power: move.power ?? 0,
    accuracy: move.accuracy ?? 100,
    pp: move.pp ?? 0,
    type: move.type?.name ?? "normal",
    priority: move.priority ?? 0,
  };

  const changes = (move.past_values ?? [])
    .map((entry) => ({
      ...entry,
      rank: VERSION_GROUPS.indexOf(entry.version_group?.name ?? ""),
    }))
    .filter((entry) => entry.rank >= 0)
    .sort((a, b) => b.rank - a.rank);

  changes.forEach((entry) => {
    if (entry.power != null) values.power = entry.power;
    if (entry.accuracy != null) values.accuracy = entry.accuracy;
    if (entry.pp != null) values.pp = entry.pp;
    if (entry.type?.name) values.type = entry.type.name;
    if (entry.priority != null) values.priority = entry.priority;
  });

  return values;
}

export async function loadMove(name) {
  if (!moveCache.has(name)) {
    moveCache.set(
      name,
      request(`${API_ROOT}/move/${name}`).then((data) => ({
        name: titleCase(data.name),
        ...gen1MoveValues(data),
        effect: EFFECTS[data.name] ?? null,
      })),
    );
  }
  return moveCache.get(name);
}

/* The last four level-up moves a Pokémon would know at this level, per the
   Red/Blue learnsets. */
export function levelUpMoves(pokemon, level) {
  const learned = [];

  (pokemon.moves ?? []).forEach((entry, index) => {
    const detail = (entry.version_group_details ?? []).find(
      (item) =>
        item.version_group?.name === "red-blue" &&
        item.move_learn_method?.name === "level-up" &&
        item.level_learned_at <= level,
    );
    if (detail) {
      learned.push({
        name: entry.move.name,
        level: detail.level_learned_at,
        order: index,
      });
    }
  });

  return learned
    .sort((a, b) => a.level - b.level || a.order - b.order)
    .slice(-4)
    .map((entry) => entry.name);
}

function baseStatsOf(pokemon) {
  const stat = (name) => pokemon.stats.find((item) => item.stat.name === name)?.base_stat ?? 0;
  return {
    hp: stat("hp"),
    attack: stat("attack"),
    defense: stat("defense"),
    special: stat("special-attack"),
    speed: stat("speed"),
  };
}

export async function buildCombatant(id, level, { name, specialMove } = {}) {
  const pokemon = await fetchPokemon(id);
  /* Red/Blue had no Steel or Fairy, and PokéAPI reports modern typings:
     Magnemite must be pure Electric and Mr. Mime pure Psychic. */
  const types = [...(pokemon.types ?? [])]
    .sort((a, b) => a.slot - b.slot)
    .map((entry) => entry.type.name)
    .filter((type) => GEN1_TYPES.includes(type));

  let moveNames = levelUpMoves(pokemon, level);

  /* special_moves.asm replaces the last move slot with the leader's one move. */
  if (specialMove) {
    moveNames = moveNames.length >= 4
      ? [...moveNames.slice(0, 3), specialMove]
      : [...moveNames, specialMove];
    moveNames = [...new Set(moveNames)].slice(-4);
  }

  const moves = (await Promise.all(moveNames.map((move) => loadMove(move)))).filter(
    Boolean,
  );

  const base = baseStatsOf(pokemon);

  return {
    id,
    name: name ?? titleCase(pokemon.name),
    number: formatNumber(id),
    level,
    types,
    base,
    /* The UI needs the level-scaled stats (HP bars, speed line); the engine
       recomputes them itself, so both read the same numbers. */
    stats: statsFor({ base, level }),
    moves,
    sprite: pixelSpriteUrl(id),
    back: backSpriteUrl(id),
  };
}

const idFromUrl = (url) => Number(String(url).split("/").filter(Boolean).pop());

function findChainNode(node, id) {
  if (!node) return null;
  if (idFromUrl(node.species.url) === id) return node;
  for (const child of node.evolves_to ?? []) {
    const hit = findChainNode(child, id);
    if (hit) return hit;
  }
  return null;
}

/* Gen 1 evolution gates: level-ups at their level, stones once three badges
   are in hand, trades once five are. */
function evolutionAllowed(details, level, badges) {
  if (!details) return false;
  const trigger = details.trigger?.name;
  if (trigger === "level-up") return (details.min_level ?? 0) <= level;
  if (trigger === "use-item") return badges.length >= 3;
  if (trigger === "trade") return badges.length >= 5;
  return false;
}

export async function resolveEvolution(member, level, badges) {
  let speciesId = member.id;
  let speciesName = member.name;
  let growth = null;

  for (let hop = 0; hop < 2; hop += 1) {
    const species = await fetchSpecies(speciesId);
    const chain = await fetchEvolution(species.evolution_chain.url);
    const node = findChainNode(chain.chain, speciesId);
    const next = (node?.evolves_to ?? []).find((child) =>
      evolutionAllowed(child.evolution_details?.[0], level, badges),
    );
    if (!next) break;

    const nextId = idFromUrl(next.species.url);
    const [beforeMon, afterMon] = await Promise.all([
      fetchPokemon(speciesId),
      fetchPokemon(nextId),
    ]);
    const beforeBase = baseStatsOf(beforeMon);
    const afterBase = baseStatsOf(afterMon);

    growth = {
      from: { id: speciesId, name: speciesName },
      to: { id: nextId, name: titleCase(next.species.name) },
      level,
      before: statsFor({ base: beforeBase, level }),
      after: statsFor({ base: afterBase, level }),
    };

    speciesId = nextId;
    speciesName = titleCase(next.species.name);
  }

  return { id: speciesId, name: speciesName, growth };
}

/* Levels the caught team to the gym's cap, evolving where the chain allows. */
export async function prepareTeam(members, { level, badges = [], onStep } = {}) {
  const team = [];
  const growth = [];
  let done = 0;

  await Promise.all(
    members.slice(0, 6).map(async (member, index) => {
      const resolved = await resolveEvolution(member, level, badges);
      team[index] = await buildCombatant(resolved.id, level, {
        name: resolved.name,
      });
      if (resolved.growth) growth.push(resolved.growth);
      done += 1;
      onStep?.(done / Math.min(members.length, 6));
    }),
  );

  return { team, growth };
}

export async function prepareGym(gym, { onStep } = {}) {
  const team = [];
  let done = 0;
  const total = gym.team.length;

  await Promise.all(
    gym.team.map(async (member, index) => {
      const special =
        gym.specialMove?.specialSlot === index ? gym.specialMove.move : null;
      team[index] = await buildCombatant(member.id, member.level, {
        name: member.name,
        specialMove: special,
      });
      done += 1;
      onStep?.(done / total);
    }),
  );

  return team;
}
