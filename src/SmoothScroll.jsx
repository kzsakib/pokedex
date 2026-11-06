import { useEffect } from "react";
import { ReactLenis, useLenis } from "lenis/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "lenis/dist/lenis.css";
import { useMotion } from "./motionSettings";

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

export default function SmoothScroll({ children }) {
  const { motion } = useMotion();

  if (!motion) return children;

  return (
    <ReactLenis
      root
      options={{
        /* A low lerp gives the wheel a long, weighted glide; the multiplier
           is trimmed so a single notch travels less per frame. */
        lerp: 0.045,
        wheelMultiplier: 0.85,
        smoothWheel: true,
        /* Touch pans are eased too, at a firmer lerp so they never trail. */
        syncTouch: true,
        syncTouchLerp: 0.075,
        touchInertiaMultiplier: 28,
        touchMultiplier: 1.4,
      }}
    >
      <ScrollTriggerBridge />
      {children}
    </ReactLenis>
  );
}
