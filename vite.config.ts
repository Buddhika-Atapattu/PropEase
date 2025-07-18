import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import history from 'connect-history-api-fallback';
import type { Connect } from 'vite';

export default defineConfig( {
  plugins: [
    angular(),
    {
      name: 'spa-fallback',
      configureServer( server ) {
        // Important: place fallback after SSR renders
        server.middlewares.use( ( req, res, next ) => {
          const skipSSR =
            req.method !== 'GET' ||
            req.originalUrl?.includes( '/api' ) || // Skip APIs
            req.originalUrl?.includes( '.' ) ||    // Skip static files
            !req.headers.accept?.includes( 'text/html' ); // Only HTML requests

          if ( skipSSR ) {
            return next();
          }

          // Let Angular SSR (Analog) handle the response
          // Do not add SSR render code here unless you're customizing SSR
          return next(); // If no SSR customization, just continue
        } );

        const fallbackMiddleware = history( {
          disableDotRule: true,
          htmlAcceptHeaders: [ 'text/html', 'application/xhtml+xml' ],
        } ) as Connect.NextHandleFunction;

        server.middlewares.use( fallbackMiddleware );
      },
    },
  ],
  server: {
    port: 4200,
    open: true,
    strictPort: true,
    host: true,
    allowedHosts: [ '.ngrok-free.app' ],
  },
} );
