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
        // TODOS os ícones são OPACOS, achatados no mesmo #FBFBFA do
        // background_color acima. Transparência aqui não fica transparente:
        // Android e iOS compõem sobre PRETO, e a arte tem listras vagadas —
        // então o splash mostrava um quadrado preto com listras pretas
        // cortando o símbolo (print do Daniel, 12/08/2026). A correção de
        // 07/08 tinha resolvido só o slot "maskable", que é o da gaveta de
        // apps; splash e iOS usam os de baixo. Achatar no tom do splash faz
        // o quadrado sumir de vez, em vez de trocar preto por branco.
        icons: [
          { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
          // Variante própria pro slot "maskable": o ícone normal tem fundo
          // transparente e o círculo quase toca a borda do canvas — sem
          // "safe zone", o mascaramento do próprio Android (que aplica sua
          // forma por cima) cortava o círculo e mostrava a transparência
          // como preto sólido. Fundo branco + círculo a ~78% do canvas
          // (achado real, print do Daniel).
          { src: "/android-chrome-512x512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    open: true,
  },
});
