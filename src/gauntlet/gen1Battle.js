/* Gen 1 battle engine. Pure JavaScript: no DOM, no React, no network.
   The loader hands in combatants that already have their Red/Blue moves, and
   this module resolves the fight from a seed so the same battle can be
   replayed exactly.

   Rules follow the cartridge:
   - one Special stat, used for both special attack and special defense
   - damage = floor(floor(floor(2L/5+2) * power * A/D) / 50) + 2, then STAB,
     type effectiveness and the 217–255 roll
   - crits happen at baseSpeed/512 and use 2L in the formula
   - the move's own type decides physical or special
   - priority first, then speed; ties are broken by the seeded RNG
   - the AI picks whichever move has the highest expected damage
*/

/* The fifteen types Red/Blue shipped with. Dark, Steel and Fairy did not
   exist yet, so they never appear in this chart or in any roster. */
export const GEN1_TYPES = [
  "normal",
  "fighting",
  "flying",
  "poison",
  "ground",
  "rock",
  "bug",
  "ghost",
  "fire",
  "water",
  "grass",
  "electric",
  "psychic",
  "ice",
  "dragon",
];

/* Only non-neutral matchups are stored. Values come from PokéAPI's
   past_damage_relations for generation-i, which is where the Gen 1 quirks
   live: Ghost does nothing to Psychic, Bug hits Poison for 2×, Poison hits
   Bug for 2×, and Ice is neutral against Fire. */
export const GEN1_CHART = {
  normal: { rock: 0.5, ghost: 0 },
  fighting: {
    normal: 2,
    rock: 2,
    ice: 2,
    flying: 0.5,
    poison: 0.5,
    bug: 0.5,
    psychic: 0.5,
    ghost: 0,
  },
  flying: { fighting: 2, bug: 2, grass: 2, rock: 0.5, electric: 0.5 },
  poison: { grass: 2, bug: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5 },
  ground: {
    poison: 2,
    rock: 2,
    fire: 2,
    electric: 2,
    bug: 0.5,
    grass: 0.5,
    flying: 0,
  },
  rock: { flying: 2, bug: 2, fire: 2, ice: 2, fighting: 0.5, ground: 0.5 },
  bug: {
    grass: 2,
    psychic: 2,
    poison: 2,
    fighting: 0.5,
    flying: 0.5,
    ghost: 0.5,
    fire: 0.5,
  },
  ghost: { ghost: 2, normal: 0, psychic: 0 },
  fire: { bug: 2, grass: 2, ice: 2, rock: 0.5, fire: 0.5, water: 0.5, dragon: 0.5 },
  water: { ground: 2, rock: 2, fire: 2, water: 0.5, grass: 0.5, dragon: 0.5 },
  grass: {
    ground: 2,
    rock: 2,
    water: 2,
    flying: 0.5,
    poison: 0.5,
    bug: 0.5,
    fire: 0.5,
    grass: 0.5,
    dragon: 0.5,
  },
  electric: { flying: 2, water: 2, grass: 0.5, electric: 0.5, dragon: 0.5, ground: 0 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5 },
  ice: { flying: 2, ground: 2, grass: 2, dragon: 2, water: 0.5, ice: 0.5 },
  dragon: { dragon: 2 },
};

/* Gen 1 decides physical or special from the move's type, not the move. */
export const PHYSICAL_TYPES = new Set([
  "normal",
  "fighting",
  "flying",
  "poison",
  "ground",
  "rock",
  "bug",
  "ghost",
]);

/* Badge boosts from Red/Blue's trainer card: each earned badge adds 12.5% to
   one stat. Only four badges did anything. */
export const BADGE_BOOSTS = {
  boulder: "attack",
  thunder: "defense",
  soul: "speed",
  volcano: "special",
};

export const BADGE_BOOST_RATE = 0.125;

/* DV 8 / statExp 0 is the neutral cartridge spread. */
const DV = 8;
const STAT_EXP = 0;

export const STRUGGLE = {
  name: "Struggle",
  type: "normal",
  power: 50,
  accuracy: 100,
  priority: 0,
};

