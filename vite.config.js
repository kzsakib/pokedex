import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Project sites are served from /<repo>/, so the deployment build sets
  // VITE_BASE while local dev and preview keep the root.
  base: process.env.VITE_BASE || "/",
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    // The cloud preview arrives through a tunnel hostname, set per process.
    allowedHosts: process.env.PREVIEW_HOST ? [process.env.PREVIEW_HOST] : [],
  },
});
