import { motion } from "motion/react";
import { softAccent, typeAccent } from "../typeColors";

/* One segmented bar, each slice as wide as its share of the type slots. The
   legend repeats the count so the bar does not have to be measured by eye. */
export default function TypeSpread({ spread, slots }) {
  return (
    <div className="spread">
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
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{
              delay: 0.5 + index * 0.04,
              duration: 0.42,
              ease: [0.2, 0.8, 0.3, 1],
            }}
            title={`${slice.type} ×${slice.count}`}
          />
        ))}
      </div>
      <ul className="spread__legend">
        {spread.map((slice) => (
          <li key={slice.type}>
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
