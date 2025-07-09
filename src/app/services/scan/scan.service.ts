// At the top of the file if still needed
/// <reference path="../../../../types/typings.d.ts" />

import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, Subscription, pipe, take } from 'rxjs';
import * as QRCode from 'qrcode';
import { isPlatformBrowser } from '@angular/common';

export interface DeviceInfo {
  name: string;
  type: 'scanner' | 'mobile';
  connection: 'USB' | 'Bluetooth' | 'WiFi';
  status: 'available' | 'in-use';
}

export interface tokenType {
  token: string;
  uploadUrl: string;
}

export interface ScanMessageReturnType {
  status: string;
  message: string;
  data: any;
}

@Injectable({ providedIn: 'root' })
export class ScanService {
  private apiRootForScanner: string = 'http://localhost:3000/api-qr/';
  private apiRootForTenantToken: string =
    'http://localhost:3000/api-file-transfer/';

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  isBrowser(): boolean {
    return isPlatformBrowser(this.platformId) && !this.isElectron();
  }

  public isElectron(): boolean {
    return (
      typeof window !== 'undefined' && !!(window as any).electron?.getUSBDevices
    );
  }

  public async generateDataUrl(text: string): Promise<string> {
    try {
      return await QRCode.toDataURL(text, {
        errorCorrectionLevel: 'H',
        width: 256,
      });
    } catch (err) {
      console.error('QR Code generation failed:', err);
      return '';
    }
  }

  //<====================== AIPs >
  public async createUploadSession(): Promise<tokenType> {
    return await firstValueFrom(
      this.http.post<tokenType>(`${this.apiRootForScanner}upload-session`, {})
    );
  }
  public async getSessionStatus(token: string): Promise<tokenType> {
    return await firstValueFrom(
      this.http.post<tokenType>(
        `${this.apiRootForScanner}upload-session/${token}`,
        {}
      )
    );
  }

  public async getReasonFileUploadsByTenantUsername(
    tenantUsername: string
  ): Promise<ScanMessageReturnType> {
    return await firstValueFrom(
      this.http.get<ScanMessageReturnType>(
        `${this.apiRootForTenantToken}get-reason-file-uploads-by-tenant-username/${tenantUsername}`
      )
    );
  }
}
