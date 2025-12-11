// Path: src/environments/environment.prod.ts
import { Environment } from "./environment.types";

/**
 * Production build configuration.
 *
 * IMPORTANT:
 * Replace `app.propease.example` with your real production domain.
 */
export const environment: Environment = {
  production: true,

  // The domain where your Angular application is hosted
  frontendOrigin: 'https://app.propease.example',

  // Backend REST API domain (HTTPS required for cookies & secure auth)
  apiOrigin: 'https://api.propease.example',

  // Socket.IO endpoint (normally matches apiOrigin)
  wsOrigin: 'https://api.propease.example',

  // File downloads / previews
  filesBaseUrl: 'https://api.propease.example/uploads/',

  // Electron build should override this at runtime
  electron: false,

  localRoot: 'https://app.propease.example',
};
