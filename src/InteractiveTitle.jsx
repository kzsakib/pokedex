import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, SplitText as GSAPSplitText } from "./motion";
import { useMotion } from "./motionSettings";

const TITLE = "Pokédex";
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/<>=+";

const BALL = `
<svg viewBox="0 0 32 32" aria-hidden="true">
  <circle cx="16" cy="16" r="14" fill="#f2f4f4" stroke="#181e22" stroke-width="2.4"/>
  <path d="M2 16h28" stroke="#181e22" stroke-width="2.4"/>
  <circle cx="16" cy="16" r="5.4" fill="#f2f4f4" stroke="#181e22" stroke-width="2.4"/>
  <circle cx="16" cy="16" r="2.2" fill="#181e22"/>
</svg>`;

export default function InteractiveTitle() {
  const ref = useRef(null);
  const { motion } = useMotion();
  const state = useRef({ split: null, ball: null, baseWeight: 800 });
  const { contextSafe } = useGSAP({ scope: ref });

  const resetWeights = contextSafe(() => {
    state.current.split?.chars.forEach((char) => {
      char.style.fontVariationSettings = "";
    });
  });

  const onPointerMove = contextSafe((event) => {
    if (!motion) return;
    const { split, ball } = state.current;

    if (ball) {
      const rect = ball.getBoundingClientRect();
      const angle =
        (Math.atan2(
          event.clientY - (rect.top + rect.height / 2),
          event.clientX - (rect.left + rect.width / 2),
        ) *
          180) /
          Math.PI +
        90;
      gsap.to(ball, {
        rotation: angle,
        duration: 0.35,
        ease: "power2.out",
        overwrite: "auto",
      });
    }

    split?.chars.forEach((char) => {
      if (char.classList.contains("has-ball")) return;
      const rect = char.getBoundingClientRect();
      const distance = Math.hypot(
        event.clientX - (rect.left + rect.width / 2),
        event.clientY - (rect.top + rect.height / 2),
      );
      const reach = Math.max(0, 1 - distance / 240);
      char.style.fontVariationSettings = `"wght" ${Math.round(
        state.current.baseWeight - reach * 340,
      )}`;
    });
  });

  useGSAP(
    () => {
      const element = ref.current;
      if (!element) return undefined;
      element.setAttribute("aria-label", TITLE);

      const split = new GSAPSplitText(element, {
        type: "chars",
        charsClass: "split-char",
        aria: "none",
      });
      split.chars.forEach((char) => char.setAttribute("aria-hidden", "true"));
      state.current.split = split;

      if (!motion) return () => split.revert();

      const finalChars = split.chars.map((char) => char.textContent);
      const proxy = { progress: 0 };
      const timeline = gsap.timeline({
        onComplete: () => {
          split.chars.forEach((char, index) => {
            char.textContent = finalChars[index];
          });

          /* The Pokéball stands in for the wordmark's O — not the É — and
             tracks the cursor from that slot. */
          const accent = split.chars.find(
            (char) => char.textContent.toLowerCase() === "o",
          );
          if (accent) {
            accent.classList.add("has-ball");
            accent.innerHTML = `<span class="title-ball">${BALL}</span>`;
            state.current.ball = accent.querySelector(".title-ball");
          }

          element.classList.add("is-ready");
          window.addEventListener("pointermove", onPointerMove, { passive: true });
          window.addEventListener("pointerleave", resetWeights);
        },
      });

      timeline
        .to(
          proxy,
          {
            progress: 1,
            duration: 0.9,
            ease: "none",
            onUpdate: () => {
              const revealed = Math.floor(proxy.progress * finalChars.length);
              split.chars.forEach((char, index) => {
                if (index < revealed) char.textContent = finalChars[index];
                else if (finalChars[index] !== " ") {
                  char.textContent =
                    GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
                }
              });
            },
          },
          0,
        )
        .from(
          split.chars,
          {
            yPercent: 55,
            opacity: 0,
            duration: 0.6,
            stagger: 0.05,
            ease: "power3.out",
          },
          0.45,
        );

      return () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerleave", resetWeights);
        state.current.split = null;
        state.current.ball = null;
        split.revert();
      };
    },
    { scope: ref, dependencies: [motion], revertOnUpdate: true },
  );

  return (
    <h1 ref={ref} id="page-title" className="title">
      {TITLE}
    </h1>
  );
}
