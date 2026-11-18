/* Tiny Groq proxy for the Kanto card game.
   Holds the API key as a Worker secret; the browser only ever sees the line. */

const ALLOWED_ORIGINS = new Set([
  "https://kzsakib.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
]);

const TYPES = new Set(["Fire", "Water", "Grass", "Lightning", "Psychic", "Fighting", "Colorless"]);
const hits = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;

const GROQ = "https://api.groq.com/openai/v1/chat/completions";
const SYSTEM =
  "You write one-line Pokédex entries for a monster-catching game. Reply with the entry only: one grammatical sentence of 16 to 28 words, in-world and matter-of-fact.\n\n" +
  "Start inside the creature's life: open on the creature, the event, the place or the object, and never on an observer (no 'Observed', 'Field notes', 'This specimen', 'Researchers have'). Build the sentence around the specific cause given for this individual and land it on what it can do because of that. Be concrete: a season, a place, another species, an object, a mistake. Write this one animal's history, not the habits of its species.\n\n" +
  "Never name the species: the card already prints its name, so use 'it', 'the hatchling', 'the old bull'. One sentence, joined properly: no comma splices and no dashes standing in for full stops. Never name, imply or describe a colour, hue, shade, tint or pigment. Never call it odd, unusual, a variant, a mutation or a form. Never mention cards, printing, software or games. Do not reach for stock explanations such as volcanic soil, algae, mineral dust, lightning, fermented fruit or deep water.";

/* One cause per line, so two chromas never get the same shape of story. */
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
const recentAngles = [];

function pickAngle() {
  const pool = ANGLES.filter((angle) => !recentAngles.includes(angle));
  const angle = pool[Math.floor(Math.random() * pool.length)] || ANGLES[0];
  recentAngles.push(angle);
  if (recentAngles.length > 8) recentAngles.shift();
  return angle;
}
/* entries must not name the colour, so a line that does is refused */
const COLOUR =
  /\b(jade|magenta|crimson|cobalt|azure|violet|amber|verdant|lime|cyan|indigo|ember|teal|scarlet|maroon|ochre|purple|pink|green|blue|red|yellow|orange|brown|grey|gray|white|black|gold|silver|bronze|copper|turquoise|lavender|olive|beige|rust|rose|mint|navy|hued|hue|colour|colou?red|color|shade|tint|pigment|palette|dark|pale|blacken\w*|reddish|greenish|bluish|greyish|grayish|yellowish|pinkish|purplish|brownish|whiten\w*)\b/i;

