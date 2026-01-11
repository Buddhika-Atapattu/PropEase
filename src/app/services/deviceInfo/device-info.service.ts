// Path: src/app/services/deviceInfo/device-info.service.ts

import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export type DeviceType =
  | 'electron-desktop'
  | 'web-desktop'
  | 'web-mobile';

@Injectable({ providedIn: 'root' })
export class DeviceInfoService {

  private readonly DEVICE_ID_KEY = 'propease_device_id';

  constructor() {}

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------

  /** Return persistent unique device ID (stored once per installation). */
  public getDeviceId(): string {
    let id = localStorage.getItem(this.DEVICE_ID_KEY);

    if (!id) {
      id = this.generateDeviceId();
      localStorage.setItem(this.DEVICE_ID_KEY, id);
    }

    return id;
  }

  /** Return normalized device type (electron, mobile, desktop). */
  public getDeviceType(): DeviceType {
    if (this.isElectron()) return 'electron-desktop';
    if (this.isMobile()) return 'web-mobile';
    return 'web-desktop';
  }

  /** True if running inside Electron renderer. */
  public isElectron(): boolean {
    // build-time flag from environment.electron.ts
    if (environment.electron === true) {
      return true;
    }

    // runtime checks
    try {
      const w = window as any;

      if (w.process?.type === 'renderer') return true;

      const ua = (navigator.userAgent || '').toLowerCase();
      if (ua.includes('electron')) return true;

      if (typeof w.require === 'function') {
        try {
          const el = w.require('electron');
          if (el) return true;
        } catch {}
      }
    } catch {}

    return false;
  }

  /** Detect mobile browsers. */
  public isMobile(): boolean {
    try {
      const ua = navigator.userAgent || '';
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        ua,
      );
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  /** Generate a cryptographically strong unique ID. */
  private generateDeviceId(): string {
    // strong random ID
    const randomPart = crypto.getRandomValues(new Uint8Array(16));
    const hex = Array.from(randomPart)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // prefix helps future debugging
    const prefix = this.isElectron()
      ? 'el'
      : this.isMobile()
      ? 'mb'
      : 'wb';

    return `${prefix}-${hex}`;
  }
}
