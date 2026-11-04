import { useEffect, useRef } from "react";

/* One key per game version that shipped a Pokédex entry for this species. */
export default function VersionTray({ versions, index, onChange }) {
  const trayRef = useRef(null);

  useEffect(() => {
    const current = trayRef.current?.querySelector('[aria-pressed="true"]');
    current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [index]);

  if (!versions.length) return null;

  return (
    <div
      className="version-tray"
      role="group"
      aria-label="Pokédex entry by game version"
      ref={trayRef}
      data-lenis-prevent
    >
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
