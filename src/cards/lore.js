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
  (c, l) => `${c.name} swapped palettes after a teleport went sideways; its ${l} hide is the only thing field teams can identify it by.`,
  (c, l) => `A botched dye experiment turned ${c.name} ${l} overnight, and it has refused every attempt to change back.`,
  (c, l) => `${c.name} absorbed a stray prism beam at the power plant. It now reads as ${l} on every scanner.`,
  (c, l) => `Nobody knows why ${c.name} hatched ${l}. It simply arrived that way and acts as if nothing is unusual.`,
  (c, l) => `${c.name} molted under an eclipse; the new ${l} shell keeps the heat of that night.`,
  (c, l) => `A printing error at the card works recoloured ${c.name} ${l}. The pokemon itself seems fine with it.`,
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
        temperature: 1.05,
        max_tokens: 300,
        reasoning_effort: "low",
        messages: [
          {
            role: "system",
            content:
              "You write one-line Pokédex entries for a fan card game. Reply with the entry only: a single sentence, at most 22 words, no quotation marks, no preamble.",
          },
          {
            role: "user",
            content: `Species: ${card.name}. Its colours were completely swapped, so the card is labelled ${card.variant?.label || "REPAINTED"} and it now counts as a ${card.tcg} type. Write a Pokédex entry saying what happened to it and how it lives with the new colours.`,
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
