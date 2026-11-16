/* Chroma lore: one line explaining why a repainted pokemon looks like that.
   Uses Groq when a key is present at build time, otherwise a local writer so
   the feature never silently disappears. */

/* The deployed site never holds a key: it asks the worker in lore-proxy/,
   which keeps the Groq key as a secret and returns only the finished line. */
const PROXY =
  (import.meta.env && import.meta.env.VITE_LORE_PROXY) ||
  "https://site-9ab0858b3eb2458ba4fa0615c5c508b8.freebuff.page/lore";
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

const TEMPLATES = [
  (c) => `${c.name} nests in mineral caves as a hatchling, and the dust it breathes settles in its coat for life.`,
  (c) => `Rangers only find ${c.name} where volcanic soil is warm; the heat changes how its body grows its markings.`,
  (c) => `This ${c.name} feeds on fermented berries, and the acids in them permanently alter the way its skin reflects light.`,
  (c) => `${c.name} hides among flowering vines as a juvenile, and its body copies the plants it grows up beside.`,
  (c) => `A ${c.name} that survives a lightning strike often keeps the scorched pattern for the rest of its life.`,
  (c) => `Deep water blocks the sunlight ${c.name} needs, so its body compensates by changing how it catches the light.`,
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
    return COLOUR.test(line) ? null : line;
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
        temperature: 1.15,
        max_tokens: 300,
        reasoning_effort: "low",
        messages: [
          {
            role: "system",
            content:
              "You write Pokédex entries for a monster-catching game. Reply with the entry only: one sentence, 18 to 30 words, in-world and matter-of-fact. Explain what in this individual's life, diet, habitat or history changed its colouring and how that helps it survive. Never name a colour, hue, shade, tint or pigment, and never call it odd, unusual, a variant or a mutation: describe the cause and the behaviour only. Never mention cards, printing or software.",
          },
          {
            role: "user",
            content: `Species: ${card.name}. Type: ${card.tcg}. Write its Pokédex entry: what in its life, diet or habitat changed its colouring, and how that helps it survive. Do not name any colour.`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`groq ${res.status}`);
    const json = await res.json();
    const line = json?.choices?.[0]?.message?.content?.trim().replace(/^["'“]|["'”]$/g, "");
    if (!line || COLOUR.test(line)) return null;
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
