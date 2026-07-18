import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      // Só cacheia o shell do app (JS/CSS/ícones) — nenhuma chamada de rede
      // pro Supabase (auth/dados/realtime) passa pelo service worker, então
      // login e dados sempre vêm da rede, nunca de um cache desatualizado.
      workbox: {
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        // Bundle principal ainda não é code-split (~3MB) — eleva o teto
        // padrão de 2MB do workbox pra ele continuar sendo pré-cacheado.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: "Gestão Sanwey",
        short_name: "Sanwey",
        description: "Gestão comercial, marketing e RH da Sanwey",
        start_url: "/",
        scope: "/",
        lang: "pt-BR",
        display: "standalone",
        background_color: "#FBFBFA",
        theme_color: "#b5000b",
        icons: [
          { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    open: true,
  },
});
