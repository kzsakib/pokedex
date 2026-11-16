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
  "You write Pokédex entries for a monster-catching game. Reply with the entry only: one sentence, 18 to 30 words, in-world and matter-of-fact. Explain what in this individual's life, diet, habitat or history changed its colouring and how that helps it survive. Never name a colour, hue, shade, tint or pigment, and never call it odd, unusual, a variant or a mutation: describe the cause and the behaviour only. Never mention cards, printing or software.";
/* entries must not name the colour, so a line that does is refused */
const COLOUR =
  /\b(jade|magenta|crimson|cobalt|azure|violet|amber|verdant|lime|cyan|indigo|ember|teal|scarlet|maroon|ochre|purple|pink|green|blue|red|yellow|orange|brown|grey|gray|white|black|gold|silver|bronze|copper|turquoise|lavender|olive|beige|rust|rose|mint|navy|hued|hue|colour|colou?red|color|shade|tint|pigment|palette|dark|pale|blacken\w*|reddish|greenish|bluish|greyish|grayish|yellowish|pinkish|purplish|brownish|whiten\w*)\b/i;

const clean = (raw) =>
  String(raw || "")
    .trim()
    .replace(/^["'“]|["'”]$/g, "")
    .slice(0, 400);


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

    const prompt = `Species: ${name}. Type: ${tcg}. Write its Pokédex entry: what in its life, diet or habitat changed its colouring, and how that helps it survive. Do not name any colour.`;

    const ask = (messages) =>
      fetch(GROQ, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${env.GROQ_KEY}` },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          temperature: 1.15,
          max_tokens: 300,
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

    const line = clean((await upstream.json())?.choices?.[0]?.message?.content);
    if (!line) return reply({ error: "empty completion" }, 502, origin);
    if (!COLOUR.test(line)) return reply({ line }, 200, origin);

    /* it named the colour: ask again, once, then refuse so the client falls back */
    try {
      const again = await ask([
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
        { role: "user", content: "Rewrite it without naming, implying or describing any colour, hue or pigment. Only the cause and how it lives." },
      ]);
      if (again.ok) {
        const retry = clean((await again.json())?.choices?.[0]?.message?.content);
        if (retry && !COLOUR.test(retry)) return reply({ line: retry }, 200, origin);
      }
    } catch {
      /* fall through to the refusal */
    }
    return reply({ error: "colour mentioned" }, 422, origin);
  },
};
