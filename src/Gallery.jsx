import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { useLenis } from "lenis/react";
import { fetchSpecies, pixelSpriteUrl, readEntries, titleCase } from "./api";
import { gsap, prefersReducedMotion } from "./motion";
import DecryptedText from "./components/DecryptedText";
import TextType from "./components/TextType";
import { inkOnLight, markOnLight, softAccent, typeAccent } from "./typeColors";
import { TYPES } from "./types";

/* Species records are fetched on first hover and kept for the session so the
   archive never asks PokéAPI twice for the same entry. */
const entryCache = new Map();
const SKELETON_CELLS = 44;

function loadEntries(id) {
  if (!entryCache.has(id)) {
    entryCache.set(
      id,
      fetchSpecies(id)
        .then((species) =>
          readEntries(species).filter((entry) => entry.text?.trim()),
        )
        .catch(() => []),
    );
  }
  return entryCache.get(id);
}


export default function Gallery({
  items,
  total,
  selectedId,
  onSelect,
  query,
  onQuery,
  type,
  onType,
  onClear,
  searchRef,
  feed,
  hoverType = null,
  hotIds = null,
  typeById = null,
  caughtIds = null,
  onTypeHover,
}) {
  const rootRef = useRef(null);
  const gridRef = useRef(null);
  const panelRef = useRef(null);
  const bankRef = useRef(null);
  const pillRef = useRef(null);
  const lenis = useLenis();
  const [tip, setTip] = useState(null);
  const requestRef = useRef(0);
  /* One delegated handler for the whole wall: per-cell pointer enter/leave
     handlers race each other when the pointer travels quickly. */
  const hoveredRef = useRef(null);

  /* Card unfolds out of the cell it belongs to. */
  useGSAP(
    () => {
      const panel = panelRef.current;
      if (!panel) return undefined;
      if (prefersReducedMotion()) {
        gsap.set(panel, { autoAlpha: 1, y: 0, scale: 1, clipPath: "inset(0%)" });
        return undefined;
      }

      const timeline = gsap.timeline();
      timeline
        .fromTo(
          panel,
          {
            autoAlpha: 0,
            y: tip?.below ? -18 : 22,
            scale: 0.82,
            rotateX: tip?.below ? -16 : 16,
            clipPath: "inset(0% 0% 100% 0%)",
          },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            rotateX: 0,
            clipPath: "inset(0%)",
            transformPerspective: 700,
            duration: 0.52,
            ease: "expo.out",
          },
        )
        .fromTo(
          panel.querySelectorAll(".gallery-tip__rule, .gallery-tip__head"),
          { autoAlpha: 0, y: 7 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.26,
            stagger: 0.05,
            ease: "power2.out",
          },
          0.08,
        );

      return () => timeline.kill();
    },
    { scope: rootRef, dependencies: [tip?.key] },
  );

  /* The wall re-assembles on every filter change: sprites fade up in a
     short wave so a new result set reads as new, not as a jump cut. */
  useGSAP(
    () => {
      const cells = gridRef.current?.querySelectorAll(".gallery-cell");
      if (!cells?.length || prefersReducedMotion()) return undefined;
      const tween = gsap.fromTo(
        cells,
        { autoAlpha: 0, y: 12, scale: 0.9 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.38,
          ease: "power2.out",
          stagger: { each: 0.006, from: "start" },
          overwrite: true,
          clearProps: "transform,opacity,visibility",
        },
      );
      return () => tween.kill();
    },
    { scope: rootRef, dependencies: [items.length, query, type] },
  );

  /* Sliding highlight under the active type chip. */
  useGSAP(
    () => {
      const bank = bankRef.current;
      const pill = pillRef.current;
      if (!bank || !pill) return undefined;
      const active = bank.querySelector('.key--type[aria-pressed="true"]');
      if (!active || prefersReducedMotion()) {
        gsap.set(pill, { autoAlpha: 0 });
        return undefined;
      }
      gsap.to(pill, {
        autoAlpha: 1,
        x: active.offsetLeft,
        y: active.offsetTop + active.offsetHeight - 2,
        width: active.offsetWidth,
        duration: 0.32,
        ease: "power3.out",
      });
      return undefined;
    },
    { scope: bankRef, dependencies: [type, items.length] },
  );

  const hide = () => {
    hoveredRef.current = null;
    requestRef.current += 1;
    setTip(null);
  };

  const show = async (cell, item) => {
    const root = rootRef.current;
    if (!root) return;

    const rootRect = root.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const centre = cellRect.left - rootRect.left + cellRect.width / 2;
    const below = cellRect.top - rootRect.top < 170;
    const token = requestRef.current + 1;
    requestRef.current = token;

    setTip({
      key: `${item.id}-${token}`,
      id: item.id,
      number: item.number,
      name: item.label,
      text: "",
      x: Math.min(Math.max(centre, 152), rootRect.width - 152),
      y: below ? cellRect.bottom - rootRect.top : cellRect.top - rootRect.top,
      below,
    });

    const entries = await loadEntries(item.id);
    if (requestRef.current !== token) return;
    const pick = entries.length
      ? entries[Math.floor(Math.random() * entries.length)].text
      : "No English record for this species.";
    setTip((current) =>
      current && current.key === `${item.id}-${token}`
        ? { ...current, text: pick }
        : current,
    );
  };

  

  const choose = (id) => {
    hide();
    onSelect(id);
    const target = document.getElementById("specimen-bay");
    if (lenis) {
      lenis.scrollTo(target, { offset: -18, duration: 1.1 });
    } else {
      target?.scrollIntoView({ behavior: "auto", block: "start" });
    }
  };

  const visibleIds = new Set(items.map((item) => item.id));
  const focusableId = visibleIds.has(selectedId) ? selectedId : items[0]?.id;

  function step(position) {
    const bounded = Math.min(Math.max(position, 0), items.length - 1);
    const cell = gridRef.current?.querySelector(`[data-id="${items[bounded].id}"]`);
    if (!cell) return;
    cell.focus({ preventScroll: true });
    cell.scrollIntoView({ block: "nearest" });
    onSelect(items[bounded].id);
  }

  function handleKeyDown(event) {
    if (!items.length) return;
    const id = Number(event.target.dataset?.id);
    const position = items.findIndex((item) => item.id === id);
    if (position < 0) return;

    const columns =
      getComputedStyle(gridRef.current).gridTemplateColumns.split(" ").filter(Boolean)
        .length || 1;

    if (event.key === "ArrowRight") {
      event.preventDefault();
      step(position + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(position - 1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      step(position + columns);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      step(position - columns);
    } else if (event.key === "Home") {
      event.preventDefault();
      step(0);
    } else if (event.key === "End") {
      event.preventDefault();
      step(items.length - 1);
    }
  }

  /* A filter change must not leave the wall scrolled into a stale tooltip. */
  useEffect(() => {
    hide();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, query, type]);

  return (
    <div className="gallery" ref={rootRef}>
      <div className="archive-filters">
        <div className={`search-slot${query ? " has-value" : ""}`}>
          <span className="search-slot__ticks" aria-hidden="true" />
          <label htmlFor="dex-search">Search</label>
          <input
            id="dex-search"
            ref={searchRef}
            type="search"
            value={query}
            placeholder="Name or number"
            autoComplete="off"
            spellCheck="false"
            aria-describedby="dex-search-hint"
            onChange={(event) => onQuery(event.target.value)}
          />
          {query ? (
            <button
              type="button"
              className="search-slot__clear"
              onClick={() => onQuery("")}
              aria-label="Clear search"
            >
              <span aria-hidden="true">×</span>
            </button>
          ) : null}
          <kbd aria-hidden="true">/</kbd>
        </div>

        <div
          className="type-bank"
          role="group"
          aria-label="Filter by type"
          ref={bankRef}
          onPointerLeave={() => onTypeHover?.(null)}
        >
          <span className="chip-pill" aria-hidden="true" ref={pillRef} />
          <button
            type="button"
            className="key key--type"
            aria-pressed={type === "all"}
            onClick={() => onType("all")}
          >
            All
          </button>
          {TYPES.map((name) => (
            <button
              key={name}
              type="button"
              className="key key--type"
              aria-pressed={type === name}
              style={{
                "--chip": typeAccent(name),
                "--chip-ink": inkOnLight(name),
                "--chip-mark": markOnLight(name),
              }}
              onPointerEnter={() => onTypeHover?.(name)}
              onFocus={() => onTypeHover?.(name)}
              onBlur={() => onTypeHover?.(null)}
              onClick={() => onType(name)}
            >
              {name}
            </button>
          ))}
        </div>

        <p className="hint archive-count" id="dex-search-hint">
          <span className="archive-count__value">{items.length}</span> of{" "}
          {total || 151} specimens · hover for a record, pick one to load it ·{" "}
          <kbd>/</kbd> to search, Esc to clear
        </p>
      </div>

      {feed === "loading" && !total ? (
        <div className="gallery-grid gallery-grid--loading" aria-hidden="true">
          {Array.from({ length: SKELETON_CELLS }, (_, position) => (
            <span key={position} className="gallery-cell is-skeleton">
              <span className="skeleton skeleton--fill" />
            </span>
          ))}
        </div>
      ) : items.length ? (
        <div
          className={`gallery-grid${hoverType ? " is-previewing" : ""}`}
          ref={gridRef}
          style={{ "--hot": typeAccent(hoverType ?? "normal") }}
          onPointerOver={(event) => {
            const cell = event.target.closest?.(".gallery-cell");
            if (!cell || cell.classList.contains("is-skeleton")) return;
            const id = Number(cell.dataset.id);
            if (id === hoveredRef.current) return;
            const item = items.find((entry) => entry.id === id);
            if (!item) return;
            hoveredRef.current = id;
            show(cell, item);
          }}
          onPointerLeave={hide}
          onKeyDown={handleKeyDown}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              data-id={item.id}
              tabIndex={item.id === focusableId ? 0 : -1}
              className={`gallery-cell cursor-target${item.id === selectedId ? " is-selected" : ""}${hoverType && hotIds?.has(item.id) ? " is-type-hot" : ""}`}
              style={
                typeById?.[item.id]
                  ? { "--cell-soft": softAccent(typeById[item.id]) }
                  : undefined
              }
              aria-current={item.id === selectedId ? "true" : undefined}
              aria-label={`${item.number} ${titleCase(item.name)}`}
              data-cursor-label={`${item.number} ${titleCase(item.name)}`}
              onFocus={(event) => {
                hoveredRef.current = item.id;
                show(event.currentTarget, item);
              }}
              onBlur={hide}
              onClick={() => choose(item.id)}
            >
              <img
                src={pixelSpriteUrl(item.id)}
                alt=""
                width="96"
                height="96"
                loading="lazy"
                decoding="async"
              />
              {caughtIds?.has(item.id) ? (
                <span
                  className="fish-caught-dot"
                  aria-hidden="true"
                  title="Logged at the angling station"
                />
              ) : null}
            </button>
          ))}
        </div>
      ) : (
        <p className="tray-empty" role="status">
          No specimens match these filters.{" "}
          <button type="button" className="key key--inline" onClick={onClear}>
            Clear
          </button>
        </p>
      )}

      {tip && (
        <div
          className={`gallery-tip${tip.below ? " is-below" : ""}`}
          style={{ left: `${tip.x}px`, top: `${tip.y}px` }}
          role="status"
        >
          <div className="gallery-tip__panel" key={tip.key} ref={panelRef}>
            <span className="gallery-tip__sweep" aria-hidden="true" />
            <p className="gallery-tip__head">
              <span className="gallery-tip__no">
                <DecryptedText text={tip.number} characters="0123456789" speed={0.4} />
              </span>
              <span className="gallery-tip__name">
                <DecryptedText
                  text={tip.name}
                  characters="ABCDEFGHJKLMNPQRSTUVWXYZ"
                  speed={0.55}
                />
              </span>
            </p>
            <span className="gallery-tip__rule" aria-hidden="true" />
            {tip.text ? (
              <TextType
                key={`${tip.id}-${tip.text.length}`}
                className="gallery-tip__text"
                text={tip.text}
                charDelay={0.011}
                caret
                force
              />
            ) : (
              <p className="gallery-tip__text">
                <span className="gallery-tip__wait">Reading record…</span>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
