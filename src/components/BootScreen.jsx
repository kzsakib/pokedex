import { useCallback, useEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "../motion";

const LINES = [
  "FIELD UNIT MK-IV",
  "SENSOR ARRAY .... OK",
  "INDEX LINK ..... UP",
  "SPECIMEN BENCH . LIVE",
];

export default function BootScreen({ motion, onDone }) {
  const ref = useRef(null);
  const finished = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onDone?.();
  }, [onDone]);

  useGSAP(
    () => {
      if (!motion) {
        finish();
        return undefined;
      }
      const timeline = gsap.timeline({ onComplete: finish });
      timeline
        .from(".boot-line", {
          autoAlpha: 0,
          y: 6,
          duration: 0.2,
          stagger: 0.1,
          ease: "power2.out",
        })
        .to(".boot-bar span", { scaleX: 1, duration: 0.6, ease: "power2.inOut" }, 0.05)
        .to(".boot-overlay", { autoAlpha: 0, duration: 0.26, ease: "power2.in" }, 0.95);

      return () => timeline.kill();
    },
    { scope: ref, dependencies: [motion] },
  );

  useEffect(() => {
    const skip = () => finish();
    window.addEventListener("pointerdown", skip, { once: true });
    window.addEventListener("keydown", skip, { once: true });
    return () => {
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
    };
  }, [finish]);

  return (
    <div className="boot-overlay" ref={ref} role="status" aria-live="polite">
      <div className="boot-screen">
        <p className="boot-title">Pokédex</p>
        <ul className="boot-lines">
          {LINES.map((line) => (
            <li key={line} className="boot-line">
              {line}
            </li>
          ))}
        </ul>
        <span className="boot-bar" aria-hidden="true">
          <span />
        </span>
      </div>
    </div>
  );
}
