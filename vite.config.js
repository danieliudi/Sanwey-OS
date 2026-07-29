import { createRequire } from "node:module";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const require = createRequire(import.meta.url);
const pkg = require("./package.json");

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      // "prompt" (era "autoUpdate") — expõe needRefresh/onNeedRefresh em vez
      // de trocar o service worker em silêncio, pra dar pra avisar o usuário
      // com um toast em vez de só aplicar e esperar o próximo hard refresh
      // (ver src/hooks/use-app-update.js). injectRegister continua "auto":
      // o próprio plugin detecta o import de virtual:pwa-register/react no
      // hook e evita registrar o SW duas vezes (confirmado nos docs oficiais
      // via Context7, /vite-pwa/docs — "auto" adapta ao método de registro
      // conforme os virtual modules importados, só cai pro <script> se
      // nenhum for detectado).
      registerType: "prompt",
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
        // clientsClaim só é injetado automaticamente quando registerType é
        // "autoUpdate" — com "prompt" (linha acima) ficava faltando, e sem
        // isso o SW novo nunca assume a aba já aberta: o SKIP_WAITING do
        // clique em "Atualizar agora" ativa o worker em segundo plano, mas
        // "controllerchange" nunca dispara, então o reload nunca acontece.
        clientsClaim: true,
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
