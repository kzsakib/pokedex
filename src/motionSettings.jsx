import { createContext, useContext, useEffect, useMemo } from "react";

const MotionContext = createContext({ motion: true });

/* Motion is part of the instrument now: the chassis switch is gone, so the
   flag stays true and the vendored ReactBits components keep reading it from
   window. The one opt-out left is the OS reduce-motion preference, which the
   text effects check before typing or scrambling. */
export function MotionProvider({ children }) {
  useEffect(() => {
    document.documentElement.dataset.motion = "on";
    window.__POKEDEX_MOTION__ = true;
  }, []);

  const value = useMemo(() => ({ motion: true }), []);

  return (
    <MotionContext.Provider value={value}>{children}</MotionContext.Provider>
  );
}

export const useMotion = () => useContext(MotionContext);
