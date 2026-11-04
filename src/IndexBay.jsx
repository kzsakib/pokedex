import { useEffect, useMemo, useRef } from "react";
import { useGSAP } from "@gsap/react";
import { Flip, ScrollTrigger, gsap } from "./motion";
import { useMotion } from "./motionSettings";
import { spriteUrl } from "./api";
import { TYPES } from "./types";

const SKELETON_ROWS = 9;

export default function IndexBay({
  items,
  entries,
  selectedId,
  onSelect,
  query,
  onQuery,
  type,
  onType,
  onClear,
  searchRef,
  feed,
}) {
  const { motion } = useMotion();
  const listRef = useRef(null);
  const bankRef = useRef(null);
  const pillRef = useRef(null);
  const ghostRef = useRef(null);
  const captured = useRef({ state: null, nodes: [], rects: null });
  const introPlayed = useRef(false);

  const signature = useMemo(() => items.map((item) => item.id).join(","), [items]);

  const { contextSafe } = useGSAP({ scope: listRef });

  /* Snapshot the tray before a filter change so Flip can slide the survivors
     and clone the leavers for their exit. */
  const capture = () => {
    const root = listRef.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll(".index-row:not(.is-skeleton)"));
    if (!nodes.length) return;
    const rects = new Map(
      nodes.map((node) => [node.dataset.id, node.getBoundingClientRect()]),
    );
    captured.current = { state: Flip.getState(nodes), nodes, rects };
  };

  const changeQuery = contextSafe((value) => {
    capture();
    onQuery(value);
  });

  const changeType = contextSafe((value) => {
    capture();
    onType(value);
  });

  const clearAll = contextSafe(() => {
    capture();
    onClear();
  });

  /* Rows cascade once, then every result change is a Flip. */
  useGSAP(
    () => {
      if (!motion) return undefined;
      const root = listRef.current;
      if (!root) return undefined;
      if (feed === "loading" && !items.length) return undefined;

      const rows = Array.from(root.querySelectorAll(".index-row:not(.is-skeleton)"));

      if (!introPlayed.current && rows.length) {
        introPlayed.current = true;
        gsap.from(rows, {
          y: 12,
          autoAlpha: 0,
          duration: 0.35,
          stagger: { each: 0.012, from: "start" },
          ease: "power2.out",
          clearProps: "all",
        });
        return undefined;
      }

      const snapshot = captured.current;
      if (!snapshot.state) return undefined;

      const nextIds = new Set(items.map((item) => String(item.id)));
      const layer = ghostRef.current;

      if (layer) {
        snapshot.nodes
          .filter((node) => !nextIds.has(node.dataset.id))
          .forEach((node) => {
            const rect = snapshot.rects.get(node.dataset.id);
            if (!rect) return;
            const clone = node.cloneNode(true);
            clone.classList.add("is-ghost");
            Object.assign(clone.style, {
              position: "fixed",
              left: `${rect.left}px`,
              top: `${rect.top}px`,
              width: `${rect.width}px`,
              height: `${rect.height}px`,
              margin: "0",
              zIndex: "30",
              pointerEvents: "none",
            });
            layer.appendChild(clone);
            gsap.to(clone, {
              autoAlpha: 0,
              scale: 0.94,
              y: -8,
              duration: 0.26,
              ease: "power2.in",
              onComplete: () => clone.remove(),
            });
          });
      }

      Flip.from(snapshot.state, {
        duration: 0.5,
        ease: "power3.out",
        absolute: true,
        scale: true,
        onEnter: (elements) =>
          gsap.fromTo(
            elements,
            { autoAlpha: 0, scale: 0.96 },
            {
              autoAlpha: 1,
              scale: 1,
              duration: 0.32,
              ease: "power2.out",
              clearProps: "all",
            },
          ),
        onComplete: () => ScrollTrigger.refresh(),
      });

      captured.current = { state: null, nodes: [], rects: null };
      return undefined;
    },
    { scope: listRef, dependencies: [motion, signature, feed] },
  );

  /* Sliding highlight that follows the active type chip. */
  useGSAP(
    () => {
      const bank = bankRef.current;
      const pill = pillRef.current;
      if (!bank || !pill) return;
      if (!motion) {
        gsap.set(pill, { autoAlpha: 0 });
        return;
      }
      const active = bank.querySelector('.key--type[aria-pressed="true"]');
      if (!active) {
        gsap.set(pill, { autoAlpha: 0 });
        return;
      }
      const bankRect = bank.getBoundingClientRect();
      const rect = active.getBoundingClientRect();
      gsap.to(pill, {
        autoAlpha: 1,
        x: rect.left - bankRect.left + (active.offsetLeft - rect.left + bankRect.left),
        y: active.offsetTop + active.offsetHeight - 2,
        width: active.offsetWidth,
        duration: 0.32,
        ease: "power3.out",
      });
    },
    { scope: bankRef, dependencies: [motion, type, items.length] },
  );

  /* The empty state arrives rather than snaps. */
  useGSAP(
    () => {
      if (!motion || items.length || feed === "loading") return;
      gsap.from(".tray-empty", {
        autoAlpha: 0,
        y: 6,
        duration: 0.3,
        ease: "power2.out",
        clearProps: "all",
      });
    },
    { dependencies: [motion, items.length, feed] },
  );

  /* Keep the bench entry visible inside the tray. scrollIntoView would also
     scroll the window, which yanked the whole page down on first load. */
  const revealRow = (node) => {
    const tray = listRef.current;
    if (!tray || !node) return;
    const trayRect = tray.getBoundingClientRect();
    const rowRect = node.getBoundingClientRect();
    if (rowRect.top < trayRect.top) {
      tray.scrollTop -= trayRect.top - rowRect.top;
    } else if (rowRect.bottom > trayRect.bottom) {
      tray.scrollTop += rowRect.bottom - trayRect.bottom;
    }
  };

  useEffect(() => {
    revealRow(listRef.current?.querySelector('[aria-selected="true"]'));
  }, [selectedId]);

  const options = () =>
    Array.from(listRef.current?.querySelectorAll('[role="option"]') ?? []);

  function focusAt(position) {
    const nodes = options();
    if (!nodes.length) return;
    const bounded = Math.min(Math.max(position, 0), nodes.length - 1);
    const node = nodes[bounded];
    node.focus({ preventScroll: true });
    revealRow(node);
    const id = Number(node.dataset.id);
    if (Number.isFinite(id)) onSelect(id);
  }

  function handleKeyDown(event) {
    const option = event.target.closest?.('[role="option"]');
    if (!option) return;
    const nodes = options();
    const position = nodes.indexOf(option);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusAt(position + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusAt(position - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusAt(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusAt(nodes.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(Number(option.dataset.id));
    }
  }

  const focusableId = items.some((item) => item.id === selectedId)
    ? selectedId
    : items[0]?.id;

  return (
    <>
      <div className="search-slot">
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
          onChange={(event) => changeQuery(event.target.value)}
        />
        <kbd aria-hidden="true">/</kbd>
      </div>
      <p id="dex-search-hint" className="hint">
        Try “pika”, “char”, or 151. Press <kbd>/</kbd> to jump here, Esc to clear.
      </p>

      <div
        className="type-bank"
        role="group"
        aria-label="Filter by type"
        ref={bankRef}
      >
        <span className="chip-pill" aria-hidden="true" ref={pillRef} />
        <button
          type="button"
          className="key key--type"
          aria-pressed={type === "all"}
          onClick={() => changeType("all")}
        >
          All
        </button>
        {TYPES.map((name) => (
          <button
            key={name}
            type="button"
            className="key key--type"
            aria-pressed={type === name}
            onClick={() => changeType(name)}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="ghost-layer" aria-hidden="true" ref={ghostRef} />

      {feed === "loading" && !items.length ? (
        <ul className="index-tray index-tray--loading" aria-hidden="true">
          {Array.from({ length: SKELETON_ROWS }, (_, position) => (
            <li key={position} className="index-row is-skeleton">
              <span className="skeleton skeleton--no" />
              <span className="skeleton skeleton--thumb" />
              <span className="skeleton skeleton--name" />
              <span className="skeleton skeleton--tag" />
            </li>
          ))}
        </ul>
      ) : items.length ? (
        <ul
          className="index-tray"
          role="listbox"
          aria-label={`Pokémon index, ${items.length} entries`}
          ref={listRef}
          onKeyDown={handleKeyDown}
          data-lenis-prevent
        >
          {items.map((item) => {
            const entry = entries[item.id];
            const types = entry?.types ?? [];
            const selected = item.id === selectedId;
            return (
              <li
                key={item.id}
                role="option"
                aria-selected={selected}
                tabIndex={item.id === focusableId ? 0 : -1}
                data-id={item.id}
                className="index-row"
                onClick={() => onSelect(item.id)}
              >
                <span className="index-number">{item.number}</span>
                <span className="index-thumb" aria-hidden="true">
                  <img
                    src={spriteUrl(item.id)}
                    alt=""
                    width="36"
                    height="36"
                    loading="lazy"
                    decoding="async"
                  />
                </span>
                <span className="index-name">{item.label}</span>
                <span className="index-types" aria-hidden="true">
                  {types.slice(0, 2).map((slot) => (
                    <span key={slot.type.name} className="index-type">
                      {slot.type.name}
                    </span>
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="tray-empty" role="status">
          No entries match these filters.{" "}
          <button type="button" className="key key--inline" onClick={clearAll}>
            Clear
          </button>
        </p>
      )}
    </>
  );
}
