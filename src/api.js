const API_ROOT = "https://pokeapi.co/api/v2";
const SPRITE_ROOT =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

const cache = new Map();

export const ENTRY_LIMIT = 151;

const SPECIAL_NAMES = { "nidoran-f": "Nidoran ♀", "nidoran-m": "Nidoran ♂" };

export function titleCase(value = "") {
  if (SPECIAL_NAMES[value]) return SPECIAL_NAMES[value];
  return value
    .replace(/-/g, " ")
    .replace(/\b[a-z]/g, (character) => character.toUpperCase());
}

export function formatNumber(id) {
  return `#${String(id).padStart(3, "0")}`;
}

function idFromUrl(url) {
  return Number(url.split("/").filter(Boolean).pop());
}

function request(url) {
  if (!cache.has(url)) {
    const promise = fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error(`PokéAPI answered ${response.status} for ${url}`);
      }
      return response.json();
    });
    promise.catch(() => cache.delete(url));
    cache.set(url, promise);
  }
  return cache.get(url);
}

export async function fetchIndex() {
  const data = await request(`${API_ROOT}/pokemon?limit=${ENTRY_LIMIT}`);
  return data.results.map((entry) => {
    const id = idFromUrl(entry.url);
    return {
      id,
      name: entry.name,
      label: titleCase(entry.name),
      number: formatNumber(id),
    };
  });
}

export const fetchPokemon = (id) => request(`${API_ROOT}/pokemon/${id}/`);
export const fetchSpecies = (id) => request(`${API_ROOT}/pokemon-species/${id}/`);
export const fetchEvolution = (url) => request(url);
export const fetchAbility = (name) => request(`${API_ROOT}/ability/${name}/`);

export const spriteUrl = (id) => `${SPRITE_ROOT}/${id}.png`;
export const artworkUrl = (id) =>
  `${SPRITE_ROOT}/other/official-artwork/${id}.png`;

const VERSION_LABELS = {
  red: "Red",
  blue: "Blue",
  yellow: "Yellow",
  gold: "Gold",
  silver: "Silver",
  crystal: "Crystal",
  ruby: "Ruby",
  sapphire: "Sapphire",
  emerald: "Emerald",
  firered: "FireRed",
  leafgreen: "LeafGreen",
  diamond: "Diamond",
  pearl: "Pearl",
  platinum: "Platinum",
  heartgold: "HeartGold",
  soulsilver: "SoulSilver",
  black: "Black",
  white: "White",
  "black-2": "Black 2",
  "white-2": "White 2",
  x: "X",
  y: "Y",
  "omega-ruby": "Omega Ruby",
  "alpha-sapphire": "Alpha Sapphire",
  sun: "Sun",
  moon: "Moon",
  "ultra-sun": "Ultra Sun",
  "ultra-moon": "Ultra Moon",
  "lets-go-pikachu": "Let's Go Pikachu",
  "lets-go-eevee": "Let's Go Eevee",
  sword: "Sword",
  shield: "Shield",
  "brilliant-diamond": "Brilliant Diamond",
  "shining-pearl": "Shining Pearl",
  "legends-arceus": "Legends: Arceus",
  scarlet: "Scarlet",
  violet: "Violet",
};

const tidy = (text = "") =>
  text.replace(/[\n\f\r]+/g, " ").replace(/\s{2,}/g, " ").trim();

/* Every English Pokédex entry this species has, one per game version. */
export function readEntries(species) {
  const entries =
    species?.flavor_text_entries?.filter(
      (entry) => entry.language.name === "en",
    ) ?? [];

  return entries.map((entry) => {
    const version = entry.version?.name ?? "unknown";
    return {
      version,
      label: VERSION_LABELS[version] ?? titleCase(version),
      text: tidy(entry.flavor_text),
    };
  });
}

export function readAbilityText(ability) {
  const effect = ability?.effect_entries?.find(
    (entry) => entry.language.name === "en",
  );
  if (effect?.short_effect) return tidy(effect.short_effect);

  const flavour = ability?.flavor_text_entries?.find(
    (entry) => entry.language.name === "en",
  );
  return tidy(flavour?.flavor_text ?? "");
}

export function readGenus(species) {
  return species?.genera?.find((genus) => genus.language.name === "en")?.genus ?? "";
}

function describeTrigger(details) {
  if (!details) return "";
  if (details.min_level) return `Lv. ${details.min_level}`;
  if (details.item) return `Use ${titleCase(details.item.name)}`;
  if (details.min_happiness) return `Happiness ${details.min_happiness}`;
  if (details.trigger?.name === "trade") return "Trade";
  if (details.trigger?.name === "use-item") return "Use item";
  return titleCase(details.trigger?.name ?? "");
}

export function evolutionStages(chain) {
  if (!chain?.chain) return [];
  const stages = [];
  const walk = (node, depth) => {
    stages.push({
      id: idFromUrl(node.species.url),
      name: titleCase(node.species.name),
      depth,
      trigger: describeTrigger(node.evolution_details?.[0]),
    });
    (node.evolves_to ?? []).forEach((child) => walk(child, depth + 1));
  };
  walk(chain.chain, 0);
  // This instrument only covers National Dex 1–151.
  const trimmed = stages.filter((stage) => stage.id <= ENTRY_LIMIT);
  // If the true base stage sits outside the range, the first visible stage
  // becomes the start of the line and must not claim an evolution trigger.
  return trimmed.map((stage, position) =>
    position === 0 ? { ...stage, trigger: "" } : stage,
  );
}

export async function pool(items, worker, concurrency = 5, onProgress) {
  let cursor = 0;
  let finished = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (cursor < items.length) {
        const item = items[cursor];
        cursor += 1;
        try {
          await worker(item);
        } catch {
          /* a single missing entry must not stop the scan */
        }
        finished += 1;
        onProgress?.(finished);
      }
    },
  );
  await Promise.all(runners);
}
