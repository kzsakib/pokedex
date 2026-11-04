/* Sweep of light across the label, driven entirely by CSS. */
export default function ShinyText({ text, className = "", speed = 5 }) {
  return (
    <span
      className={`shiny-text ${className}`.trim()}
      style={{ "--shiny-speed": `${speed}s` }}
    >
      {text}
    </span>
  );
}
