// Core Angular features for application config and zone optimization
import {ApplicationConfig, provideZoneChangeDetection} from '@angular/core';

// Router setup with module preloading for faster lazy-loaded route access
import {provideRouter, withPreloading, PreloadAllModules} from '@angular/router';

// Choose URL strategy: Path-based (default) or Hash-based
import {LocationStrategy, PathLocationStrategy} from '@angular/common';

// HTTP client with Fetch API support
import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withFetch,
  withInterceptorsFromDi, // <-- allow HTTP_INTERCEPTORS from DI
} from '@angular/common/http';

// Material date formats and locale support
import {
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
  DateAdapter,
  MatDateFormats,
} from '@angular/material/core';

// Moment.js adapter for Angular Material DatePicker
import {MomentDateAdapter, MAT_MOMENT_DATE_ADAPTER_OPTIONS} from '@angular/material-moment-adapter';

// Enable Angular animations (required by many Angular Material components)
import {provideAnimations} from '@angular/platform-browser/animations';

// Global default options for Angular Material Dialogs
import {MAT_DIALOG_DEFAULT_OPTIONS} from '@angular/material/dialog';

// Application route configuration
import {routes} from './app.routes';

// Google Charts support
import {provideGoogleCharts} from 'angular-google-charts';

// Custom date format for DatePicker (DD/MM/YYYY style)
export const MY_DATE_FORMATS: MatDateFormats = {
  parse: {dateInput: 'DD/MM/YYYY'},
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMM YYYY',
    dateA11yLabel: 'DD/MM/YYYY',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

import {AuthInspectorService} from './services/inspectorService/auth-inspector-service';

// HTTP interceptor to add JWT auth token to outgoing requests
export const httpInterceptorProviders = [
  {provide: HTTP_INTERCEPTORS, useClass: AuthInspectorService, multi: true},
];

// Main Angular standalone application configuration
export const appConfig: ApplicationConfig = {
  providers: [
    // ❌ no provideClientHydration here (done conditionally in main.ts)

    // Charts
    provideGoogleCharts(),

    // HttpClient with Fetch + DI-based interceptors (needed for JWT header)
    provideHttpClient(
      withFetch(),
      withInterceptorsFromDi(), // <-- makes httpInterceptorProviders take effect
    ),

    // Animations
    provideAnimations(),

    // Performance: coalesce change detection events
    provideZoneChangeDetection({eventCoalescing: true}),

    // Router + preloading for better UX on lazy routes
    provideRouter(routes, withPreloading(PreloadAllModules)),

    // URL strategy
    {provide: LocationStrategy, useClass: PathLocationStrategy},

    // Material i18n + date adapter/format
    {provide: MAT_DATE_LOCALE, useValue: 'en-GB'},
    {
      provide: DateAdapter,
      useClass: MomentDateAdapter,
      deps: [MAT_DATE_LOCALE, MAT_MOMENT_DATE_ADAPTER_OPTIONS],
    },
    {provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS},

    // Global dialog defaults
    {provide: MAT_DIALOG_DEFAULT_OPTIONS, useValue: {hasBackdrop: true, autoFocus: true}},

    // ✅ Register your HTTP interceptors
    ...httpInterceptorProviders,
  ],
};
