import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import netlify from '@astrojs/netlify';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://hostaltambococha.com',
  integrations: [tailwind(), react(), sitemap()],
  output: 'static',
  adapter: netlify({
    imageCDN: false,
  }),
  vite: {
    build: {
      minify: "esbuild",
    },
    esbuild: {
      charset: "ascii",
    },
  },
});
