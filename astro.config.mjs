import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://shalini-prabha.netlify.app',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/search-index.json'),
    }),
  ],
});
