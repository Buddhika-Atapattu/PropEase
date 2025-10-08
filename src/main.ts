/// <reference types="@angular/localize" />

import {bootstrapApplication} from '@angular/platform-browser';
import {AppComponent} from './app/app.component';
import {appConfig} from './app/app.config';

import {destroyPlatform, mergeApplicationConfig, ApplicationConfig} from '@angular/core';
import {provideClientHydration, withEventReplay} from '@angular/platform-browser';

// HMR safety for Vite/CLI
try {destroyPlatform();} catch { /* no existing platform, ignore */}

// Detect if SSR markup is present (added by Angular Universal on the server)
const HAS_SSR =
  typeof document !== 'undefined' &&
  document.documentElement.hasAttribute('ng-server-context');

// Only request hydration when SSR data exists
const hydrationConfig: ApplicationConfig = HAS_SSR
  ? {providers: [provideClientHydration(withEventReplay())]}
  : {providers: []};

bootstrapApplication(AppComponent, mergeApplicationConfig(appConfig, hydrationConfig))
  .then(() => {
    // Hide the preloader when the app is ready
    const preloader = document.getElementById('app-preloader');
    if(preloader) {
      preloader.style.transition = 'opacity 0.5s ease-out';
      preloader.style.opacity = '0';
      setTimeout(() => preloader.remove(), 500);
    }

    // Register custom service worker
    if(
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
