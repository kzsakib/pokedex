import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { GYMS, gymTeam } from "./gyms";
import { BADGE_SHEET, prepareGym, prepareTeam } from "./loader";
import { estimateWinChance } from "./estimate";
import { multipliersForBadges, runBattle, typeMultiplier } from "./gen1Battle";
import { playSfx } from "../audio";
import { typeAccent } from "../typeColors";
import { pixelSpriteUrl } from "../api";
import BallGlyph from "../team/BallGlyph";
import "./gauntlet.css";

/* ---------- small helpers ---------- */

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return undefined;
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener?.("change", sync);
    return () => query.removeEventListener?.("change", sync);
  }, []);
  return reduced;
};

const useTypewriter = (text, speed = 10) => {
  const [shown, setShown] = useState("");
  useEffect(() => {
    if (!text) {
      setShown("");
      return undefined;
    }
    let index = 0;
    setShown("");
    const timer = window.setInterval(() => {
      index += 1;
      setShown(text.slice(0, index));
      if (index >= text.length) window.clearInterval(timer);
    }, speed);
    return () => window.clearInterval(timer);
  }, [text, speed]);
  return shown;
};

const hpTone = (ratio) => (ratio > 0.5 ? "high" : ratio > 0.2 ? "low" : "crit");

const typeChip = (type) => (
  <span key={type} className="gg-chip" style={{ "--chip": typeAccent(type) }}>
    {type}
  </span>
);

/* The official trainer-card sheet is a PNG of the eight badge tiles. Each
   earned badge gets a colour wash in its gym's type colour, so the case reads
   rock / water / electric at a glance instead of eight grey shapes. */
function BadgeSprite({ tile, scale = 3, earned = true, name, loaded = true, tint }) {
  if (!loaded) {
    return (
      <span className={`gg-badge-name${earned ? " is-earned" : " is-locked"}`}>
        {name}
      </span>
    );
  }
  const size = 16 * scale;
  return (
    <span
      className={`gg-badge${earned ? " is-earned" : " is-locked"}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${name}${earned ? "" : " (locked)"}`}
    >
      <span
        className="gg-badge__art"
        style={{
          backgroundImage: `url(${BADGE_SHEET})`,
          backgroundSize: `${size}px ${256 * scale}px`,
          backgroundPosition: `0 ${-tile * size}px`,
        }}
      />
      {earned && tint ? (
        <span className="gg-badge__tint" style={{ background: tint }} aria-hidden="true" />
      ) : null}
    </span>
  );
}

/* One probe for the whole sprite sheet; if it never loads the badge falls
   back to its name in mono text. */
const useBadgeSheet = () => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    const image = new Image();
    image.onload = () => live && setLoaded(true);
    image.src = BADGE_SHEET;
    return () => {
      live = false;
    };
  }, []);
  return loaded;
};

/* The playback cursor resolved into who is on the field and how much HP each
   side has. Pure, so the arena only has to render. */
function stateFromLog(prepared, log, cursor) {
  const playerHp = (index) => prepared.player[index]?.stats.maxHp ?? 0;
  const enemyHp = (index) => prepared.enemy[index]?.stats.maxHp ?? 0;
  const state = {
    playerIndex: 0,
    enemyIndex: 0,
    playerHp: playerHp(0),
    enemyHp: enemyHp(0),
  };

  for (let index = 0; index < cursor && index < log.length; index += 1) {
    const entry = log[index];
    if (entry.kind === "switch") {
      if (entry.side === "player") {
        state.playerIndex = entry.actorSlot ?? 0;
        state.playerHp = playerHp(state.playerIndex);
      } else {
        state.enemyIndex = entry.actorSlot ?? 0;
        state.enemyHp = enemyHp(state.enemyIndex);
      }
    }
    if (entry.kind === "move") {
      if (entry.side === "player") state.enemyHp = entry.hpAfter;
      else state.playerHp = entry.hpAfter;
    }
    if (entry.kind === "faint") {
      if (entry.side === "player") state.playerHp = 0;
      else state.enemyHp = 0;
    }
  }

  return state;
}

function describe(entry) {
  if (entry.kind === "faint") return `${entry.actor} fainted.`;
  if (entry.kind === "switch") return `${entry.actor} was sent out.`;
  const who = entry.side === "player" ? "YOU" : "THEM";
  if (entry.miss) return `${who} · ${entry.actor} — ${entry.move} missed.`;
  return `${who} · ${entry.actor} used ${entry.move} — ${entry.damage} dmg${
    entry.crit ? " CRIT" : ""
  }${entry.effectiveness !== 1 ? ` (${entry.effectiveness}×)` : ""}${
    entry.faint ? " · KO" : ""
  }`;
}

