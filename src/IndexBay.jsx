import { useEffect, useRef } from "react";
import { spriteUrl } from "./api";
import { TYPES } from "./types";
import { gsap } from "./motion";
import { useMotion } from "./motionSettings";

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

  /* Re-scan the tray with a short cascade whenever the result set changes. */
  useEffect(() => {
    if (!motion || !listRef.current) return undefined;
    const rows = listRef.current.querySelectorAll(".index-row");
    if (!rows.length) return undefined;
    const tween = gsap.fromTo(
      rows,
      { y: 10, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.28,
        ease: "power2.out",
        stagger: Math.min(0.02, 0.55 / rows.length),
        clearProps: "transform,opacity",
        overwrite: true,
      },
    );
    return () => tween.kill();
  }, [motion, items.length, query, type]);

  /* Keep the bench entry visible when it is chosen from elsewhere
     (random draw, evolution stage, detail links). */
  useEffect(() => {
    const row = listRef.current?.querySelector('[aria-selected="true"]');
    row?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  const options = () =>
    Array.from(listRef.current?.querySelectorAll('[role="option"]') ?? []);

  function focusAt(position) {
    const nodes = options();
    if (!nodes.length) return;
    const bounded = Math.min(Math.max(position, 0), nodes.length - 1);
    const node = nodes[bounded];
    node.focus();
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
          onChange={(event) => onQuery(event.target.value)}
        />
        <kbd aria-hidden="true">/</kbd>
      </div>
      <p id="dex-search-hint" className="hint">
        Try “pika”, “char”, or 151. Press <kbd>/</kbd> to jump here, Esc to clear.
      </p>

      <div className="type-bank" role="group" aria-label="Filter by type">
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
            onClick={() => onType(name)}
          >
            {name}
          </button>
        ))}
      </div>

      {items.length ? (
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
          {feed === "loading" ? (
            "Scanning the index…"
          ) : (
            <>
              No entries match these filters.{" "}
              <button type="button" className="key" onClick={onClear}>
                Clear
              </button>
            </>
          )}
        </p>
      )}
    </>
  );
}
