import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      manifest: {
        name: "BirthdayReminder",
        short_name: "Anniv",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#e85d75",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
    }),
  ],
  server: { proxy: { "/api": "http://localhost:8787" } },
  test: { environment: "jsdom", globals: true, setupFiles: "./test/setup.ts" },
});
