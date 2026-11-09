/* Team report maths. Everything the report shows is derived here from the
   caught team, so re-ordering or swapping a member updates every panel
   without touching a component. No DOM, no React. */

/* Ranks are kept in one table so the thresholds are a one-line edit. A score
   falls in the first band whose `max` it sits under. */
export const RANKS = [
  { max: 30, title: "Youngster", note: "A first lap of the tall grass." },
  { max: 45, title: "Bug Catcher", note: "Keen, but the net is still small." },
  { max: 60, title: "Trainer", note: "A solid, workable six." },
  { max: 72, title: "Ace Trainer", note: "Coverage is starting to bite." },
  { max: 85, title: "Gym Leader", note: "A team built to hold a room." },
  { max: 93, title: "Elite Four", note: "Almost nothing falls through." },
  { max: Infinity, title: "Champion", note: "No gap left to exploit." },
];

/* How the type ratio is worded. Thresholds on distinct / type slots. */
export const BALANCE_BANDS = [
  { min: 0.85, label: "Well balanced" },
  { min: 0.58, label: "Fairly balanced" },
  { min: 0, label: "Lopsided" },
];

/* The three scoring weights. They add up to 100. */
export const SCORE_WEIGHTS = {
  power: 60,
  variety: 25,
  balance: 15,
};

/* Power is the team's average base stat total mapped onto 0–1: 280 is the
   floor (a team of Magikarp) and 500 the ceiling (a team of legendaries). */
export const POWER_RANGE = { floor: 280, span: 220 };

const clamp01 = (value) => Math.min(1, Math.max(0, value));

export function rankFor(score) {
  return RANKS.find((band) => score < band.max) ?? RANKS[RANKS.length - 1];
}

/**
 * @typedef {Object} TeamMember
 * @property {number} id
 * @property {string} name
 * @property {string} [number]  dex number already formatted (#025)
 * @property {string[]} types  primary type first
 * @property {number} bst      base stat total
 */

/**
 * @param {TeamMember[]} team
 */
export function computeTeamReport(team = []) {
  /* Only members whose PokéAPI facts have landed can be scored; a member
     still in flight would otherwise drag the averages to zero. */
  const members = team.filter(
    (mon) => mon && Array.isArray(mon.types) && mon.types.length && mon.bst > 0,
  );
  const count = members.length;

  const totalBST = members.reduce((sum, mon) => sum + mon.bst, 0);
  const average = count ? Math.round(totalBST / count) : 0;

  const spreadMap = new Map();
  members.forEach((mon) => {
    mon.types.forEach((type) => {
      spreadMap.set(type, (spreadMap.get(type) ?? 0) + 1);
    });
  });

  const slots = [...spreadMap.values()].reduce((sum, value) => sum + value, 0);
  const distinct = spreadMap.size;

  const spread = [...spreadMap.entries()]
    .map(([type, used]) => ({
      type,
      count: used,
      share: slots ? used / slots : 0,
    }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));

  const duplicates = spread.filter((slice) => slice.count > 1);
  const ratio = slots ? distinct / slots : 0;

  const power =
    clamp01((average - POWER_RANGE.floor) / POWER_RANGE.span) * SCORE_WEIGHTS.power;
  const variety =
    (Math.min(distinct, 6) / 6) * SCORE_WEIGHTS.variety;
  const balance = ratio * SCORE_WEIGHTS.balance;
  const score = count ? Math.round(power + variety + balance) : 0;

  const strongest = count
    ? members.reduce((best, mon) => (mon.bst > best.bst ? mon : best))
    : null;
  const weakest = count
    ? members.reduce((worst, mon) => (mon.bst < worst.bst ? mon : worst))
    : null;

  const label =
    BALANCE_BANDS.find((band) => ratio >= band.min)?.label ?? "Lopsided";

  const repeated = duplicates.slice(0, 2).map((slice) => slice.type);
  const tip = duplicates.length
    ? `${repeated.join(" and ")} ${repeated.length > 1 ? "show" : "shows"} up more than once. Swap one out to cover a new type.`
    : "No repeated types — every slot is pulling its weight.";

  return {
    count,
    members,
    totalBST,
    average,
    score,
    rank: rankFor(score),
    strongest,
    strongestDelta: strongest ? strongest.bst - average : 0,
    weakest,
    weakestDelta: weakest ? weakest.bst - average : 0,
    spread,
    distinct,
    slots,
    balance: { ratio, label, tip, duplicates },
    parts: {
      power: Math.round(power),
      variety: Math.round(variety),
      balance: Math.round(balance),
    },
  };
}
