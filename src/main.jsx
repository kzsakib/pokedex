import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
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
