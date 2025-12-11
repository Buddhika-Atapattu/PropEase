// Path: src/environments/environment.ts
import { Environment } from "./environment.types";

/**
 * Default development environment (localhost DEV).
 * Keep this in sync with backend .env:
 *   FRONTEND_ORIGIN=http://localhost:4200
 *   PORT=3000 → apiOrigin=http://localhost:3000
 */
export const environment: Environment = {
  production: false,
  frontendOrigin: 'http://localhost:4200',
  localRoot: 'http://localhost:4200',

  apiOrigin: 'http://localhost:3000',
  wsOrigin: 'http://localhost:3000',

  filesBaseUrl: 'http://localhost:3000/uploads/',
  electron: false,
};

/**
 * LAN / Mobile testing helpers
 * ---------------------------------------------------------------------------
 * Use these when you test on a real phone in the same Wi-Fi network.
 *  - FRONTEND URL (Angular dev server):  http://192.168.8.117:4200
 *  - BACKEND URL (API + Socket.IO):      http://192.168.8.117:3000
 *
 * You can switch between localhost and LAN by:
 *  - either using a second env file (environment.lan.ts)
 *  - or reading from a runtime config later.
 */
export const LAN_HOST = '192.168.8.117';

export const LAN_WEB_ORIGIN = `http://${ LAN_HOST }:4200`;
export const LAN_API_ORIGIN = `http://${ LAN_HOST }:3000`;
export const LAN_FILES_BASE_URL = `http://${ LAN_HOST }:3000/uploads/`;