const clean = (raw) =>
  String(raw || "")
    .trim()
    .replace(/^["'“]|["'”]$/g, "")
    .slice(0, 400);

/* A usable entry is one finished sentence of the right size: reasoning tokens
   sometimes eat the budget mid-word, and short replies come back as fragments. */
const words = (line) => line.split(/\s+/).filter(Boolean).length;
const usable = (line) =>
  !!line &&
  line.length > 40 &&
  /[.!?]$/.test(line) &&
  words(line) >= 12 &&
  words(line) <= 40 &&
  !COLOUR.test(line);


/* ---- fusion entries: two species' dex lines go in, one short line comes out ---- */
const FUSION_SYSTEM =
  "You write Pokédex entries for a fan monster-catching game. Two creatures have been spliced into one and you are given the flavour text of both halves. Reply with the entry only: ONE grammatical sentence of 14 to 22 words, in-world and matter-of-fact.\n\n" +
  "Give the creature one body and one life: its head and front follow the first half, its build, habits and temper follow the second. Take one habit from each half and fuse them into something you can watch — a hunt, a shelter, a season, a way of moving. Do not list the halves' facts side by side and do not explain how the creature was made. Start on the creature itself, never on an observer (no 'Observed', 'Field notes', 'Researchers'). The card already prints the creature's name and its types, so never write either: no names and no type words (fire, water, psychic, fighting and so on), only 'it'. Never mention fusion, splicing, experiments, breeding, genes, cards, printing, software or games.";

const TYPE_WORD =
  /\b(fire|water|grass|lightning|electric|psychic|fighting|colorless|normal|flying|poison|ground|rock|bug|ghost|dragon|ice|steel|dark|fairy|type|types)\b/i;

const flatName = (value) => String(value || "").toUpperCase().replace(/[^A-Z]/g, "");

/* One sentence, short enough for the strip under the card, with neither the
   creature's name nor a type word in it. */
const fusionUsable = (line, banned = []) => {
  if (!line) return false;
  const text = String(line).trim();
  if (text.length < 50 || text.length > 220) return false;
  if (!/[.!?]$/.test(text)) return false;
  if (/[.!?]\s+[A-Z(]/.test(text.slice(0, -1))) return false;
  const n = words(text);
  if (n < 10 || n > 28) return false;
  if (TYPE_WORD.test(text)) return false;
  const flat = flatName(text);
  return !banned.some((name) => name && flat.includes(name));
};

function askGroq(env, messages, temperature) {
  return fetch(GROQ, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.GROQ_KEY}` },
    body: JSON.stringify({
      model: "openai/gpt-oss-20b",
      temperature,
      /* the reasoning pass is billed against this, so leave it room */
      max_tokens: 800,
      reasoning_effort: "low",
      messages,
    }),
  });
}

function originAllowed(origin) {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return /^https:\/\/pv-[a-z0-9-]+\.style\.dev$/.test(origin);
}

function headers(origin) {
  return {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "Origin",
    "cache-control": "no-store",
  };
}

const reply = (body, status, origin) =>
  new Response(JSON.stringify(body), { status, headers: headers(origin) });

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);
    const allowed = originAllowed(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: allowed ? 204 : 403, headers: headers(allowed ? origin : "null") });
    }
    if (!allowed) return reply({ error: "origin not allowed" }, 403, "null");
    if (url.pathname !== "/" && url.pathname !== "/lore" && url.pathname !== "/fusion") {
      return reply({ error: "not found" }, 404, origin);
    }
    if (request.method !== "POST") return reply({ error: "use POST" }, 405, origin);
    if (!env.GROQ_KEY) return reply({ error: "proxy is missing its key" }, 503, origin);

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= MAX_PER_WINDOW) return reply({ error: "slow down" }, 429, origin);
    recent.push(now);
    hits.set(ip, recent);

    let body;
    try {
      body = await request.json();
    } catch {
      return reply({ error: "bad json" }, 400, origin);
    }

    if (url.pathname === "/fusion") {
      const raw = (value) => String(value || "").toUpperCase().replace(/[^A-Z .'-]/g, "").slice(0, 24);
      const head = raw(body?.head);
      const bodyHalf = raw(body?.body);
      const fused = String(body?.name || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 16);
      const entryA = String(body?.entryA || "").replace(/\s+/g, " ").trim().slice(0, 300);
      const entryB = String(body?.entryB || "").replace(/\s+/g, " ").trim().slice(0, 300);
      if (!head || !bodyHalf || fused.length < 3) return reply({ error: "bad fusion" }, 400, origin);
      const types = (Array.isArray(body?.types) ? body.types : []).filter((t) => TYPES.has(t)).join(" / ");
      const banned = [fused, head, bodyHalf]
        .map((value) => flatName(value).slice(0, 5))
        .filter((value) => value.length >= 3);

      const prompt =
        `Fused creature: ${fused}. Its head half is ${head}, its body half is ${bodyHalf}. Types: ${types || "unknown"}.\n` +
        `Entry written about ${head}: ${entryA || "none"}\n` +
        `Entry written about ${bodyHalf}: ${entryB || "none"}\n` +
        `Write the single Pokédex sentence for ${fused}: combine both halves into one animal, its body following the head half and its habits and build following the body half. Do not use any of those three names or any type word in the entry.`;

      let upstream;
      try {
        upstream = await askGroq(
          env,
          [
            { role: "system", content: FUSION_SYSTEM },
            { role: "user", content: prompt },
          ],
          1.1,
        );
      } catch {
        return reply({ error: "upstream unreachable" }, 502, origin);
      }
      if (!upstream.ok) return reply({ error: `upstream ${upstream.status}` }, 502, origin);
      const line = clean((await upstream.json().catch(() => null))?.choices?.[0]?.message?.content);
      if (fusionUsable(line, banned)) return reply({ line }, 200, origin);
      return reply({ error: "unusable entry" }, 422, origin);
    }

    const name = String(body?.name || "").toUpperCase().replace(/[^A-Z0-9 '.-]/g, "").slice(0, 24);
    const tcg = TYPES.has(body?.tcg) ? body.tcg : "Colorless";
    if (name.length < 2) return reply({ error: "bad species" }, 400, origin);

    const angle = pickAngle();
    const prompt =
      `Species: ${name}. Type: ${tcg}. The cause for this individual: ${angle}. ` +
      "Write its one-line Pokédex entry around that cause, ending on what it can do because of it. One sentence, no colour words.";

    const ask = (messages) => askGroq(env, messages, 1.25);

    let upstream;
    try {
      upstream = await ask([
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ]);
    } catch {
      return reply({ error: "upstream unreachable" }, 502, origin);
    }
    if (!upstream.ok) return reply({ error: `upstream ${upstream.status}` }, 502, origin);

    const first = await upstream.json().catch(() => null);
    const line = clean(first?.choices?.[0]?.message?.content);
    if (!line) return reply({ error: "empty completion" }, 502, origin);
    if (usable(line) && first?.choices?.[0]?.finish_reason !== "length") return reply({ line }, 200, origin);

    /* it named the colour: ask again, once, then refuse so the client falls back */
    try {
      const again = await ask([
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
        {
          role: "user",
          content:
            "Rewrite it as one complete sentence of 16 to 28 words, still built on that cause, without naming, implying or describing any colour, hue or pigment.",
        },
      ]);
      if (again.ok) {
        const retry = clean((await again.json())?.choices?.[0]?.message?.content);
        if (usable(retry)) return reply({ line: retry }, 200, origin);
      }
    } catch {
      /* fall through to the refusal */
    }
    return reply({ error: "colour mentioned" }, 422, origin);
  },
};
