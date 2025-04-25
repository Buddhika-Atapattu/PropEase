import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service'; // adjust if needed

export const guardAuth: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isUserLoggedIn()) {
    return true;
  } else {
    router.navigateByUrl('/login', { replaceUrl: true });
    return false;
  }
};
