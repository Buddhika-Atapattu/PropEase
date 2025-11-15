// src/app/services/comments/attachment-downloader.service.ts
import {Injectable} from '@angular/core';
import {HttpClient, HttpEvent, HttpEventType, HttpHeaders} from '@angular/common/http';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';

export interface DownloadProgress {
  state: 'progress' | 'done';
  loaded?: number;
  total?: number;
  percent?: number;     // 0..100
  blob?: Blob;          // only when state === 'done'
  filename?: string;    // parsed from headers when available
}

@Injectable({providedIn: 'root'})
export class AttachmentDownloaderService {
  public constructor (private readonly http: HttpClient) {}

  public fetch(url: string): Observable<DownloadProgress> {
    return this.http.get(url, {
      responseType: 'blob',
      observe: 'events',
      reportProgress: true,
    }).pipe(
      map((event: HttpEvent<Blob>): DownloadProgress => {
        if(event.type === HttpEventType.DownloadProgress) {
          const percent = event.total ? Math.round((event.loaded / event.total) * 100) : undefined;
          return {state: 'progress', loaded: event.loaded, total: event.total ?? undefined, percent};
        }
        if(event.type === HttpEventType.Response) {
          const disposition = event.headers?.get('Content-Disposition') || '';
          const filename = this.getFileNameFromDisposition(disposition) || this.guessNameFromUrl(url);
          return {state: 'done', blob: event.body as Blob, filename};
        }
        return {state: 'progress'};
      })
    );
  }

  // --- helpers ---
  private getFileNameFromDisposition(dispo: string): string | undefined {
    const match = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(dispo);
    if(!match) return undefined;
    try {return decodeURIComponent(match[1]);} catch {return match[1];}
  }
  private guessNameFromUrl(url: string): string {
    try {
      const u = new URL(url, window.location.origin);
      const last = u.pathname.split('/').filter(Boolean).pop() || 'download';
      return decodeURIComponent(last);
    } catch {
      const parts = url.split('?')[0].split('/');
      return parts[parts.length - 1] || 'download';
    }
  }
}
