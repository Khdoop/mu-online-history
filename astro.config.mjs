import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://mu-online-history.pages.dev',
  markdown: {
    // Season bodies contain inline HTML (<sup>, <mu-cite>) that must survive.
    smartypants: false,
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
