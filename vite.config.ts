import { cloudflare } from "@cloudflare/vite-plugin";
import tailwind from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The Cloudflare plugin runs src/worker in workerd beside the dev server and builds both. The
// environment (staging, production) comes from CLOUDFLARE_ENV at build time.
export default defineConfig({
  plugins: [react(), tailwind(), cloudflare()],
  // Expose only PUBLIC_* variables to the browser.
  envPrefix: "PUBLIC_",
  build: { assetsInlineLimit: 0 },
});
