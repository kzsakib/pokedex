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

/* the data writes MR-MIME and NIDORAN-M: a title and a gender letter are not
   the species' own name, so neither is used as one */
const words = (name) => {
  const parts = String(name || "")
    .toUpperCase()
    .replace(/[.\-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length > 1 && /^(M|F|X)$/.test(parts[parts.length - 1])) parts.pop();
  return parts;
};

/* "MR. MIME" fuses as MIME, not MRMIME, unless the honorific is kept below */
const baseName = (name) => {
  const parts = words(name);
  return lettersOf(parts[parts.length - 1] || name);
};

/* "MR. MIME" + ARBOK reads "MR. BOK", the way the games print the title */
const HONORIFIC = /^(MR|MRS|MS|DR|PROF|SIR|LADY)\.?$/;

/* consonant pairs a splice may open on without looking like a typo */
const ONSET = /^(BL|BR|CH|CL|CR|DR|DW|FL|FR|GL|GR|KN|PH|PL|PR|QU|SC|SH|SK|SL|SM|SN|SP|ST|SW|TH|TR|TW|WH|WR)/;

/* every way the head half can be cut, scored on where the cut lands */
function headCandidates(n) {
  const out = [];
  for (let cut = 2; cut <= Math.min(6, n.length); cut += 1) {
    const text = n.slice(0, cut);
    if (!VOWEL.test(text)) continue;
    let score = 0;
    /* a cut sits well on a syllable edge: before a vowel, or after one */
    if (cut < n.length && (VOWEL.test(n[cut]) || VOWEL.test(n[cut - 1]))) score += 2;
    score -= Math.abs(text.length - 4) * 0.5;
    if (/[^AEIOUY]{3}$/.test(text)) score -= 4;
    if (/(.)\1$/.test(text)) score -= 1.5;
    out.push({ text, score });
  }
  return out;
}

/* every tail the body half can contribute, scored on how it opens */
function tailCandidates(n) {
  const out = [];
  for (let start = 1; start <= n.length - 2; start += 1) {
    const text = n.slice(start);
    if (!VOWEL.test(text)) continue;
    let score = 0;
    if (!VOWEL.test(text[0])) score += 2;
    /* a tail that begins on a consonant run the language does not open on */
    if (/^[^AEIOUY]{2}/.test(text) && !ONSET.test(text)) score -= 1.5;
    else if (/^[^AEIOUY]{2}/.test(text)) score -= 0.6;
    score -= Math.abs(text.length - 4) * 0.7;
    out.push({ text, score });
  }
  return out;
}

/* the seam itself: doubled letters and vowel piles read as mistakes */
function seamScore(a, b) {
  /* the honorific keeps its full stop, which is not a consonant */
  const left = a.replace(/[^A-Z]/g, "");
  const right = b.replace(/[^A-Z]/g, "");
  let score = 0;
  if (/[^AEIOUY]{3}/.test(`${left.slice(-2)}${right.slice(0, 2)}`)) score -= 4;
  if (VOWEL.test(left[left.length - 1]) && VOWEL.test(right[0])) score -= 5;
  if (left[left.length - 1] === right[0]) score -= 1.5;
  return score;
}

/* the head half on its own, for the places that only need one side */
export function headPart(name) {
  const parts = words(name);
  if (parts.length > 1 && HONORIFIC.test(parts[0])) return `${parts[0].replace(/\.+$/, "")}.`;
  const n = baseName(name);
  if (n.length <= 3) return n;
  const best = headCandidates(n).sort((a, b) => b.score - a.score)[0];
  return best ? best.text : n.slice(0, Math.min(4, n.length));
}

/* the body half on its own */
export function bodyPart(name) {
  const n = baseName(name);
  if (n.length <= 3) return n;
  const best = tailCandidates(n).sort((a, b) => b.score - a.score)[0];
  return best ? best.text : n.slice(-Math.min(4, n.length));
}

/* HALF OF ONE + HALF OF THE OTHER, chosen from every cut of both names so the
   splice lands on a syllable edge, keeps its consonants pronounceable and stays
   short enough for the name line. */
export function fusionName(headName, bodyName) {
  const headParts = words(headName);
  const honorific =
    headParts.length > 1 && HONORIFIC.test(headParts[0])
      ? `${headParts[0].replace(/\.+$/, "")}.`
      : null;
  const heads = honorific ? [{ text: honorific, score: 4 }] : headCandidates(baseName(headName));
  const body = baseName(bodyName);
  const tails = tailCandidates(body);
  if (!tails.length) tails.push({ text: body.slice(-Math.min(4, body.length)), score: -3 });

  const headOwn = baseName(headName);
  const bodyOwn = body;
  let best = null;
  for (const head of heads) {
    for (const tail of tails) {
      const gap = honorific ? " " : "";
      const text = `${head.text}${gap}${tail.text}`;
      if (text.length < 4) continue;
      /* an honorific is its own word, so it never shares a seam with the tail */
      let score = head.score + tail.score + (honorific ? 0 : seamScore(head.text, tail.text));
      score -= Math.abs(text.length - 8) * 0.3;
      /* never print one of the parents' own names as the fusion */
      if (text.length > 11 || text === headOwn || text === bodyOwn) score -= 100;
      if (!best || score > best.score) best = { text, score };
    }
  }
  if (!best || best.score < -50) {
    const head = baseName(headName).slice(0, 5);
    const tail = body.slice(-4);
    return `${head}${tail}`.slice(0, 11);
  }
  return best.text.slice(0, 11);
}
