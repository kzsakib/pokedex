import { motion } from "motion/react";
import ScoreRing from "./ScoreRing";
import TypeSpread from "./TypeSpread";
import { pixelSpriteUrl } from "../api";
import { typeAccent } from "../typeColors";

function Extreme({ label, mon, delta, tone }) {
  if (!mon) return null;
  const accent = typeAccent(mon.types[0] ?? "normal");

  return (
    <article className={`report-panel${tone === "top" ? " report-panel--shine" : ""}`}>
      <h5 className="report-label">{label}</h5>
      <div className="report-member">
        <span
          className="report-member__sprite"
          style={{ "--type": accent }}
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
        </span>
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
    </article>
  );
}

/* The report fades in beneath the arena once the cards have landed. Every
   figure comes from computeTeamReport; this file only lays the figures out. */
export default function TeamReport({ report }) {
  const { balance, spread, slots, distinct } = report;

  return (
    <motion.section
      className="team-report"
      aria-label="Team report"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10, transition: { duration: 0.18 } }}
      transition={{ duration: 0.5, delay: 0.55, ease: [0.22, 0.9, 0.3, 1] }}
    >
      <article className="report-panel report-panel--score">
        <ScoreRing score={report.score} />
        <div className="report-panel__copy">
          <h4 className="report-rank">{report.rank.title}</h4>
          <p className="report-meta">
            Team power {report.totalBST.toLocaleString("en-US")} · average{" "}
            {report.average} per Pokémon
          </p>
          <p className="report-note">{report.rank.note}</p>
        </div>
      </article>

      <Extreme
        label="Strongest"
        mon={report.strongest}
        delta={report.strongestDelta}
        tone="top"
      />
      <Extreme
        label="Weakest"
        mon={report.weakest}
        delta={report.weakestDelta}
        tone="low"
      />

      <article className="report-panel report-panel--wide">
        <h5 className="report-label">Type spread</h5>
        <TypeSpread spread={spread} slots={slots} />
      </article>

      <article className="report-panel">
        <h5 className="report-label">Type balance</h5>
        <p className="report-balance">{balance.label}</p>
        <div className="report-meter" aria-hidden="true">
          <motion.span
            className="report-meter__fill"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: Math.max(0.04, balance.ratio) }}
            transition={{ duration: 0.7, delay: 0.65, ease: [0.2, 0.8, 0.3, 1] }}
          />
        </div>
        <p className="report-fine">
          {distinct} different {distinct === 1 ? "type" : "types"} across {slots}{" "}
          type {slots === 1 ? "slot" : "slots"}
        </p>
        <p className="report-tip">{balance.tip}</p>
      </article>
    </motion.section>
  );
}
