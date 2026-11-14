import { useEffect, useRef, useState } from "react";
import { renderCard, CARD_W, CARD_H, F3, F5, textWidth } from "./cardRenderer.js";
import { spriteFor } from "./assets.js";

const TYPES = ["Fire", "Water", "Grass", "Lightning", "Psychic", "Fighting", "Colorless"];

const base = {
  stage: 0,
  level: 15,
  hp: 120,
  rarity: "rare",
  shiny: false,
  genus: "MOUSE",
  id: 27,
  height: 0.6,
  weight: 12,
  retreat: 3,
  weakness: "Water",
  resistance: "Lightning",
  moves: [
    {
      cost: ["Lightning", "Lightning", "Colorless"],
      name: "THUNDERBOLT",
      display: "60×",
      effect: "FLIP 4 COINS FOR DAMAGE",
    },
  ],
};

const CARDS = [
  { ...base, id: 9, name: "BLASTOISE", tcg: "Water", stage: 2, hp: 130, rarity: "holo" },
  { ...base, id: 83, name: "FARFETCH'D", tcg: "Colorless", hp: 100, rarity: "uncommon" },
  { ...base, id: 29, name: "NIDORAN♀", tcg: "Psychic", hp: 90, rarity: "common" },
  { ...base, id: 32, name: "NIDORAN♂", tcg: "Psychic", hp: 95, rarity: "common" },
  { ...base, id: 122, name: "MR. MIME", tcg: "Psychic", hp: 110, rarity: "rare" },
  { ...base, id: 101, name: "ELECTRODE", tcg: "Lightning", hp: 140, rarity: "legend" },
  { ...base, id: 71, name: "VICTREEBEL", tcg: "Grass", hp: 125, rarity: "rare", shiny: true },
  {
    ...base,
    id: 6,
    name: "CHARIZARD",
    tcg: "Fire",
    hp: 120,
    rarity: "legend",
    resistance: null,
    weakness: null,
    moves: [
      { cost: ["Fire", "Fire"], name: "FLAMETHROWER", display: "60", effect: "HEADS: CONFUSED" },
      { cost: ["Fire", "Colorless", "Colorless"], name: "DREAM EATER", display: "-", effect: "" },
    ],
  },
  {
    ...base,
    id: 95,
    name: "ONIX",
    tcg: "Fighting",
    hp: 110,
    rarity: "common",
    moves: [
      { cost: ["Fighting"], name: "HARDEN", display: "-", effect: "" },
    ],
  },
  { ...base, id: 1, name: "BULBASAUR", tcg: "Grass", hp: 70, rarity: "uncommon" },
];

export default function CardTest() {
  const [fixtures, setFixtures] = useState([]);
  const hostRef = useRef(null);
  const debug = new URLSearchParams(location.search).get("debug") === "bounds";

  useEffect(() => {
    let alive = true;
    (async () => {
      const out = [];
      for (const card of CARDS) {
        let sprite = null;
        try {
          sprite = await spriteFor(card);
        } catch {
          sprite = null;
        }
        out.push({ card, canvas: renderCard(card, sprite) });
        window.__cards = out.map((o) => o.canvas);
      }
      if (alive) setFixtures(out);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!hostRef.current || !fixtures.length) return;
    hostRef.current.innerHTML = "";
    const k = 4;
    for (const { card, canvas } of fixtures) {
      const fig = document.createElement("figure");
      fig.style.margin = "0";
      const big = document.createElement("canvas");
      big.width = CARD_W * k;
      big.height = CARD_H * k;
      big.style.width = `${CARD_W * k}px`;
      big.style.height = `${CARD_H * k}px`;
      big.style.imageRendering = "pixelated";
      big.style.display = "block";
      const ctx = big.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(canvas, 0, 0, CARD_W * k, CARD_H * k);
      if (debug) {
        ctx.strokeStyle = "#ff00ff";
        ctx.lineWidth = 1;
        const boxes = [
          [5, 4, 88, 7],
          [7, 13, 78, 7],
          [9, 87, 78, 5],
          [8, 94, 84, 15],
          [8, 111, 84, 15],
          [6, 126, 88, 9],
        ];
        boxes.forEach(([x, y, w, h]) => ctx.strokeRect(x * k + 0.5, y * k + 0.5, w * k, h * k));
      }
      const cap = document.createElement("figcaption");
      cap.textContent = `${card.name} · ${card.tcg} · ${card.rarity}`;
      cap.style.cssText = "color:#cfcadf;font:11px/1.4 monospace;padding:6px 0";
      fig.append(big, cap);
      hostRef.current.append(fig);
    }

    const overflow = [];
    for (const { card } of fixtures) {
      const nameW = textWidth(String(card.name).toUpperCase(), F5, 1);
      if (nameW > 78) overflow.push(`${card.name} name ${nameW}px`);
      for (const move of card.moves) {
        const nameW2 = textWidth(String(move.name).toUpperCase(), F3, 1);
        const costW = (move.cost || []).slice(0, 3).length * 8 + 2;
        const dmgW = textWidth(String(move.display || ""), F5, 0);
        if (costW + nameW2 + dmgW + 4 > 84) overflow.push(`${card.name} move ${move.name}`);
        if (move.effect && textWidth(String(move.effect).toUpperCase(), F3, 1) > 82) {
          overflow.push(`${card.name} effect ${move.effect}`);
        }
      }
    }
    if (overflow.length) console.warn("[cards] overflow:", overflow);
    else console.info("[cards] no overflow in", fixtures.length, "stress cards");
  }, [fixtures, debug]);

  return (
    <section className="bay kp-section" id="kanto-packs">
      <h2 className="bay-tag bay-tag--rule">
        <span className="bay-label">Card stress test</span>
        <span className="bay-rule" aria-hidden="true" />
      </h2>
      <div
        ref={hostRef}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(400px, 400px))",
          gap: "18px",
          padding: "18px 0",
          justifyContent: "center",
          background: "#14122a",
        }}
      />
    </section>
  );
}
