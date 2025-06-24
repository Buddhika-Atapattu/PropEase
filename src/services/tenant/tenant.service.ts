import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface TenantTableElement {
  username?: string;
  name: string;
  image: string | File | undefined;
  contactNumber: string | undefined;
  email: string;
  gender: string;
  addedBy?: string;
}

export interface ActionButtonType {
  type: 'add' | 'delete' | 'remove' | 'view';
}

export interface CustomTableColumn {
  key: string;
  label: string;
}

@Injectable({
  providedIn: 'root',
})
export class TenantService {
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  public isTenantArray(
    data: TenantTableElement[]
  ): data is TenantTableElement[] {
    return (
      Array.isArray(data) &&
      data.every(
        (item) =>
          typeof item.username === 'string' &&
          typeof item.name === 'string' &&
          typeof item.email === 'string' &&
          typeof item.image === 'string' &&
          typeof item.contactNumber === 'string' &&
          typeof item.gender === 'string' &&
          typeof item.addedBy === 'string'
      )
    );
  }
}
