import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
/* Self-hosted variable families (Fontsource) — the only three in the app. */
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "@fontsource-variable/martian-mono/index.css";
import "@fontsource-variable/doto/index.css";
import App from "./App";
import SmoothScroll from "./SmoothScroll";
import { MotionProvider } from "./motionSettings";
import "./styles.css";
import "./record.css";
import "./typography.css";
import "./motion.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MotionProvider>
      <SmoothScroll>
        <App />
      </SmoothScroll>
    </MotionProvider>
  </StrictMode>,
);
