import { useMemo } from "react";
import { motion } from "motion/react";
import { pixelSpriteUrl } from "../api";

const STEPS = 7;

/* Quadratic arc between two points, lifted above the higher end, sampled
   into keyframes so the sprite travels a curve rather than a straight line. */
export function arc(from, to, lift = 96) {
  const controlX = (from.x + to.x) / 2;
  const controlY = Math.min(from.y, to.y) - lift;
  return Array.from({ length: STEPS }, (_, index) => {
    const t = index / (STEPS - 1);
    const inverse = 1 - t;
    return [
      inverse * inverse * from.x + 2 * inverse * t * controlX + t * t * to.x - from.x,
      inverse * inverse * from.y + 2 * inverse * t * controlY + t * t * to.y - from.y,
    ];
  });
}

const times = Array.from({ length: STEPS }, (_, index) => index / (STEPS - 1));

/* The caught sprite arcing from the stage into its slot. Transform and
   opacity only: the x/y keyframes carry the arc, the image carries squash
   and stretch. */
export default function CatchFlight({ mon, from, to, onDone }) {
  const points = useMemo(
    () => arc(from, to),
    [from.x, from.y, to.x, to.y],
  );

  return (
    <motion.div
      className="catch-flight"
      initial={{ x: from.x, y: from.y, opacity: 1 }}
      animate={{ x: points.map(([x]) => x), y: points.map(([, y]) => y) }}
      transition={{ duration: 0.62, times, ease: "easeInOut" }}
      onAnimationComplete={onDone}
      aria-hidden="true"
    >
      <motion.img
        src={pixelSpriteUrl(mon.id)}
        alt=""
        width="40"
        height="40"
        decoding="async"
        draggable="false"
        animate={{
          scaleX: [1, 1.18, 0.86, 1.06, 0.98, 1.02, 1],
          scaleY: [1, 0.8, 1.16, 0.94, 1.03, 0.98, 1],
        }}
        transition={{ duration: 0.62, times, ease: "easeInOut" }}
      />
    </motion.div>
  );
}
