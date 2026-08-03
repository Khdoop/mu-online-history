import { satteri } from '@astrojs/markdown-satteri';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // Drives canonical links, Open Graph URLs and the generated sitemap.
  site: 'https://mu-online-history.vercel.app',
  integrations: [sitemap({ filter: (page) => !page.endsWith('/404/') })],
  markdown: {
    // Smart punctuation is off because season bodies contain raw inline HTML
    // (`<sup>`, `<mu-cite>`) and quoted item names that must survive verbatim.
    processor: satteri({ features: { smartPunctuation: false } }),
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
