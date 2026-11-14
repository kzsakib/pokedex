import { useEffect, useRef } from "react";
import { KantoPacksGame } from "./game.js";
import "./packs.css";

export default function KantoPacks() {
  const stageRef = useRef(null);

  useEffect(() => {
    if (!stageRef.current) return undefined;
    const game = new KantoPacksGame(stageRef.current);
    window.__kanto = game;
    return () => {
      if (window.__kanto === game) delete window.__kanto;
      game.destroy();
    };
  }, []);

  return (
    <section className="bay kp-section" id="kanto-packs" aria-labelledby="packs-title">
      <h2 className="bay-tag bay-tag--rule" id="packs-title">
        <span className="bay-index" aria-hidden="true">
          05
        </span>
        <span className="bay-label">Open a pack</span>
        <span className="bay-rule" aria-hidden="true" />
      </h2>
      <div className="kp-stage" ref={stageRef} />
      <p className="kp-credit">
        Fan project. Not affiliated with Nintendo, Game Freak or The Pokémon
        Company. Sprites from the PokeAPI sprites repository.
      </p>
    </section>
  );
}
