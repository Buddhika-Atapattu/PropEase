// Path: src/app/app.config.ts
// ──────────────────────────────────────────────────────────────────────────────
// Purpose
//   Central application configuration for both Web (dev/prod) and Electron.
//
// Features configured here:
//   • Router: path routing (web) / hash routing (electron)
//   • HTTP: Fetch API + DI interceptors (JWT / Auth headers)
//   • UI: Angular Material locale, Moment date adapter, animations
//   • PWA: Service Worker only for production web builds
//   • Charts: angular-google-charts module import
//   • Editor: TinyMCE self-hosted build (offline + CSP-friendly)
//   • Performance: zone coalescing for smoother change detection
//
// Notes
//   • Always use relative asset paths (no leading "/") — critical for Electron.
//   • SW is disabled for dev/Electron to avoid 404 on ngsw-worker.js.
// ──────────────────────────────────────────────────────────────────────────────

import {
  ApplicationConfig,
  importProvidersFrom,
  isDevMode,
  provideZoneChangeDetection,
} from '@angular/core';

// ── Router (platform-aware) ──────────────────────────────────────────────────
import {
  provideRouter,
  withInMemoryScrolling,
  withPreloading,
  PreloadAllModules,
  withHashLocation,
  TitleStrategy,
} from '@angular/router';
import { routes } from './app.routes';

// ── HttpClient (Fetch backend, DI interceptors) ──────────────────────────────
import {
  provideHttpClient,
  withFetch,
  withInterceptorsFromDi,
  HTTP_INTERCEPTORS,
} from '@angular/common/http';

// ── Service Worker (PWA for web prod only) ───────────────────────────────────
import { provideServiceWorker } from '@angular/service-worker';

// ── Animations (Angular Material / transitions) ──────────────────────────────
import { provideAnimations } from '@angular/platform-browser/animations';

// ── Angular Material: date/locale ────────────────────────────────────────────
import {
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
  DateAdapter,
  MatDateFormats,
} from '@angular/material/core';
import {
  MomentDateAdapter,
  MAT_MOMENT_DATE_ADAPTER_OPTIONS,
} from '@angular/material-moment-adapter';

// ── Google Charts (for dashboard modules) ────────────────────────────────────
import { GoogleChartsModule } from 'angular-google-charts';

// ── Environment (detects if Electron or Web build) ───────────────────────────
import { environment } from '../environments/environment';

// ── HTTP interceptors (Auth headers + inspector) ─────────────────────────────
import { AuthInspectorService } from './services/inspectorService/auth-inspector-service';
import { AuthHeaderInterceptor } from './interceptors/auth-header.interceptor';

// ── TinyMCE Angular wrapper (self-hosted, CSP-safe) ──────────────────────────
import { EditorModule, TINYMCE_SCRIPT_SRC } from '@tinymce/tinymce-angular';

import { AppTitleStrategy } from './core/routing/app-title.strategy';

import { RecycleBinWsRpcToken } from "./services/recyclebin/recyclebin-ws-rpc.token";

// ── Custom Material date format (UK style: DD/MM/YYYY) ───────────────────────
export const MY_DATE_FORMATS: MatDateFormats = {
  parse: { dateInput: 'DD/MM/YYYY' },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMM YYYY',
    dateA11yLabel: 'DD/MM/YYYY',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

// ── HTTP interceptors registration ───────────────────────────────────────────
// Order matters:
//  - AuthHeaderInterceptor runs FIRST → attaches Authorization + x-guard-token
//  - AuthInspectorService runs AFTER → can log/handle 401 knowing headers are set
export const httpInterceptorProviders = [
  {
    provide: HTTP_INTERCEPTORS,
    useClass: AuthHeaderInterceptor,
    multi: true,
  },
  {
    provide: HTTP_INTERCEPTORS,
    useClass: AuthInspectorService,
    multi: true,
  },
];

// ── Router configuration (platform-aware) ────────────────────────────────────
// Electron → hash routing (avoids file:// deep-link reload issues)
// Web      → normal path-based routing (server must fallback to index.html)
const routerProviders = environment.electron
  ? provideRouter(
    routes,
    withHashLocation(),
    withPreloading( PreloadAllModules ),
    withInMemoryScrolling( {
      scrollPositionRestoration: 'top',
      anchorScrolling: 'enabled',
    } ),
  )
  : provideRouter(
    routes,
    withPreloading( PreloadAllModules ),
    withInMemoryScrolling( {
      scrollPositionRestoration: 'top',
      anchorScrolling: 'enabled',
    } ),
  );

// ── Final Application Config ─────────────────────────────────────────────────
export const appConfig: ApplicationConfig = {
  providers: [
    // Router + page title
    routerProviders,
    { provide: TitleStrategy, useClass: AppTitleStrategy },

    // HTTP Client (Fetch API + DI interceptors)
    provideHttpClient( withFetch(), withInterceptorsFromDi() ),
    ...httpInterceptorProviders,

    // Animations (Material)
    provideAnimations(),

    // Zone optimization
    provideZoneChangeDetection( { eventCoalescing: true } ),

    // Google Charts
    importProvidersFrom( GoogleChartsModule ),

    // Service Worker (PWA – disabled in dev / Electron)
    provideServiceWorker( 'ngsw-worker.js', {
      enabled: !isDevMode(),
    } ),

    // TinyMCE editor (self-hosted)
    importProvidersFrom( EditorModule ),
    { provide: TINYMCE_SCRIPT_SRC, useValue: 'tinymce/tinymce.min.js' },

    // Material Date/Locale configuration
    { provide: MAT_DATE_LOCALE, useValue: 'en-GB' },
    {
      provide: DateAdapter,
      useClass: MomentDateAdapter,
      deps: [ MAT_DATE_LOCALE, MAT_MOMENT_DATE_ADAPTER_OPTIONS ],
    },
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS },

  ],
};
