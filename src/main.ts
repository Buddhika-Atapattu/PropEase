/// <reference types="@angular/localize" />

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { destroyPlatform } from '@angular/core';

// 🛡 Fix: Destroy previous platform instance if it exists (for Vite HMR safety)
try {
  destroyPlatform();
} catch (err) {
  // It's okay if no platform exists yet
}

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

    // Register custom service worker
    if (
      'serviceWorker' in navigator &&
      (location.protocol === 'https:' || location.hostname === 'localhost')
    ) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('✅ Custom Service Worker registered:', registration);
        })
        .catch((error) => {
          console.error('❌ Custom Service Worker registration failed:', error);
        });
    }
  })
  .catch((err) => console.error(err));