export function typeMultiplier(moveType, defenderTypes = []) {
  const row = GEN1_CHART[moveType] ?? {};
  return defenderTypes.reduce((product, type) => product * (row[type] ?? 1), 1);
}

export function isCritical(baseSpeed, rng) {
  return rng() < baseSpeed / 512;
}

/* mulberry32: small, fast, and identical across browsers, so a seed is all a
   replay needs. */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function gen1Stat(base, level, { hp = false } = {}) {
  const core = Math.floor(
    (((base + DV) * 2 + Math.floor(Math.sqrt(STAT_EXP) / 4)) * level) / 100,
  );
  return hp ? core + level + 10 : core + 5;
}

export function statsFor(mon) {
  return {
    maxHp: gen1Stat(mon.base.hp, mon.level, { hp: true }),
    attack: gen1Stat(mon.base.attack, mon.level),
    defense: gen1Stat(mon.base.defense, mon.level),
    special: gen1Stat(mon.base.special, mon.level),
    speed: gen1Stat(mon.base.speed, mon.level),
  };
}

export function multipliersForBadges(badges = []) {
  const multipliers = { attack: 1, defense: 1, special: 1, speed: 1 };
  badges.forEach((badge) => {
    const stat = BADGE_BOOSTS[badge];
    if (stat) multipliers[stat] += BADGE_BOOST_RATE;
  });
  return multipliers;
}

function applyBoost(stats, multipliers) {
  return {
    maxHp: stats.maxHp,
    attack: Math.floor(stats.attack * (multipliers.attack ?? 1)),
    defense: Math.floor(stats.defense * (multipliers.defense ?? 1)),
    special: Math.floor(stats.special * (multipliers.special ?? 1)),
    speed: Math.floor(stats.speed * (multipliers.speed ?? 1)),
  };
}

const normalizeMove = (move) => ({
  name: move.name,
  type: move.type,
  power: move.power ?? 0,
  accuracy: move.accuracy ?? 100,
  priority: move.priority ?? 0,
});

function makeSide(team, side, multipliers) {
  return {
    side,
    active: 0,
    team: team.map((mon) => {
      const stats = applyBoost(statsFor(mon), multipliers);
      return {
        id: mon.id,
        name: mon.name,
        level: mon.level,
        types: mon.types.slice(),
        base: { ...mon.base },
        moves: mon.moves.map(normalizeMove),
        stats,
        hp: stats.maxHp,
        dealt: 0,
        taken: 0,
        kos: 0,
        fainted: false,
      };
    }),
  };
}

const activeOf = (side) => side.team[side.active] ?? null;
const aliveOf = (side) => side.team.some((mon) => !mon.fainted);

/* Expected damage, used only to rank the AI's options. The random roll is
   averaged and accuracy is folded in so a strong-but-inaccurate move is not
   automatically preferred over a reliable one. */
export function expectedDamage(attacker, defender, move) {
  if (!move.power) return -1;
  const effectiveness = typeMultiplier(move.type, defender.types);
  if (effectiveness === 0) return -1;

  const physical = PHYSICAL_TYPES.has(move.type);
  const attack = physical ? attacker.stats.attack : attacker.stats.special;
  const defense = physical ? defender.stats.defense : defender.stats.special;
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;

  const base =
    Math.floor(
      Math.floor(
        (Math.floor((2 * attacker.level) / 5 + 2) * move.power * attack) / defense,
      ) / 50,
    ) + 2;

  return base * stab * effectiveness * (move.accuracy / 100) * (236 / 255);
}

export function chooseMove(attacker, defender) {
  let best = null;
  let bestScore = -1;

  attacker.moves.forEach((move) => {
    const score = expectedDamage(attacker, defender, move);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  });

  /* Nothing damaging left: the cartridge forces Struggle. */
  return best ?? STRUGGLE;
}

