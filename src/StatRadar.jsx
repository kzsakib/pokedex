import { useRef } from "react";
import { useGSAP } from "@gsap/react";
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
  Array.from({ length: 6 }, (_, index) => point(index, ratio).join(",")).join(" ");

const ordinal = (value) => {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
};

const toPoints = (flat) => {
  const pairs = [];
  for (let index = 0; index < flat.length; index += 2) {
    pairs.push(`${flat[index].toFixed(2)},${flat[index + 1].toFixed(2)}`);
  }
  return pairs.join(" ");
};

export default function StatRadar({ stats, active, total, percentiles, label }) {
  const { motion } = useMotion();
  const shapeRef = useRef(null);
  const dotRefs = useRef([]);
  const previousRef = useRef(null);
  const signature = stats.map((stat) => stat.value).join("-");

  const target = stats.flatMap((stat, index) =>
    point(index, Math.max(stat.ratio, 0.02)),
  );

  useGSAP(
    () => {
      const shape = shapeRef.current;
      if (!shape) return undefined;

      const from = previousRef.current ?? Array.from({ length: target.length }, (_, index) =>
        index % 2 === 0 ? CENTER : CENTER,
      );
      previousRef.current = target;

      const draw = (values) => {
        shape.setAttribute("points", toPoints(values));
        stats.forEach((stat, index) => {
          const dot = dotRefs.current[index];
          if (!dot) return;
          dot.setAttribute("cx", values[index * 2].toFixed(2));
          dot.setAttribute("cy", values[index * 2 + 1].toFixed(2));
        });
      };

      if (!motion) {
        draw(target);
        return undefined;
      }

      const proxy = { progress: 0 };
      const tween = gsap.to(proxy, {
        progress: 1,
        duration: 0.7,
        ease: "power2.out",
        onUpdate: () => {
          draw(
            target.map(
              (value, index) => from[index] + (value - from[index]) * proxy.progress,
            ),
          );
        },
        onComplete: () => draw(target),
      });

      return () => tween.kill();
    },
    { dependencies: [motion, signature] },
  );

  const activeStat = stats.find((stat) => stat.key === active) ?? null;
  const percentile = activeStat ? percentiles?.[activeStat.key] : null;

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
          <polygon key={ratio} points={ringPath(ratio)} className="radar-ring" />
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

        <polygon ref={shapeRef} points={toPoints(target)} className="radar-shape" />

        {stats.map((stat, index) => {
          const [x, y] = point(index, Math.max(stat.ratio, 0.02));
          return (
            <circle
              key={stat.key}
              ref={(node) => {
                dotRefs.current[index] = node;
              }}
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
