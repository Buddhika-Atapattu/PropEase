// Path: src/app/service/downloadService/download.service.ts
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

interface ElectronAPI {
  downloadFile?: (payload: { url: string; fileName: string }) => void;
  saveFileFromBytes?: (payload: { fileName: string; bytes: number[] }) => void;
}

// Extend window type (just inside this file)
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

@Injectable({ providedIn: 'root' })
export class DownloadService {
  private readonly isBrowser: boolean;
  private readonly isElectron: boolean;

  public constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.isElectron = this.isBrowser && !!window.electronAPI;
  }

  // 1) Simple URL download (works for both)
  public async downloadFromUrl(url: string, fileName: string): Promise<void> {
    if (!this.isBrowser) {
      return;
    }

    if (this.isElectron && window.electronAPI?.downloadFile) {
      // Let Electron main process handle save dialog + disk write
      window.electronAPI.downloadFile({ url, fileName });
      return;
    }

    // Browser behaviour (no Electron)
    const anchor: HTMLAnchorElement = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.target = '_blank';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  // 2) Blob download (e.g. from HTTP API) – converts to URL in web, bytes in Electron
  public async downloadFromBlob(blob: Blob, fileName: string): Promise<void> {
    if (!this.isBrowser) {
      return;
    }

    if (this.isElectron && window.electronAPI?.saveFileFromBytes) {
      const arrayBuffer: ArrayBuffer = await blob.arrayBuffer();
      const bytes: number[] = Array.from(new Uint8Array(arrayBuffer));
      window.electronAPI.saveFileFromBytes({ fileName, bytes });
      return;
    }

    // Browser-only path
    const url: string = URL.createObjectURL(blob);
    await this.downloadFromUrl(url, fileName);
    URL.revokeObjectURL(url);
  }
}
