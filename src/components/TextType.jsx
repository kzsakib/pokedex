import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, prefersReducedMotion } from "../motion";
import { useMotion } from "../motionSettings";

/* Types the text out once per change. The full sentence stays in the DOM as
   a hidden ghost so the block keeps its final height while typing. */
export default function TextType({
  text,
  className = "",
  speed = 14,
  charDelay,
  caret = false,
  force = false,
}) {
  const ref = useRef(null);
  const { motion } = useMotion();

  useGSAP(
    () => {
      const element = ref.current;
      if (!element) return undefined;

      if (!force && (!motion || prefersReducedMotion())) {
        element.textContent = text;
        return undefined;
      }

      element.textContent = "";
      const proxy = { index: 0 };
      const duration = charDelay
        ? Math.min(2.4, Math.max(0.18, text.length * charDelay))
        : Math.min(1.7, Math.max(0.4, text.length / speed / 60));
      const tween = gsap.to(proxy, {
        index: text.length,
        duration,
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
    { scope: ref, dependencies: [text, motion, speed, charDelay, force], revertOnUpdate: true },
  );

  return (
    <p className={`text-type ${className}`.trim()} data-typing="">
      <span className="text-type__ghost" aria-hidden="true">
        {text}
      </span>
      <span className="text-type__live" aria-hidden="true">
        <span className="text-type__chars" ref={ref} />
        {caret && <span className="text-type__caret" />}
      </span>
      <span className="visually-hidden">{text}</span>
    </p>
  );
}
