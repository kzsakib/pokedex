import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { useLenis } from "lenis/react";
import { fetchSpecies, pixelSpriteUrl, readEntries, titleCase } from "./api";
import { gsap } from "./motion";
import { useMotion } from "./motionSettings";
import DecryptedText from "./components/DecryptedText";

/* Species records are fetched on first hover and kept for the session so the
   archive never asks PokéAPI twice for the same entry. */
const entryCache = new Map();

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

export default function Gallery({ items, selectedId, onSelect }) {
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const lenis = useLenis();
  const { motion } = useMotion();
  const { contextSafe } = useGSAP({ scope: rootRef });
  const [tip, setTip] = useState(null);
  const requestRef = useRef(0);

  useGSAP(
    () => {
      if (!motion || !panelRef.current) return;
      gsap.fromTo(
        panelRef.current,
        { autoAlpha: 0, y: 10, scale: 0.97 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.24, ease: "power2.out" },
      );
    },
    { scope: rootRef, dependencies: [tip?.key] },
  );

  const hide = contextSafe(() => {
    requestRef.current += 1;
    if (!panelRef.current) {
      setTip(null);
      return;
    }
    gsap.to(panelRef.current, {
      autoAlpha: 0,
      y: 6,
      duration: 0.15,
      ease: "power2.in",
      onComplete: () => setTip(null),
    });
  });

  const show = contextSafe(async (event, item) => {
    const root = rootRef.current;
    if (!root) return;

    const rootRect = root.getBoundingClientRect();
    const cellRect = event.currentTarget.getBoundingClientRect();
    const centre = cellRect.left - rootRect.left + cellRect.width / 2;
    const below = cellRect.top - rootRect.top < 150;
    const token = requestRef.current + 1;
    requestRef.current = token;

    setTip({
      key: `${item.id}-${token}`,
      id: item.id,
      number: item.number,
      name: item.label,
      text: "",
      x: Math.min(Math.max(centre, 146), rootRect.width - 146),
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
  });

  const choose = (id) => {
    hide();
    onSelect(id);
    const target = document.querySelector(".specimen-col");
    if (lenis && motion) {
      lenis.scrollTo(target, { offset: -24, duration: 1.1 });
    } else {
      target?.scrollIntoView({ behavior: "auto", block: "start" });
    }
  };

  return (
    <div className="gallery" ref={rootRef}>
      <div className="gallery-grid">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`gallery-cell${item.id === selectedId ? " is-selected" : ""}`}
            aria-current={item.id === selectedId ? "true" : undefined}
            aria-label={`${item.number} ${titleCase(item.name)}`}
            onPointerEnter={(event) => show(event, item)}
            onFocus={(event) => show(event, item)}
            onPointerLeave={hide}
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
          </button>
        ))}
      </div>

      {tip && (
        <div
          className={`gallery-tip${tip.below ? " is-below" : ""}`}
          style={{ left: `${tip.x}px`, top: `${tip.y}px` }}
          role="status"
        >
          <div className="gallery-tip__panel" ref={panelRef}>
            <p className="gallery-tip__head">
              <span>{tip.number}</span>
              {tip.name}
            </p>
            <p className="gallery-tip__text">
              {tip.text ? (
                <DecryptedText text={tip.text} speed={0.15} />
              ) : (
                "Reading record…"
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
