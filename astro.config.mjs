import { satteri } from '@astrojs/markdown-satteri';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://mu-online-history.pages.dev',
  markdown: {
    // Smart punctuation is off because season bodies contain raw inline HTML
    // (`<sup>`, `<mu-cite>`) and quoted item names that must survive verbatim.
    processor: satteri({ features: { smartPunctuation: false } }),
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
