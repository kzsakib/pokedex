import { useEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "./motion";

/* One key per game version that shipped a Pokédex entry for this species. */
export default function VersionTray({ versions, index, onChange }) {
  const trayRef = useRef(null);
  const pillRef = useRef(null);

  /* Scroll the tray itself; scrollIntoView would move the page too. */
  useEffect(() => {
    const tray = trayRef.current;
    const current = tray?.querySelector('[aria-pressed="true"]');
    if (!tray || !current) return;
    const trayRect = tray.getBoundingClientRect();
    const rect = current.getBoundingClientRect();
    if (rect.left < trayRect.left) {
      tray.scrollLeft -= trayRect.left - rect.left;
    } else if (rect.right > trayRect.right) {
      tray.scrollLeft += rect.right - trayRect.right;
    }
  }, [index]);

  useGSAP(
    () => {
      const tray = trayRef.current;
      const pill = pillRef.current;
      if (!tray || !pill) return;
      const active = tray.querySelector('[aria-pressed="true"]');
      if (!active) {
        gsap.set(pill, { autoAlpha: 0 });
        return;
      }
      gsap.to(pill, {
        autoAlpha: 1,
        x: active.offsetLeft,
        width: active.offsetWidth,
        y: active.offsetTop + active.offsetHeight - 2,
        duration: 0.32,
        ease: "power3.out",
      });
    },
    { scope: trayRef, dependencies: [index, versions.length] },
  );

  if (!versions.length) return null;

  return (
    <div
      className="version-tray"
      role="group"
      aria-label="Pokédex entry by game version"
      ref={trayRef}
      data-lenis-prevent
    >
      <span className="version-pill" aria-hidden="true" ref={pillRef} />
      {versions.map((entry, position) => (
        <button
          key={`${entry.version}-${position}`}
          type="button"
          className="version-key"
          aria-pressed={position === index}
          onClick={() => onChange(position)}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}
