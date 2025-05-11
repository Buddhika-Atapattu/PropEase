import { Injectable } from '@angular/core';
import { Router, NavigationStart, UrlTree } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class UrlControllerService {
  constructor(private router: Router, private authService: AuthService) {}
}
