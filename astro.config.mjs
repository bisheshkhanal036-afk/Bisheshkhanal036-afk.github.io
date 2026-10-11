// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// User site on GitHub Pages: no base path.
export default defineConfig({
  site: 'https://bisheshkhanal036-afk.github.io',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  // Fonts are downloaded at build time and self-hosted from /_astro.
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Newsreader',
      cssVariable: '--font-newsreader',
      weights: [400, 500, 600],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['Georgia', 'serif'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'JetBrains Mono',
      cssVariable: '--font-jbmono',
      weights: ['100 800'],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['ui-monospace', 'monospace'],
    },
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
