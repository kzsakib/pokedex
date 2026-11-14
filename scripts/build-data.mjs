#!/usr/bin/env node
/**
 * One-shot dev script: vendors the Gen 1 data and coloured pixel sprites so the
 * site never touches the network at runtime.
 *
 *   node scripts/build-data.mjs
 *
 * Sprites: PokeAPI's FireRed/LeafGreen set, which keeps the GBA colour ramps
 * instead of the four-colour Red/Blue set.
 */
import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(root, "public/cards/data");
const spriteDir = resolve(root, "public/cards/sprites");
const SPRITE_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-iii/firered-leafgreen";
const API = "https://pokeapi.co/api/v2";

const ids = Array.from({ length: 151 }, (_, i) => i + 1);

async function getJSON(url) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "kanto-packs-build" } });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  return null;
}

async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return out;
}

const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

async function main() {
  await mkdir(dataDir, { recursive: true });
  await mkdir(spriteDir, { recursive: true });

  console.log("fetching pokemon + species…");
  const entries = await pool(ids, 8, async (id) => {
    const [mon, species] = await Promise.all([
      getJSON(`${API}/pokemon/${id}`),
      getJSON(`${API}/pokemon-species/${id}`),
    ]);
    return { id, mon, species };
  });

  const chainUrls = [...new Set(entries.map((e) => e.species.evolution_chain?.url).filter(Boolean))];
  console.log(`fetching ${chainUrls.length} evolution chains…`);
  const chains = new Map();
  await pool(chainUrls, 8, async (url) => {
    const chain = await getJSON(url);
    const walk = (node, depth) => {
      const id = Number(node.species.url.split("/").filter(Boolean).pop());
      chains.set(id, depth);
      node.evolves_to.forEach((child) => walk(child, depth + 1));
    };
    walk(chain.chain, 0);
  });

  const data = entries.map(({ id, mon, species }) => {
    const stats = {};
    for (const stat of mon.stats) stats[stat.stat.name] = stat.base_stat;
    const genus = species.genera?.find((g) => g.language.name === "en")?.genus || "POKEMON";
    return {
      id,
      name: species.name.toUpperCase(),
      slug: species.name,
      types: mon.types.map((t) => t.type.name),
      stats,
      bst: Object.values(stats).reduce((a, b) => a + b, 0),
      height: mon.height / 10,
      weight: mon.weight / 10,
      genus: genus.replace(/ Pokémon$/i, "").toUpperCase(),
      stage: Math.min(2, chains.get(id) ?? 0),
      evolvesFrom: species.evolves_from_species?.name ?? null,
      colour: species.color?.name ?? "gray",
      flavour: (species.flavor_text_entries?.find((f) => f.language.name === "en")?.flavor_text || "")
        .replace(/[\n\f\u00ad]/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    };
  });

  data.sort((a, b) => a.id - b.id);
  await writeFile(resolve(dataDir, "gen1.json"), JSON.stringify(data, null, 1));
  console.log(`wrote gen1.json with ${data.length} entries`);

  let downloaded = 0;
  let skipped = 0;
  await pool(ids, 8, async (id) => {
    const path = resolve(spriteDir, `${String(id).padStart(3, "0")}.png`);
    if (await exists(path)) {
      skipped += 1;
      return;
    }
    const res = await fetch(`${SPRITE_BASE}/${id}.png`);
    if (!res.ok) throw new Error(`sprite ${id}: ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    await writeFile(path, bytes);
    downloaded += 1;
  });
  console.log(`sprites: ${downloaded} downloaded, ${skipped} already present`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
