import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { artworkUrl, formatNumber, spriteUrl, titleCase } from "./api";
import { typeAccent } from "./typeColors";
import { gsap, SplitText as GSAPSplitText } from "./motion";
import { useMotion } from "./motionSettings";
import DecryptedText from "./components/DecryptedText";
import TextType from "./components/TextType";
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
  const nameSplitRef = useRef(null);
  const [entryIndex, setEntryIndex] = useState(0);
  const [activeStat, setActiveStat] = useState(null);

  const { contextSafe } = useGSAP({ scope: screenRef });

  useEffect(() => {
    setEntryIndex(0);
    setActiveStat(null);
  }, [pokemon?.id]);

  /* One timeline per specimen: the scan wipes the artwork, the name rises,
     the meta staggers, then the bars and their numbers count together. */
  useGSAP(
    () => {
      const root = screenRef.current;
      if (!root || !pokemon || !motion) return undefined;

      nameSplitRef.current?.revert();
      nameSplitRef.current = null;

      const art = root.querySelector(".art-well img");
      const scan = root.querySelector(".scan-line");
      const nameElement = root.querySelector(".screen-copy h3");
      const meta = root.querySelectorAll(".type-tag, .measures > div");
      const rows = Array.from(root.querySelectorAll(".stat-row"));
      const totalElement = root.querySelector(".stats-total-value");
      const totalValue = Number(root.dataset.total ?? 0);

      const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });

      if (art) {
        timeline.fromTo(
          art,
          { autoAlpha: 0, scale: 0.86, filter: "blur(8px)" },
          {
            autoAlpha: 1,
            scale: 1,
            filter: "blur(0px)",
            duration: 0.5,
            clearProps: "filter,transform,visibility",
          },
          0,
        );
      }

      if (scan) {
        timeline
          .fromTo(
            scan,
            { yPercent: -140, opacity: 0 },
            { yPercent: 140, opacity: 0.9, duration: 0.6, ease: "power2.inOut" },
            0,
          )
          .to(scan, { opacity: 0, duration: 0.16 }, 0.52);
      }

      if (nameElement) {
        const split = new GSAPSplitText(nameElement, {
          type: "chars",
          charsClass: "split-char",
        });
        nameSplitRef.current = split;
        timeline.from(
          split.chars,
          {
            yPercent: 110,
            rotateX: -70,
            opacity: 0,
            stagger: 0.022,
            duration: 0.5,
          },
          0.06,
        );
      }

      if (meta.length) {
        timeline.from(
          meta,
          { y: 10, autoAlpha: 0, stagger: 0.04, duration: 0.38 },
          0.1,
        );
      }

      rows.forEach((row, index) => {
        const fill = row.querySelector(".stat-fill");
        const valueElement = row.querySelector(".stat-value");
        const value = Number(row.dataset.value ?? 0);
        const percent = Number(row.dataset.pct ?? 0);
        const at = 0.16 + index * 0.05;

        if (fill) {
          timeline.fromTo(
            fill,
            { width: "0%" },
            { width: `${percent}%`, duration: 0.72 },
            at,
          );
        }

        if (valueElement) {
          const proxy = { value: 0 };
          timeline.to(
            proxy,
            {
              value,
              duration: 0.72,
              onUpdate: () => {
                valueElement.textContent = String(Math.round(proxy.value));
              },
              onComplete: () => {
                valueElement.textContent = String(value);
              },
            },
            at,
          );
        }
      });

      if (totalElement) {
        const proxy = { value: 0 };
        timeline.to(
          proxy,
          {
            value: totalValue,
            duration: 0.9,
            onUpdate: () => {
              totalElement.textContent = String(Math.round(proxy.value));
            },
            onComplete: () => {
              totalElement.textContent = String(totalValue);
            },
          },
          0.2,
        );
      }

      return () => {
        timeline.kill();
        nameSplitRef.current?.revert();
        nameSplitRef.current = null;
      };
    },
    { scope: screenRef, dependencies: [motion, pokemon?.id] },
  );

  const onArtLoad = contextSafe((event) => {
    if (!motion) return;
    gsap.fromTo(
      event.currentTarget,
      { autoAlpha: 0, filter: "blur(6px)" },
      {
        autoAlpha: 1,
        filter: "blur(0px)",
        duration: 0.45,
        ease: "power2.out",
        clearProps: "filter,visibility",
      },
    );
  });

  /* Cursor-follow glow on the dark card. */
  const onGlowMove = contextSafe((event) => {
    if (!motion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    gsap.to(event.currentTarget, {
      "--glow-x": `${(((event.clientX - rect.left) / rect.width) * 100).toFixed(1)}%`,
      "--glow-y": `${(((event.clientY - rect.top) / rect.height) * 100).toFixed(1)}%`,
      duration: 0.3,
      ease: "power2.out",
    });
  });

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
    <article
      className="screen"
      ref={screenRef}
      data-total={total}
      onPointerMove={onGlowMove}
    >
      <header className="screen-head">
        <p className="screen-no">
          <DecryptedText text={formatNumber(pokemon.id)} />
        </p>
        <p className="screen-genus">{record?.genus || "Specimen"}</p>
      </header>

      <div className="screen-stack">
        <div className="screen-body">
          <div className="art-well">
            <span className="scan-line" aria-hidden="true" />
            <img
              src={artworkUrl(pokemon.id)}
              alt={`${label} official artwork`}
              width="475"
              height="475"
              onLoad={onArtLoad}
              onError={(event) => {
                const image = event.currentTarget;
                if (image.dataset.fallback) return;
                image.dataset.fallback = "1";
                image.src = spriteUrl(pokemon.id);
              }}
            />
          </div>

          <div className="screen-copy">
            <h3 key={pokemon.id}>{label}</h3>
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
          <TextType
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
              <span className="stats-total-value">{total}</span>
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
                    data-value={stat.base_stat}
                    data-pct={percent}
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
                    <span className="stat-value">{stat.base_stat}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <AbilityList abilities={abilities} />
      </div>

      <p className="screen-foot">
        Source PokéAPI · National Dex {formatNumber(pokemon.id)} ·{" "}
        {entries.length} English {entries.length === 1 ? "entry" : "entries"}
      </p>
    </article>
  );
}
