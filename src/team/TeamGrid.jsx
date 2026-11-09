import { useMemo } from "react";
import { motion } from "motion/react";
import PokemonCard from "./PokemonCard";
import { typeAccent } from "../typeColors";

const PIECES = 26;

/* Deterministic confetti: no Math.random, so a re-render cannot restage the
   burst. Every piece is transform + opacity, and reduced-motion never turns
   it off — the bay is an animation instrument by design. */
function Celebration({ colors }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, index) => ({
        left: ((index * 37) % 100) / 100,
        drift: ((index % 5) - 2) * 16,
        spin: 180 + ((index * 47) % 300),
        delay: (index % 7) * 0.035,
        duration: 0.85 + (index % 4) * 0.17,
        color: colors[index % colors.length],
      })),
    [colors],
  );

  return (
    <div className="team-celebration" aria-hidden="true">
      {pieces.map((piece, index) => (
        <motion.span
          key={index}
          className="team-celebration__piece"
          style={{
            left: `${piece.left * 100}%`,
            background: piece.color,
          }}
          initial={{ y: -12, x: 0, opacity: 0, scale: 0.5, rotate: 0 }}
          animate={{
            y: [-12, 54, 200],
            x: [0, piece.drift, piece.drift * 1.6],
            opacity: [0, 1, 1, 0],
            scale: 1,
            rotate: piece.spin,
          }}
          transition={{
            duration: piece.duration,
            delay: 0.52 + piece.delay,
            times: [0, 0.12, 0.72, 1],
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

/* The reveal layer. It is positioned over the measured stage, so the grid
   lands in the middle of the arena rather than on top of the footer. */
export default function TeamGrid({
  slots,
  stageBox,
  caughtCount,
  revealKey,
}) {
  const colors = useMemo(() => {
    const found = slots
      .filter(Boolean)
      .flatMap((mon) => mon.types ?? []);
    return found.length
      ? [...new Set(found)].map((type) => typeAccent(type))
      : ["#e3b53c", "#f2c94c", "#8fa3ad"];
  }, [slots]);

  return (
    <motion.div
      className="team-reveal"
      style={
        stageBox
          ? {
              top: stageBox.top,
              left: stageBox.left,
              width: stageBox.width,
              height: stageBox.height,
              "--stage-h": `${stageBox.height}px`,
            }
          : undefined
      }
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <div className="team-reveal__scrim" aria-hidden="true" />

      <p className="team-reveal__banner">
        <span className="team-reveal__dot" aria-hidden="true" />
        Run complete — {caughtCount} of 6 slots filled
      </p>

      <div
        className="team-grid"
        role="group"
        aria-label={`Team of ${caughtCount} revealed`}
      >
        {slots.map((mon, index) =>
          mon ? (
            <PokemonCard key={mon.id} mon={mon} index={index} />
          ) : (
            <motion.div
              key={`empty-${index}`}
              className="team-card is-empty"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.12 + index * 0.05, duration: 0.3 }}
            >
              <span>Empty slot</span>
            </motion.div>
          ),
        )}
      </div>

      <Celebration key={revealKey} colors={colors} />
    </motion.div>
  );
}
