// Path: src/app/interceptors/auth-header.interceptor.ts

import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from '@angular/common/http';
import { Observable } from 'rxjs';

import { HeaderContextService } from '../services/security/header-context.service';
import { environment } from '../../environments/environment';

@Injectable()
export class AuthHeaderInterceptor implements HttpInterceptor {
  constructor (
    private readonly headerContext: HeaderContextService
  ) {}

  intercept( req: HttpRequest<unknown>, next: HttpHandler ): Observable<HttpEvent<unknown>> {
    // Optionally restrict to your API origin
    const apiOrigin = ( environment.apiOrigin ?? 'http://localhost:3000' ).replace( /\/+$/, '' );
    if ( !req.url.startsWith( apiOrigin ) ) {
      return next.handle( req );
    }

    const headers = this.headerContext.buildAuthHeaders();

    // If no headers to add → pass through
    if ( Object.keys( headers ).length === 0 ) {
      return next.handle( req );
    }

    const cloned = req.clone( { setHeaders: headers } );
    return next.handle( cloned );
  }
}
