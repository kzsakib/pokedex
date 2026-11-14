const calls = [];
function fakeCanvas() {
  const c = { width: 0, height: 0 };
  c.getContext = () => ({
    fillStyle: "#000", imageSmoothingEnabled: false,
    fillRect() {}, clearRect() {}, drawImage() {}, strokeRect() {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData() {},
  });
  return c;
}
globalThis.document = { createElement: () => fakeCanvas() };
globalThis.__textLog = [];
const { renderCard } = await import("../src/cards/cardRenderer.js");
const card = {
  id: 48, name: "Venonat", genus: "Insect Pokémon", tcg: "Grass", stage: 0, level: 16, hp: 50,
  rarity: "common", shiny: false, finish: "plain",
  moves: [{ name: "Sleep Powder", cost: ["Grass", "Grass"], effect: "Heal 10 damage", damage: null }],
  weakness: "Fire", resistance: null, retreat: 1, height: 1.0, weight: 30,
};
renderCard(card, null);
for (const t of globalThis.__textLog) console.log(`${String(t.y).padStart(4)} x=${String(t.x).padStart(3)} ${t.text}`);
