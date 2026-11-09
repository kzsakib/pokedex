import { useState } from "react";
import { motion } from "motion/react";
import { softAccent, typeAccent } from "../typeColors";

/* One segmented bar, each slice as wide as its share of the type slots.
   Pointing at a slice — or its legend entry — lifts it and dims the rest. */
export default function TypeSpread({ spread, slots }) {
  const [active, setActive] = useState(null);

  return (
    <div className="spread" onPointerLeave={() => setActive(null)}>
      <div
        className="spread__bar"
        role="img"
        aria-label={`Type spread: ${spread
          .map((slice) => `${slice.type} ${slice.count}`)
          .join(", ")}`}
      >
        {spread.map((slice, index) => (
          <motion.span
            key={slice.type}
            className="spread__slice"
            style={{
              flexGrow: slice.count,
              background: `linear-gradient(180deg, ${softAccent(slice.type)}, ${typeAccent(slice.type)})`,
            }}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{
              scaleX: 1,
              scaleY: active === slice.type ? 1.32 : 1,
              opacity: active && active !== slice.type ? 0.3 : 1,
            }}
            transition={{
              scaleX: {
                delay: 0.5 + index * 0.04,
                duration: 0.42,
                ease: [0.2, 0.8, 0.3, 1],
              },
              default: { duration: 0.16, ease: "easeOut" },
            }}
            onPointerEnter={() => setActive(slice.type)}
            title={`${slice.type} ×${slice.count}`}
          />
        ))}
      </div>

      <ul className="spread__legend">
        {spread.map((slice) => (
          <li
            key={slice.type}
            className={active === slice.type ? "is-hot" : undefined}
            onPointerEnter={() => setActive(slice.type)}
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
