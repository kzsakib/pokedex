import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { softAccent, typeAccent } from "../typeColors";

/* The spread as a DMG-style matrix: one block per type slot, so a ×3 type is
   literally three blocks wide. Blocks pop in one after another while the
   report walks through its panels. */
export default function TypeSpread({ spread, slots, active = true }) {
  const [hot, setHot] = useState(null);

  const cells = useMemo(
    () =>
      spread.flatMap((slice) =>
        Array.from({ length: slice.count }, (_, index) => ({
          type: slice.type,
          index,
        })),
      ),
    [spread],
  );

  return (
    <div className="spread" onPointerLeave={() => setHot(null)}>
      <div className="spread__screen">
        <div className="spread__hud">
          <span>TYPE MATRIX</span>
          <span>{slots} SLOTS</span>
        </div>

        <div
          className="spread__bar"
          role="img"
          aria-label={`Type spread: ${spread
            .map((slice) => `${slice.type} ${slice.count}`)
            .join(", ")}`}
        >
          {cells.map((cell, index) => (
            <motion.span
              key={`${cell.type}-${cell.index}`}
              className="spread__cell"
              style={{
                "--cell": typeAccent(cell.type),
                "--cell-soft": softAccent(cell.type),
              }}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={
                active
                  ? {
                      opacity: hot && hot !== cell.type ? 0.3 : 1,
                      scale: 1,
                      y: hot === cell.type ? -3 : 0,
                    }
                  : { opacity: 0, scale: 0.3, y: 0 }
              }
              transition={{
                opacity: { duration: 0.14 },
                default: { type: "spring", stiffness: 420, damping: 24, delay: 0.1 + index * 0.045 },
              }}
              onPointerEnter={() => setHot(cell.type)}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>

      <ul className="spread__legend">
        {spread.map((slice) => (
          <li
            key={slice.type}
            className={hot === slice.type ? "is-hot" : undefined}
            onPointerEnter={() => setHot(slice.type)}
          >
            <i style={{ background: typeAccent(slice.type) }} aria-hidden="true" />
            {slice.type} <b>×{slice.count}</b>
          </li>
        ))}
      </ul>

      <p className="spread__fine">
        {slots} type {slots === 1 ? "slot" : "slots"} across the team
      </p>
    </div>
  );
}
