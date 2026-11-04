import { useEffect, useRef } from "react";
import { gsap } from "./motion";
import { useMotion } from "./motionSettings";

const SIZE = 220;
const CENTER = SIZE / 2;
const RADIUS = 74;
const RINGS = [0.25, 0.5, 0.75, 1];

const point = (index, ratio) => {
  const angle = ((-90 + index * 60) * Math.PI) / 180;
  return [
    CENTER + Math.cos(angle) * RADIUS * ratio,
    CENTER + Math.sin(angle) * RADIUS * ratio,
  ];
};

const ringPath = (ratio) =>
  Array.from({ length: 6 }, (_, index) => point(index, ratio).join(",")).join(
    " ",
  );

const ordinal = (value) => {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
};

export default function StatRadar({ stats, active, total, percentiles, label }) {
  const { motion } = useMotion();
  const shapeRef = useRef(null);
  const signature = stats.map((stat) => stat.value).join("-");

  /* Draw the perimeter like a plotting pen, then settle the shape. */
  useEffect(() => {
    if (!motion || !shapeRef.current) return undefined;
    const shape = shapeRef.current;
    const length = shape.getTotalLength?.() ?? 0;
    const tween = gsap.fromTo(
      shape,
      {
        strokeDasharray: length,
        strokeDashoffset: length,
        scale: 0.55,
        transformOrigin: "center center",
      },
      {
        strokeDashoffset: 0,
        scale: 1,
        duration: 0.9,
        ease: "power2.inOut",
        clearProps: "transform,strokeDasharray,strokeDashoffset",
      },
    );
    return () => tween.kill();
  }, [motion, signature]);

  const activeStat = stats.find((stat) => stat.key === active) ?? null;
  const percentile = activeStat ? percentiles?.[activeStat.key] : null;
  const shape = stats
    .map((stat, index) => point(index, Math.max(stat.ratio, 0.02)).join(","))
    .join(" ");

  return (
    <div className="radar">
      <svg
        className="radar-svg"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`Base stat radar for ${label}: ${stats
          .map((stat) => `${stat.label} ${stat.value}`)
          .join(", ")}`}
      >
        {RINGS.map((ratio) => (
          <polygon
            key={ratio}
            points={ringPath(ratio)}
            className="radar-ring"
          />
        ))}

        {stats.map((stat, index) => {
          const [x, y] = point(index, 1);
          return (
            <line
              key={stat.key}
              x1={CENTER}
              y1={CENTER}
              x2={x}
              y2={y}
              className={`radar-axis${active === stat.key ? " is-active" : ""}`}
            />
          );
        })}

        <polygon ref={shapeRef} points={shape} className="radar-shape" />

        {stats.map((stat, index) => {
          const [x, y] = point(index, Math.max(stat.ratio, 0.02));
          return (
            <circle
              key={stat.key}
              cx={x}
              cy={y}
              r={active === stat.key ? 4 : 2.4}
              className={`radar-dot${active === stat.key ? " is-active" : ""}`}
            />
          );
        })}

        {stats.map((stat, index) => {
          const [x, y] = point(index, 1.2);
          return (
            <text key={stat.key} x={x} y={y + 3} className="radar-label">
              {stat.label}
            </text>
          );
        })}
      </svg>

      <div className="radar-readout">
        <span className="readout-label">
          {activeStat ? activeStat.label : "Total"}
        </span>
        <span className="readout-value">
          {activeStat ? activeStat.value : total}
        </span>
        <span className="readout-meta">
          {activeStat
            ? percentile === null || percentile === undefined
              ? "base stat"
              : `${ordinal(percentile)} percentile`
            : "base stats"}
        </span>
      </div>
    </div>
  );
}
