import { useEffect } from "react";
import { ReactLenis, useLenis } from "lenis/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "lenis/dist/lenis.css";
import { useMotion } from "./motionSettings";

/* Lenis is the only thing allowed to move the page. Native smooth scrolling
   on top of it produces two animations fighting for the same scroll offset,
   which reads as stutter, so the CSS behaviour is pinned to auto (see
   `html { scroll-behavior: auto }` in styles.css) and every programmatic
   move goes through `lenis.scrollTo`. */

/* Keeps GSAP's scroll work in step with Lenis, which drives the page scroll. */
function ScrollTriggerBridge() {
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis) return undefined;
    const update = () => ScrollTrigger.update();
    lenis.on("scroll", update);
    ScrollTrigger.refresh();
    return () => lenis.off("scroll", update);
  }, [lenis]);

  return null;
}

/* A long exponential ease-out: the page keeps drifting after the wheel stops
   and settles without a bounce. Time-based rather than lerp-based so the
   glide is identical on 60Hz and 120Hz displays. */
const easeOutExpo = (time) => (time === 1 ? 1 : 1 - 2 ** (-10 * time));

export default function SmoothScroll({ children }) {
  const { motion } = useMotion();

  if (!motion) return children;

  return (
    <ReactLenis
      root
      options={{
        autoRaf: true,
        duration: 1.15,
        easing: easeOutExpo,
        smoothWheel: true,
        wheelMultiplier: 1,
        /* Touch keeps the platform's own momentum: syncing it to Lenis makes
           a phone flick feel like it is stuck in treacle. */
        syncTouch: false,
        touchMultiplier: 1.6,
      }}
    >
      <ScrollTriggerBridge />
      {children}
    </ReactLenis>
  );
}
