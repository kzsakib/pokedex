import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, MotionConfig } from "motion/react";
import { CatchArena } from "./CatchArena";
import { fetchPokemon, formatNumber } from "../api";
import { playSfx } from "../audio";
import TeamStrip from "./TeamStrip";
import TeamGrid from "./TeamGrid";
import TeamReport from "./TeamReport";
import GymGauntlet from "../gauntlet/GymGauntlet";
import CatchFlight from "./CatchFlight";
import BallGlyph from "./BallGlyph";
import { computeTeamReport } from "./teamReport";
import "./team.css";

const HINTS = {
  loading: "Readying",
  ready: "Swipe to throw",
  aim: "Release to throw",
  flying: "In flight",
  catching: "Capturing",
  broke: "Broke free",
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
  odds: null,
  ball: null,
  rack: [],
  mons: [],
};

/* Types and base stat total come from the same /pokemon payload the dex
   already fetches, and api.js caches it, so a member costs one request at
   most. Kept at module scope so a remount does not refetch the team. */
const FACTS = new Map();

function useTeamFacts(team) {
  const [version, setVersion] = useState(0);
  const ids = team.map((mon) => mon.id).join(",");

  useEffect(() => {
    let live = true;
    team.forEach((mon) => {
      if (FACTS.has(mon.id)) return;
      fetchPokemon(mon.id)
        .then((data) => {
          FACTS.set(mon.id, {
            types: [...(data.types ?? [])]
              .sort((a, b) => a.slot - b.slot)
              .map((entry) => entry.type.name),
            bst: (data.stats ?? []).reduce(
              (sum, stat) => sum + (stat.base_stat ?? 0),
              0,
            ),
            number: formatNumber(mon.id),
          });
        })
        .catch(() => {
          FACTS.set(mon.id, { types: [], bst: 0, number: formatNumber(mon.id) });
        })
        .finally(() => {
          if (live) setVersion((value) => value + 1);
        });
    });
    return () => {
      live = false;
    };
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo(
    () =>
      team.map((mon) => ({
        ...mon,
        ...(FACTS.get(mon.id) ?? { number: formatNumber(mon.id) }),
      })),
    [team, ids, version],
  );
}

export default function TeamBuilder({ roster = [] }) {
  const hostRef = useRef(null);
  const stageRef = useRef(null);
  const panelRef = useRef(null);
  const slotRefs = useRef([]);
  const arenaRef = useRef(null);
  const rosterRef = useRef(roster);
  rosterRef.current = roster;

  const [state, setState] = useState(EMPTY);
  const [flights, setFlights] = useState([]);
  const [landed, setLanded] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [revealKey, setRevealKey] = useState(0);
  /* The gauntlet replaces the report in place; the section stays 04. */
  const [gauntletOpen, setGauntletOpen] = useState(false);
  /* The reveal floats over the panel at the stage's box rather than inside
     it, so the clipped arena canvas can never spill behind the cards. */
  const [stageBox, setStageBox] = useState(null);

  const team = state.team || [];
  /* Evolutions the gauntlet has triggered this run, keyed by the caught id.
     The six big cards read the evolved species while the run holds the map. */
  const [grown, setGrown] = useState({});
  const handleEvolve = useCallback((map) => {
    setGrown((previous) => {
      const next = map ?? {};
      const keys = Object.keys(next);
      const same =
        keys.length === Object.keys(previous).length &&
        keys.every((key) => previous[key]?.id === next[key]?.id);
      return same ? previous : next;
    });
  }, []);
  const displayTeam = useMemo(
    () =>
      team.map((mon) => {
        const grownMon = grown[mon.id];
        return grownMon
          ? { ...mon, id: grownMon.id, name: grownMon.name }
          : mon;
      }),
    [team, grown],
  );
  const enriched = useTeamFacts(displayTeam);
  const slots = useMemo(() => {
    const filled = enriched.slice(0, 6);
    while (filled.length < 6) filled.push(null);
    return filled;
  }, [enriched]);

  const complete = state.phase === "complete";
  const closed = state.phase === "roundOver" || complete;
  const report = useMemo(() => computeTeamReport(enriched), [enriched]);

  /* The catch handler is read through a ref so the arena, which is created
     once, always calls the current version of it. */
  const catchRef = useRef(null);
  catchRef.current = (event) => {
    if (event?.type !== "catch") return;
    const target = slotRefs.current[event.slot];
    const stage = stageRef.current?.getBoundingClientRect();
    const panel = panelRef.current?.getBoundingClientRect();
    if (!target || !stage || !panel) return;
    const box = target.getBoundingClientRect();
    setFlights((list) => [
      ...list,
      {
        key: `${event.mon.id}-${list.length}-${Date.now()}`,
        mon: event.mon,
        from: {
          x: stage.left - panel.left + stage.width / 2,
          y: stage.top - panel.top + stage.height * 0.55,
        },
        to: {
          x: box.left - panel.left + box.width / 2,
          y: box.top - panel.top + box.height / 2,
        },
      },
    ]);
  };

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
      arena = new CatchArena(host, {
        roster: rosterRef.current,
        onState: setState,
        onEvent: (event) => catchRef.current?.(event),
      });
      arenaRef.current = arena;
      arena.mount();
      return true;
    };

    /* The engine is heavy, so it only boots when the bay comes into view. */
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

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const panel = panelRef.current;
    if (!stage || !panel) return undefined;

    const measure = () => {
      const box = stage.getBoundingClientRect();
      const frame = panel.getBoundingClientRect();
      setStageBox({
        top: box.top - frame.top,
        left: box.left - frame.left,
        width: box.width,
        height: box.height,
      });
    };

    measure();
    let observer;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      observer.observe(stage);
      observer.observe(panel);
    }
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  /* The run closes, the arena empties, then the six slots take over the
     stage on their own. */
  useEffect(() => {
    if (!complete) {
      setRevealed(false);
      return undefined;
    }
    if (!team.length) return undefined;
    const timer = window.setTimeout(() => setRevealed(true), 850);
    return () => window.clearTimeout(timer);
  }, [complete, team.length]);

  const openReveal = () => {
    setRevealed(true);
    setRevealKey((value) => value + 1);
  };

  const replay = () => {
    setRevealed(false);
    window.setTimeout(() => {
      setRevealed(true);
      setRevealKey((value) => value + 1);
    }, 80);
  };

  const onSlot = () => {
    if (!complete) return;
    if (revealed) replay();
    else openReveal();
  };

  const finishFlight = (flight) => {
    setFlights((list) => list.filter((item) => item.key !== flight.key));
    const slot = slots.findIndex((mon) => mon?.id === flight.mon.id);
    if (slot >= 0) {
      setLanded(slot);
      window.setTimeout(() => setLanded(null), 760);
    }
    playSfx("land");
  };

  const primary = () => {
    if (complete) {
      arenaRef.current?.resetGame();
      setRevealed(false);
      setFlights([]);
      setGauntletOpen(false);
      setGrown({});
      return;
    }
    if (closed) arenaRef.current?.nextRound();
  };

  const announce = Boolean(state.message) && !revealed;

  return (
    <MotionConfig reducedMotion="never">
      <LayoutGroup id="team-reveal">
        <div className="team-panel" ref={panelRef}>
          <header className="team-head">
            <span className="team-mark" aria-hidden="true">
              {state.ball?.icon ? (
                <img
                  className="team-ball team-ball--mark"
                  src={state.ball.icon}
                  alt=""
                  width="34"
                  height="34"
                  decoding="async"
                />
              ) : (
                <BallGlyph size={34} />
              )}
            </span>
            <div className="team-head__copy">
              <h3 className="team-title">Catch 6 Pokémon</h3>
              <p className="team-sub">
                They wander, so lead your throw. The ball lands where the swipe
                ends, and a curl bends it on the way. Each throw pulls its own
                ball from the bag — only the one in hand is shown.
              </p>
            </div>
            <p className="team-round">
              <span className="team-round__label">Round</span>
              <span className="team-round__value">{state.round}</span>
              <span className="team-round__total">/ {state.rounds}</span>
            </p>
          </header>

          <div className="team-stage" ref={stageRef}>
            {!complete && (
              <div className="team-hud">
                <span
                  className="team-hud__balls"
                  title={state.ball?.name}
                  aria-label={`${state.ball?.name ?? "Poké Ball"} in hand, ${
                    state.balls
                  } ${state.balls === 1 ? "ball" : "balls"} left`}
                >
                  {state.ball?.icon ? (
                    <img
                      className="team-ball"
                      src={state.ball.icon}
                      alt=""
                      width="16"
                      height="16"
                      decoding="async"
                    />
                  ) : (
                    <BallGlyph size={16} />
                  )}
                  <b>×{state.balls}</b>
                </span>
                <span className="team-hud__hint">
                  {state.odds
                    ? `Catch ${state.odds}%`
                    : (HINTS[state.phase] ?? "Swipe to throw")}
                </span>
              </div>
            )}

            <div
              className="team-canvas"
              ref={hostRef}
              role="application"
              aria-label="Catching arena. Press on the Poké Ball, swipe to where a moving Pokémon is and release to throw."
            />

            <p
              className={`team-toast${announce ? " is-on" : ""}`}
              aria-live="polite"
            >
              {announce ? state.message : ""}
            </p>

          </div>

          {revealed && stageBox && (
            <TeamGrid
              slots={slots}
              stageBox={stageBox}
              caughtCount={report.count}
              revealKey={revealKey}
            />
          )}

          <AnimatePresence initial={false}>
            {revealed && report.count > 0 && !gauntletOpen && (
              <TeamReport key="team-report" report={report} />
            )}
          </AnimatePresence>

          {gauntletOpen && complete && (
            <GymGauntlet
              team={team}
              onTeamEvolve={handleEvolve}
              onBack={() => setGauntletOpen(false)}
            />
          )}

          {/* The strip and its actions sit under the report, so the cards
              and the results read top to bottom before the controls. */}
          <footer className="team-foot">
            <TeamStrip
              slots={slots}
              revealed={revealed}
              landedSlot={landed}
              canReveal={complete}
              slotRefs={slotRefs}
              onSlot={onSlot}
            />

            <div className="team-actions">
              {!gauntletOpen && complete && (
                <button
                  type="button"
                  className="team-ghost"
                  onClick={revealed ? () => setRevealed(false) : openReveal}
                >
                  {revealed ? "Hide team" : "Show team"}
                </button>
              )}
              {!gauntletOpen && (
                <button
                  type="button"
                  className="team-cta team-gauntlet"
                  onClick={() => {
                    setRevealed(true);
                    setGauntletOpen(true);
                  }}
                  disabled={report.count < 6}
                  title={
                    report.count < 6
                      ? "Fill all six slots to start the gauntlet"
                      : "Take the six through all eight gyms"
                  }
                >
                  Start gym gauntlet
                  <span aria-hidden="true">›</span>
                </button>
              )}
              {!gauntletOpen && (
                <button
                  type="button"
                  className="team-cta"
                  onClick={primary}
                  disabled={!closed}
                >
                  {complete ? "Play again" : "Next round"}
                  <span aria-hidden="true">›</span>
                </button>
              )}
              {gauntletOpen && (
                <button
                  type="button"
                  className="team-ghost"
                  onClick={() => setGauntletOpen(false)}
                >
                  ‹ Back to team
                </button>
              )}
            </div>
          </footer>

          <p className="visually-hidden" role="status">
            {revealed
              ? `Team of ${report.count} revealed. ${slots
                  .filter(Boolean)
                  .map((mon) => mon.name)
                  .join(", ")}.`
              : ""}
          </p>

          <div className="team-flight-layer" aria-hidden="true">
            {flights.map((flight) => (
              <CatchFlight
                key={flight.key}
                mon={flight.mon}
                from={flight.from}
                to={flight.to}
                onDone={() => finishFlight(flight)}
              />
            ))}
          </div>
        </div>
      </LayoutGroup>
    </MotionConfig>
  );
}
