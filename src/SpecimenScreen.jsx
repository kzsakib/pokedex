import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import {
  artworkUrl,
  entriesByGeneration,
  formatNumber,
  pixelSpriteFallbackUrl,
  pixelSpriteRawUrl,
  pixelSpriteUrl,
  titleCase,
} from "./api";
import { percentileFor } from "./census";
import { markOnDark, typeAccent } from "./typeColors";
import {
  formatMultiplier,
  matchupStrip,
  multiplierTone,
} from "./typeChart";
import { gsap } from "./motion";
import { useMotion } from "./motionSettings";
import { playCry } from "./audio";
import DecryptedText from "./components/DecryptedText";
import TextType from "./components/TextType";
import FaultyTerminal from "./components/FaultyTerminal";
import AbilityList from "./AbilityList";

const STAT_LABELS = {
  hp: "HP",
  attack: "ATK",
  defense: "DEF",
  "special-attack": "SP.A",
  "special-defense": "SP.D",
  speed: "SPE",
};

const statTone = (percentile) => {
  if (percentile == null) return "unknown";
  if (percentile >= 75) return "high";
  if (percentile >= 40) return "mid";
  return "low";
};

export default function SpecimenScreen({
  pokemon,
  record,
  abilities,
  loading,
  fault,
  onRetry,
  statsIndex,
  statsScope = "registry",
}) {
  const { motion } = useMotion();
  const screenRef = useRef(null);
  const bentoRef = useRef(null);
  const [version, setVersion] = useState(null);
  const [shiny, setShiny] = useState(false);
  const [crying, setCrying] = useState(false);

  /* Cursor-tracking border glow: each tile records where the pointer is so
     its edge can light up locally instead of the whole plate washing out. */
  const trackSpotlight = (event) => {
    const grid = bentoRef.current;
    if (!grid) return;
    const tile = event.target.closest?.(".bento-tile") ?? null;
    const lit = grid.querySelector(".bento-tile.is-lit");
    if (lit && lit !== tile) lit.classList.remove("is-lit");
    if (!tile) return;
    const rect = tile.getBoundingClientRect();
    tile.style.setProperty("--mouse-x", `${event.clientX - rect.left}px`);
    tile.style.setProperty("--mouse-y", `${event.clientY - rect.top}px`);
    tile.classList.add("is-lit");
  };

  const clearSpotlight = () => {
    bentoRef.current?.querySelector(".bento-tile.is-lit")?.classList.remove("is-lit");
  };

  useEffect(() => {
    setShiny(false);
    setVersion(null);
    setCrying(false);
  }, [pokemon?.id]);

  const entries = record?.entries ?? [];
  const groups = entriesByGeneration(entries);
  const entry =
    entries.find((item) => item.version === version) ?? entries[0] ?? null;

  /* Tiles arrive as a group, then the readings count in. */
  useGSAP(
    () => {
      const root = screenRef.current;
      if (!root || !pokemon || !motion) return undefined;
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        return undefined;
      }

      const tiles = root.querySelectorAll(".bento-tile");
      const bars = root.querySelectorAll(".stat-bar__fill");
      const values = root.querySelectorAll(".stat-reading");
      const figures = root.querySelectorAll(".bento-figure");
      const cells = root.querySelectorAll(".matchup-cell");

      const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });

      timeline.from(tiles, {
        y: 16,
        autoAlpha: 0,
        duration: 0.4,
        stagger: 0.035,
      });

      timeline.from(
        bars,
        { scaleX: 0, transformOrigin: "left center", duration: 0.6, stagger: 0.06 },
        0.12,
      );

      values.forEach((node, index) => {
        const target = Number(node.dataset.value ?? 0);
        const proxy = { value: 0 };
        timeline.to(
          proxy,
          {
            value: target,
            duration: 0.6,
            onUpdate: () => {
              node.textContent = String(Math.round(proxy.value));
            },
            onComplete: () => {
              node.textContent = String(target);
            },
          },
          0.14 + index * 0.05,
        );
      });

      figures.forEach((node, index) => {
        /* The species ID is a padded string, not a reading to count up. */
        if (node.dataset.value === undefined) return;
        const target = Number(node.dataset.value);
        /* Height and weight read in decimals (0.4 m, 6.0 kg); the census
           figures stay whole numbers. */
        const decimals = Number(node.dataset.decimals ?? 0);
        const write = (value) => {
          node.textContent =
            decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
        };
        const proxy = { value: 0 };
        timeline.to(
          proxy,
          {
            value: target,
            duration: 0.7,
            onUpdate: () => write(proxy.value),
            onComplete: () => write(target),
          },
          0.2 + index * 0.06,
        );
      });

      timeline.from(
        cells,
        { autoAlpha: 0, scale: 0.9, duration: 0.3, stagger: 0.012 },
        0.24,
      );

      return () => timeline.kill();
    },
    { scope: screenRef, dependencies: [motion, pokemon?.id] },
  );

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
        <div className="skeleton-card" aria-hidden="true">
          <span className="skeleton skeleton-card__art" />
          <span className="skeleton-card__copy">
            <span className="skeleton skeleton--title" />
            <span className="skeleton skeleton--line" />
            <span className="skeleton skeleton--line" />
            <span className="skeleton skeleton--line skeleton--short" />
          </span>
        </div>
        <p className="visually-hidden" role="status">
          Reading the PokéAPI record…
        </p>
      </div>
    );
  }

  const label = titleCase(pokemon.name);
  const types = pokemon.types.map((slot) => slot.type.name);
  const total = pokemon.stats.reduce((sum, stat) => sum + stat.base_stat, 0);
  const strip = matchupStrip(types);
  const shinyUrl =
    pokemon.sprites?.front_shiny ??
    pokemon.sprites?.other?.["official-artwork"]?.front_shiny ??
    null;
  const cryUrl = pokemon.cries?.latest ?? pokemon.cries?.legacy ?? null;
  const scopeLabel = statsScope === "all" ? "Pokémon" : "the registry";

  return (
    <article className="screen bento-screen" ref={screenRef}>
      {/* The phosphor field sits in the gutters between tiles, tinted by the
          specimen's primary type. */}
      <div className="bento-terminal" aria-hidden="true">
        <FaultyTerminal
          tint={typeAccent(types[0])}
          glyphs="blocks"
          scale={1.7}
          gridMul={[2, 1]}
          digitSize={1.15}
          timeScale={0.32}
          brightness={0.62}
          glow={0.5}
          persistence={0.45}
          mouseStrength={0.22}
          mouseGlow={0.5}
          scanlineIntensity={0.22}
          curvature={0.06}
          vignette={0.4}
          clickEffect="glitch"
          variation={pokemon.id}
        />
      </div>

      <header className="screen-head">
        <p className="screen-no">
          <DecryptedText text={formatNumber(pokemon.id)} />
        </p>
        <p className="screen-genus">{record?.genus || "Specimen"}</p>
      </header>

      <div
        className="bento"
        ref={bentoRef}
        onPointerMove={trackSpotlight}
        onPointerLeave={clearSpotlight}
      >
        {/* 1 — sprite ------------------------------------------------ */}
        <section
          className="bento-tile bento-sprite"
          aria-labelledby="bento-name"
          style={{
            "--type-glow": typeAccent(types[0]),
            "--type-second": typeAccent(types[1] ?? types[0]),
          }}
        >
          <span className="bento-sprite__glow" aria-hidden="true" />
          <div className="bento-sprite__art">
            <img
              className={`bento-sprite__img${shiny ? "" : " is-on"}`}
              src={pixelSpriteUrl(pokemon.id)}
              alt={`${label} Red/Blue sprite`}
              width="96"
              height="96"
              onError={(event) => {
                const image = event.currentTarget;
                const step = image.dataset.fallback ?? "0";
                if (step === "0") {
                  image.dataset.fallback = "1";
                  image.src = pixelSpriteRawUrl(pokemon.id);
                } else if (step === "1") {
                  image.dataset.fallback = "2";
                  image.src = pixelSpriteFallbackUrl(pokemon.id);
                } else if (step === "2") {
                  image.dataset.fallback = "3";
                  image.src = artworkUrl(pokemon.id);
                }
              }}
            />
            {shinyUrl && (
              <img
                className={`bento-sprite__img bento-sprite__img--shiny${shiny ? " is-on" : ""}`}
                src={shinyUrl}
                alt=""
                aria-hidden="true"
                width="96"
                height="96"
                loading="lazy"
              />
            )}
          </div>

          <div className="bento-sprite__meta">
            <p className="bento-sprite__no">{formatNumber(pokemon.id)}</p>
            <h3 id="bento-name" className="bento-sprite__name">
              {label}
            </h3>
            <p className="bento-sprite__genus">{record?.genus || "Specimen"}</p>
            <ul className="bento-types">
              {types.map((name) => (
                <li
                  key={name}
                  className="bento-type"
                  style={{ "--chip": typeAccent(name) }}
                >
                  {name}
                </li>
              ))}
            </ul>
          </div>

          <div className="sprite-actions">
            <button
              type="button"
              className={`shiny-toggle cry-toggle${crying ? " is-on" : ""} cursor-target`}
              aria-label={cryUrl ? `Play ${label} cry` : `No cry on record for ${label}`}
              data-cursor-label="Cry"
              disabled={!cryUrl}
              onClick={() => {
                playCry(cryUrl);
                setCrying(true);
                window.setTimeout(() => setCrying(false), 900);
              }}
            >
              <span className="cry-toggle__wave" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              Cry
            </button>

            <button
              type="button"
              className={`shiny-toggle${shiny ? " is-on" : ""} cursor-target`}
              aria-pressed={shiny}
              aria-label={
                shinyUrl
                  ? `Show shiny ${label}`
                  : `No shiny sprite on record for ${label}`
              }
              data-cursor-label={shiny ? "Default" : "Shiny"}
              disabled={!shinyUrl}
              onClick={() => setShiny((current) => !current)}
            >
              <span className="shiny-toggle__dot" aria-hidden="true" />
              Shiny
            </button>
          </div>
        </section>

        {/* 2 — stats ------------------------------------------------- */}
        <section className="bento-tile bento-stats" aria-labelledby="bento-stats">
          <div className="bento-head">
            <h4 className="bento-label" id="bento-stats">
              Base stats
            </h4>
            <p className="bento-note">
              Total <span className="stats-total-value">{total}</span>
            </p>
          </div>

          <ul className="stat-list">
            {pokemon.stats.map((stat) => {
              const name = stat.stat.name;
              const percentile = percentileFor(statsIndex, name, stat.base_stat);
              const tone = statTone(percentile);
              return (
                <li key={name} className="stat-item" data-tone={tone}>
                  <span className="stat-name">
                    {STAT_LABELS[name] ?? name}
                  </span>
                  <span className="stat-bar" aria-hidden="true">
                    <span
                      className="stat-bar__fill"
                      style={{
                        width: `${percentile ?? Math.min(100, (stat.base_stat / 180) * 100)}%`,
                      }}
                    />
                  </span>
                  <span className="stat-reading" data-value={stat.base_stat}>
                    {stat.base_stat}
                  </span>
                  <span className="stat-rank">
                    {percentile == null
                      ? "ranking…"
                      : name === "speed"
                        ? `faster than ${percentile}% of ${scopeLabel}`
                        : `higher than ${percentile}% of ${scopeLabel}`}
                  </span>
                </li>
              );
            })}
          </ul>
          {/* The bars carry a colour nobody could decode from the bars alone. */}
          <ul className="stat-legend">
            <li data-tone="low">Below average</li>
            <li data-tone="mid">Around average</li>
            <li data-tone="high">Above average</li>
          </ul>
        </section>

        {/* 3 — measurements ------------------------------------------ */}
        <div className="bento-tile bento-metric">
          <p className="bento-label">Height</p>
          <p
            className="bento-figure"
            data-value={pokemon.height / 10}
            data-decimals="1"
          >
            {(pokemon.height / 10).toFixed(1)}
          </p>
          <p className="bento-unit">metres</p>
        </div>

        <div className="bento-tile bento-metric">
          <p className="bento-label">Weight</p>
          <p
            className="bento-figure"
            data-value={pokemon.weight / 10}
            data-decimals="1"
          >
            {(pokemon.weight / 10).toFixed(1)}
          </p>
          <p className="bento-unit">kilograms</p>
        </div>

        <div className="bento-tile bento-metric">
          <p className="bento-label">Base exp</p>
          <p className="bento-figure" data-value={pokemon.base_experience ?? 0}>
            {pokemon.base_experience ?? "—"}
          </p>
          <p className="bento-unit">yield on defeat</p>
        </div>

        <div className="bento-tile bento-metric bento-metric--led">
          <p className="bento-label">Species ID</p>
          <p className="bento-figure">{String(pokemon.id).padStart(4, "0")}</p>
          <p className="bento-unit">national dex</p>
        </div>

        {/* 4 — abilities --------------------------------------------- */}
        <section className="bento-tile bento-abilities" aria-labelledby="bento-abilities">
          <div className="bento-head">
            <h4 className="bento-label" id="bento-abilities">
              Abilities
            </h4>
            <p className="bento-note">{abilities?.length ?? 0} on record</p>
          </div>
          <AbilityList abilities={abilities} />
        </section>

        {/* 5 — type matchups ----------------------------------------- */}
        <section className="bento-tile bento-matchup" aria-labelledby="bento-matchup">
          <div className="bento-head">
            <h4 className="bento-label" id="bento-matchup">
              Type matchups
            </h4>
            <p className="bento-note">incoming damage</p>
          </div>

          <ul className="matchup-strip">
            {strip.map((cell) => (
              <li
                key={cell.type}
                className="matchup-cell"
                data-tone={multiplierTone(cell.multiplier)}
                aria-label={`${cell.type} moves deal ${formatMultiplier(cell.multiplier)} damage`}
                style={{ "--cell-type": markOnDark(cell.type) }}
              >
                <span className="matchup-cell__type" aria-hidden="true">
                  {cell.type}
                </span>
                <span className="matchup-cell__mult" aria-hidden="true">
                  {formatMultiplier(cell.multiplier)}
                </span>
              </li>
            ))}
          </ul>

          <ul className="matchup-legend" aria-hidden="true">
            {[
              ["immune", "0×"],
              ["resist-low", "0.25×"],
              ["resist", "0.5×"],
              ["neutral", "1×"],
              ["weak", "2×"],
              ["weak-high", "4×"],
            ].map(([tone, text]) => (
              <li key={tone} data-tone={tone}>
                <span className="matchup-legend__swatch" />
                {text}
              </li>
            ))}
          </ul>
        </section>

        {/* 6 — flavor ------------------------------------------------ */}
        <section className="bento-tile bento-flavor" aria-labelledby="bento-entry">
          <div className="bento-head">
            <h4 className="bento-label" id="bento-entry">
              Pokédex entry
            </h4>
            {groups.length > 0 && (
              <label className="version-select">
                <span>Game</span>
                <select
                  value={entry?.version ?? ""}
                  onChange={(event) => setVersion(event.target.value)}
                  aria-label="Choose the game this entry is read from"
                  className="cursor-target"
                  data-cursor-label="Switch game"
                >
                  {groups.map((group) => (
                    <optgroup key={group.id} label={group.label}>
                      {group.entries.map((item) => (
                        <option key={item.version} value={item.version}>
                          {item.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            )}
          </div>

          <TextType
            key={`${pokemon.id}-${entry?.version ?? "none"}`}
            className="entry-text bento-entry"
            text={entry?.text || "No English entry on record for this species."}
          />

          <p className="bento-note bento-flavor__foot">
            {entry ? `${entry.label} · ${entries.length} English entries` : "No entry"}
          </p>
        </section>
      </div>

      <p className="screen-foot">
        Source PokéAPI · Red/Blue sprite · National Dex {formatNumber(pokemon.id)}
      </p>
    </article>
  );
}
