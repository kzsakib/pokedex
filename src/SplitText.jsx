import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, SplitText as GSAPSplitText } from "./motion";
import { useMotion } from "./motionSettings";

/* Split text keeps a real accessible label while animating each unit. */
export function SplitChars({ text, as: Tag = "span", id, className, delay = 0 }) {
  const ref = useRef(null);
  const { motion } = useMotion();

  useGSAP(
    () => {
      const element = ref.current;
      if (!element) return undefined;
      element.setAttribute("aria-label", text);
      if (!motion) return undefined;

      const split = new GSAPSplitText(element, {
        type: "chars",
        charsClass: "split-char",
        aria: "none",
      });
      split.chars.forEach((node) => node.setAttribute("aria-hidden", "true"));

      gsap.from(split.chars, {
        yPercent: 118,
        rotateX: -80,
        opacity: 0,
        duration: 0.72,
        ease: "back.out(1.7)",
        stagger: 0.045,
        delay,
      });

      return () => split.revert();
    },
    { scope: ref, dependencies: [motion, text, delay], revertOnUpdate: true },
  );

  return (
    <Tag ref={ref} id={id} className={className}>
      {text}
    </Tag>
  );
}

export function SplitWords({ text, as: Tag = "p", id, className, delay = 0 }) {
  const ref = useRef(null);
  const { motion } = useMotion();

  useGSAP(
    () => {
      const element = ref.current;
      if (!element) return undefined;
      element.setAttribute("aria-label", text);
      if (!motion) return undefined;

      const split = new GSAPSplitText(element, {
        type: "words",
        wordsClass: "split-word",
        aria: "none",
      });

      gsap.from(split.words, {
        y: 16,
        opacity: 0,
        duration: 0.55,
        ease: "power2.out",
        stagger: 0.02,
        delay,
      });

      return () => split.revert();
    },
    { scope: ref, dependencies: [motion, text, delay], revertOnUpdate: true },
  );

  return (
    <Tag ref={ref} id={id} className={className}>
      {text}
    </Tag>
  );
}
