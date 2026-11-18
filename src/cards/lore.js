/* Chroma lore: one line explaining why a repainted pokemon looks like that.
   Uses Groq when a key is present at build time, otherwise a local writer so
   the feature never silently disappears. */

/* The deployed site never holds a key: it asks the worker in lore-proxy/,
   which keeps the Groq key as a secret and returns only the finished line. */
const PROXY_SRC =
  (import.meta.env && import.meta.env.VITE_LORE_PROXY) ||
  "https://site-9ab0858b3eb2458ba4fa0615c5c508b8.freebuff.page/lore";
/* the worker answers /lore for chroma and /fusion for spliced entries */
const PROXY_BASE = PROXY_SRC.replace(/\/lore\/?$/, "");
const PROXY = `${PROXY_BASE}/lore`;
const KEY = (import.meta.env && import.meta.env.VITE_GROQ_KEY) || "";

const HUE_FAMILIES = [
  "CRIMSON", "EMBER", "AMBER", "LIME", "VERDANT", "JADE",
  "CYAN", "AZURE", "COBALT", "INDIGO", "VIOLET", "MAGENTA",
];

export function hueLabel(hueMap, source) {
  if (typeof source === "number" && hueMap && typeof hueMap[source] === "number") {
    const sector = Math.floor((((hueMap[source] % 360) + 360) % 360) / 30);
    return HUE_FAMILIES[sector];
  }
  const counts = new Array(12).fill(0);
  for (const key of Object.keys(hueMap || {})) {
    const sector = Math.floor((((hueMap[key] % 360) + 360) % 360) / 30);
    counts[sector] += 1;
  }
  let best = 0;
  for (let i = 1; i < counts.length; i += 1) if (counts[i] > counts[best]) best = i;
  return HUE_FAMILIES[best];
}

/* entries say why the colour changed, never what the colour is */
const COLOUR =
  /\b(jade|magenta|crimson|cobalt|azure|violet|amber|verdant|lime|cyan|indigo|ember|teal|scarlet|maroon|ochre|purple|pink|green|blue|red|yellow|orange|brown|grey|gray|white|black|gold|silver|bronze|copper|turquoise|lavender|olive|beige|rust|rose|mint|navy|hued|hue|colou?r|colou?red|shade|tint|pigment|palette|dark|pale|blacken\w*|reddish|greenish|bluish|greyish|grayish|yellowish|pinkish|purplish|brownish|whiten\w*)\b/i;

/* The angle steers the model away from stock causes, so no two lines open the
   same way. Mirrors the list in lore-proxy/index.js. */
const ANGLES = [
  "a wound that healed badly and left it moving differently",
  "a smaller creature that lives on it and will not leave",
  "a rival it grew up beside and still follows",
  "a migration it joins at the same week every year",
  "a storm it sat through instead of hiding",
  "a habit it copied from whoever used to feed it",
  "something it stole once and refuses to give back",
  "a molt that went wrong",
  "a whole season it spent asleep somewhere it should not have",
  "a place it will not leave, even when the food runs out",
  "a sound it learned to answer",
  "a game it plays with others of its kind",
  "an object it carries and will not put down",
  "an old alliance with a species that hunts it",
  "a food it can no longer digest but keeps eating",
  "a temperature it has to stay near",
  "a light it waits for every night",
  "a smell it tracks for days at a time",
  "a rescue it remembers and keeps paying back",
  "a duty it took over from a parent",
];

const SYSTEM =
  "You write one-line Pokédex entries for a monster-catching game. Reply with the entry only: one grammatical sentence of 16 to 28 words, in-world and matter-of-fact.\n\n" +
  "Start inside the creature's life: open on the creature, the event, the place or the object, and never on an observer (no 'Observed', 'Field notes', 'This specimen', 'Researchers have'). Build the sentence around the specific cause given for this individual and land it on what it can do because of that. Be concrete: a season, a place, another species, an object, a mistake. Write this one animal's history, not the habits of its species.\n\n" +
  "Never name the species: the card already prints its name, so use 'it', 'the hatchling', 'the old bull'. One sentence, joined properly: no comma splices and no dashes standing in for full stops. Never name, imply or describe a colour, hue, shade, tint or pigment. Never call it odd, unusual, a variant, a mutation or a form. Never mention cards, printing, software or games. Do not reach for stock explanations such as volcanic soil, algae, mineral dust, lightning, fermented fruit or deep water.";

