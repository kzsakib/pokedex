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
    const label = String(body?.label || "REPAINTED").toUpperCase().replace(/[^A-Z0-9 -]/g, "").slice(0, 16);
    const tcg = TYPES.has(body?.tcg) ? body.tcg : "Colorless";
    if (name.length < 2) return reply({ error: "bad species" }, 400, origin);

    const prompt = `Species: ${name}. Its colours were completely swapped, so the card is labelled ${label} and it now counts as a ${tcg} type. Write a Pokédex entry saying what happened to it and how it lives with the new colours.`;

    let upstream;
    try {
      upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${env.GROQ_KEY}` },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          temperature: 1.05,
          max_tokens: 300,
          reasoning_effort: "low",
          messages: [
            {
              role: "system",
              content:
                "You write one-line Pokédex entries for a fan card game. Reply with the entry only: a single sentence, at most 22 words, no quotation marks, no preamble.",
            },
            { role: "user", content: prompt },
          ],
        }),
      });
    } catch {
      return reply({ error: "upstream unreachable" }, 502, origin);
    }
    if (!upstream.ok) return reply({ error: `upstream ${upstream.status}` }, 502, origin);

    const data = await upstream.json();
    const line = String(data?.choices?.[0]?.message?.content || "")
      .trim()
      .replace(/^["'“]|["'”]$/g, "")
      .slice(0, 220);
    if (!line) return reply({ error: "empty completion" }, 502, origin);
    return reply({ line }, 200, origin);
  },
};
