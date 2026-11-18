/* Vendors the Kanto front sprites used on the cards.

   Only front, static, full-body pixel art is taken: one sprite per game
   version (Red/Green, Red/Blue, Yellow, Gold, Silver, Crystal, Ruby/Sapphire,
   FireRed/LeafGreen, Emerald, Diamond/Pearl, Platinum, HeartGold/SoulSilver,
   Black/White). No backs, no animated GIFs, no menu icons, no shiny or SGB
   palette variants.

   Gen I and Gen II files ship on an opaque white plate, so the plate is keyed
   out by flood-filling inwards from the border. Internal whites (eyes, teeth,
   highlights) are enclosed by ink and survive the fill.

   npm i --no-save @napi-rs/canvas
   node scripts/fetch-card-sprites.mjs
*/
import fs from "node:fs";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const RAW = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
const OUT = path.resolve("public/cards/sprites");

export const VERSIONS = [
  ["rg", "generation-i/red-green-japan"],
  ["rb", "generation-i/red-blue"],
  ["yellow", "generation-i/yellow"],
  ["gold", "generation-ii/gold"],
  ["silver", "generation-ii/silver"],
  ["crystal", "generation-ii/crystal"],
  ["rs", "generation-iii/ruby-sapphire"],
  ["frlg", "generation-iii/firered-leafgreen"],
  ["emerald", "generation-iii/emerald"],
  ["dp", "generation-iv/diamond-pearl"],
  ["plat", "generation-iv/platinum"],
  ["hgss", "generation-iv/heartgold-soulsilver"],
  ["bw", "generation-v/black-white"],
];

const NEAR_WHITE = 246;

function keyOutWhite(canvas) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const image = ctx.getImageData(0, 0, width, height);
  const d = image.data;
  const white = (i) => d[i] > NEAR_WHITE && d[i + 1] > NEAR_WHITE && d[i + 2] > NEAR_WHITE;
  if (width === 0 || height === 0) return canvas;
  if (!white(0)) return canvas; /* already transparent or a full-bleed plate */
  const seen = new Uint8Array(width * height);
  const queue = [];
  const push = (x, y) => {
    const p = y * width + x;
    if (seen[p]) return;
    seen[p] = 1;
    if (!white(p * 4)) return;
    queue.push(p);
  };
  for (let x = 0; x < width; x += 1) { push(x, 0); push(x, height - 1); }
  for (let y = 0; y < height; y += 1) { push(0, y); push(width - 1, y); }
  while (queue.length) {
    const p = queue.pop();
    d[p * 4 + 3] = 0;
    const x = p % width;
    const y = (p - x) / width;
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

const jobs = [];
for (const [key, dir] of VERSIONS) {
  for (let id = 1; id <= 151; id += 1) {
    jobs.push({ key, url: `${RAW}/versions/${dir}/${id}.png`, file: path.join(OUT, key, `${String(id).padStart(3, "0")}.png`) });
  }
}

let missing = 0, written = 0;
const queue = jobs.slice();
async function worker() {
  while (queue.length) {
    const job = queue.shift();
    try {
      const res = await fetch(job.url);
      if (!res.ok) { missing += 1; continue; }
      const img = await loadImage(Buffer.from(await res.arrayBuffer()));
      const canvas = createCanvas(img.width, img.height);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      keyOutWhite(canvas);
      fs.mkdirSync(path.dirname(job.file), { recursive: true });
      fs.writeFileSync(job.file, canvas.toBuffer("image/png"));
      written += 1;
    } catch (error) {
      missing += 1;
      console.error("fail", job.key, job.url, error.message);
    }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
console.log(`wrote ${written} sprites, ${missing} missing`);