const pickAngle = () => ANGLES[Math.floor(Math.random() * ANGLES.length)];

/* Offline writer: same shape as the model's, one distinct incident each. */
const words = (line) => line.split(/\s+/).filter(Boolean).length;
const usable = (line) =>
  !!line &&
  line.length > 40 &&
  /[.!?]$/.test(line) &&
  words(line) >= 12 &&
  words(line) <= 40 &&
  !COLOUR.test(line);

const TEMPLATES = [
  (c) => `${c.name} took a wound to the flank as a juvenile and never grew the same way over it, so it leans into turns before it has finished deciding to.`,
  (c) => `A tick-like creature has ridden this ${c.name} since its first summer, and the itch keeps it awake through the hours it would rather sleep.`,
  (c) => `This ${c.name} grew up beside a rival it could never beat and still walks the same routes that rival walks, a few paces behind.`,
  (c) => `${c.name} joins the same river crossing on the same week every year, and rangers now set their calendars by the noise it makes arriving.`,
  (c) => `It sat through a storm instead of sheltering, and the exposure left it slow to warm and quick to seek out stone that holds the day's heat.`,
  (c) => `Whoever fed this ${c.name} as a hatchling always knocked twice first, and it now refuses food from anyone who does not.`,
  (c) => `${c.name} stole a smooth stone from a nest it had no business near and has carried it since, turning it over whenever it is nervous.`,
  (c) => `One molt came away badly and left a seam of bare skin along its back, so it keeps to shade and lets nothing approach from above.`,
  (c) => `This ${c.name} slept through an entire season in a cold storeroom and woke thin, hungry, and unwilling to hibernate again.`,
  (c) => `It will not leave a stretch of beach where it once found easy food, even now that the water there gives it nothing.`,
  (c) => `${c.name} answers a whistle that no trainer nearby is making, and follows the sound for as long as it lasts.`,
  (c) => `It plays a chasing game with smaller species that should be prey, and the ones that play along are the ones it never hunts.`,
  (c) => `${c.name} carries a bent metal ring it cannot eat or use, and trades it between paws for hours at a time.`,
  (c) => `It has an arrangement with a predator that would otherwise take it, and the two now share the same sleeping ledge without conflict.`,
  (c) => `This ${c.name} keeps eating a fruit its body cannot break down and spends most of each afternoon recovering from the effort.`,
  (c) => `${c.name} must stay near warm stone or its limbs stiffen, so it has learned every sunlit ledge along a mile of cliff.`,
  (c) => `It waits each night for a light on the headland and will not settle until that light goes out.`,
  (c) => `${c.name} tracks one particular smell for days at a time and abandons food, water and shelter to keep following it.`,
  (c) => `Someone pulled this ${c.name} out of a collapse years ago, and it now digs at any rubble it passes, looking for the same debt.`,
  (c) => `A parent's route became this ${c.name}'s route, and it walks the whole circuit every day whether or not there is anything left to find.`,
];

export function fallbackLore(card, seed = 0) {
  const pick = Math.abs(Math.floor(seed)) % TEMPLATES.length;
  return TEMPLATES[pick](card);
}

async function fromProxy(card, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(PROXY, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: card.name,
        tcg: card.tcg,
      }),
    });
    if (!res.ok) throw new Error(`proxy ${res.status}`);
    const json = await res.json();
    const line = String(json?.line || "").trim();
    if (!line) throw new Error("proxy empty");
    /* the entry explains the cause, it must never name the colour */
    return usable(line) ? line : null;
  } finally {
    clearTimeout(timer);
  }
}

async function fromKey(card, timeoutMs) {
  if (!KEY) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        temperature: 1.25,
        max_tokens: 800,
        reasoning_effort: "low",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content:
              `Species: ${card.name}. Type: ${card.tcg}. The cause for this individual: ${pickAngle()}. ` +
              "Write its one-line Pokédex entry around that cause, ending on what it can do because of it. One sentence, no colour words.",
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`groq ${res.status}`);
    const json = await res.json();
    const line = json?.choices?.[0]?.message?.content?.trim().replace(/^["'“]|["'”]$/g, "");
    if (!usable(line)) return null;
    return line;
  } finally {
    clearTimeout(timer);
  }
}

