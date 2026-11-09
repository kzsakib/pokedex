import { useState } from "react";
import { motion } from "motion/react";
import { softAccent, typeAccent } from "../typeColors";

/* The spread as one continuous bar: every type takes a slice proportional to
   how many of the team's type slots it fills, so a ×3 type is visibly three
   times as wide as a ×1. Slices spring open in order while the report walks
   through its panels, and hovering either a slice or its legend row pulls it
   forward while the rest dim. */
export default function TypeSpread({ spread, slots, active = true }) {
  const [hot, setHot] = useState(null);

  return (
    <div className="spread" onPointerLeave={() => setHot(null)}>
      <div
        className="spread__bar"
        role="img"
        aria-label={`Type spread: ${spread
          .map((slice) => `${slice.type} ${slice.count}`)
          .join(", ")}`}
      >
        {spread.map((slice, index) => {
          const dimmed = hot !== null && hot !== slice.type;

          return (
            <motion.span
              key={slice.type}
              className="spread__seg"
              style={{
                "--seg": typeAccent(slice.type),
                "--seg-soft": softAccent(slice.type),
                flexGrow: slice.count,
              }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={
                active
                  ? {
                      scaleX: 1,
                      opacity: dimmed ? 0.32 : 1,
                      y: hot === slice.type ? -2 : 0,
                    }
                  : { scaleX: 0, opacity: 0 }
              }
              transition={{
                opacity: { duration: 0.16 },
                default: {
                  type: "spring",
                  stiffness: 280,
                  damping: 28,
                  delay: active ? 0.06 + index * 0.07 : 0,
                },
              }}
              onPointerEnter={() => setHot(slice.type)}
              aria-hidden="true"
            />
          );
        })}
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
