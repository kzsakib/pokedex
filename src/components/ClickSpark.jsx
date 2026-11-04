import { useCallback, useEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "../motion";
import { useMotion } from "../motionSettings";

const SPARKS = 8;

export default function ClickSpark() {
  const layerRef = useRef(null);
  const { motion } = useMotion();
  const { contextSafe } = useGSAP({ scope: layerRef });

  const spark = contextSafe((event) => {
    const layer = layerRef.current;
    if (!motion || !layer) return;

    for (let index = 0; index < SPARKS; index += 1) {
      const dot = document.createElement("span");
      dot.className = "click-spark__dot";
      dot.style.left = `${event.clientX}px`;
      dot.style.top = `${event.clientY}px`;
      layer.appendChild(dot);

      const angle = (index / SPARKS) * Math.PI * 2;
      const distance = 16 + Math.random() * 10;
      gsap.fromTo(
        dot,
        { opacity: 1, scale: 1 },
        {
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          opacity: 0,
          scale: 0.2,
          duration: 0.42,
          ease: "power2.out",
          onComplete: () => dot.remove(),
        },
      );
    }
  });

  useEffect(() => {
    if (!motion) return undefined;
    const handler = (event) => spark(event);
    window.addEventListener("pointerdown", handler);
    return () => window.removeEventListener("pointerdown", handler);
  }, [motion, spark]);

  return <div className="click-spark" ref={layerRef} aria-hidden="true" />;
}
