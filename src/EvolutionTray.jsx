import { Fragment, useEffect, useRef } from "react";
import { spriteUrl } from "./api";
import AnimatedContent from "./components/AnimatedContent";

export default function EvolutionTray({ stages, selectedId, onSelect }) {
  const trayRef = useRef(null);

  /* Scroll the tray itself. scrollIntoView also scrolls the window, which
     opened the page scrolled down to the evolution line on first load. */
  useEffect(() => {
    const tray = trayRef.current;
    const current = tray?.querySelector('[aria-current="true"]');
    if (!tray || !current) return;
    const trayRect = tray.getBoundingClientRect();
    const rect = current.getBoundingClientRect();
    if (rect.left < trayRect.left) {
      tray.scrollLeft -= trayRect.left - rect.left;
    } else if (rect.right > trayRect.right) {
      tray.scrollLeft += rect.right - trayRect.right;
    }
  }, [selectedId, stages]);

  const stageKey = stages?.length
    ? stages.map((stage) => stage.id).join("-")
    : "pending";

  return (
    <section className="evo" aria-labelledby="evo-title">
      <div className="evo-head">
        <h3 id="evo-title">Evolution line</h3>
        <p className="hint">
          {stages?.length ? `${stages.length} stages` : "Reading lineage"}
        </p>
      </div>

      {stages?.length ? (
        <div
          className="evo-tray"
          role="group"
          aria-label="Evolution line"
          ref={trayRef}
          data-lenis-prevent
        >
          <AnimatedContent
            key={stageKey}
            className="evo-track"
            direction="vertical"
            distance={8}
            duration={0.4}
            trigger="mount"
            threshold={0.01}
            stagger={0.04}
            initialOpacity={0}
          >
            {stages.map((stage, position) => (
              <Fragment key={stage.id}>
                {position > 0 && (
                  <span className="evo-link" aria-hidden="true">
                    {stage.depth === stages[position - 1].depth ? "or" : "→"}
                  </span>
                )}
                <button
                  type="button"
                  className="evo-module"
                  aria-current={stage.id === selectedId ? "true" : undefined}
                  onClick={() => onSelect(stage.id)}
                >
                  <span className="evo-thumb" aria-hidden="true">
                    <img
                      src={spriteUrl(stage.id)}
                      alt=""
                      width="36"
                      height="36"
                      loading="lazy"
                      decoding="async"
                    />
                  </span>
                  <span className="evo-text">
                    <span className="evo-name">{stage.name}</span>
                    <span className="evo-meta">
                      {stage.trigger || "Base stage"}
                    </span>
                  </span>
                  <span className="lamp" aria-hidden="true" />
                </button>
              </Fragment>
            ))}
          </AnimatedContent>
        </div>
      ) : (
        <p className="hint">Lineage pending — the record is still loading.</p>
      )}
    </section>
  );
}
