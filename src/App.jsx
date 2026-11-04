import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ENTRY_LIMIT,
  evolutionStages,
  fetchAbility,
  fetchEvolution,
  fetchIndex,
  fetchPokemon,
  fetchSpecies,
  formatNumber,
  pool,
  readAbilityText,
  readEntries,
  readGenus,
  titleCase,
} from "./api";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { gsap } from "./motion";
import { useMotion } from "./motionSettings";
import { SplitChars, SplitWords } from "./SplitText";
import { accentVars } from "./typeColors";
import CountUp from "./components/CountUp";
import EvolutionTray from "./EvolutionTray";
import IndexBay from "./IndexBay";
import SpecimenScreen from "./SpecimenScreen";

const LEDE =
  "A field instrument for the original 151. Search the index, read the specimen record, switch between Pokédex entries by game, and trace the evolution line. Every reading below streams live from PokéAPI.";

const DEFAULT_ENTRY = 25;

gsap.registerPlugin(ScrollTrigger);

export default function App() {
  const { motion, toggleMotion } = useMotion();
  const shellRef = useRef(null);
  const dialRef = useRef(null);
  const searchRef = useRef(null);

  const [index, setIndex] = useState([]);
  const [entries, setEntries] = useState({});
  const [records, setRecords] = useState({});
  const [abilitiesById, setAbilitiesById] = useState({});
  const [lines, setLines] = useState({});
  const [scanned, setScanned] = useState(0);
  const [feed, setFeed] = useState("loading");
  const [selectedId, setSelectedId] = useState(DEFAULT_ENTRY);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [faultId, setFaultId] = useState(null);
  const [attempt, setAttempt] = useState(0);

  /* Load the index, then walk it in the background so type filters and
     thumbnails fill in without blocking the first paint. */
  useEffect(() => {
    let cancelled = false;
    const pending = [];
    const flush = () => {
      if (cancelled || !pending.length) return;
      const chunk = Object.fromEntries(pending.splice(0, pending.length));
      setEntries((previous) => ({ ...previous, ...chunk }));
    };

    fetchIndex()
      .then((items) => {
        if (cancelled) return;
        setIndex(items);
        setFeed("live");

        const begin = () => {
          pool(
            items,
            async (item) => {
              const data = await fetchPokemon(item.id);
              pending.push([item.id, data]);
              if (pending.length >= 10) flush();
            },
            5,
            (done) => {
              if (!cancelled && (done % 6 === 0 || done === items.length)) {
                setScanned(done);
              }
            },
          )
            .then(flush)
            .catch(() => {});
        };

        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(begin, { timeout: 1500 });
        } else {
          window.setTimeout(begin, 400);
        }
      })
      .catch(() => {
        if (!cancelled) setFeed("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /* Read the selected entry: specimen, abilities, species record and line. */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const pokemon = await fetchPokemon(selectedId);
        if (cancelled) return;
        setEntries((previous) =>
          previous[selectedId] ? previous : { ...previous, [selectedId]: pokemon },
        );

        const abilityDetails = await Promise.all(
          pokemon.abilities.map(async (slot) => {
            const base = {
              name: slot.ability.name,
              label: titleCase(slot.ability.name),
              hidden: slot.is_hidden,
              text: "",
            };
            try {
              const data = await fetchAbility(slot.ability.name);
              return { ...base, text: readAbilityText(data) };
            } catch {
              return base;
            }
          }),
        );
        if (cancelled) return;
        setAbilitiesById((previous) =>
          previous[selectedId]
            ? previous
            : { ...previous, [selectedId]: abilityDetails },
        );

        const species = await fetchSpecies(selectedId);
        if (cancelled) return;
        setRecords((previous) =>
          previous[selectedId]
            ? previous
            : {
                ...previous,
                [selectedId]: {
                  genus: readGenus(species),
                  entries: readEntries(species),
                },
              },
        );

        if (species?.evolution_chain?.url) {
          const chain = await fetchEvolution(species.evolution_chain.url);
          if (cancelled) return;
          setLines((previous) =>
            previous[selectedId]
              ? previous
              : { ...previous, [selectedId]: evolutionStages(chain) },
          );
        }
      } catch {
        if (!cancelled) setFaultId(selectedId);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedId, attempt]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/^#/, "");
    return index.filter((item) => {
      if (type !== "all") {
        const data = entries[item.id];
        if (!data?.types?.some((slot) => slot.type.name === type)) return false;
      }
      if (!needle) return true;
      return (
        item.name.includes(needle) ||
        String(item.id) === needle ||
        item.number.replace("#", "").includes(needle)
      );
    });
  }, [index, entries, query, type]);

  const selectedEntry = index.find((item) => item.id === selectedId);
  const pokemon = entries[selectedId] ?? null;
  const record = records[selectedId] ?? null;
  const abilityList = abilitiesById[selectedId] ?? [];
  const line = lines[selectedId] ?? [];

  /* How this specimen's base stats rank across the scanned registry. */
  const percentiles = useMemo(() => {
    if (!pokemon) return {};
    const scannedEntries = Object.values(entries);
    if (!scannedEntries.length) return {};

    return Object.fromEntries(
      pokemon.stats.map((stat) => {
        const key = stat.stat.name;
        const values = scannedEntries
          .map(
            (entry) =>
              entry.stats?.find((slot) => slot.stat.name === key)?.base_stat,
          )
          .filter((value) => typeof value === "number");
        if (!values.length) return [key, null];
        const below = values.filter((value) => value < stat.base_stat).length;
        return [key, Math.round((below / values.length) * 100)];
      }),
    );
  }, [entries, pokemon]);

  const primaryType = pokemon?.types?.[0]?.type.name;
  const accentStyle = useMemo(() => accentVars(primaryType), [primaryType]);

  const select = useCallback((id) => {
    setSelectedId(id);
    setFaultId((current) => (current === id ? null : current));
  }, []);

  const clearFilters = useCallback(() => {
    setQuery("");
    setType("all");
  }, []);

  const drawRandom = useCallback(() => {
    if (!index.length) return;
    const currentPosition = index.findIndex((item) => item.id === selectedId);
    let nextPosition = Math.floor(Math.random() * index.length);
    if (index.length > 1 && nextPosition === currentPosition) {
      nextPosition = (nextPosition + 1) % index.length;
    }
    setQuery("");
    setType("all");
    select(index[nextPosition].id);

    if (motion && dialRef.current) {
      gsap.fromTo(
        dialRef.current,
        { rotate: -16 },
        { rotate: 0, duration: 0.55, ease: "back.out(2.6)" },
      );
      const ticks = dialRef.current.querySelector(".dial-ticks");
      if (ticks) {
        gsap.fromTo(
          ticks,
          { rotate: -60 },
          { rotate: 0, duration: 0.55, ease: "power2.out" },
        );
      }
    }
  }, [index, motion, selectedId, select]);

  /* Boot sequence for the chassis, then directional reveals for the bays. */
  useEffect(() => {
    if (!motion) return undefined;
    const context = gsap.context(() => {
      const boot = gsap.timeline({ defaults: { ease: "power3.out" } });
      boot
        .from(".vents span", {
          scaleX: 0,
          transformOrigin: "left center",
          duration: 0.4,
          stagger: 0.05,
          clearProps: "transform",
        })
        .from(
          ".screw",
          { scale: 0, rotate: -90, duration: 0.45, stagger: 0.06, clearProps: "transform" },
          0,
        )
        .from(
          ".dial",
          { scale: 0.6, opacity: 0, duration: 0.55, clearProps: "transform,opacity" },
          0.05,
        )
        .from(
          ".bay",
          { y: 20, autoAlpha: 0, duration: 0.55, stagger: 0.07, clearProps: "all" },
          0.1,
        );

      gsap.from(".index-col", {
        x: -28,
        autoAlpha: 0,
        duration: 0.62,
        ease: "power3.out",
        clearProps: "all",
        scrollTrigger: { trigger: ".workbench", start: "top 90%", once: true },
      });
      gsap.from(".specimen-col", {
        x: 28,
        autoAlpha: 0,
        duration: 0.62,
        ease: "power3.out",
        clearProps: "all",
        scrollTrigger: { trigger: ".workbench", start: "top 90%", once: true },
      });
      gsap.from(".closing > div", {
        y: 18,
        autoAlpha: 0,
        duration: 0.5,
        stagger: 0.09,
        ease: "power2.out",
        clearProps: "all",
        scrollTrigger: { trigger: ".closing", start: "top 94%", once: true },
      });
    }, shellRef);
    return () => context.revert();
  }, [motion]);

  useEffect(() => {
    function onKeyDown(event) {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape" && typing) {
        setQuery("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const scanComplete = scanned >= ENTRY_LIMIT;
  const feedLabel =
    feed === "error"
      ? "Offline"
      : feed === "loading"
        ? "Connecting"
        : scanComplete
          ? "PokéAPI live"
          : `Indexing ${scanned}/${ENTRY_LIMIT}`;

  const announcement =
    feed === "error"
      ? "Index feed offline."
      : `${filtered.length} of ${index.length || ENTRY_LIMIT} entries in the index.${
          selectedEntry
            ? ` ${selectedEntry.number} ${selectedEntry.label} on the bench.`
            : ""
        }`;

  return (
    <div className="page">
      <a className="skip-link" href="#index-bay">
        Skip to index
      </a>

      <main className="chassis" ref={shellRef} style={accentStyle}>
        <div className="seam" aria-hidden="true" />
        <span className="screw screw--tl" aria-hidden="true" />
        <span className="screw screw--tr" aria-hidden="true" />
        <span className="screw screw--bl" aria-hidden="true" />
        <span className="screw screw--br" aria-hidden="true" />

        <section className="bay opening" aria-labelledby="page-title">
          <div className="opening-copy">
            <p className="bay-tag">
              <span className="bay-index" aria-hidden="true">
                01
              </span>
              National registry
            </p>
            <SplitChars as="h1" id="page-title" text="Pokédex" />
            <SplitWords className="lede" delay={0.25} text={LEDE} />
          </div>

          <div className="controls">
            <div className="vents" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <button
              ref={dialRef}
              type="button"
              className="dial"
              onClick={drawRandom}
              aria-describedby="dial-hint"
            >
              <span className="dial-ticks" aria-hidden="true" />
              <span className="dial-face">
                <span className="dial-symbol" aria-hidden="true">
                  ⤨
                </span>
                <span className="dial-label">Draw one</span>
              </span>
            </button>
            <p className="control-hint" id="dial-hint">
              Draws a random entry from the index.
            </p>
            <button type="button" className="key key--wide" onClick={clearFilters}>
              Clear filters
            </button>
            <button
              type="button"
              className="key key--wide key--motion"
              aria-pressed={motion}
              onClick={toggleMotion}
            >
              <span className="lamp" aria-hidden="true" />
              Motion {motion ? "on" : "off"}
            </button>
          </div>
        </section>

        <section className="bay status" aria-labelledby="status-title">
          <h2 id="status-title" className="visually-hidden">
            Instrument status
          </h2>
          <dl className="facts">
            <div className="fact">
              <dt>Entries</dt>
              <dd>
                <CountUp
                  to={index.length || ENTRY_LIMIT}
                  duration={1}
                  trigger="view"
                />
              </dd>
            </div>
            <div className="fact">
              <dt>Matches</dt>
              <dd>
                {feed === "live" ? (
                  <CountUp to={filtered.length} duration={0.45} trigger="view" />
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="fact">
              <dt>On bench</dt>
              <dd>
                {selectedEntry
                  ? `${selectedEntry.number} ${selectedEntry.label}`
                  : pokemon
                    ? `${formatNumber(pokemon.id)} ${titleCase(pokemon.name)}`
                    : "—"}
              </dd>
            </div>
            <div className="fact">
              <dt>Feed</dt>
              <dd>
                <span
                  className={`lamp${feed === "live" ? " lamp--on" : ""}`}
                  aria-hidden="true"
                />
                {feedLabel}
              </dd>
            </div>
          </dl>
          {feed === "error" && (
            <p className="fault" role="alert">
              Index feed offline — PokéAPI did not answer. Reload the page to
              reconnect.
            </p>
          )}
        </section>

        <div className="bay workbench">
          <section className="index-col" id="index-bay" aria-labelledby="index-title">
            <h2 className="bay-tag" id="index-title">
              <span className="bay-index" aria-hidden="true">
                02
              </span>
              Index
            </h2>
            <IndexBay
              items={filtered}
              entries={entries}
              selectedId={selectedId}
              onSelect={select}
              query={query}
              onQuery={setQuery}
              type={type}
              onType={setType}
              onClear={clearFilters}
              searchRef={searchRef}
              feed={feed}
            />
          </section>

          <section className="specimen-col" aria-labelledby="specimen-title">
            <h2 className="bay-tag" id="specimen-title">
              <span className="bay-index" aria-hidden="true">
                03
              </span>
              Specimen record
            </h2>
            <div className="bezel">
              <SpecimenScreen
                pokemon={pokemon}
                record={record}
                abilities={abilityList}
                percentiles={percentiles}
                loading={!pokemon && faultId !== selectedId}
                fault={faultId === selectedId}
                onRetry={() => {
                  setFaultId(null);
                  setAttempt((value) => value + 1);
                }}
              />
            </div>
            <EvolutionTray
              stages={line}
              selectedId={selectedId}
              onSelect={select}
            />
          </section>
        </div>

        <footer className="bay closing">
          <div>
            <p className="bay-tag">
              <span className="bay-index" aria-hidden="true">
                04
              </span>
              Field unit
            </p>
            <p className="closing-copy">
              An independent fan instrument covering National Dex 001–151. No
              account and no server of its own: this page queries PokéAPI
              directly from your browser.
            </p>
          </div>
          <div>
            <p className="bay-tag bay-tag--plain">Data</p>
            <ul className="footer-list">
              <li>
                <a href="https://pokeapi.co/" target="_blank" rel="noreferrer">
                  PokéAPI v2
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/PokeAPI/sprites"
                  target="_blank"
                  rel="noreferrer"
                >
                  Sprite archive
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="bay-tag bay-tag--plain">Attribution</p>
            <p className="closing-copy">
              Pokémon and Pokémon character names are trademarks of Nintendo,
              Creatures Inc. and GAME FREAK inc. This project is unaffiliated and
              non-commercial.
            </p>
          </div>
        </footer>
      </main>

      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
