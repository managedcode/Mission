// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// The Mission landing page is served from the `mission` subdomain.
export default defineConfig({
  site: 'https://mission.managed-code.com',
  server: {
    port: 4323,
  },
  integrations: [
    sitemap({
      // emit <lastmod> so crawlers get a freshness signal
      serialize(item) {
        item.lastmod = new Date().toISOString();
        return item;
      },
    }),
  ],
  build: {
    // inline CSS into the HTML to remove the render-blocking stylesheet request
    inlineStylesheets: 'always',
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  devToolbar: {
    enabled: false,
  },
});
