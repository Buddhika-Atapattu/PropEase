import {Injectable} from '@angular/core';
import {HttpEvent, HttpHandler, HttpInterceptor, HttpRequest} from '@angular/common/http';
import {Observable} from 'rxjs';

@Injectable({providedIn: 'root'})
export class AuthInspectorService implements HttpInterceptor {
  get token(): string | null {
    return localStorage.getItem('JWT'); // wherever you store the login token
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const t = this.token;
    if(!t) return next.handle(req);
    const authed = req.clone({setHeaders: {Authorization: `Bearer ${t}`}});
    return next.handle(authed);
  }
}
