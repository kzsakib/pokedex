import { useEffect, useRef } from "react";
import { KantoPacksGame } from "./game.js";
import CardTest from "./CardTest.jsx";
import "./packs.css";

export default function KantoPacks() {
  const stageRef = useRef(null);
  const testMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("test") === "cards";

  useEffect(() => {
    if (testMode || !stageRef.current) return undefined;
    const game = new KantoPacksGame(stageRef.current);
    window.__kanto = game;
    return () => {
      if (window.__kanto === game) delete window.__kanto;
      game.destroy();
    };
  }, [testMode]);

  if (testMode) return <CardTest />;

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
        Company. Sprites from the PokeAPI sprites repository. Fusion sprites are
        fan art from the Pokémon Infinite Fusion custom-sprite project, credited
        per card to their artists.
      </p>
    </section>
  );
}
