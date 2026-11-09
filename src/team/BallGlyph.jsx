/* The drawn ball, used wherever a sprite would be too heavy: the empty team
   slot, the HUD fallback and the header before the first sprite lands. */
export default function BallGlyph({ size = 18, dim = false }) {
  return (
    <svg
      className={`team-ball${dim ? " is-dim" : ""}`}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="10" cy="10" r="8.6" fill="#eef0ef" stroke="#0e1417" strokeWidth="1.6" />
      <path d="M1.6 10h16.8" stroke="#0e1417" strokeWidth="1.6" />
      <path d="M1.6 10a8.4 8.4 0 0 1 16.8 0Z" fill="#d8452f" stroke="#0e1417" strokeWidth="1.6" />
      <circle cx="10" cy="10" r="3" fill="#eef0ef" stroke="#0e1417" strokeWidth="1.6" />
      <circle cx="10" cy="10" r="1.1" fill="#0e1417" />
    </svg>
  );
}
