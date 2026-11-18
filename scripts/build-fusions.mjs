/* Builds the local Fusion library used by the cards.
 *
 * Infinite Fusion numbers its own species list; 1..151 there are the Kanto
 * dex in National order (verified: 25.25 is Pikachu/Pikachu, 151.151 Mew/Mew).
 * A fusion is a HEAD id plus a BODY id, order matters, and only pairs with a
 * community sprite can be printed.
 *
 * This script keeps only Kanto x Kanto pairs, downloads the sprites from the
 * community repo once and writes them into public/cards/fusions/ so the site
 * serves its own copies instead of hotlinking raw.githubusercontent.com.
 *
 *   node scripts/build-fusions.mjs [count]
 */
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public/cards/fusions");
const TARGET = Number(process.argv[2] || 360);
const LIST = "https://raw.githubusercontent.com/dleetr/FusionDex/master/src/assets/FusionListing.json";
const CREDITS = "https://raw.githubusercontent.com/pokemoninfinitefusion/custom-sprites/master/Sprite%20Credits.csv";
const SPRITE = (h, b) =>
  `https://raw.githubusercontent.com/pokemoninfinitefusion/custom-sprites/master/CustomBattlers/${h}.${b}.png`;

function mulberry32(a) {
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* 288x288 RGBA/colormap PNG, whatever the bit depth */
function pngSize(buf) {
  if (buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

async function get(url, tries = 3) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "kanto-151-card-build" } });
      if (res.status === 404) return { status: 404 };
      if (!res.ok) throw new Error(`http ${res.status}`);
      return { status: 200, buf: Buffer.from(await res.arrayBuffer()) };
    } catch (error) {
      if (i === tries - 1) return { status: 0, error: String(error) };
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  return { status: 0 };
}

const listing = await (await fetch(LIST)).json();
const pairs = [];
for (const headKey of Object.keys(listing)) {
  const head = Number(headKey);
  if (!(head >= 1 && head <= 151)) continue;
  for (const bodyKey of listing[headKey].headFusions || []) {
    const body = Number(bodyKey);
    if (!(body >= 1 && body <= 151)) continue;
    if (body === head) continue;
    pairs.push([head, body]);
  }
}
console.log(`${pairs.length} kanto pairs listed`);

/* fixed shuffle: the shipped set is reproducible from this script */
const rnd = mulberry32(151151);
for (let i = pairs.length - 1; i > 0; i -= 1) {
  const j = Math.floor(rnd() * (i + 1));
  [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
}

const creditRes = await get(CREDITS, 2);
const artists = new Map();
if (creditRes.buf) {
  for (const line of creditRes.buf.toString("utf8").split(/\r?\n/)) {
    const [name, artist] = line.split(",");
    if (!name || !artist) continue;
    if (!/^\d+\.\d+$/.test(name)) continue;
    if (!artists.has(name)) artists.set(name, artist.trim());
  }
}
console.log(`${artists.size} credited files`);

await fs.mkdir(OUT, { recursive: true });
const present = new Set((await fs.readdir(OUT).catch(() => [])).map((f) => f.replace(/\.png$/, "")));
/* reruns keep what is already on disk so the index stays complete */
let kept = [];
try {
  kept = JSON.parse(await fs.readFile(path.join(OUT, "index.json"), "utf8")).pairs || [];
} catch {
  kept = [];
}
const have = new Set(kept.map(([head, body]) => `${head}.${body}`));
let skipped = 0;

for (let i = 0; i < pairs.length && kept.length < TARGET; i += 10) {
  const batch = pairs.slice(i, i + 10);
  const got = await Promise.all(
    batch.map(async ([head, body]) => {
      const key = `${head}.${body}`;
      if (have.has(key)) return { head, body, skip: true };
      const res = await get(SPRITE(head, body));
      if (res.status !== 200 || !res.buf) return { head, body, skip: true };
      const size = pngSize(res.buf);
      if (!size || size.w !== 288 || size.h !== 288) return { head, body, skip: true };
      return { head, body, buf: res.buf };
    }),
  );
  for (const row of got) {
    if (row.skip) {
      skipped += 1;
      continue;
    }
    await fs.writeFile(path.join(OUT, `${row.head}.${row.body}.png`), row.buf);
    kept.push([row.head, row.body, artists.get(`${row.head}.${row.body}`) || ""]);
    have.add(`${row.head}.${row.body}`);
  }
  process.stdout.write(`\r${kept.length}/${TARGET} kept, ${skipped} 404s   `);
}

console.log(`\nwrote ${kept.length} sprites, ${skipped} missing`);
await fs.writeFile(
  path.join(OUT, "index.json"),
  `${JSON.stringify({ source: "pokemoninfinitefusion/custom-sprites", pairs: kept })}\n`,
);
