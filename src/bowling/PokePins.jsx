import { useEffect, useRef } from "react";
import "./game.js";
import "./bowling.css";

/* The React shell for Poké-Pins: map strip, scorecard, status and rules. The
   game paints the canvas and fills the [data-bowl] slots directly. */
export default function PokePins() {
  const rootRef = useRef(null);

  useEffect(() => {
    const game = window.PokePins;
    if (!game || !rootRef.current) return undefined;
    game.mount(rootRef.current);
    return () => game.destroy?.();
  }, []);

  return (
    <section className="bay pp-bay" id="poke-pins" aria-labelledby="pp-title">
      <h2 className="bay-tag bay-tag--rule" id="pp-title">
        <span className="bay-index" aria-hidden="true">
          05
        </span>
        <span className="bay-label">Poké-Pins</span>
        <span className="bay-rule" aria-hidden="true" />
      </h2>

      <div className="pp-shell" ref={rootRef}>
        <p className="pp-intro">
          Ten frames, five lanes. Drag back from the bowler to set your hook and
          power, release at the pocket, and clear the rack. Pins are Pokémon;
          each lane has its own weather, its own ball and its own reason to
          throw again.
        </p>

        <div className="pp-maps" data-bowl="maps" role="group" aria-label="Bowling lanes" />
        <p className="pp-note" data-bowl="note" />

        <div className="pp-stage">
          <canvas
            className="pp-canvas"
            tabIndex={0}
            role="img"
            aria-label="Isometric bowling lane. Drag back and release to bowl, arrows to aim and set power, A and D to move along the foul line, Q and E for spin."
          />
        </div>

        <p className="pp-status" data-bowl="status" role="status" aria-live="polite">
          drag back and release to bowl
        </p>
        <p className="pp-banner" data-bowl="banner" aria-hidden="true" hidden />

        <div className="pp-scorecard">
          <div className="pp-score" data-bowl="you" />
          <div className="pp-score pp-score--rival" data-bowl="rival" hidden />
          <div className="pp-meta">
            <div className="pp-meta__block">
              <span className="pp-meta__label">Total</span>
              <span className="pp-meta__value" data-bowl="total">
                –
              </span>
            </div>
            <div className="pp-meta__block">
              <span className="pp-meta__label">Best</span>
              <span className="pp-meta__value" data-bowl="best">
                0
              </span>
            </div>
            <div className="pp-meta__block pp-meta__block--pins">
              <span className="pp-meta__label">Rack</span>
              <span className="pp-pins" data-bowl="pins" aria-label="10 pins standing" />
            </div>
          </div>
        </div>

        <div className="pp-touch" aria-label="Position and spin">
          <span className="pp-touch__label">pos</span>
          <button type="button" className="pp-touch__btn" data-nudge="pos-left" aria-label="Move left">
            ‹
          </button>
          <button type="button" className="pp-touch__btn" data-nudge="pos-right" aria-label="Move right">
            ›
          </button>
          <span className="pp-touch__label">spin</span>
          <button type="button" className="pp-touch__btn" data-nudge="spin-left" aria-label="Less spin">
            ‹
          </button>
          <span className="pp-touch__val" data-bowl="spin">
            0
          </span>
          <button type="button" className="pp-touch__btn" data-nudge="spin-right" aria-label="More spin">
            ›
          </button>
        </div>

        <div className="pp-controls">
          <div className="pp-modes" role="group" aria-label="Mode">
            <button type="button" className="pp-mode" data-mode="solo">
              Solo
            </button>
            <button type="button" className="pp-mode" data-mode="versus">
              Versus rival
            </button>
          </div>
          <button type="button" className="pp-mute" data-bowl="mute" aria-pressed="false">
            Sound on
          </button>
        </div>

        <footer className="pp-foot">
          <div>
            <p className="pp-label">The frame</p>
            <p className="pp-rules">
              Two rolls a frame, ten pins, re-set after a strike or the second
              ball. Strike scores 10 plus the next two rolls; spare scores 10
              plus the next one. The tenth frame earns bonus balls.
            </p>
          </div>
          <div>
            <p className="pp-label">The throw</p>
            <p className="pp-rules">
              Pull back to load power, angle the pull to aim, Q/E for spin.
              Hook bites in the dry back half of the lane. A gutter ball scores
              nothing and the frame moves on.
            </p>
          </div>
          <p className="pp-credit">
            Ten-pin lane and rasteriser adapted from Pixel Plays by AmirMushich
            (MIT). Concept: abhi, game: AmirMushich. Fan project; every Pokémon
            here is drawn from primitives, no sprites or official art.
          </p>
        </footer>
      </div>
    </section>
  );
}
