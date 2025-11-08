/// <reference types="@angular/localize" />

/**
 * main.ts
 * ----------
 * Bootstraps the Angular app in both Web and Electron environments.
 * - Plays nice with SSR hydration (only if SSR markup is present)
 * - Avoids service worker on Electron / file://
 * - Hides the splash preloader once Angular is ready
 */

import {bootstrapApplication} from '@angular/platform-browser';
import {AppComponent} from './app/app.component';
import {appConfig} from './app/app.config';

import {
  destroyPlatform,
  mergeApplicationConfig,
  ApplicationConfig,
} from '@angular/core';
import {provideClientHydration, withEventReplay} from '@angular/platform-browser';

import {environment} from './environments/environment';

/* ─────────────────────────────────────────────────────────────────────────────
   1) Environment helpers
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Detect if we’re running inside Electron.
 *  - userAgent check covers most builds
 *  - window.process?.versions?.electron works when nodeIntegration/sandbox allow it
 */
function isElectron(): boolean {
  try {
    const uaHasElectron = navigator.userAgent.toLowerCase().includes('electron');
    const verHasElectron =
      typeof window !== 'undefined' &&
      (window as any).process &&
      (window as any).process.versions &&
      !!(window as any).process.versions.electron;
    return !!(environment as any).electron || uaHasElectron || verHasElectron;
  } catch {
    return !!(environment as any).electron;
  }
}

/**
 * Quick protocol test used for SW registration & a few guards.
 * - In Electron, you’ll usually get file://
 * - In dev web server: http://
 * - In production web hosting: https://
 */
const isFileProtocol = typeof location !== 'undefined' && location.protocol === 'file:';
const runningInElectron = isElectron();

/* ─────────────────────────────────────────────────────────────────────────────
   2) HMR safety: tear down any previous platform instance
   ───────────────────────────────────────────────────────────────────────────── */
try {
  destroyPlatform();
} catch {
  // No existing platform (first boot) — safe to ignore
}

/* ─────────────────────────────────────────────────────────────────────────────
   3) SSR hydration setup (only if server rendered markup exists)
   ───────────────────────────────────────────────────────────────────────────── */
/**
 * Angular Universal adds ng-server-context on <html> when SSR is in play.
 * Only enable client hydration if that attribute exists to avoid extra work.
 */
const HAS_SSR =
  typeof document !== 'undefined' &&
  document.documentElement.hasAttribute('ng-server-context');

const hydrationConfig: ApplicationConfig = HAS_SSR
  ? {providers: [provideClientHydration(withEventReplay())]}
  : {providers: []};

/* ─────────────────────────────────────────────────────────────────────────────
   4) Bootstrap Angular
   ───────────────────────────────────────────────────────────────────────────── */
bootstrapApplication(AppComponent, mergeApplicationConfig(appConfig, hydrationConfig))
  .then(() => {
    /* ─────────────────────────────────────────────────────────────────────────
       4a) Hide the preloader once Angular is ready
       ------------------------------------------------------------------------- */
    const preloader = document.getElementById('app-preloader');
    if(preloader) {
      preloader.style.transition = 'opacity 0.5s ease-out';
      preloader.style.opacity = '0';
      setTimeout(() => preloader.remove(), 500);
    }

    /* ─────────────────────────────────────────────────────────────────────────
       4b) Service Worker (web only)
       -------------------------------------------------------------------------
       Rules:
       - Never register a SW on Electron / file://.
       - Only allow on https: (or localhost during dev).
       - If you use Angular's NGSW, keep the filename 'ngsw-worker.js'.
         If you truly use a custom worker, update the path below accordingly.
       - Optional: gate by environment.production if you want SW only in prod.
       ------------------------------------------------------------------------- */
    const isHttps = location.protocol === 'https:';
    const isLocalhost =
      location.hostname === 'localhost' || location.hostname === '127.0.0.1';

    if(
      'serviceWorker' in navigator &&
      !runningInElectron &&
      !isFileProtocol &&
      (isHttps || isLocalhost)
      // && environment.production   // <- uncomment if you want SW only in prod
    ) {
      // Prefer Angular’s default NGSW filename. Change if you use a custom one.
      const workerUrl = 'ngsw-worker.js';

      navigator.serviceWorker
        .register(workerUrl)
        .then((registration) => {
          console.log('✅ Service Worker registered:', registration.scope);
        })
        .catch((error) => {
          console.error('❌ Service Worker registration failed:', error);
        });
    }
  })
  .catch((err) => {
    // Final bootstrap error handler
    console.error('❌ Angular bootstrap failed:', err);
  });

/* ─────────────────────────────────────────────────────────────────────────────
   Notes:
   - Deep linking:
     • Web: your dev server / host must fallback to index.html for any route.
     • Electron: you’re already using withHashLocation() in app.config.ts,
       so deep links won’t hit the file system. Good!

   - Assets:
     • Your angular.json copies public/ to the build root. Always reference
       assets as relative paths (e.g., "Images/...") without a leading slash.
       This keeps them working under both http(s) and file://.

   - Security:
     • main.ts contains no NodeJS calls. Keep nodeIntegration disabled and rely
       on a preload script + IPC for any native functionality in Electron.
   ───────────────────────────────────────────────────────────────────────────── */
