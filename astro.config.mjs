// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// User site on GitHub Pages: no base path.
export default defineConfig({
  site: 'https://bisheshkhanal036-afk.github.io',
  trailingSlash: 'ignore',
  vite: {
    plugins: [tailwindcss()],
  },
});
