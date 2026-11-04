import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Flip } from "gsap/Flip";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, Flip, SplitText);

/* The app-level motion switch is authoritative. It lives on window so the
   vendored ReactBits components can read it without prop plumbing. */
export function motionEnabled() {
  if (typeof window === "undefined") return true;
  return window.__POKEDEX_MOTION__ !== false;
}

/* Used only for the one-off text effects that should stay still for people
   who asked the OS for less motion. */
export function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export { gsap, ScrollTrigger, Flip, SplitText };
