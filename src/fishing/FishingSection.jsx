import { useEffect, useRef } from "react";
import "../../fishing/game.js";
import "./fishing.css";

/* The React half of the Angling Station: section shell, map strip, readouts
   and rules copy. The game writes into the [data-fish] slots and paints the
   canvas; React never re-renders it, so a run survives app state changes. */
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

      <div className="fish-shell" ref={rootRef}>
        <p className="fish-intro">
          Five waters charted off the registry. Pick a map, read the pond, then
          click the water where you want the line to land — shallow edges hold
          the common catch, the middle holds the rare ones. Everything you land
          is logged to the archive.
        </p>

        <div
          className="fish-maps"
          data-fish="levels"
          role="group"
          aria-label="Fishing maps"
        />

        <div className="fish-stage-wrap">
          <div className="fish-stage">
            <canvas
              className="fish-canvas"
              tabIndex={0}
              role="img"
              aria-label="Isometric pixel island with a pond. Click or tap the water to cast, strike when the bobber dips, then hold to reel and release when the fish thrashes."
            />
          </div>
          <p className="fish-status" data-fish="status" aria-live="polite">
            Pick a spot on the water and click to cast.
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
            <dt>Map</dt>
            <dd data-fish="level">L1 · VIRIDIAN POND</dd>
          </div>
          <div className="fish-stat">
            <dt>Coins</dt>
            <dd data-fish="coins">0</dd>
          </div>
        </dl>

        <div className="fish-card" data-fish="card" hidden />
        <div className="fish-kit" data-fish="kit" hidden />
        <div className="fish-log" data-fish="log" />

        <footer className="fish-foot">
          <div>
            <p className="fish-label">Rules</p>
            <p className="fish-rules">
              Click the water to cast, strike when the bobber dips. Hold to
              reel, release when it thrashes. Deeper water holds rarer species;
              a snapped line costs the cast.
            </p>
          </div>
          <div>
            <p className="fish-label">Controls</p>
            <p className="fish-rules">
              Mouse or touch on the pond, Space to cast blind, Esc to pause,
              arrow keys to change map. Sound follows the instrument’s Sound
              key.
            </p>
          </div>
        </footer>
      </div>
    </section>
  );
}
