import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import { pixelSpriteUrl } from "../api";
import { mix, softAccent, typeAccent } from "../typeColors";

const SPRING = { stiffness: 280, damping: 26, mass: 0.6 };

/* One big card. It is the shared-layout target for its small slot, so the
   outer article owns the layout animation and an inner surface does the
   pointer tilt — the two transforms never fight. */
export default function PokemonCard({ mon, index }) {
  const surface = useRef(null);

  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);
  const smoothX = useSpring(pointerX, SPRING);
  const smoothY = useSpring(pointerY, SPRING);
  const glare = useSpring(0, { stiffness: 200, damping: 30 });

  const rotateY = useTransform(smoothX, [0, 1], [-8, 8]);
  const rotateX = useTransform(smoothY, [0, 1], [6, -6]);
  const glareX = useTransform(smoothX, [0, 1], [-64, 64]);
  const glareY = useTransform(smoothY, [0, 1], [-46, 46]);

  /* Facts can land a frame after the card mounts, so the card has to survive
     a member with no types yet. */
  const types = mon.types ?? [];
  const primary = types[0] ?? "normal";
  const accent = typeAccent(primary);

  const move = (event) => {
    const rect = surface.current?.getBoundingClientRect();
    if (!rect) return;
    pointerX.set((event.clientX - rect.left) / rect.width);
    pointerY.set((event.clientY - rect.top) / rect.height);
  };

  const enter = () => glare.set(0.2);
  const leave = () => {
    pointerX.set(0.5);
    pointerY.set(0.5);
    glare.set(0);
  };

  return (
    <motion.article
      layoutId={`member-${mon.id}`}
      className="team-card"
      style={{
        "--type": accent,
        "--glow": softAccent(primary),
        "--glow-deep": mix(accent, "#0b1115", 0.74),
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        layout: {
          type: "spring",
          stiffness: 240,
          damping: 28,
          delay: index * 0.07,
        },
        opacity: { duration: 0.24, delay: 0.04 },
      }}
      onPointerMove={move}
      onPointerEnter={enter}
      onPointerLeave={leave}
      aria-label={`${mon.name}, ${mon.number}, base stat total ${mon.bst}`}
    >
      <motion.div
        ref={surface}
        className="team-card__surface"
        style={{ rotateX, rotateY, transformPerspective: 820 }}
      >
        <header className="team-card__head">
          <span className="team-card__dex">{mon.number}</span>
          <span className="team-card__bst">
            BST <b>{mon.bst}</b>
          </span>
        </header>

        <div className="team-card__sprite">
          <img
            src={pixelSpriteUrl(mon.id)}
            alt=""
            width="96"
            height="96"
            loading="lazy"
            decoding="async"
            draggable="false"
          />
        </div>

        <footer className="team-card__foot">
          <h4 className="team-card__name">{mon.name}</h4>
          <ul className="team-card__types">
            {types.map((type) => (
              <li
                key={type}
                style={{
                  "--chip": typeAccent(type),
                  "--chip-soft": softAccent(type),
                }}
              >
                {type}
              </li>
            ))}
          </ul>
        </footer>

        <motion.span
          className="team-card__glare"
          style={{ x: glareX, y: glareY, opacity: glare }}
          aria-hidden="true"
        />
      </motion.div>
    </motion.article>
  );
}
