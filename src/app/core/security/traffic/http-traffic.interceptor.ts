// Path: src/app/core/security/traffic/http-traffic.interceptor.ts

import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { TrafficMonitorService } from './traffic-monitor.service';

@Injectable()
export class HttpTrafficInterceptor implements HttpInterceptor {
  public constructor(private readonly traffic: TrafficMonitorService) {}

  public intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const startedAt: number = Date.now();

    return next.handle(req).pipe(
      tap({
        next: (event: HttpEvent<any>) => {
          if (event instanceof HttpResponse) {
            this.traffic.push({
              atMs: Date.now(),
              method: req.method,
              url: req.urlWithParams,
              status: event.status,
              durationMs: Date.now() - startedAt,
              ok: true,
            });
          }
        },
        error: (err: unknown) => {
          const httpErr: HttpErrorResponse | null =
            err instanceof HttpErrorResponse ? err : null;

          this.traffic.push({
            atMs: Date.now(),
            method: req.method,
            url: req.urlWithParams,
            status: Number(httpErr?.status || 0),
            durationMs: Date.now() - startedAt,
            ok: false,
          });

          console.error('[Error:] [Traffic] HTTP request failed.\n', err);
        },
      }),
    );
  }
}
