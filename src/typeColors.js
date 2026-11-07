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

/* Objects the UI actually paints behind type-coloured marks. Ink helpers
   below are checked against these, so a chip label is always readable on
   the surface it sits on. */
export const SURFACE_LIGHT = "#dde2e3";
export const SURFACE_DARK = "#171e22";

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

function relativeLuminance(hex) {
  const [r, g, b] = toRgb(hex).map((channel) => {
    const unit = channel / 255;
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/* WCAG 2.1 contrast ratio, 1–21. */
export function contrastRatio(a, b) {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

/* Walks a colour toward black or white until it clears the ratio. Used for
   every type-coloured label instead of trusting the raw accent. */
function settle(base, surface, target, min) {
  const key = `${base}|${surface}|${min}`;
  if (cachedInk.has(key)) return cachedInk.get(key);
  let ratio = 0;
  let current = base;
  for (let step = 0; step <= 1.0001; step += 0.04) {
    current = mix(base, target, step);
    ratio = contrastRatio(current, surface);
    if (ratio >= min) break;
  }
  if (ratio < min) current = target;
  cachedInk.set(key, current);
  return current;
}

const cachedInk = new Map();

export function typeAccent(type) {
  return ACCENTS[type] ?? FALLBACK_ACCENT;
}

/* Pale halo behind a sprite, so a hovered cell glows in its own type rather
   than the accent of whatever record happens to be loaded. */
export function softAccent(type) {
  return mix(typeAccent(type), "#ffffff", 0.4);
}

/* Label colour for type text on the light chassis. */
export function inkOnLight(type, min = 4.5) {
  return settle(typeAccent(type), SURFACE_LIGHT, "#0a0f12", min);
}

/* Label colour for type text inside the dark screen. */
export function inkOnDark(type, min = 4.5) {
  return settle(typeAccent(type), SURFACE_DARK, "#ffffff", min);
}

/* Non-text marks (dots, edges, stripes) only need 3:1 against their field. */
export function markOnLight(type) {
  return settle(typeAccent(type), SURFACE_LIGHT, "#0a0f12", 3);
}

export function markOnDark(type) {
  return settle(typeAccent(type), SURFACE_DARK, "#ffffff", 3);
}

export function accentVars(type) {
  const base = typeAccent(type);
  return {
    "--accent": base,
    "--accent-soft": softAccent(type),
    "--accent-deep": mix(base, "#0b1115", 0.22),
    /* Accent used as text on the grey chassis. */
    "--accent-ink": settle(base, SURFACE_LIGHT, "#0a0f12", 4.5),
    /* On the dark display the raw accent can disappear (electric, ice,
       flying). Everything drawn on the field reads from this pair. */
    "--accent-on-field": settle(base, SURFACE_DARK, "#ffffff", 4.5),
    "--accent-mark": settle(base, SURFACE_DARK, "#ffffff", 3),
  };
}
