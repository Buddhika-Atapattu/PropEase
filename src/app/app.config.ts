// Core Angular features for application config and zone optimization
import {
  ApplicationConfig,
  provideZoneChangeDetection,
} from '@angular/core';

// Router setup with module preloading for faster lazy-loaded route access
import {
  provideRouter,
  withPreloading,
  PreloadAllModules
} from '@angular/router';

// Choose URL strategy: Path-based (default) or Hash-based
import {
  LocationStrategy,
  PathLocationStrategy,
} from '@angular/common';

// HTTP client with Fetch API support
import {
  provideHttpClient,
  withFetch
} from '@angular/common/http';

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

// Main Angular standalone application configuration
export const appConfig: ApplicationConfig = {
  providers: [
    // ❌ no provideClientHydration here (done conditionally in main.ts)
    provideGoogleCharts(),
    provideHttpClient(withFetch()),
    provideAnimations(),
    provideZoneChangeDetection({eventCoalescing: true}),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    {provide: LocationStrategy, useClass: PathLocationStrategy},
    {provide: MAT_DATE_LOCALE, useValue: 'en-GB'},
    {
      provide: DateAdapter,
      useClass: MomentDateAdapter,
      deps: [MAT_DATE_LOCALE, MAT_MOMENT_DATE_ADAPTER_OPTIONS],
    },
    {provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS},
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: {hasBackdrop: true, autoFocus: true},
    },
  ],
};
