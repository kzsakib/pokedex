/* Type accents replace the single orange indicator colour: the selected
   specimen's primary type drives lamps, focus rings, dial mark, radar and
   meter highlights. Values are darkened so they hold contrast on the grey
   chassis, with a lighter mix for the dark screen. */

const ACCENTS = {
  normal: "#6f7576",
  fire: "#cf451c",
  water: "#2c6ea8",
  electric: "#9a7200",
  grass: "#3f7a3c",
  ice: "#2f7f95",
  fighting: "#a3352c",
  poison: "#7b3a94",
  ground: "#86611f",
  flying: "#5f78a4",
  psychic: "#ad3468",
  bug: "#5d7a28",
  rock: "#77664a",
  ghost: "#56458a",
  dragon: "#3f53a3",
};

export const FALLBACK_ACCENT = "#f15b22";

function toRgb(hex) {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function toHex(channels) {
  return `#${channels
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function mix(from, to, ratio) {
  const a = toRgb(from);
  const b = toRgb(to);
  return toHex(a.map((channel, index) => channel + (b[index] - channel) * ratio));
}

export function typeAccent(type) {
  return ACCENTS[type] ?? FALLBACK_ACCENT;
}

export function accentVars(type) {
  const base = typeAccent(type);
  return {
    "--accent": base,
    "--accent-soft": mix(base, "#ffffff", 0.4),
    "--accent-deep": mix(base, "#0b1115", 0.22),
  };
}
