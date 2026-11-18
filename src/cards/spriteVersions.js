/* The front sprites vendored under public/cards/sprites/<key>/.
   Static pixel art only: no back views, no animated GIFs, no menu icons and no
   palette variants (shiny, Super Game Boy gray, GBC). One printing per game the
   species appeared in, so a card can show any era's art. */

import { hashSeed } from "./rng.js";

export const SPRITE_VERSIONS = [
  "rg", "rb", "yellow",
  "gold", "silver", "crystal",
  "rs", "frlg", "emerald",
  "dp", "plat", "hgss",
  "bw",
];

/* Seeded off the pack code, so the same card rebuilds the same printing and two
   cards of one species still differ. */
export function spriteVersionFor(seed, id, slot = 0) {
  return SPRITE_VERSIONS[hashSeed(`${seed}|${id}|${slot}`) % SPRITE_VERSIONS.length];
}
