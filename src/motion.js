import gsap from "gsap";

/* The app-level motion switch is authoritative. It lives on window so the
   vendored ReactBits components can read it without prop plumbing. */
export function motionEnabled() {
  if (typeof window === "undefined") return true;
  return window.__POKEDEX_MOTION__ !== false;
}

export { gsap };
