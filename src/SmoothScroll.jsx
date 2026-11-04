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
        lerp: 0.08,
        wheelMultiplier: 1.05,
        smoothWheel: true,
        syncTouch: false,
      }}
    >
      <ScrollTriggerBridge />
      {children}
    </ReactLenis>
  );
}
