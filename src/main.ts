/// <reference types="@angular/localize" />

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig)
  .then(() => {
    // Hide the preloader when the app is ready
    const preloader = document.getElementById('app-preloader');
    if (preloader) {
      preloader.style.transition = 'opacity 0.5s ease-out';
      preloader.style.opacity = '0';
      setTimeout(() => {
        preloader.remove();
      }, 500);
    }
  })
  .catch((err) => console.error(err));