export async function chromaLore(card, timeoutMs = 7000) {
  const seed = (card.id * 2654435761 + (card.variant?.label || "").length) >>> 0;
  try {
    const viaProxy = await fromProxy(card, timeoutMs);
    if (viaProxy) return viaProxy;
  } catch {
    /* fall through to the local writer */
  }
  try {
    const viaKey = await fromKey(card, timeoutMs);
    if (viaKey) return viaKey;
  } catch {
    /* fall through */
  }
  return fallbackLore(card, seed);
}

/* ---------- fusion entries ----------
   Both halves' dex lines go in; one short line comes out. The card prints the
   name and both type discs already, so the entry repeats neither, and it stays
   a single sentence so it fits the strip under the card. */

const bare = (s) => String(s || "").replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "");

const TYPE_WORD =
  /\b(fire|water|grass|lightning|electric|psychic|fighting|colorless|normal|flying|poison|ground|rock|bug|ghost|dragon|ice|steel|dark|fairy|type|types)\b/i;

const nameLetters = (value) => String(value || "").toUpperCase().replace(/[^A-Z]/g, "");

/* catches the creature's name and either half's name, however it is spaced */
function repeatsName(line, card) {
  const flat = nameLetters(line);
  const f = card.fusion || {};
  return [card.name, f.headName, f.bodyName]
    .map(nameLetters)
    .filter((n) => n.length >= 3)
    .some((n) => flat.includes(n.slice(0, 5)));
}

/* a finished sentence with no second one hiding in the middle */
const oneSentence = (line) => {
  const text = String(line || "").trim();
  if (!/[.!?]$/.test(text)) return false;
  return !/[.!?]\s+[A-Z(]/.test(text.slice(0, -1));
};

const goodEntry = (line, card) => {
  if (!line) return false;
  const text = String(line).replace(/\s+/g, " ").trim();
  const n = words(text);
  if (text.length < 50 || text.length > 220) return false;
  if (n < 10 || n > 28) return false;
  if (!oneSentence(text)) return false;
  if (TYPE_WORD.test(text)) return false;
  return !(card && repeatsName(text, card));
};

/* Offline writer: each half lends one short clause, joined as a single
   sentence so the line reads as one creature, not two dex pages. */
const shortClause = (source, max = 11) => {
  const text = bare(source).replace(/\bPOK[eé]MON\b/gi, "creature");
  if (!text) return "";
  const sentence = text.split(/[.;:!?]/)[0].trim();
  if (!sentence) return "";
  /* the first comma clause is the short one, unless it drops the subject */
  const bits = sentence.split(",");
  let clause = bits[0].trim();
  if (clause.split(/\s+/).filter(Boolean).length < 4 && bits.length > 1) clause = sentence;
  const parts = clause.split(/\s+/).filter(Boolean);
  clause = parts.length <= max ? clause : parts.slice(0, max).join(" ");
  return clause.replace(/[,;:\-]+$/, "").trim();
};

const lowerFirst = (text) => (text ? text[0].toLowerCase() + text.slice(1) : text);
const upperFirst = (text) => (text ? text[0].toUpperCase() + text.slice(1) : text);

export function fusionFallback(card) {
  const f = card.fusion || {};
  const a = shortClause(f.entryA);
  const b = shortClause(f.entryB);
  if (!a && !b) return "It keeps to cover no other creature uses and answers a call only its own two halves make.";
  if (!a) return `${upperFirst(b)}.`;
  if (!b) return `${upperFirst(a)}.`;
  return `${upperFirst(a)}; ${lowerFirst(b)}.`;
}

async function fusionFromProxy(card, timeoutMs) {
  const f = card.fusion || {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${PROXY_BASE}/fusion`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: card.name,
        head: f.headName,
        body: f.bodyName,
        entryA: f.entryA,
        entryB: f.entryB,
        types: [card.tcg, f.tcgB],
      }),
    });
    if (!res.ok) throw new Error(`proxy ${res.status}`);
    const json = await res.json();
    const line = String(json?.line || "").trim();
    return goodEntry(line, card) ? line : null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fusionLore(card, timeoutMs = 7000) {
  try {
    const viaProxy = await fusionFromProxy(card, timeoutMs);
    if (viaProxy) return viaProxy;
  } catch {
    /* fall through to the local writer */
  }
  return fusionFallback(card);
}
