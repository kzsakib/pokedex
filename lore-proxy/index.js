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
    if (url.pathname !== "/" && url.pathname !== "/lore") return reply({ error: "not found" }, 404, origin);
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

    const name = String(body?.name || "").toUpperCase().replace(/[^A-Z0-9 '.-]/g, "").slice(0, 24);
    const tcg = TYPES.has(body?.tcg) ? body.tcg : "Colorless";
    if (name.length < 2) return reply({ error: "bad species" }, 400, origin);

    const angle = pickAngle();
    const prompt =
      `Species: ${name}. Type: ${tcg}. The cause for this individual: ${angle}. ` +
      "Write its one-line Pokédex entry around that cause, ending on what it can do because of it. One sentence, no colour words.";

    const ask = (messages) =>
      fetch(GROQ, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${env.GROQ_KEY}` },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          temperature: 1.25,
          /* the reasoning pass is billed against this, so leave it room */
          max_tokens: 800,
          reasoning_effort: "low",
          messages,
        }),
      });

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
