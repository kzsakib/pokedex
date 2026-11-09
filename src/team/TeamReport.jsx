import { useEffect, useState } from "react";
import { motion } from "motion/react";
import ScoreRing from "./ScoreRing";
import TypeSpread from "./TypeSpread";
import { pixelSpriteUrl } from "../api";
import { typeAccent } from "../typeColors";

/* The report builds itself one panel at a time instead of landing all at
   once: score, strongest, weakest, spread, balance. Each step has its own
   entrance so the run's result reads like a results screen. */
const START = 240;
const STEP = 660;

const spring = { type: "spring", stiffness: 240, damping: 26 };

function Extreme({ label, mon, delta, tone, active }) {
  if (!mon) return null;
  const accent = typeAccent(mon.types[0] ?? "normal");
  const fromTop = tone === "top";

  return (
    <motion.article
      className={`report-panel${fromTop ? " report-panel--shine" : ""}`}
      initial={fromTop ? { opacity: 0, x: 46 } : { opacity: 0, y: 30 }}
      animate={
        active
          ? { opacity: 1, x: 0, y: 0 }
          : { opacity: 0, x: fromTop ? 46 : 0, y: fromTop ? 0 : 30 }
      }
      transition={spring}
    >
      <h5 className="report-label">{label}</h5>
      <div className="report-member">
        <motion.span
          className="report-member__sprite"
          style={{ "--type": accent }}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={active ? { scale: 1, opacity: 1 } : { scale: 0.6, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 18, delay: active ? 0.16 : 0 }}
          aria-hidden="true"
        >
          <img
            src={pixelSpriteUrl(mon.id)}
            alt=""
            width="56"
            height="56"
            loading="lazy"
            decoding="async"
          />
        </motion.span>
        <div className="report-member__copy">
          <p className="report-member__name">{mon.name}</p>
          <p className="report-member__meta">
            {mon.number} · BST {mon.bst}
          </p>
          <p className={`report-member__delta is-${tone}`}>
            {delta > 0 ? `+${delta}` : delta} {delta > 0 ? "above" : "below"} team
            average
          </p>
        </div>
      </div>
    </motion.article>
  );
}

export default function TeamReport({ report }) {
  const { balance, spread, slots, distinct } = report;
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timers = [1, 2, 3, 4, 5].map((step) =>
      window.setTimeout(() => setStage(step), START + (step - 1) * STEP),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  return (
    <motion.section
      className="team-report"
      aria-label="Team report"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.16 } }}
      transition={{ duration: 0.2 }}
    >
      <motion.article
        className="report-panel report-panel--score"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={
          stage >= 1
            ? { opacity: 1, scale: 1 }
            : { opacity: 0, scale: 0.94 }
        }
        transition={spring}
      >
        <ScoreRing score={report.score} active={stage >= 1} />
        <div className="report-panel__copy">
          <motion.h4
            className="report-rank"
            initial={{ opacity: 0, y: 8 }}
            animate={stage >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: 0.4, delay: stage >= 1 ? 0.45 : 0 }}
          >
            {report.rank.title}
          </motion.h4>
          <motion.span
            className="report-rank__rule"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: stage >= 1 ? 1 : 0 }}
            transition={{ duration: 0.5, delay: stage >= 1 ? 0.62 : 0 }}
            aria-hidden="true"
          />
          <motion.p
            className="report-meta"
            initial={{ opacity: 0 }}
            animate={{ opacity: stage >= 1 ? 1 : 0 }}
            transition={{ duration: 0.35, delay: stage >= 1 ? 0.72 : 0 }}
          >
            Team power {report.totalBST.toLocaleString("en-US")} · average{" "}
            {report.average} per Pokémon
          </motion.p>
          <motion.p
            className="report-note"
            initial={{ opacity: 0 }}
            animate={{ opacity: stage >= 1 ? 1 : 0 }}
            transition={{ duration: 0.35, delay: stage >= 1 ? 0.82 : 0 }}
          >
            {report.rank.note}
          </motion.p>
        </div>
      </motion.article>

      <Extreme
        label="Strongest"
        mon={report.strongest}
        delta={report.strongestDelta}
        tone="top"
        active={stage >= 2}
      />
      <Extreme
        label="Weakest"
        mon={report.weakest}
        delta={report.weakestDelta}
        tone="low"
        active={stage >= 3}
      />

      <motion.article
        className="report-panel report-panel--wide"
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={
          stage >= 4
            ? { opacity: 1, y: 0, scale: 1 }
            : { opacity: 0, y: 18, scale: 0.985 }
        }
        transition={spring}
      >
        <h5 className="report-label">Type spread</h5>
        <TypeSpread spread={spread} slots={slots} active={stage >= 4} />
      </motion.article>

      <motion.article
        className="report-panel"
        initial={{ opacity: 0, x: -38 }}
        animate={
          stage >= 5 ? { opacity: 1, x: 0 } : { opacity: 0, x: -38 }
        }
        transition={spring}
      >
        <h5 className="report-label">Type balance</h5>
        <p className="report-balance">{balance.label}</p>
        <div className="report-meter" aria-hidden="true">
          <motion.span
            className="report-meter__fill"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: stage >= 5 ? Math.max(0.04, balance.ratio) : 0 }}
            transition={{ duration: 0.7, delay: stage >= 5 ? 0.2 : 0, ease: [0.2, 0.8, 0.3, 1] }}
          />
        </div>
        <p className="report-fine">
          {distinct} different {distinct === 1 ? "type" : "types"} across {slots}{" "}
          type {slots === 1 ? "slot" : "slots"}
        </p>
        <p className="report-tip">{balance.tip}</p>
      </motion.article>
    </motion.section>
  );
}