function damageFor({ attacker, defender, move, crit, rng }) {
  const physical = PHYSICAL_TYPES.has(move.type);
  const attack = physical ? attacker.stats.attack : attacker.stats.special;
  const defense = physical ? defender.stats.defense : defender.stats.special;
  const level = crit ? attacker.level * 2 : attacker.level;
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  const effectiveness = typeMultiplier(move.type, defender.types);

  if (effectiveness === 0) return 0;

  const beforeRoll =
    Math.floor(
      Math.floor((Math.floor((2 * level) / 5 + 2) * move.power * attack) / defense) /
        50,
    ) + 2;
  const roll = 217 + Math.floor(rng() * 39);
  const rolled = beforeRoll * stab * effectiveness * (roll / 255);

  return Math.max(1, Math.floor(rolled));
}

/**
 * @typedef {Object} Combatant
 * @property {number} id
 * @property {string} name
 * @property {number} level
 * @property {string[]} types
 * @property {{hp:number,attack:number,defense:number,special:number,speed:number}} base
 * @property {{name:string,type:string,power:number,accuracy:number,priority?:number}[]} moves
 */

/**
 * Resolve one battle.
 * @param {Combatant[]} playerTeam
 * @param {Combatant[]} enemyTeam
 * @param {{seed?:number, multipliers?:object, maxTurns?:number}} options
 */
export function runBattle(playerTeam, enemyTeam, options = {}) {
  const { seed = 1, multipliers = {}, maxTurns = 400 } = options;

  if (!playerTeam?.length || !enemyTeam?.length) {
    throw new Error("runBattle needs a non-empty team on both sides");
  }

  const rng = mulberry32(seed);
  const player = makeSide(playerTeam, "player", multipliers);
  const enemy = makeSide(enemyTeam, "enemy", {});

  const log = [];
  let turn = 0;
  let winner = null;

  const record = (entry) => log.push(entry);

  while (turn < maxTurns) {
    turn += 1;

    const playerMon = activeOf(player);
    const enemyMon = activeOf(enemy);
    if (!playerMon || !enemyMon) break;

    const actions = [
      { side: "player", mon: playerMon, move: chooseMove(playerMon, enemyMon) },
      { side: "enemy", mon: enemyMon, move: chooseMove(enemyMon, playerMon) },
    ].map((action) => ({
      ...action,
      priority: action.move.priority ?? 0,
      speed: action.mon.stats.speed,
      tie: rng(),
    }));

    actions.sort(
      (a, b) => b.priority - a.priority || b.speed - a.speed || a.tie - b.tie,
    );

    for (const action of actions) {
      const attackerSide = action.side === "player" ? player : enemy;
      const defenderSide = action.side === "player" ? enemy : player;
      const attacker = action.mon;
      const defender = activeOf(defenderSide);

      if (attacker.hp <= 0 || !defender || defender.hp <= 0) continue;

      const move = action.move;
      const effectiveness = typeMultiplier(move.type, defender.types);
      const actorSlot = attackerSide.team.indexOf(attacker);
      const targetSlot = defenderSide.team.indexOf(defender);

      if (rng() * 100 >= move.accuracy) {
        record({
          kind: "move",
          turn,
          side: action.side,
          actor: attacker.name,
          actorSlot,
          target: defender.name,
          targetSlot,
          move: move.name,
          damage: 0,
          effectiveness,
          crit: false,
          miss: true,
          hpAfter: defender.hp,
          hpMax: defender.stats.maxHp,
          faint: false,
        });
        continue;
      }

      const crit = isCritical(attacker.base.speed, rng);
      const damage = damageFor({ attacker, defender, move, crit, rng });

      defender.hp = Math.max(0, defender.hp - damage);
      defender.taken += damage;
      attacker.dealt += damage;

      const fainted = defender.hp <= 0;

      record({
        kind: "move",
        turn,
        side: action.side,
        actor: attacker.name,
        actorSlot,
        target: defender.name,
        targetSlot,
        move: move.name,
        damage,
        effectiveness,
        crit,
        miss: false,
        hpAfter: defender.hp,
        hpMax: defender.stats.maxHp,
        faint: fainted,
      });

      if (!fainted) continue;

      defender.fainted = true;
      attacker.kos += 1;

      record({
        kind: "faint",
        turn,
        side: defenderSide.side,
        actor: defender.name,
        actorSlot: targetSlot,
        target: null,
        move: null,
        damage: 0,
        effectiveness: 1,
        crit: false,
        miss: false,
        hpAfter: 0,
        hpMax: defender.stats.maxHp,
        faint: true,
      });

      if (!aliveOf(defenderSide)) {
        winner = action.side;
        break;
      }

      defenderSide.active = defenderSide.team.findIndex((mon) => !mon.fainted);
      record({
        kind: "switch",
        turn,
        side: defenderSide.side,
        actor: activeOf(defenderSide).name,
        actorSlot: defenderSide.active,
        target: null,
        move: null,
        damage: 0,
        effectiveness: 1,
        crit: false,
        miss: false,
        hpAfter: activeOf(defenderSide).hp,
        hpMax: activeOf(defenderSide).stats.maxHp,
        faint: false,
      });
    }

    if (winner) break;
    if (!aliveOf(player) || !aliveOf(enemy)) break;
  }

  const perPokemon = [
    ...player.team.map((mon) => ({ side: "player", ...mon })),
    ...enemy.team.map((mon) => ({ side: "enemy", ...mon })),
  ].map((mon) => ({
    side: mon.side,
    id: mon.id,
    name: mon.name,
    level: mon.level,
    damageDealt: mon.dealt,
    damageTaken: mon.taken,
    kos: mon.kos,
    fainted: mon.fainted,
    hpLeft: mon.hp,
    maxHp: mon.stats.maxHp,
  }));

  const playerMon = perPokemon.filter((mon) => mon.side === "player");
  const enemyMon = perPokemon.filter((mon) => mon.side === "enemy");

  const mvp =
    perPokemon
      .filter((mon) => mon.side === "player")
      .sort((a, b) => b.damageDealt - a.damageDealt || b.kos - a.kos)[0] ?? null;

  const keyMoments = buildKeyMoments(log);

  return {
    seed,
    winner: winner ?? "draw",
    turns: turn,
    log,
    summary: {
      winner: winner ?? "draw",
      turns: turn,
      playerLeft: playerMon.filter((mon) => !mon.fainted).length,
      enemyLeft: enemyMon.filter((mon) => !mon.fainted).length,
      damageDealt: playerMon.reduce((sum, mon) => sum + mon.damageDealt, 0),
      damageTaken: playerMon.reduce((sum, mon) => sum + mon.damageTaken, 0),
      perPokemon,
      mvp,
      keyMoments,
    },
  };
}

