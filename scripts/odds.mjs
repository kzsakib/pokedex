import fs from "node:fs";
const data = JSON.parse(fs.readFileSync("public/cards/data/gen1.json", "utf8"));
const { generatePack } = await import("../src/cards/generate.js");
const counts = {}, rar = {};
let n = 0, shiny = 0, odd = 0;
for (let i = 0; i < 4000; i += 1) {
  const pack = generatePack(data, `SIM${i}`, {});
  const cards = pack.cards || pack;
  for (const c of cards) {
    n += 1;
    counts[c.finish || "undefined"] = (counts[c.finish || "undefined"] || 0) + 1;
    rar[c.rarity] = (rar[c.rarity] || 0) + 1;
    if (c.shiny) shiny += 1;
    if (!c.finish) odd += 1;
  }
}
console.log("cards", n, "shiny", shiny, "missing finish", odd);
console.log("rarity", rar);
console.log("finish", counts);
