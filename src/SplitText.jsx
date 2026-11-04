import { Fragment, useEffect, useRef } from "react";
import { gsap } from "./motion";
import { useMotion } from "./motionSettings";

/* Split text keeps a real accessible label while animating each glyph. */
export function SplitChars({ text, as: Tag = "span", id, className, delay = 0 }) {
  const ref = useRef(null);
  const { motion } = useMotion();

  useEffect(() => {
    if (!motion || !ref.current) return undefined;
    const chars = ref.current.querySelectorAll(".split-char");
    const tween = gsap.fromTo(
      chars,
      { yPercent: 120, rotateX: -80, opacity: 0 },
      {
        yPercent: 0,
        rotateX: 0,
        opacity: 1,
        duration: 0.75,
        ease: "back.out(1.7)",
        stagger: 0.05,
        delay,
        clearProps: "transform,opacity",
      },
    );
    return () => tween.kill();
  }, [motion, delay, text]);

  return (
    <Tag ref={ref} id={id} className={className} aria-label={text}>
      {Array.from(text).map((character, index) => (
        <span
          key={`${character}-${index}`}
          className="split-char"
          aria-hidden="true"
        >
          {character === " " ? "\u00A0" : character}
        </span>
      ))}
    </Tag>
  );
}

export function SplitWords({ text, as: Tag = "p", id, className, delay = 0 }) {
  const ref = useRef(null);
  const { motion } = useMotion();
  const words = text.split(" ");

  useEffect(() => {
    if (!motion || !ref.current) return undefined;
    const nodes = ref.current.querySelectorAll(".split-word");
    const tween = gsap.fromTo(
      nodes,
      { y: 16, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.55,
        ease: "power2.out",
        stagger: 0.02,
        delay,
        clearProps: "transform,opacity",
      },
    );
    return () => tween.kill();
  }, [motion, delay, text]);

  return (
    <Tag ref={ref} id={id} className={className}>
      {words.map((word, index) => (
        <Fragment key={`${word}-${index}`}>
          <span className="split-word">{word}</span>
          {index < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </Tag>
  );
}
