import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, prefersReducedMotion } from "../motion";
import { useMotion } from "../motionSettings";

const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#/";

/* A small ReactBits-style decrypt: each frame reveals one more glyph and the
   remaining slots hold scrambled characters. */
export default function DecryptedText({
  text,
  className = "",
  characters = GLYPHS,
  speed = 1,
}) {
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

      const proxy = { progress: 0 };
      const duration = Math.max(0.35, text.length * 0.05) * speed;
      const tween = gsap.to(proxy, {
        progress: 1,
        duration,
        ease: "none",
        onUpdate: () => {
          const revealed = Math.floor(proxy.progress * text.length);
          element.textContent = Array.from(text)
            .map((character, index) => {
              if (index < revealed || character === " ") return character;
              return characters[Math.floor(Math.random() * characters.length)];
            })
            .join("");
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
    <span ref={ref} className={className} aria-label={text}>
      {text}
    </span>
  );
}
