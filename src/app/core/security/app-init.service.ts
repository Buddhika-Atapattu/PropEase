// Path: src/app/core/app-init.service.ts
import { Injectable } from '@angular/core';
import { AccessControlService } from './access-control.service';
import type { UserSafeDto } from '../../services/auth/user.contract';

@Injectable({ providedIn: 'root' })
export class AppInitService {
  constructor(private readonly access: AccessControlService) {}

  public init(): void {
    const raw = localStorage.getItem('loggedUser');
    if (!raw) return;

    const user = JSON.parse( raw ) as UserSafeDto;
    this.access.setUser(user);
  }
}
