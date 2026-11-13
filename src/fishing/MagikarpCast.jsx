import { useEffect, useRef } from "react";
import "../../fishing/magikarp.js";
import "./magikarp.css";

/* React only supplies the frame: header, readouts, catch card and rules. The
   game owns the canvas and writes into the [data-mc] slots directly. */
export default function MagikarpCast() {
  const rootRef = useRef(null);

  useEffect(() => {
    const game = window.MagikarpCast;
    if (!game || !rootRef.current) return undefined;
    game.mount(rootRef.current);
    return () => game.destroy?.();
  }, []);

  return (
    <section className="bay mc-bay" id="magikarp-cast" aria-labelledby="mc-title">
      <h2 className="bay-tag bay-tag--rule" id="mc-title">
        <span className="bay-index" aria-hidden="true">
          05
        </span>
        <span className="bay-label">Magikarp cast</span>
        <span className="bay-rule" aria-hidden="true" />
      </h2>

      <div className="mc-shell" ref={rootRef}>
        <p className="mc-intro">
          One pond, five casts. Hold to fill the meter, release over the ripple
          patch, then strike the instant the float dips. Magikarp are the usual
          catch; a perfect cast tempts rarer pond Pokémon, and a perfect cast
          with a perfect hook sometimes wakes something much longer.
        </p>

        <div className="mc-stage">
          <canvas
            className="mc-canvas"
            tabIndex={0}
            role="img"
            aria-label="Isometric pixel island with a pond and a wooden dock. Hold space or press and hold to charge a cast, release to cast at the ripple patch, then press when the float dips."
          />
        </div>

        <p className="mc-status" data-mc="status" role="status" aria-live="polite">
          Five casts · hold, then release to cast
        </p>

        <div className="mc-hud">
          <div className="mc-stat">
            <span className="mc-stat__label">Score</span>
            <span className="mc-stat__value" data-mc="score">
              0
            </span>
          </div>
          <div className="mc-stat">
            <span className="mc-stat__label">Casts</span>
            <span className="mc-casts" data-mc="casts" aria-label="5 of 5 casts left" />
          </div>
          <div className="mc-stat">
            <span className="mc-stat__label">Best round</span>
            <span className="mc-stat__value" data-mc="best">
              0
            </span>
          </div>
          <button
            type="button"
            className="mc-mute"
            data-mc="mute"
            aria-pressed="false"
          >
            Sound on
          </button>
        </div>

        <div className="mc-card" data-mc="card" hidden />

        <footer className="mc-foot">
          <div>
            <p className="mc-label">How to cast</p>
            <p className="mc-rules">
              Hold on the pond to fill the power meter, release to send the
              float. A landing inside the dotted ripple patch is a perfect cast.
            </p>
          </div>
          <div>
            <p className="mc-label">How to hook</p>
            <p className="mc-rules">
              Strike within the first quarter second of the dip for a perfect
              hook. Strike early and the splash scares the fish off.
            </p>
          </div>
          <p className="mc-credit">
            Fishing engine adapted from Pixel Plays by AmirMushich (MIT). A fan
            project; creature designs are original blocky interpretations.
          </p>
        </footer>
      </div>
    </section>
  );
}
