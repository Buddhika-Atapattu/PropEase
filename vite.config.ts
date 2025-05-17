import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import history from 'connect-history-api-fallback';
import type { Connect } from 'vite';

export default defineConfig({
  plugins: [
    angular(),
    {
      name: 'spa-fallback',
      configureServer(server) {
        const middleware = history({
          disableDotRule: true, // Important for Angular routing with dots in paths
          htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
          rewrites: [
            {
              from: /^\/public\/.*$/,
              to: (context) => {
                return context.parsedUrl.pathname || '/';
              },
            },
            {
              from: /^(?!\/public\/).*$/, // For anything else
              to: '/index.html',
            },
          ],
        }) as Connect.NextHandleFunction;

        server.middlewares.use(middleware);
      },
    },
  ],
  server: {
    port: 4200,
    open: true, // Optional: Automatically open browser
    strictPort: true, // Optional: Avoid random fallback ports
  },
});
