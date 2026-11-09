import { useEffect, useState } from "react";
import { motion } from "motion/react";

/* A score that walks up to its value once the panel mounts. Small enough to
   keep here: the report only needs one counter and it avoids pulling a
   whole ticker component into the arena bundle. */
function useCountUp(value, duration = 1.15) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      /* ease-out cubic, so the number decelerates into its final value */
      setShown(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return shown;
}

export default function ScoreRing({ score, size = 86 }) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const shown = useCountUp(score);
  const centre = size / 2;

  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
        <circle
          className="score-ring__track"
          cx={centre}
          cy={centre}
          r={radius}
          fill="none"
          strokeWidth="7"
        />
        <motion.circle
          className="score-ring__fill"
          cx={centre}
          cy={centre}
          r={radius}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - score / 100) }}
          transition={{ duration: 1.1, ease: [0.22, 0.9, 0.3, 1], delay: 0.15 }}
          transform={`rotate(-90 ${centre} ${centre})`}
        />
      </svg>
      <span className="score-ring__value">
        <b>{shown}</b>
        <i>out of 100</i>
      </span>
    </div>
  );
}
