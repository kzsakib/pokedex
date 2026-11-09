import { motion } from "motion/react";
import { pixelSpriteUrl } from "../api";
import { typeAccent } from "../typeColors";
import BallGlyph from "./BallGlyph";

/* The six small slots. Each filled one is the shared-layout source for its
   big card, so its sprite wrapper keeps the same layoutId until the reveal
   takes it over. Slots are buttons: the whole strip is the replay control. */
export default function TeamStrip({
  slots,
  revealed,
  landedSlot,
  canReveal,
  slotRefs,
  onSlot,
}) {
  return (
    <div className="team-slots">
      <p className="team-slots__label">Your team</p>
      <ul className={`team-slot-row${revealed ? " is-dimmed" : ""}`}>
        {slots.map((mon, index) => (
          <li
            key={mon ? mon.id : `empty-${index}`}
            ref={(node) => {
              slotRefs.current[index] = node;
            }}
            style={
              mon
                ? { "--land-accent": typeAccent(mon.types?.[0] ?? "normal") }
                : undefined
            }
            className={`team-slot-cell${
              landedSlot === index ? " is-landed" : ""
            }`}
          >
            <button
              type="button"
              className={`team-slot${mon ? " is-filled" : ""}`}
              data-empty={mon ? undefined : "true"}
              onClick={onSlot}
              disabled={!canReveal}
              aria-label={
                mon
                  ? `${mon.name} caught — replay the team reveal`
                  : `Slot ${index + 1} empty`
              }
            >
              {mon ? (
                <>
                  <motion.span
                    className="team-slot__well"
                    layoutId={revealed ? undefined : `member-${mon.id}`}
                    transition={{
                      layout: { type: "spring", stiffness: 260, damping: 30 },
                    }}
                  >
                    <img
                      src={pixelSpriteUrl(mon.id)}
                      alt=""
                      width="44"
                      height="44"
                      loading="lazy"
                      decoding="async"
                    />
                  </motion.span>
                  <span className="team-slot__name">{mon.name}</span>
                </>
              ) : (
                <>
                  <BallGlyph size={22} dim />
                  <span className="team-slot__name" aria-hidden="true">
                    —
                  </span>
                </>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
