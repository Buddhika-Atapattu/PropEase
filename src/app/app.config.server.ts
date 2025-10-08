import {provideServerRendering, withRoutes} from '@angular/ssr';
import {mergeApplicationConfig, ApplicationConfig} from '@angular/core';
import {appConfig} from './app.config';
import {serverRoutes} from './app.routes.server';
import { provideClientHydration } from '@angular/platform-browser';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    provideClientHydration(),
  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
