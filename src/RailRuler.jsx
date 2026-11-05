import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger, gsap } from "./motion";
import { useMotion } from "./motionSettings";

export default function RailRuler() {
  const railRef = useRef(null);
  const fillRef = useRef(null);
  const headRef = useRef(null);
  const { motion } = useMotion();

  useGSAP(
    () => {
      if (!motion) return undefined;
      const rail = railRef.current;
      const fill = fillRef.current;
      const head = headRef.current;
      if (!rail || !fill || !head) return undefined;

      gsap.set(fill, { scaleY: 0, transformOrigin: "top center" });
      gsap.set(head, { y: 0 });

      const trigger = ScrollTrigger.create({
        start: 0,
        end: "max",
        onUpdate: (self) => {
          gsap.set(fill, { scaleY: self.progress });
          gsap.set(head, { y: self.progress * (rail.clientHeight - 6) });
        },
      });

      return () => trigger.kill();
    },
    { scope: railRef, dependencies: [motion] },
  );

  return (
    <div className="rail" aria-hidden="true" ref={railRef}>
      <span className="rail-ticks" />
      <span className="rail-fill" ref={fillRef} />
      <span className="rail-head" ref={headRef} />
    </div>
  );
}