/* A handful of sentences the results screen can lean on. Kept structured so a
   later panel can reword or reorder them without parsing strings. */
function buildKeyMoments(log) {
  const moments = [];

  const firstCrit = log.find((entry) => entry.crit && entry.damage > 0);
  if (firstCrit) {
    moments.push({
      kind: "crit",
      turn: firstCrit.turn,
      actor: firstCrit.actor,
      text: `${firstCrit.actor}'s ${firstCrit.move} landed a critical hit for ${firstCrit.damage}.`,
    });
  }

  const best = log
    .filter((entry) => entry.kind === "move" && entry.damage > 0)
    .sort((a, b) => b.damage - a.damage)[0];
  if (best) {
    moments.push({
      kind: "biggest-hit",
      turn: best.turn,
      actor: best.actor,
      text: `${best.actor} hit ${best.target} for ${best.damage} with ${best.move}${
        best.effectiveness > 1 ? ` (${best.effectiveness}×)` : ""
      }.`,
    });
  }

  const firstFaint = log.find((entry) => entry.kind === "faint");
  if (firstFaint) {
    moments.push({
      kind: "faint",
      turn: firstFaint.turn,
      actor: firstFaint.actor,
      text: `${firstFaint.actor} went down on turn ${firstFaint.turn}.`,
    });
  }

  const finalBlow = [...log]
    .reverse()
    .find((entry) => entry.kind === "move" && entry.faint);
  if (finalBlow) {
    moments.push({
      kind: "final-blow",
      turn: finalBlow.turn,
      actor: finalBlow.actor,
      text: `${finalBlow.actor} finished it with ${finalBlow.move}.`,
    });
  }

  return moments;
}
