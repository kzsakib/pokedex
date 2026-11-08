import { useEffect, useMemo, useRef, useState } from "react";
import { CatchArena } from "./CatchArena";
import { pixelSpriteUrl } from "../api";
import "./team.css";

const HINTS = {
  loading: "Readying",
  ready: "Swipe to throw",
  aim: "Release to throw",
  flying: "In flight",
  catching: "Capturing",
  caught: "Gotcha",
  missed: "Missed",
  roundOver: "Round closed",
  complete: "Run complete",
};

const EMPTY = {
  round: 1,
  rounds: 6,
  balls: 3,
  team: [],
  phase: "loading",
  message: "",
  mons: [],
};

function BallIcon({ size = 18, dim = false }) {
  return (
    <svg
      className={`team-ball${dim ? " is-dim" : ""}`}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="10" cy="10" r="8.6" fill="#eef0ef" stroke="#0e1417" strokeWidth="1.6" />
      <path d="M1.6 10h16.8" stroke="#0e1417" strokeWidth="1.6" />
      <path d="M1.6 10a8.4 8.4 0 0 1 16.8 0Z" fill="#d8452f" stroke="#0e1417" strokeWidth="1.6" />
      <circle cx="10" cy="10" r="3" fill="#eef0ef" stroke="#0e1417" strokeWidth="1.6" />
      <circle cx="10" cy="10" r="1.1" fill="#0e1417" />
    </svg>
  );
}

export default function TeamBuilder({ roster = [] }) {
  const hostRef = useRef(null);
  const arenaRef = useRef(null);
  const rosterRef = useRef(roster);
  rosterRef.current = roster;

  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let arena = null;
    let poll = 0;
    let observer = null;
    let parker = null;

    const start = () => {
      if (arena) return true;
      if (rosterRef.current.length < 3) {
        poll = window.setTimeout(start, 500);
        return false;
      }
      arena = new CatchArena(host, { roster: rosterRef.current, onState: setState });
      arenaRef.current = arena;
      arena.mount();
      return true;
    };

    /* The engine is heavy, so it only boots when the bay comes into view —
       and never on a save-data connection that asked for reduced motion. */
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer?.disconnect();
            observer = null;
            start();
          }
        },
        { rootMargin: "320px" },
      );
      observer.observe(host);
    } else {
      start();
    }

    /* Once it is awake the arena still parks its render loop whenever the
       panel scrolls away, so reading the dex does not keep the GPU busy. */
    if ("IntersectionObserver" in window) {
      parker = new IntersectionObserver((entries) => {
        arenaRef.current?.setAwake(entries.some((entry) => entry.isIntersecting));
      });
      parker.observe(host);
    }

    return () => {
      observer?.disconnect();
      parker?.disconnect();
      window.clearTimeout(poll);
      arena?.destroy();
      arenaRef.current = null;
    };
  }, []);

  const team = state.team || [];
  const slots = useMemo(() => {
    const filled = team.slice(0, 6);
    while (filled.length < 6) filled.push(null);
    return filled;
  }, [team]);

  const closed = state.phase === "roundOver" || state.phase === "complete";
  const complete = state.phase === "complete";
  /* The toast only carries what the engine chose to say — instructions live
     in the header and the HUD, so the two never repeat each other. */
  const announce = Boolean(state.message);

  const nextLabel = complete ? "Play again" : "Next round";

  return (
    <div className="team-panel">
      <header className="team-head">
        <span className="team-mark" aria-hidden="true">
          <BallIcon size={34} />
        </span>
        <div className="team-head__copy">
          <h3 className="team-title">Catch 6 Pokémon</h3>
          <p className="team-sub">
            They wander, so lead your throw. The ball lands where the swipe
            ends, and a curl bends it on the way.
          </p>
        </div>
        <p className="team-round">
          <span className="team-round__label">Round</span>
          <span className="team-round__value">{state.round}</span>
          <span className="team-round__total">/ {state.rounds}</span>
        </p>
      </header>

      <div className="team-stage">
        <div className="team-hud">
          <span className="team-hud__balls">
            <BallIcon size={16} />
            <span aria-hidden="true">×</span>
            <b>{state.balls}</b>
          </span>
          <span className="team-hud__hint">{HINTS[state.phase] ?? "Swipe to throw"}</span>
        </div>

        <div
          className="team-canvas"
          ref={hostRef}
          role="application"
          aria-label="Catching arena. Press on the Poké Ball, swipe to where a moving Pokémon is and release to throw."
        />

        <p className={`team-toast${announce ? " is-on" : ""}`} aria-live="polite">
          {announce ? state.message : ""}
        </p>
      </div>

      <footer className="team-foot">
        <div className="team-slots">
          <p className="team-slots__label">Your team</p>
          <ul className="team-slot-row">
            {slots.map((mon, index) => (
              <li
                key={mon ? mon.id : `empty-${index}`}
                className={`team-slot${mon ? " is-filled" : ""}`}
                data-empty={mon ? undefined : "true"}
              >
                {mon ? (
                  <>
                    <img
                      src={pixelSpriteUrl(mon.id)}
                      alt=""
                      width="44"
                      height="44"
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="team-slot__name">{mon.name}</span>
                  </>
                ) : (
                  <>
                    <BallIcon size={22} dim />
                    <span className="team-slot__name" aria-hidden="true">
                      —
                    </span>
                  </>
                )}
                <span className="visually-hidden">
                  {mon ? `${mon.name} caught` : `slot ${index + 1} empty`}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          className="team-cta"
          onClick={() => {
            if (complete) arenaRef.current?.resetGame();
            else if (closed) arenaRef.current?.nextRound();
          }}
          disabled={!closed}
        >
          {nextLabel}
          <span aria-hidden="true">›</span>
        </button>
      </footer>
    </div>
  );
}
