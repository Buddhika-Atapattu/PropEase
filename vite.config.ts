import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular'; // Or your respective Angular plugin
import history from 'connect-history-api-fallback';
import type { Connect } from 'vite';

export default defineConfig({
  plugins: [
    angular(),
    {
      name: 'spa-fallback',
      configureServer(server) {
        const middleware = history({
          // Rewriting rules
          rewrites: [
            {
              // Matching all assets URLs
              from: /^\/assets\/.*$/,
              to: (context) => {
                console.log('Parsed URL:', context.parsedUrl.pathname); // Check this in the console
                // Ensure that `context.parsedUrl.pathname` is never null
                return context.parsedUrl.pathname || '/';
              },
            },
            {
              // Default fallback rewrite for all other URLs
              from: /^(?!\/assets\/).*$/,
              to: (context) => {
                return '/index.html'; // Fallback to index.html for SPA routing
              },
            },
          ],
        }) as Connect.NextHandleFunction;
        server.middlewares.use(middleware);
      },
    },
  ],
  server: {
    port: 4200,
  },
});