/* ---------- route ---------- */

function RouteTrack({ current, cleared, sheetLoaded }) {
  return (
    <ol className="gg-route" aria-label="Gym route">
      {GYMS.map((gym, index) => {
        const clearedEntry = cleared.find((entry) => entry.badge === gym.badge);
        const state = clearedEntry
          ? "is-cleared"
          : index === current
            ? "is-current"
            : "is-upcoming";
        return (
          <li key={gym.id} className={`gg-node ${state}`}>
            <span className="gg-node__badge" title={`${gym.badgeName} · ${gym.leader}`}>
              <BadgeSprite
                tile={gym.badgeTile}
                scale={2}
                earned={Boolean(clearedEntry)}
                name={gym.badgeName}
                loaded={sheetLoaded}
                tint={typeAccent(gym.type)}
              />
            </span>
            <span className="gg-node__name">{gym.leader}</span>
            <span className="gg-node__type" style={{ "--chip": typeAccent(gym.type) }}>
              {gym.type}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- loader ---------- */

const loaderLine = (pct, sims, total) => {
  if (pct >= 100) return "RESOLVING TURNS...";
  if (pct >= 40) return `RUNNING SIMULATIONS ${sims} / ${total}`;
  if (pct >= 22) return "APPLYING BADGE BOOSTS...";
  if (pct >= 8) return "CHECKING TYPE MATCHUPS...";
  return "LOADING MOVESETS...";
};

export function BattleLoader({ leader, pct, line, reduced, compact = false }) {
  const filled = Math.round(pct / 5);
  return (
    <div className={`gg-loader${compact ? " is-compact" : ""}`} role="status">
      <div className="gg-loader__stage" aria-hidden={reduced ? "true" : undefined}>
        <span className={`gg-loader__ball${reduced ? " is-still" : ""}`}>
          <BallGlyph size={compact ? 28 : 54} />
        </span>
      </div>
      <p className="gg-loader__who">{leader.toUpperCase()} wants to fight!</p>
      <div className="gg-loader__bar" aria-hidden="true">
        {Array.from({ length: 20 }, (_, index) => (
          <i key={index} className={index < filled ? "is-on" : undefined} />
        ))}
      </div>
      <p className="gg-loader__line">
        {line}
        {reduced ? ` · ${pct}%` : ""}
      </p>
    </div>
  );
}

/* ---------- briefing ---------- */

function MatchupChips({ player, enemy }) {
  return (
    <ul className="gg-chips gg-chips--matchup">
      {enemy.map((mon) => {
        const best = Math.max(
          ...player.flatMap((mine) => mine.types.map((type) => typeMultiplier(type, mon.types))),
          0,
        );
        const label = mon.types[0] ?? "normal";
        return (
          <li key={`${mon.id}-${mon.level}-${mon.name}`} className={`gg-match is-${best}`}>
            {best}× vs {label}
          </li>
        );
      })}
    </ul>
  );
}

function MonLine({ mon, onLead, isLead, opponent = false }) {
  return (
    <li className={`gg-mon${isLead ? " is-lead" : ""}`}>
      <span className="gg-mon__sprite" style={{ "--type": typeAccent(mon.types[0] ?? "normal") }}>
        <img src={mon.sprite} alt="" width="48" height="48" loading="lazy" decoding="async" />
      </span>
      <span className="gg-mon__copy">
        <span className="gg-mon__name">{mon.name}</span>
        <span className="gg-mon__meta">
          <span className="gg-mon__level">Lv {mon.level}</span>
          {mon.types.map(typeChip)}
        </span>
      </span>
      {!opponent && (
        <button
          type="button"
          className={`gg-lead${isLead ? " is-on" : ""}`}
          onClick={() => onLead?.()}
          aria-pressed={isLead}
        >
          {isLead ? "LEAD" : "SET LEAD"}
        </button>
      )}
    </li>
  );
}

function Briefing({
  gym,
  prepared,
  playerTeam,
  lead,
  setLead,
  chance,
  scout,
  onBegin,
  onBack,
  error,
}) {
  const reduced = usePrefersReducedMotion();

  if (error) {
    return (
      <div className="gg-card gg-error">
        <p className="gg-label">League records unavailable</p>
        <p className="gg-sub">{error}</p>
        <button type="button" className="gg-ghost" onClick={onBack}>
          ‹ Back to team
        </button>
      </div>
    );
  }

  if (!prepared) {
    return (
      <div className="gg-card gg-reading">
        <p className="gg-label">Reading league records</p>
        <BattleLoader
          leader={gym.leader}
          pct={0}
          line="LOADING MOVESETS..."
          reduced={reduced}
          compact
        />
      </div>
    );
  }

  const { enemy, growth } = prepared;

  return (
    <motion.div
      className="gg-brief"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="gg-grid">
        <article className="gg-card">
          <p className="gg-label">Opponent</p>
          <h5 className="gg-card__title">
            {gym.leader} <span>· {gym.gym}</span>
          </h5>
          <p className="gg-sub">
            {gym.badgeName} on the line · cap Lv {gym.levelCap}
          </p>
          <ul className="gg-roster">
            {enemy.map((mon, index) => (
              <MonLine key={`${mon.id}-${index}`} mon={mon} opponent />
            ))}
          </ul>
        </article>

        <article className="gg-card">
          <p className="gg-label">Your team</p>
          <h5 className="gg-card__title">
            Level cap {gym.levelCap} <span>· full heal</span>
          </h5>
          <ul className="gg-roster gg-roster--mine">
            {playerTeam.map((mon, index) => (
              <MonLine
                key={`${mon.id}-${mon.name}`}
                mon={mon}
                isLead={index === 0}
                onLead={() => setLead(index)}
              />
            ))}
          </ul>
          <p className="gg-fine">
            Lead: {playerTeam[0]?.name ?? "—"} · order follows the list, next one
            up steps in on a faint.
          </p>
        </article>
      </div>

      {growth.length > 0 && (
        <div className="gg-card gg-growth">
          <p className="gg-label">Growth</p>
          {growth.map((entry) => (
            <p key={`${entry.from.id}-${entry.to.id}`} className="gg-sub">
              {entry.from.name} → <b>{entry.to.name}</b> at Lv {entry.level}
            </p>
          ))}
        </div>
      )}

      <div className="gg-scout">
        <div className="gg-scout__head">
          <p className="gg-label">Win chance</p>
          <span className="gg-scout__value">
            {chance == null ? `SCOUTING… ${scout}/200` : `${chance}%`}
          </span>
        </div>
        <div className="gg-meter" aria-hidden="true">
          <motion.span
            className="gg-meter__fill"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: chance == null ? scout / 200 : chance / 100 }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <MatchupChips player={playerTeam} enemy={enemy} />
      </div>

      <div className="gg-actions">
        <button type="button" className="gg-ghost" onClick={onBack}>
          ‹ Back to team
        </button>
        <button type="button" className="gg-cta" onClick={onBegin} disabled={!chance && chance !== 0}>
          BEGIN BATTLE <span aria-hidden="true">›</span>
        </button>
      </div>
    </motion.div>
  );
}

/* ---------- arena ---------- */

function Hp({ name, level, hp, maxHp, side }) {
  const ratio = maxHp ? hp / maxHp : 0;
  return (
    <div className={`gg-hp is-${side}`}>
      <div className="gg-hp__head">
        <span className="gg-hp__name">{name}</span>
        <span className="gg-hp__level">Lv {level}</span>
      </div>
      <div className="gg-hp__bar" aria-hidden="true">
        <span className={`gg-hp__fill is-${hpTone(ratio)}`} style={{ width: `${Math.max(0, ratio * 100)}%` }} />
      </div>
      <span className="gg-hp__num">
        {Math.max(0, hp)} / {maxHp}
      </span>
    </div>
  );
}

function Arena({ prepared, playerTeam, result, cursor, speed, setSpeed, onSkip }) {
  const view = stateFromLog(
    { player: playerTeam, enemy: prepared.enemy },
    result.log,
    cursor,
  );
  const enemyMon = prepared.enemy[view.enemyIndex] ?? prepared.enemy[0];
  const playerMon = playerTeam[view.playerIndex] ?? playerTeam[0];
  const lines = result.log.slice(Math.max(0, cursor - 6), cursor);
  const latest = lines[lines.length - 1];
  const typed = useTypewriter(latest ? describe(latest) : "", 8);

  return (
    <motion.div
      className="gg-arena"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <div className="gg-arena__field">
        <div className="gg-arena__enemy">
          <Hp
            name={enemyMon?.name}
            level={enemyMon?.level}
            hp={view.enemyHp}
            maxHp={enemyMon?.stats.maxHp}
            side="enemy"
          />
          <motion.img
            key={`${enemyMon?.id}-${view.enemyIndex}`}
            className="gg-sprite is-enemy"
            src={enemyMon?.sprite}
            alt=""
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          />
        </div>

        <div className="gg-arena__player">
          <motion.img
            key={`${playerMon?.id}-${view.playerIndex}`}
            className="gg-sprite is-player"
            src={playerMon?.sprite}
            alt=""
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          />
          <Hp
            name={playerMon?.name}
            level={playerMon?.level}
            hp={view.playerHp}
            maxHp={playerMon?.stats.maxHp}
            side="player"
          />
        </div>
      </div>

      <div className="gg-log" aria-live="polite">
        <p className="gg-log__head">
          <span>TURN LOG</span>
          <span>{cursor < result.log.length ? "LIVE" : "FINAL"}</span>
        </p>
        <ul>
          {lines.slice(0, -1).map((entry, index) => (
            <li key={`${index}-${entry.turn}-${entry.move ?? entry.kind}`}>
              {describe(entry)}
            </li>
          ))}
          {latest && <li className="is-typing">{typed}</li>}
        </ul>
      </div>

      <div className="gg-speed">
        {[1, 2].map((rate) => (
          <button
            key={rate}
            type="button"
            className={`gg-speed__btn${speed === rate ? " is-on" : ""}`}
            onClick={() => setSpeed(rate)}
          >
            {rate}×
          </button>
        ))}
        <button type="button" className="gg-speed__btn" onClick={onSkip}>
          SKIP
        </button>
      </div>
    </motion.div>
  );
}

/* ---------- results ---------- */

/* Plain-language recap: who carried it, what actually worked, how it ended,
   and the luck that moved it. No shorthand the reader has to decode. */
function explain(prepared, playerTeam, result) {
  const won = result.winner === "player";
  const mine = result.summary.perPokemon.filter((mon) => mon.side === "player");
  const theirs = result.summary.perPokemon.filter((mon) => mon.side === "enemy");
  const kos = mine.reduce((sum, mon) => sum + mon.kos, 0);
  const mvp = result.summary.mvp;
  const standing = mine.filter((mon) => !mon.fainted);
  const lines = [];

  if (mvp) {
    lines.push(
      `${mvp.name} did the most damage — ${mvp.damageDealt} across the fight, with ${mvp.kos} knockout${
        mvp.kos === 1 ? "" : "s"
      } to their name. Your team took ${kos} of their ${theirs.length} down.`,
    );
  } else {
    lines.push(`No damage was dealt before the fight ended on turn ${result.turns}.`);
  }

  const supers = result.log.filter(
    (entry) => entry.kind === "move" && entry.side === "player" && entry.effectiveness > 1,
  );
  if (supers.length) {
    const counts = new Map();
    supers.forEach((entry) => counts.set(entry.move, (counts.get(entry.move) ?? 0) + 1));
    const [move, count] = [...counts].sort((a, b) => b[1] - a[1])[0];
    lines.push(
      `${move} was your best answer, landing ${count} super-effective hit${count === 1 ? "" : "s"}.`,
    );
  } else {
    lines.push("Nothing landed super effectively, so this was won on stats and speed alone.");
  }

  const finalKo = [...result.log]
    .reverse()
    .find((entry) => entry.kind === "move" && entry.side === "player" && entry.faint);
  if (won && finalKo) {
    lines.push(
      `The winning knockout came on turn ${finalKo.turn}, when ${finalKo.actor} finished ${finalKo.target} with ${finalKo.move}.`,
    );
  }

  if (won) {
    lines.push(
      standing.length === mine.length
        ? `All ${mine.length} of yours were still standing — a clean sweep.`
        : standing.length <= 2
          ? `It went to the wire: only ${standing.length} of your ${mine.length} were left standing.`
          : `You finished with ${standing.length} of ${mine.length} still on their feet.`,
    );
  } else {
    const survivor = theirs
      .filter((mon) => !mon.fainted)
      .sort((a, b) => a.hpLeft - b.hpLeft)[0];
    if (survivor) {
      lines.push(
        `${survivor.name} survived on ${survivor.hpLeft}/${survivor.maxHp} HP — a different lead or order can flip this fight.`,
      );
    }
  }

  const crits = result.log.filter(
    (entry) => entry.crit && entry.kind === "move" && entry.side === "player",
  ).length;
  const misses = result.log.filter(
    (entry) => entry.kind === "move" && entry.side === "player" && entry.miss,
  ).length;
  const luck = [];
  if (crits) luck.push(`landed ${crits} critical hit${crits === 1 ? "" : "s"}`);
  if (misses) luck.push(`missed ${misses} attack${misses === 1 ? "" : "s"}`);
  if (luck.length) lines.push(`You ${luck.join(" and ")}.`);

  return lines;
}

/* Both rosters as sprite rows: colour means still standing, black and white
   means knocked out. */
function TeamStrip({ team, summary, side }) {
  return (
    <ul className="gg-strip">
      {team.map((mon, index) => {
        const record = summary.perPokemon.find(
          (entry) => entry.side === side && entry.slot === index,
        );
        const down = record?.fainted;
        return (
          <li key={`${mon.id}-${index}`} className={down ? "is-ko" : "is-up"}>
            <span className="gg-strip__sprite">
              <img src={mon.sprite} alt="" width="52" height="52" loading="lazy" />
            </span>
            <span className="gg-strip__name">{mon.name}</span>
            <span className="gg-strip__hp">
              {down
                ? "KO"
                : `${record?.hpLeft ?? mon.stats.maxHp}/${record?.maxHp ?? mon.stats.maxHp}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Results({
  gym,
  prepared,
  playerTeam,
  result,
  onNext,
  onRetry,
  onChangeLead,
  onBack,
  finalGym,
}) {
  const won = result.winner === "player";
  const gone = result.summary.perPokemon.filter((mon) => mon.side === "player");
  const mvp = result.summary.mvp;
  const tank = [...gone].sort((a, b) => b.damageTaken - a.damageTaken)[0];
  const kos = gone.reduce((sum, mon) => sum + mon.kos, 0);
  const breakdown = prepared.enemy.map((mon, index) => {
    const record = result.summary.perPokemon.find(
      (entry) => entry.side === "enemy" && entry.slot === index,
    );
    return {
      mon,
      record,
      defeatedBy: [...result.log]
        .reverse()
        .find(
          (entry) =>
            entry.kind === "move" &&
            entry.side === "player" &&
            entry.faint &&
            entry.targetSlot === index,
        ),
    };
  });

  return (
    <motion.div
      className="gg-results"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className={`gg-banner ${won ? "is-win" : "is-loss"}`}>
        <p className="gg-banner__kick">{won ? "VICTORY" : "DEFEAT"}</p>
        <h5 className="gg-banner__title">
          {won ? `${gym.badgeName} earned` : `${gym.leader} holds the line`}
        </h5>
        <p className="gg-banner__meta">
          {result.turns} turns · {kos} KOs · {result.summary.playerLeft} of{" "}
          {playerTeam.length} standing
        </p>
      </div>

      <div className="gg-stats">
        <div className="gg-stat">
          <p className="gg-label">MVP</p>
          <b>{mvp?.name ?? "—"}</b>
          <span>{mvp ? `${mvp.damageDealt} dmg · ${mvp.kos} KO` : "no damage"}</span>
        </div>
        <div className="gg-stat">
          <p className="gg-label">Most damage taken</p>
          <b>{tank?.name ?? "—"}</b>
          <span>{tank ? `${tank.damageTaken} taken` : "—"}</span>
        </div>
        <div className="gg-stat">
          <p className="gg-label">KOs</p>
          <b>{kos}</b>
          <span>of {prepared.enemy.length} opponents</span>
        </div>
        <div className="gg-stat">
          <p className="gg-label">Turns</p>
          <b>{result.turns}</b>
          <span>{won ? "cleared" : "held"}</span>
        </div>
      </div>

      <article className="gg-card">
        <p className="gg-label">Your team</p>
        <TeamStrip team={prepared.player} summary={result.summary} side="player" />
      </article>

      <div className="gg-grid">
        <article className="gg-card">
          <p className="gg-label">What happened</p>
          <ul className="gg-explain">
            {explain(prepared, playerTeam, result).map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        </article>

        <article className="gg-card">
          <p className="gg-label">Their team</p>
          <ul className="gg-breakdown">
            {breakdown.map(({ mon, record, defeatedBy }, index) => (
              <li
                key={`${mon.id}-${index}`}
                className={record?.fainted ? "is-ko" : "is-up"}
              >
                <img
                  className="gg-breakdown__sprite"
                  src={mon.sprite}
                  alt=""
                  width="36"
                  height="36"
                  loading="lazy"
                />
                <span className="gg-breakdown__mon">
                  {mon.name} <i>Lv {mon.level}</i>
                </span>
                <span className="gg-breakdown__hp">
                  {record?.hpLeft ?? 0}/{record?.maxHp ?? mon.stats.maxHp}
                </span>
                <span className="gg-breakdown__by">
                  {record?.fainted
                    ? defeatedBy
                      ? `${defeatedBy.actor} · ${defeatedBy.move}`
                      : "fainted"
                    : "still up"}
                </span>
              </li>
            ))}
          </ul>
        </article>
      </div>

      {prepared.growth.length > 0 && (
        <div className="gg-card gg-growthcard">
          <div className="gg-growthcard__head">
            <p className="gg-label">Growth</p>
            <span className="gg-growthcard__pill">EVOLVED</span>
          </div>
          {prepared.growth.map((entry) => (
            <div key={`${entry.from.id}-${entry.to.id}`} className="gg-growthcard__row">
              <span className="gg-growthcard__side gg-growthcard__side--before">
                <img src={pixelSpriteUrl(entry.from.id)} alt="" width="42" height="42" />
                <span>
                  <b>{entry.from.name}</b>
                  <i>before</i>
                </span>
              </span>
              <span className="gg-growthcard__arrow" aria-hidden="true">
                →
              </span>
              <span className="gg-growthcard__side gg-growthcard__side--after">
                <img src={pixelSpriteUrl(entry.to.id)} alt="" width="58" height="58" />
                <span>
                  <b>{entry.to.name}</b>
                  <i>now · Lv {entry.level}</i>
                </span>
              </span>
              <span className="gg-growthcard__stats">
                {["maxHp", "attack", "defense", "special", "speed"].map((key) => {
                  const delta = entry.after[key] - entry.before[key];
                  return (
                    <i key={key} className={delta > 0 ? "is-up" : undefined}>
                      {key === "maxHp" ? "HP" : key.slice(0, 3).toUpperCase()}{" "}
                      {entry.before[key]} → {entry.after[key]}
                      {delta > 0 ? ` (+${delta})` : ""}
                    </i>
                  );
                })}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="gg-actions">
        <button type="button" className="gg-ghost" onClick={onBack}>
          ‹ Back to team
        </button>
        {won ? (
          <button type="button" className="gg-cta" onClick={onNext}>
            {finalGym ? "FINISH GAUNTLET" : "NEXT GYM"} <span aria-hidden="true">›</span>
          </button>
        ) : (
          <>
            <button type="button" className="gg-ghost" onClick={onChangeLead}>
              CHANGE LEAD
            </button>
            <button type="button" className="gg-cta" onClick={onRetry}>
              RETRY <span aria-hidden="true">›</span>
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

/* ---------- badge case + completion ---------- */

function BadgeCase({ cleared, sheetLoaded }) {
  return (
    <div className="gg-case">
      <div className="gg-case__head">
        <p className="gg-label">Badge case</p>
        <span className="gg-fine">
          {cleared.length} / {GYMS.length}
        </span>
      </div>
      <ul className="gg-case__grid">
        {GYMS.map((gym) => {
          const entry = cleared.find((item) => item.badge === gym.badge);
          return (
            <li
              key={gym.id}
              className={entry ? "is-earned" : "is-locked"}
              title={`${gym.badgeName} · ${gym.leader}${entry ? ` · ${entry.turns} turns` : " · locked"}`}
            >
              <BadgeSprite
                tile={gym.badgeTile}
                scale={4}
                earned={Boolean(entry)}
                name={gym.badgeName}
                loaded={sheetLoaded}
                tint={typeAccent(gym.type)}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const CONFETTI_COLORS = [
  "#f2c94c",
  "#f7d76f",
  "#d4553c",
  "#78c8e8",
  "#a98be0",
  "#7dc36a",
  "#e79b4f",
];

function Confetti({ reduced }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 90 }, (_, index) => ({
        left: (index * 37.3) % 100,
        delay: ((index * 13) % 26) / 10,
        duration: 2.6 + ((index * 7) % 22) / 10,
        width: 5 + ((index * 3) % 6),
        spin: ((index * 61) % 720) - 360,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      })),
    [],
  );

  if (reduced) return null;

  return (
    <div className="gg-confetti" aria-hidden="true">
      {pieces.map((piece, index) => (
        <i
          key={index}
          style={{
            left: `${piece.left}%`,
            width: piece.width,
            height: piece.width * 1.7,
            background: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            "--spin": `${piece.spin}deg`,
          }}
        />
      ))}
    </div>
  );
}

export function Complete({ cleared, onRestart, onBack, sheetLoaded, reduced }) {
  const turns = cleared.reduce((sum, entry) => sum + entry.turns, 0);
  const kos = cleared.reduce((sum, entry) => sum + (entry.kos ?? 0), 0);
  const fastest = [...cleared].sort((a, b) => a.turns - b.turns)[0];

  return (
    <motion.div
      className="gg-complete"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <Confetti reduced={reduced} />
      <p className="gg-label">Gauntlet complete</p>
      <h5 className="gg-complete__title">Eight badges, one run</h5>
      <p className="gg-sub">
        {cleared.length} gyms · {turns} turns · {kos} knockouts
        {fastest ? ` · fastest was ${fastest.leader} in ${fastest.turns}` : ""}.
      </p>

      <ul className="gg-summary">
        {GYMS.map((item) => {
          const entry = cleared.find((row) => row.badge === item.badge);
          return (
            <li key={item.id} className={entry ? "is-cleared" : "is-locked"}>
              <span className="gg-summary__badge">
                <BadgeSprite
                  tile={item.badgeTile}
                  scale={2}
                  earned={Boolean(entry)}
                  name={item.badgeName}
                  loaded={sheetLoaded}
                  tint={typeAccent(item.type)}
                />
              </span>
              <span className="gg-summary__gym">
                <b>{item.leader}</b>
                <i>{item.gym}</i>
              </span>
              <span className="gg-summary__stat">
                <b>{entry?.turns ?? "—"}</b>
                <i>turns</i>
              </span>
              <span className="gg-summary__stat">
                <b>{entry?.kos ?? "—"}</b>
                <i>KOs</i>
              </span>
              <span className="gg-summary__stat">
                <b>{entry ? `${entry.standing}/${item.team.length}` : "—"}</b>
                <i>standing</i>
              </span>
              <span className="gg-summary__mvp">{entry?.mvp ?? "—"}</span>
            </li>
          );
        })}
      </ul>

      <div className="gg-actions">
        <button type="button" className="gg-ghost" onClick={onBack}>
          ‹ Back to team
        </button>
        <button type="button" className="gg-cta" onClick={onRestart}>
          RUN IT AGAIN <span aria-hidden="true">›</span>
        </button>
      </div>
    </motion.div>
  );
}

/* ---------- the mode ---------- */

export default function GymGauntlet({ team, onBack }) {
  const [gymIndex, setGymIndex] = useState(0);
  const [cleared, setCleared] = useState([]);
  const [stage, setStage] = useState("briefing");
  const [prepared, setPrepared] = useState(null);
  const [error, setError] = useState(null);
  const [chance, setChance] = useState(null);
  const [scout, setScout] = useState(0);
  const [lead, setLead] = useState(0);
  const [seed, setSeed] = useState(101);
  const [result, setResult] = useState(null);
  const [cursor, setCursor] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [loader, setLoader] = useState({ pct: 0, line: "LOADING MOVESETS..." });
  const [loadPct, setLoadPct] = useState(0);

  const reduced = usePrefersReducedMotion();
  const sheetLoaded = useBadgeSheet();
  const finished = useRef(false);
  const gym = GYMS[gymIndex];
  const badges = useMemo(() => cleared.map((entry) => entry.badge), [cleared]);
  const multipliers = useMemo(() => multipliersForBadges(badges), [badges]);

  const teamKey = team
    .slice(0, 6)
    .map((mon) => mon.id)
    .join(",");

  /* Load both rosters, level the team, evolve it, then scout the odds. */
  useEffect(() => {
    if (stage !== "briefing") return undefined;
    let live = true;
    setPrepared(null);
    setChance(null);
    setScout(0);
    setError(null);
    setLoadPct(0);

    (async () => {
      const current = GYMS[gymIndex];
      const enemy = await prepareGym(
        { ...current, team: gymTeam(current) },
        { onStep: (value) => live && setLoadPct(Math.round(value * 55)) },
      );
      const built = await prepareTeam(team, {
        level: current.levelCap,
        badges,
        onStep: (value) => live && setLoadPct(55 + Math.round(value * 45)),
      });
      if (!live) return;
      setPrepared({ gym: current, enemy, player: built.team, growth: built.growth });
    })().catch((cause) => {
      if (live) setError(cause.message ?? "Could not load the league records.");
    });

    return () => {
      live = false;
    };
  }, [stage, gymIndex, seed, teamKey, badges.length]);

  /* Lead order is a view of the prepared team, not a reload. */
  const playerTeam = useMemo(() => {
    if (!prepared) return [];
    const leadMon = prepared.player[lead] ?? prepared.player[0];
    return [leadMon, ...prepared.player.filter((mon) => mon !== leadMon)];
  }, [prepared, lead]);

  useEffect(() => {
    if (!prepared) return undefined;
    let live = true;
    setChance(null);
    setScout(0);
    estimateWinChance(playerTeam, prepared.enemy, {
      sims: 200,
      multipliers,
      baseSeed: gymIndex + seed,
      onProgress: (done) => live && setScout(done),
    })
      .then((pct) => live && setChance(pct))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [prepared, playerTeam, multipliers, gymIndex, seed]);

  /* A blip as the loader's status line changes, when sound is on. */
  useEffect(() => {
    if (stage === "loader") playSfx("land");
  }, [loader.line, stage]);

  const beginBattle = async () => {
    if (!prepared) return;
    finished.current = false;
    setStage("loader");
    setLoader({ pct: 0, line: "LOADING MOVESETS..." });
    const started = performance.now();

    const pct = await estimateWinChance(playerTeam, prepared.enemy, {
      sims: 200,
      multipliers,
      baseSeed: gymIndex + seed + 17,
      onProgress: (done, total) =>
        setLoader({
          pct: Math.round((done / total) * 100),
          line: loaderLine(Math.round((done / total) * 100), done, total),
        }),
    });

    const battle = runBattle(playerTeam, prepared.enemy, { seed, multipliers });
    setChance(pct);

    const elapsed = performance.now() - started;
    if (elapsed < 2000) {
      await new Promise((resolve) => {
        setTimeout(resolve, 2000 - elapsed);
      });
    }

    setResult(battle);
    setCursor(0);
    setStage("battle");
  };

  const finishBattle = useCallback(() => {
    if (!result || finished.current) return;
    finished.current = true;
    if (result.winner === "player") {
      setCleared((list) =>
        list.some((entry) => entry.badge === gym.badge)
          ? list
          : [
              ...list,
              {
                badge: gym.badge,
                badgeName: gym.badgeName,
                leader: gym.leader,
                gym: gym.gym,
                turns: result.turns,
                kos: result.summary.perPokemon
                  .filter((mon) => mon.side === "player")
                  .reduce((sum, mon) => sum + mon.kos, 0),
                standing: result.summary.playerLeft,
                mvp: result.summary.mvp?.name ?? "—",
              },
            ],
      );
    }
    setStage("results");
  }, [result, gym]);

  /* Play the precomputed log back, one event at a time. */
  useEffect(() => {
    if (stage !== "battle" || !result) return undefined;
    if (cursor >= result.log.length) {
      const timer = window.setTimeout(finishBattle, 650);
      return () => window.clearTimeout(timer);
    }
    const delay = speed === 2 ? 380 : 760;
    const timer = window.setTimeout(() => setCursor((value) => value + 1), delay);
    return () => window.clearTimeout(timer);
  }, [stage, cursor, speed, result, finishBattle]);

  const skip = () => {
    if (!result) return;
    setCursor(result.log.length);
    finishBattle();
  };

  const nextGym = () => {
    if (gymIndex >= GYMS.length - 1) {
      setStage("complete");
      return;
    }
    setGymIndex((index) => index + 1);
    setLead(0);
    setSeed((value) => value + 1);
    setResult(null);
    setCursor(0);
    setStage("briefing");
  };

  const retry = () => {
    setSeed((value) => value + 1);
    setResult(null);
    setCursor(0);
    setStage("briefing");
  };

  const restart = () => {
    setGymIndex(0);
    setCleared([]);
    setLead(0);
    setSeed((value) => value + 1);
    setResult(null);
    setCursor(0);
    setStage("briefing");
  };

  return (
    <section className="gg" aria-label="Gym Gauntlet">
      <header className="gg-head">
        <div>
          <p className="gg-kicker">Gym gauntlet</p>
          <h4 className="gg-title">
            {gym.leader} <span>· {gym.gym}</span>
          </h4>
        </div>
        <button type="button" className="gg-ghost gg-back" onClick={onBack}>
          ‹ Back to team
        </button>
      </header>

      <RouteTrack current={gymIndex} cleared={cleared} sheetLoaded={sheetLoaded} />

      <AnimatePresence mode="wait" initial={false}>
        {stage === "briefing" && (
          <motion.div key="brief" exit={{ opacity: 0 }}>
            <Briefing
              gym={gym}
              prepared={prepared}
              playerTeam={playerTeam}
              lead={lead}
              setLead={setLead}
              chance={chance}
              scout={scout}
              onBegin={beginBattle}
              onBack={onBack}
              error={error}
            />
            {!prepared && !error && (
              <div className="gg-reading__bar" aria-hidden="true">
                <span style={{ width: `${loadPct}%` }} />
              </div>
            )}
          </motion.div>
        )}

        {stage === "loader" && (
          <motion.div key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="gg-card">
              <BattleLoader
                leader={gym.leader}
                pct={loader.pct}
                line={loader.line}
                reduced={reduced}
              />
            </div>
          </motion.div>
        )}

        {stage === "battle" && result && (
          <Arena
            key="battle"
            prepared={prepared}
            playerTeam={playerTeam}
            result={result}
            cursor={cursor}
            speed={speed}
            setSpeed={setSpeed}
            onSkip={skip}
          />
        )}

        {stage === "results" && result && (
          <Results
            key="results"
            gym={gym}
            prepared={prepared}
            playerTeam={playerTeam}
            result={result}
            onNext={nextGym}
            onRetry={retry}
            onChangeLead={() => setStage("briefing")}
            onBack={onBack}
            finalGym={gymIndex >= GYMS.length - 1}
          />
        )}

        {stage === "complete" && (
          <Complete
            key="complete"
            cleared={cleared}
            onRestart={restart}
            onBack={onBack}
            sheetLoaded={sheetLoaded}
            reduced={reduced}
          />
        )}
      </AnimatePresence>

      <BadgeCase cleared={cleared} sheetLoaded={sheetLoaded} />
    </section>
  );
}
