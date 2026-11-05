import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
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
import { ScrollTrigger, gsap } from "./motion";
import { useLenis } from "lenis/react";
import TargetCursor from "./components/TargetCursor";
import { useMotion } from "./motionSettings";
import { SplitWords } from "./SplitText";
import InteractiveTitle from "./InteractiveTitle";
import Gallery from "./Gallery";
import RailRuler from "./RailRuler";
import { accentVars } from "./typeColors";
import BootScreen from "./components/BootScreen";
import ClickSpark from "./components/ClickSpark";
import CountUp from "./components/CountUp";
import ShinyText from "./components/ShinyText";
import EvolutionTray from "./EvolutionTray";
import SpecimenScreen from "./SpecimenScreen";

const LEDE =
  "A field instrument for the original 151. Search the field archive, load a specimen record, switch between Pokédex entries by game, and trace the evolution line. Every reading below streams live from PokéAPI.";

const DEFAULT_ENTRY = 25;

export default function App() {
  const { motion } = useMotion();
  const pageRef = useRef(null);
  const shellRef = useRef(null);
  const dialRef = useRef(null);
  const ventsRef = useRef(null);
  const searchRef = useRef(null);
  const progressRef = useRef(null);
  const { lenis } = useLenis();

  const [index, setIndex] = useState([]);
  const [entries, setEntries] = useState({});
  const [records, setRecords] = useState({});
  const [abilitiesById, setAbilitiesById] = useState({});
  const [lines, setLines] = useState({});
  const [scanned, setScanned] = useState(0);
  const [feed, setFeed] = useState("loading");
  const [feedAttempt, setFeedAttempt] = useState(0);
  const [booted, setBooted] = useState(false);
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
    setFeed("loading");
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
  }, [feedAttempt]);

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

  /* Stats index & scope for percentiles across the live archive. */
  const statsIndex = useMemo(() => {
    if (!Object.keys(entries).length) return { scope: "the registry", data: [] };
    const rows = Object.entries(entries)
      .map(([id, p]) => {
        const stats = p?.stats?.map((s) => ({ name: s.stat.name, base_stat: s.base_stat })) ?? [];
        return { id, stats };
      })
      .filter((r) => r.stats.length > 0);
    return { scope: "Pokémon", data: rows };
  }, [entries]);

  const selectedEntry = index.find((item) => item.id === selectedId);
  const pokemon = entries[selectedId] ?? null;
  const record = records[selectedId] ?? null;
  const abilityList = abilitiesById[selectedId] ?? [];
  const line = lines[selectedId] ?? [];

  /* How this specimen's base stats rank across the scanned registry. */
  const percentiles = useMemo(() => {
    if (!pokemon) return {};
    const { data: scannedEntries = [] } = statsIndex ?? {};
    if (!scannedEntries.length) return {};

    return Object.fromEntries(
      pokemon.stats.map((stat) => {
        const key = stat.stat.name;
        const values = scannedEntries
          .map((entry) => entry.stats?.find((slot) => slot.stat.name === key)?.base_stat)
          .filter((value) => typeof value === "number");
        if (!values.length) return [key, null];
        const below = values.filter((value) => value < stat.base_stat).length;
        return [key, Math.round((below / values.length) * 100)];
      }),
    );
  }, [statsIndex, pokemon]);

  const primaryType = pokemon?.types?.[0]?.type.name;
  const accentStyle = useMemo(() => accentVars(primaryType), [primaryType]);

  const { contextSafe } = useGSAP({ scope: shellRef });

  const select = useCallback((id) => {
    setSelectedId(id);
    setFaultId((current) => (current === id ? null : current));
  }, []);

  const clearFilters = useCallback(() => {
    setQuery("");
    setType("all");
  }, []);

  const retryFeed = contextSafe(() => {
    setScanned(0);
    setFeedAttempt((value) => value + 1);
  });

  /* The vent grille doubles as a level meter: it answers the feed, the boot
     sequence and the dial instead of sitting there as decoration. The bars
     stay full width; the light band travels along them. */
  const flashVents = contextSafe((strength = 1) => {
    const bars = ventsRef.current?.querySelectorAll("span");
    if (!motion || !bars?.length) return;
    gsap.fromTo(
      bars,
      { backgroundPositionX: "0%", opacity: 0.45 },
      {
        backgroundPositionX: "100%",
        opacity: 1,
        duration: 0.42 + strength * 0.22,
        stagger: 0.045,
        ease: "power2.inOut",
        overwrite: "auto",
      },
    );
  });

  const drawRandom = contextSafe(() => {
    if (!index.length) return;
    const currentPosition = index.findIndex((item) => item.id === selectedId);
    let nextPosition = Math.floor(Math.random() * index.length);
    if (index.length > 1 && nextPosition === currentPosition) {
      nextPosition = (nextPosition + 1) % index.length;
    }
    const target = index[nextPosition];

    setQuery("");
    setType("all");

    const dial = dialRef.current;
    const face = dial?.querySelector(".dial-face");
    const readout = dial?.querySelector(".dial-readout");
    const ticks = dial?.querySelector(".dial-ticks");

    if (!motion || !dial) {
      select(target.id);
      if (readout) readout.textContent = target.number;
      return;
    }

    /* The dial is a real instrument: it winds through whole turns while the
       readout rolls like an odometer, then settles on the drawn entry. Only
       the face and its tick ring turn — rotating the housing would swing the
       cast shadow around with it. */
    dial.classList.add("is-spinning");
    const proxy = { progress: 0 };
    gsap
      .timeline({
        onComplete: () => {
          dial.classList.remove("is-spinning");
          gsap.set(face, { clearProps: "transform" });
          gsap.set(ticks, { clearProps: "transform" });
          if (readout) readout.textContent = target.number;
        },
      })
      .to(face, { rotate: 1080, duration: 1, ease: "power3.inOut" }, 0)
      .to(ticks, { rotate: 1080, duration: 1, ease: "power3.inOut" }, 0)
      .to(
        proxy,
        {
          progress: 1,
          duration: 1,
          ease: "none",
          onUpdate: () => {
            if (!readout || proxy.progress > 0.9) return;
            readout.textContent = `#${String(
              Math.floor(Math.random() * ENTRY_LIMIT) + 1,
            ).padStart(3, "0")}`;
          },
        },
        0,
      )
      .add(() => {
        select(target.id);
        flashVents(1);
      }, 0.84);
  });

  /* Keep the dial readout honest when the entry changes by any other route. */
  useEffect(() => {
    const readout = dialRef.current?.querySelector(".dial-readout");
    if (!readout || dialRef.current?.classList.contains("is-spinning")) return;
    if (selectedEntry) readout.textContent = selectedEntry.number;
  }, [selectedEntry]);

  /* After randomize selects a new entry, scroll specimen-bay into view. */
  useEffect(() => {
    const scheduled = setTimeout(() => {
      if (lenis) {
        lenis.scrollTo("#specimen-bay", {
          offset: -80,
          duration: 1,
          easing: (t) => Math.min(1, 0.1 + 0.9 * t),
        });
      } else {
        const target = document.getElementById("specimen-bay");
        target?.scrollIntoView({ behavior: "auto", block: "start" });
      }
    }, 0);
    return () => clearTimeout(scheduled);
  }, [selectedId, lenis]);

  useEffect(() => {
    if (booted && scanned > 0) flashVents(0.55);
  }, [scanned, booted, flashVents]);

  /* Chassis boot: every bay settles in once the boot overlay clears. */
  useGSAP(
    () => {
      if (!motion || !booted) return undefined;
      const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
      timeline
        .from(".vents span", {
          autoAlpha: 0,
          duration: 0.35,
          stagger: 0.04,
        })
        .from(
          ".screw",
          { scale: 0, rotate: -90, duration: 0.4, stagger: 0.05 },
          0,
        )
        .fromTo(
          ".dial",
          { scale: 0.72, autoAlpha: 0 },
          {
            scale: 1,
            autoAlpha: 1,
            duration: 0.5,
            clearProps: "transform,opacity,visibility",
          },
          0.05,
        )
        .from(
          ".bay",
          { y: 18, autoAlpha: 0, duration: 0.5, stagger: 0.06 },
          0.05,
        );

      return () => timeline.kill();
    },
    { scope: shellRef, dependencies: [motion, booted] },
  );

  /* Scroll reveals for the section plates and their hairlines. */
  useGSAP(
    () => {
      if (!motion) return undefined;
      const scope = shellRef.current;
      if (!scope) return undefined;

      /* Reveals run as class-driven transitions triggered by ScrollTrigger.
         A GSAP tween created in onEnter gets killed by context reverts and
         reset by ScrollTrigger.refresh(), which left the footer and hairlines
         frozen part-way; a CSS transition has no such state to lose. */
      const triggers = [];
      const plates = Array.from(scope.querySelectorAll(".bay-tag--rule"));

      plates.forEach((plate) => {
        plate.classList.add("reveal");
        plate.querySelector(".bay-rule")?.classList.add("rule-reveal");
        triggers.push(
          ScrollTrigger.create({
            trigger: plate,
            start: "top 92%",
            once: true,
            onEnter: () => {
              plate.classList.add("is-in");
              plate.querySelector(".bay-rule")?.classList.add("is-in");
            },
          }),
        );
      });

      const closing = Array.from(scope.querySelectorAll(".closing > div"));
      closing.forEach((element, index) => {
        element.classList.add("reveal");
        element.style.transitionDelay = `${index * 90}ms`;
      });
      triggers.push(
        ScrollTrigger.create({
          trigger: ".closing",
          start: "top 94%",
          once: true,
          onEnter: () => closing.forEach((element) => element.classList.add("is-in")),
        }),
      );

      ScrollTrigger.refresh();

      return () => {
        triggers.forEach((trigger) => trigger.kill());
        plates.forEach((plate) => {
          plate.classList.remove("reveal", "is-in");
          plate.querySelector(".bay-rule")?.classList.remove("rule-reveal", "is-in");
        });
        closing.forEach((element) => {
          element.classList.remove("reveal", "is-in");
          element.style.transitionDelay = "";
        });
      };
    },
    { scope: shellRef, dependencies: [motion, index.length] },
  );

  /* Thin progress rail across the top of the instrument. */
  useGSAP(
    () => {
      const bar = progressRef.current;
      if (!bar || !motion) return undefined;
      gsap.set(bar, { scaleX: 0, transformOrigin: "left center" });
      const trigger = ScrollTrigger.create({
        start: 0,
        end: "max",
        onUpdate: (self) => gsap.set(bar, { scaleX: self.progress }),
      });
      return () => trigger.kill();
    },
    { scope: pageRef, dependencies: [motion, index.length, filtered.length] },
  );

  /* Layout shifts once the feed lands; ScrollTrigger needs fresh measurements. */
  useEffect(() => {
    const timer = window.setTimeout(() => ScrollTrigger.refresh(), 320);
    return () => window.clearTimeout(timer);
  }, [index.length, filtered.length, booted]);

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
    <div className="page" ref={pageRef} style={accentStyle}>
      <a className="skip-link" href="#archive-bay">
        Skip to archive
      </a>

      <TargetCursor />

      <div className="scroll-progress" aria-hidden="true">
        <span ref={progressRef} />
      </div>

      <ClickSpark />

      <main className="chassis" ref={shellRef} style={accentStyle}>
        <div className="seam" aria-hidden="true" />
        <RailRuler />
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
            <InteractiveTitle />
            <SplitWords className="lede" delay={0.25} text={LEDE} />
          </div>

          <div className="controls">
            <div className="vents" aria-hidden="true" ref={ventsRef}>
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
                <span className="dial-label">Randomize</span>
                <span className="dial-readout" aria-hidden="true">
                  {selectedEntry?.number ?? "#025"}
                </span>
              </span>
            </button>
            <p className="control-hint" id="dial-hint">
              Picks a random specimen from the archive.
            </p>
            <button type="button" className="key key--wide" onClick={clearFilters}>
              Clear filters
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
                <CountUp to={index.length || ENTRY_LIMIT} duration={1} />
              </dd>
            </div>
            <div className="fact">
              <dt>Matches</dt>
              <dd>
                {feed === "live" ? (
                  <CountUp to={filtered.length} duration={0.45} />
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
                {feed === "live" ? (
                  <ShinyText text={feedLabel} />
                ) : (
                  <span className="feed-label">{feedLabel}</span>
                )}
              </dd>
            </div>
          </dl>
          {feed === "error" && (
            <p className="fault" role="alert">
              Index feed offline — PokéAPI did not answer.
              <button type="button" className="key key--inline" onClick={retryFeed}>
                Retry feed
              </button>
            </p>
          )}
        </section>

        <section className="bay archive-bay" id="archive-bay" aria-labelledby="archive-title">
          <h2 className="bay-tag bay-tag--rule" id="archive-title">
            <span className="bay-index" aria-hidden="true">
              02
            </span>
            <span className="bay-label">Field archive</span>
            <span className="bay-rule" aria-hidden="true" />
          </h2>
          <Gallery
            items={filtered}
            total={index.length}
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

        <section className="bay specimen-bay" id="specimen-bay" aria-labelledby="specimen-title">
          <h2 className="bay-tag bay-tag--rule" id="specimen-title">
            <span className="bay-index" aria-hidden="true">
              03
            </span>
            <span className="bay-label">Specimen record</span>
            <span className="bay-rule" aria-hidden="true" />
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

      {!booted && <BootScreen motion={motion} onDone={() => setBooted(true)} />}

      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
