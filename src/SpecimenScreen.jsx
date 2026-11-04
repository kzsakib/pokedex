import { useEffect, useRef, useState } from "react";
import { artworkUrl, formatNumber, spriteUrl, titleCase } from "./api";
import { typeAccent } from "./typeColors";
import { gsap } from "./motion";
import { useMotion } from "./motionSettings";
import { SplitWords } from "./SplitText";
import AnimatedContent from "./components/AnimatedContent";
import CountUp from "./components/CountUp";
import AbilityList from "./AbilityList";
import StatRadar from "./StatRadar";
import VersionTray from "./VersionTray";

const STAT_LABELS = {
  hp: "HP",
  attack: "ATK",
  defense: "DEF",
  "special-attack": "SP.A",
  "special-defense": "SP.D",
  speed: "SPE",
};

const statCap = (name) => (name === "hp" ? 255 : 180);

export default function SpecimenScreen({
  pokemon,
  record,
  abilities,
  percentiles,
  loading,
  fault,
  onRetry,
}) {
  const { motion } = useMotion();
  const screenRef = useRef(null);
  const [entryIndex, setEntryIndex] = useState(0);
  const [activeStat, setActiveStat] = useState(null);

  useEffect(() => {
    setEntryIndex(0);
    setActiveStat(null);
  }, [pokemon?.id]);

  useEffect(() => {
    if (!pokemon || !motion) return undefined;
    const context = gsap.context(() => {
      gsap.fromTo(
        ".js-bar",
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 0.6,
          stagger: 0.045,
          ease: "power2.out",
          clearProps: "transform",
        },
      );
    }, screenRef);
    return () => context.revert();
  }, [motion, pokemon?.id]);

  if (fault) {
    return (
      <div className="screen" ref={screenRef}>
        <div className="screen-state">
          <p className="state-code">Signal lost</p>
          <p className="state-copy">PokéAPI did not answer for this entry.</p>
          <button type="button" className="key key--onfield" onClick={onRetry}>
            Retry reading
          </button>
        </div>
      </div>
    );
  }

  if (loading || !pokemon) {
    return (
      <div className="screen" ref={screenRef}>
        <div className="screen-state">
          <p className="state-code">Acquiring specimen</p>
          <span className="groove" aria-hidden="true">
            <span />
          </span>
          <p className="state-copy">Reading the PokéAPI record…</p>
        </div>
      </div>
    );
  }

  const label = titleCase(pokemon.name);
  const types = pokemon.types.map((slot) => slot.type.name);
  const entries = record?.entries ?? [];
  const entry = entries[Math.min(entryIndex, entries.length - 1)] ?? null;
  const total = pokemon.stats.reduce((sum, stat) => sum + stat.base_stat, 0);
  const best = Math.max(...pokemon.stats.map((stat) => stat.base_stat));
  const radarStats = pokemon.stats.map((stat) => ({
    key: stat.stat.name,
    label: STAT_LABELS[stat.stat.name] ?? stat.stat.name,
    value: stat.base_stat,
    ratio: Math.min(1, stat.base_stat / statCap(stat.stat.name)),
  }));

  return (
    <article className="screen" ref={screenRef}>
      <header className="screen-head">
        <p className="screen-no">{formatNumber(pokemon.id)}</p>
        <p className="screen-genus">{record?.genus || "Specimen"}</p>
      </header>

      <AnimatedContent
        key={pokemon.id}
        className="screen-stack"
        direction="vertical"
        distance={14}
        duration={0.42}
        trigger="mount"
        threshold={0.01}
        initialOpacity={0}
      >
        <div className="screen-body">
          <div className="art-well">
            <img
              src={artworkUrl(pokemon.id)}
              alt={`${label} official artwork`}
              width="475"
              height="475"
              onError={(event) => {
                const image = event.currentTarget;
                if (image.dataset.fallback) return;
                image.dataset.fallback = "1";
                image.src = spriteUrl(pokemon.id);
              }}
            />
          </div>

          <div className="screen-copy">
            <h3>{label}</h3>
            <ul className="type-list">
              {types.map((name) => (
                <li key={name} className="type-tag">
                  <span
                    className="lamp lamp--chip"
                    aria-hidden="true"
                    style={{ "--chip": typeAccent(name) }}
                  />
                  {name}
                </li>
              ))}
            </ul>

            <dl className="measures">
              <div>
                <dt>Height</dt>
                <dd>{(pokemon.height / 10).toFixed(1)} m</dd>
              </div>
              <div>
                <dt>Weight</dt>
                <dd>{(pokemon.weight / 10).toFixed(1)} kg</dd>
              </div>
              <div>
                <dt>Base exp</dt>
                <dd>{pokemon.base_experience ?? "—"}</dd>
              </div>
            </dl>
          </div>
        </div>

        <section className="entry-block" aria-labelledby="entry-title">
          <div className="entry-head">
            <h4 className="stats-title" id="entry-title">
              Pokédex entry
            </h4>
            <p className="entry-version">
              {entry ? entry.label : "Reading"}
              {entries.length > 1 ? ` · ${entryIndex + 1}/${entries.length}` : ""}
            </p>
          </div>
          <SplitWords
            key={`${pokemon.id}-${entryIndex}`}
            className="entry-text"
            text={entry?.text || "No English entry on record for this species."}
          />
          <VersionTray
            versions={entries}
            index={entryIndex}
            onChange={setEntryIndex}
          />
        </section>

        <div className="stats">
          <div className="stats-head">
            <h4 className="stats-title">Base stats</h4>
            <p className="stats-total">
              Total{" "}
              <CountUp
                to={total}
                duration={0.8}
                className="stats-total-value"
              />
            </p>
          </div>

          <div className="stats-body">
            <StatRadar
              stats={radarStats}
              active={activeStat}
              total={total}
              percentiles={percentiles}
              label={label}
            />

            <div className="stat-rows">
              {pokemon.stats.map((stat) => {
                const name = stat.stat.name;
                const statLabel = STAT_LABELS[name] ?? name;
                const percent = Math.min(
                  100,
                  Math.round((stat.base_stat / statCap(name)) * 100),
                );
                const pressed = activeStat === name;

                return (
                  <button
                    key={name}
                    type="button"
                    className={`stat-row${stat.base_stat === best ? " is-max" : ""}`}
                    aria-pressed={pressed}
                    onClick={() =>
                      setActiveStat((current) => (current === name ? null : name))
                    }
                    onMouseEnter={() => setActiveStat(name)}
                    onMouseLeave={() =>
                      setActiveStat((current) =>
                        current === name ? null : current,
                      )
                    }
                    onFocus={() => setActiveStat(name)}
                    onBlur={() =>
                      setActiveStat((current) =>
                        current === name ? null : current,
                      )
                    }
                  >
                    <span className="stat-label">{statLabel}</span>
                    <span className="stat-track" aria-hidden="true">
                      <span
                        className="stat-fill js-bar"
                        style={{ width: `${percent}%` }}
                      />
                    </span>
                    <span className="stat-value">
                      <CountUp to={stat.base_stat} duration={0.55} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <AbilityList abilities={abilities} />
      </AnimatedContent>

      <p className="screen-foot">
        Source PokéAPI · National Dex {formatNumber(pokemon.id)} ·{" "}
        {entries.length} English {entries.length === 1 ? "entry" : "entries"}
      </p>
    </article>
  );
}
