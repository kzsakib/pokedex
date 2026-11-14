import fs from "node:fs";
function fakeCanvas() {
  const c = { width: 0, height: 0 };
  c.getContext = () => ({
    fillStyle: "#000", imageSmoothingEnabled: false,
    fillRect() {}, clearRect() {}, drawImage() {}, strokeRect() {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {},
  });
  return c;
}
globalThis.document = { createElement: () => fakeCanvas() };
const { renderCard } = await import("../src/cards/cardRenderer.js");
const { generatePack } = await import("../src/cards/generate.js");
const data = JSON.parse(fs.readFileSync("public/cards/data/gen1.json", "utf8"));
const errors = new Map();
let cards = 0, bad = 0;
for (let i = 0; i < 600; i += 1) {
  const pack = generatePack(data, `LINT${i}`, {});
  for (const card of pack.cards) {
    cards += 1;
    const c = renderCard(card, null, { lint: true });
    const errs = (c.__lint || []).filter((b) => b.error);
    if (errs.length) {
      bad += 1;
      for (const e of errs) {
        const key = `${e.zone}:${e.error}`;
        if (!errors.has(key)) errors.set(key, { n: 0, sample: e });
        errors.get(key).n += 1;
      }
    }
  }
}
console.log("cards", cards, "with problems", bad);
for (const [k, v] of errors) console.log(k, v.n, JSON.stringify(v.sample));
