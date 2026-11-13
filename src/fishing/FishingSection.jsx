import { useEffect, useRef } from "react";
import "../../fishing/game.js";
import "./fishing.css";

/* The React half of the Angling Station: it owns the section shell, the HUD
   slots and the rules copy, then hands the panel to the imperative game. The
   game writes into the [data-fish] slots and draws on the canvas; React never
   re-renders it, so a run survives unrelated state changes in the app. */
export default function FishingSection({ onSelect, onCaught }) {
  const rootRef = useRef(null);

  useEffect(() => {
    const station = window.AnglingStation;
    if (!station || !rootRef.current) return undefined;
    station.mount(rootRef.current, { onSelect, onCaught });
    return () => station.destroy?.();
  }, [onSelect, onCaught]);

  return (
    <section
      className="bay fish-bay"
      id="angling-bay"
      aria-labelledby="angling-title"
    >
      <h2 className="bay-tag bay-tag--rule" id="angling-title">
        <span className="bay-index" aria-hidden="true">
          05
        </span>
        <span className="bay-label">Angling station</span>
        <span className="bay-rule" aria-hidden="true" />
      </h2>

      <div className="fish-panel" ref={rootRef}>
        <header className="fish-head">
          <div className="fish-head__copy">
            <p className="fish-eyebrow">Field activity · five waters</p>
            <h3 className="fish-title">Angling station</h3>
            <p className="fish-sub">
              Ten casts a stage, five stages, one old rod. Read the water, hold
              the line short of a snap, and log what comes up — every species
              here also reports back to the specimen record.
            </p>
          </div>

          <dl className="fish-hud" aria-label="Station readouts">
            <div className="fish-stat">
              <dt>Score</dt>
              <dd data-fish="score">0</dd>
            </div>
            <div className="fish-stat">
              <dt>Casts</dt>
              <dd data-fish="casts">10/10</dd>
            </div>
            <div className="fish-stat">
              <dt>Combo</dt>
              <dd data-fish="combo">×1.00</dd>
            </div>
            <div className="fish-stat">
              <dt>Level</dt>
              <dd data-fish="level">L1 · VIRIDIAN POND</dd>
            </div>
            <div className="fish-stat">
              <dt>Coins</dt>
              <dd data-fish="coins">0</dd>
            </div>
          </dl>
        </header>

        <div
          className="fish-rail"
          data-fish="levels"
          role="group"
          aria-label="Fishing stages"
        />

        <div className="fish-stage-wrap">
          <div className="fish-stage">
            <canvas
              className="fish-canvas"
              tabIndex={0}
              role="img"
              aria-label="Isometric pixel diorama of the current fishing spot. Hold the pointer or Space to charge a cast, release to throw, strike when the bobber dips, then hold to reel and release when the fish thrashes."
            />
          </div>
          <p className="fish-status" data-fish="status" aria-live="polite">
            Hold to charge a cast, release to throw.
          </p>
        </div>

        <div className="fish-card" data-fish="card" hidden />
        <div className="fish-kit" data-fish="kit" hidden />

        <footer className="fish-foot">
          <div>
            <p className="fish-label">Rules</p>
            <p className="fish-rules">
              Hold to charge a cast, release to throw. Strike when the bobber
              dips. Hold to reel, release when it thrashes. Deeper water holds
              rarer species; a snapped line costs the cast.
            </p>
          </div>
          <div>
            <p className="fish-label">Controls</p>
            <p className="fish-rules">
              Mouse or touch on the diorama, or Space when it has focus. Esc
              pauses. Sound follows the instrument’s Sound key.
            </p>
          </div>
        </footer>
      </div>
    </section>
  );
}
