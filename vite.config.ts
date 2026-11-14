import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { SUPABASE_URL } from "./src/config";

const TILE_ORIGIN = "https://tile.openstreetmap.org";
const SEARCH_ORIGIN = "https://nominatim.openstreetmap.org";
const RATES_ORIGIN = "https://api.frankfurter.dev";

// Adds a Content-Security-Policy to the built page. The app only talks to
// itself, its Supabase project, OpenStreetMap's map tiles and place search,
// and the exchange-rate service.
function contentSecurityPolicy(): Plugin {
  const connect = ["'self'", SEARCH_ORIGIN, TILE_ORIGIN, RATES_ORIGIN];
  if (SUPABASE_URL) {
    const supabase = new URL(SUPABASE_URL);
    connect.push(supabase.origin, `wss://${supabase.host}`);
  }
  const policy = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    `img-src 'self' data: ${TILE_ORIGIN}`,
    "font-src 'self'",
    `connect-src ${connect.join(" ")}`,
    "manifest-src 'self'",
    "worker-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");

  return {
    name: "content-security-policy",
    apply: "build",
    transformIndexHtml() {
      return [
        {
          tag: "meta",
          attrs: { "http-equiv": "Content-Security-Policy", content: policy },
          injectTo: "head-prepend",
        },
      ];
    },
  };
}

export default defineConfig({
  base: "/travel/",
  // The map library makes one bundle of about 200 KB compressed. It's cached
  // for offline use, so splitting it wouldn't help.
  build: { chunkSizeWarningLimit: 900 },
  plugins: [
    react(),
    contentSecurityPolicy(),
    VitePWA({
      registerType: "autoUpdate",
      // Registered in src/main.tsx, which also reloads the page on updates.
      injectRegister: false,
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Our Trips",
        short_name: "Trips",
        description: "Vitou and Carmen's trip planner",
        start_url: "/travel/",
        scope: "/travel/",
        display: "standalone",
        background_color: "#f6f4ef",
        theme_color: "#0f6b62",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // A new version takes over open pages straight away.
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: "/travel/index.html",
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
        runtimeCaching: [
          {
            // Keep map tiles you've already looked at, so the map still
            // works without signal. Fresh tiles are used whenever online.
            urlPattern: ({ url }) => url.origin === TILE_ORIGIN,
            handler: "NetworkFirst",
            options: {
              cacheName: "map-tiles",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 2500, maxAgeSeconds: 60 * 60 * 24 * 45 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
});
