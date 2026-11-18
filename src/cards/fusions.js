/* Infinite Fusion, as the cards use it.
 *
 * A fusion is a HEAD id plus a BODY id and the order matters: 69.48 is a
 * different creature from 48.69. The game keeps its own species list, and
 * 1..151 on that list are the Kanto dex in National order (25.25 is a
 * Pikachu/Pikachu sprite, 151.151 a Mew/Mew one), so the only fusions printed
 * here are Kanto head + Kanto body.
 *
 * public/cards/fusions/ holds the pairs whose community sprite was vendored
 * (built once by scripts/build-fusions.mjs, credited per card), so the live
 * site never hotlinks raw.githubusercontent.com.
 */

const BASE = (import.meta.env && import.meta.env.BASE_URL) || "/";

let indexPromise = null;

export function loadFusionIndex() {
  if (!indexPromise) {
    indexPromise = fetch(`${BASE}cards/fusions/index.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`fusions ${res.status}`);
        return res.json();
      })
      .then((json) =>
        (Array.isArray(json?.pairs) ? json.pairs : []).map(([head, body, artist]) => ({
          head: Number(head),
          body: Number(body),
          artist: String(artist || ""),
        })),
      )
      .catch(() => []);
  }
  return indexPromise;
}

export const fusionKey = (head, body) => `${head}.${body}`;

const VOWEL = /[AEIOUY]/;
const lettersOf = (name) => String(name || "").toUpperCase().replace(/[^A-Z]/g, "");

/* "MR. MIME" fuses as MIME, not MRMIME */
const baseName = (name) => {
  const parts = String(name || "").toUpperCase().split(/[\s.]+/).filter(Boolean);
  return lettersOf(parts[parts.length - 1] || name);
};

/* The head keeps its opening syllable: CHARIZARD -> CHARI, BLASTOISE -> BLAST. */
export function headPart(name) {
  const n = baseName(name);
  if (n.length <= 4) return n;
  let cut = Math.min(5, Math.max(2, Math.round(n.length * 0.55)));
  while (cut < n.length - 2 && VOWEL.test(n[cut - 1]) && VOWEL.test(n[cut])) cut += 1;
  return n.slice(0, cut);
}

/* The body keeps its closing syllable, beginning on a consonant so the tail can
   stand on its own: MACHAMP -> HAMP, WARTORTLE -> TORTLE, CHARIZARD -> ZARD. */
export function bodyPart(name) {
  const n = baseName(name);
  if (n.length <= 5) return n.slice(Math.floor(n.length / 2));
  const target = Math.round(n.length * 0.4);
  const hi = n.length - 2;
  let best = null;
  for (let i = 2; i <= hi; i += 1) {
    if (VOWEL.test(n[i])) continue;
    if (best === null || Math.abs(i - target) < Math.abs(best - target)) best = i;
  }
  if (best === null) best = Math.max(2, Math.min(hi, target));
  /* keep the ending, never the middle: five head letters plus six tail letters
     is the most the name line can print at 2x */
  return n.slice(best).slice(-6);
}

/* HALF OF ONE + HALF OF THE OTHER, dropped into one name. */
export function fusionName(headName, bodyName) {
  const head = headPart(headName);
  let body = bodyPart(bodyName);
  /* two vowels meeting across the splice would read as a typo */
  if (head && body && VOWEL.test(head[head.length - 1]) && VOWEL.test(body[0])) body = body.slice(1);
  const out = `${head}${body}`;
  return (out.length < 4 ? `${head}${body}`.slice(0, 4) : out).slice(0, 11);
}
