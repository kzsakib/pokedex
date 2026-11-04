import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const MotionContext = createContext({ motion: true, toggleMotion: () => {} });
const STORAGE_KEY = "pokedex.motion";

/* Motion defaults to on and is persisted, so the animations are always there
   unless the visitor explicitly turns them off with the chassis switch. */
export function MotionProvider({ children }) {
  const [motion, setMotion] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "off") setMotion(false);
  }, []);

  if (typeof window !== "undefined") {
    window.__POKEDEX_MOTION__ = motion;
  }

  useEffect(() => {
    document.documentElement.dataset.motion = motion ? "on" : "off";
    window.localStorage.setItem(STORAGE_KEY, motion ? "on" : "off");
  }, [motion]);

  const toggleMotion = useCallback(() => setMotion((value) => !value), []);
  const value = useMemo(() => ({ motion, toggleMotion }), [motion, toggleMotion]);

  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

export const useMotion = () => useContext(MotionContext);
