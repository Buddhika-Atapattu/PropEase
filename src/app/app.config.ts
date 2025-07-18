// Core Angular features for application config and zone optimization
import {
  ApplicationConfig,
  provideZoneChangeDetection,
  isDevMode,
} from '@angular/core';

// Router setup with module preloading for faster lazy-loaded route access
import {
  provideRouter,
  withPreloading,
  PreloadAllModules
} from '@angular/router';

// Choose URL strategy: Path-based (default) or Hash-based
import {
  HashLocationStrategy,
  LocationStrategy,
  PathLocationStrategy,
} from '@angular/common';

// HTTP client with Fetch API support (needed for SSR hydration)
import {
  provideHttpClient,
  withFetch
} from '@angular/common/http';

// Enables Angular client-side hydration with event replay (for SSR)
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';

// Material date formats and locale support
import {
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
  DateAdapter,
  MatDateFormats,
} from '@angular/material/core';

// Moment.js adapter for Angular Material DatePicker
import {
  MomentDateAdapter,
  MAT_MOMENT_DATE_ADAPTER_OPTIONS,
} from '@angular/material-moment-adapter';

// Enable Angular animations (required by many Angular Material components)
import { provideAnimations } from '@angular/platform-browser/animations';

// Global default options for Angular Material Dialogs
import { MAT_DIALOG_DEFAULT_OPTIONS } from '@angular/material/dialog';

// Application route configuration
import { routes } from './app.routes';

// Google Charts support
import { provideGoogleCharts } from 'angular-google-charts';

// Required for Angular Universal Server-Side Rendering (SSR)
import { provideServerRendering } from '@angular/ssr';

// Custom date format for DatePicker (DD/MM/YYYY style)
export const MY_DATE_FORMATS: MatDateFormats = {
  parse: {
    dateInput: 'DD/MM/YYYY',
  },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMM YYYY',
    dateA11yLabel: 'DD/MM/YYYY',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

// Main Angular standalone application configuration
export const appConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(), // Enables SSR support
    provideClientHydration( withEventReplay() ), // Enables hydration + replays events like clicks that occurred before hydration completes
    provideGoogleCharts(), // Registers Google Charts globally
    provideHttpClient( withFetch() ), // HTTP client using Fetch API (for SSR compatibility)
    provideAnimations(), // Enables browser animations
    provideZoneChangeDetection( { eventCoalescing: true } ), // Optimizes change detection by reducing event triggers
    provideRouter(
      routes,
      withPreloading( PreloadAllModules ) // Preload all lazy-loaded routes after app load for better UX
    ),
    { provide: LocationStrategy, useClass: PathLocationStrategy }, // Use standard path URLs (e.g., /home), can switch to HashLocationStrategy if needed
    { provide: MAT_DATE_LOCALE, useValue: 'en-GB' }, // Set Material date locale to British format
    {
      provide: DateAdapter,
      useClass: MomentDateAdapter,
      deps: [ MAT_DATE_LOCALE, MAT_MOMENT_DATE_ADAPTER_OPTIONS ], // Use Moment.js as the date adapter
    },
    {
      provide: MAT_DATE_FORMATS,
      useValue: MY_DATE_FORMATS, // Custom date format definitions
    },
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: {
        hasBackdrop: true,
        autoFocus: true, // Default behavior for Material Dialogs
      },
    },
  ],
};
