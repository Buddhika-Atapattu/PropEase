// google-charts.provider.ts
import { importProvidersFrom } from '@angular/core';
import { GoogleChartsModule } from 'angular-google-charts';

export const provideGoogleCharts = () =>
  importProvidersFrom(GoogleChartsModule);
