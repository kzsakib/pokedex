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

const TEMPLATES = [
  (c, l) => `${c.name} hatched with ${l} markings instead of its usual colours; it uses them to hide in flowering fields.`,
  (c, l) => `A ${l} strain of ${c.name} lives only in the deep caves, where the stone stains everything that stays too long.`,
  (c, l) => `${c.name} changes colour when it feeds, and this ${l} shade means it has been eating nothing but mineral-rich soil.`,
  (c, l) => `Rangers report ${c.name} in ${l} only in the cold months; the colour fades again by spring.`,
  (c, l) => `This ${c.name} grew up among ${l} plants, and its body copied the shade to blend in with the leaves.`,
  (c, l) => `${c.name} glows ${l} when it is ready to evolve, warning other pokemon to keep their distance.`,
];

export function fallbackLore(card, seed = 0) {
  const pick = Math.abs(Math.floor(seed)) % TEMPLATES.length;
  return TEMPLATES[pick](card, (card.variant && card.variant.label) || "UNUSUAL");
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
        label: card.variant?.label || "REPAINTED",
        tcg: card.tcg,
      }),
    });
    if (!res.ok) throw new Error(`proxy ${res.status}`);
    const json = await res.json();
    const line = String(json?.line || "").trim();
    if (!line) throw new Error("proxy empty");
    return line;
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
              "You write Pokédex entries for a monster-catching game. Reply with the entry only: one sentence, 18 to 30 words, in-world and matter-of-fact, the way a real dex reads. Treat this individual's unusual colour as a natural adaptation: say what it eats, where it nests, how it hunts, or what the colour does for it. Be specific and a little strange. Never mention cards, printing, palettes, dyes, ink, screens, data or software, and never say it looks unusual.",
          },
          {
            role: "user",
            content: `Species: ${card.name}. This individual is ${card.variant?.label || "REPAINTED"} rather than the usual colour for ${card.name}. Write its Pokédex entry.`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`groq ${res.status}`);
    const json = await res.json();
    const line = json?.choices?.[0]?.message?.content?.trim().replace(/^["'“]|["'”]$/g, "");
    return line || null;
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
