import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, prefersReducedMotion } from "../motion";
import { useMotion } from "../motionSettings";

/* Types the entry out once per selection. The full sentence stays in the DOM
   as a hidden ghost so the card keeps its final height while typing. */
export default function TextType({ text, className = "", speed = 14 }) {
  const ref = useRef(null);
  const { motion } = useMotion();

  useGSAP(
    () => {
      const element = ref.current;
      if (!element) return undefined;

      if (!motion || prefersReducedMotion()) {
        element.textContent = text;
        return undefined;
      }

      element.textContent = "";
      const proxy = { index: 0 };
      const tween = gsap.to(proxy, {
        index: text.length,
        duration: Math.min(1.7, Math.max(0.4, text.length / speed / 60)),
        ease: "none",
        onUpdate: () => {
          element.textContent = text.slice(0, Math.round(proxy.index));
        },
        onComplete: () => {
          element.textContent = text;
        },
      });

      return () => tween.kill();
    },
    { scope: ref, dependencies: [text, motion, speed], revertOnUpdate: true },
  );

  return (
    <p className={`text-type ${className}`.trim()}>
      <span className="text-type__ghost" aria-hidden="true">
        {text}
      </span>
      <span className="text-type__live" ref={ref} aria-hidden="true" />
      <span className="visually-hidden">{text}</span>
    </p>
  );
}
