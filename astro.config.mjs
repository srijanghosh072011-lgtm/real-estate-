// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Change SITE_URL at deploy time (Netlify/Cloudflare/Vercel env var) so canonicals,
// sitemap and JSON-LD all point at the live domain.
const site = process.env.SITE_URL || 'https://www.harborlane.realestate';

export default defineConfig({
  site,
  trailingSlash: 'never',
  integrations: [sitemap({ filter: (page) => !page.includes('/thanks') })],
  vite: { plugins: [tailwindcss()] },
  build: { format: 'file' },
});
