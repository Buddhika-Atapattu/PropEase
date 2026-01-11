import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { ImageService, type ImageMetadata } from '../imageService/image.service';
import type { FileKind } from '../../components/shared/dropdown/dropdown';

export interface FileMetadataBase {
  name: string;
  size: number;                 // bytes (0 if unknown)
  mimeType: string | null;
  kind: FileKind;
  sourceType: 'file' | 'url';
  url: string | null;
}

export interface FileMetadata extends FileMetadataBase {
  width: number;                // 0 if not image / unknown
  height: number;               // 0 if not image / unknown
}

@Injectable({ providedIn: 'root' })
export class FileMetadataService {
  private readonly isBrowser: boolean;

  public constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    private readonly http: HttpClient,
    private readonly imageService: ImageService
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  // ---------------------------------------------
  // PUBLIC: Build metadata from File
  // ---------------------------------------------
  public async fromFile(file: File): Promise<FileMetadata> {
    const name: string = file?.name ? String(file.name) : 'unknown';
    const mimeType: string | null = file?.type ? String(file.type) : null;
    const size: number = typeof file?.size === 'number' ? file.size : 0;

    const kind: FileKind = this.kindFrom(mimeType, name);

    // Image: reuse your ImageService (gets width/height safely)
    if (kind === 'image') {
      try {
        const img: ImageMetadata = await this.imageService.getImageMetadataFromFile(file);
        return {
          name: img.name,
          size: img.size,
          mimeType: img.mimeType,
          width: img.width,
          height: img.height,
          kind,
          sourceType: 'file',
          url: null
        };
      } catch {
        // fallback (still valid)
        return {
          name,
          size,
          mimeType,
          width: 0,
          height: 0,
          kind,
          sourceType: 'file',
          url: null
        };
      }
    }

    // Non-image
    return {
      name,
      size,
      mimeType,
      width: 0,
      height: 0,
      kind,
      sourceType: 'file',
      url: null
    };
  }

  // ---------------------------------------------
  // PUBLIC: Build metadata from URL/path
  // ---------------------------------------------
  public async fromUrl(url: string): Promise<FileMetadata> {
    const safeUrl: string = String(url ?? '').trim();
    const name: string = this.extractNameFromUrl(safeUrl);

    // If it looks like an image URL, prefer ImageService (width/height)
    if (this.imageService.isLikelyImagePathOrUrl(safeUrl)) {
      try {
        const img: ImageMetadata = await this.imageService.getImageMetadataFromUrl(safeUrl);
        return {
          name: img.name,
          size: img.size,
          mimeType: img.mimeType,
          width: img.width,
          height: img.height,
          kind: 'image',
          sourceType: 'url',
          url: safeUrl
        };
      } catch {
        // fall through to HEAD probe
      }
    }

    // HEAD probe for content-type & length (best-effort)
    const head = await this.headProbe(safeUrl);

    const mimeType: string | null = head.contentType;
    const size: number = head.contentLength ?? 0;
    const kind: FileKind = this.kindFrom(mimeType, name);

    return {
      name,
      size,
      mimeType,
      width: 0,
      height: 0,
      kind,
      sourceType: 'url',
      url: safeUrl
    };
  }

  // ---------------------------------------------
  // PRIVATE: HEAD probe
  // ---------------------------------------------
  private async headProbe(url: string): Promise<{
    ok: boolean;
    contentType: string | null;
    contentLength: number | null;
    headers: HttpHeaders | null;
  }> {
    const safeUrl: string = String(url ?? '').trim();
    if (!safeUrl) {
      return { ok: false, contentType: null, contentLength: null, headers: null };
    }

    try {
      const response: HttpResponse<void> = await firstValueFrom(
        this.http.head<void>(safeUrl, { observe: 'response' })
      );

      const headers: HttpHeaders = response.headers;
      const contentType: string | null = headers.get('Content-Type');

      const contentLengthHeader: string | null = headers.get('Content-Length');
      const contentLength: number | null =
        contentLengthHeader !== null &&
        contentLengthHeader.trim() !== '' &&
        !isNaN(Number(contentLengthHeader))
          ? Number(contentLengthHeader)
          : null;

      return { ok: response.ok, contentType, contentLength, headers };
    } catch {
      return { ok: false, contentType: null, contentLength: null, headers: null };
    }
  }

  // ---------------------------------------------
  // PRIVATE: kind detection
  // ---------------------------------------------
  private kindFrom(mimeType: string | null, name: string): FileKind {
    const t: string = (mimeType ?? '').toLowerCase();
    const n: string = (name ?? '').toLowerCase();

    if (t.startsWith('image/')) return 'image';
    if (t === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
    if (t.startsWith('text/') || t === 'application/json' || t === 'application/xml' || /\.(txt|log|md|json|xml)$/i.test(n)) return 'text';
    if (t.includes('csv') || /\.(csv|tsv)$/i.test(n)) return 'csv';
    if (t.startsWith('audio/') || /\.(mp3|wav|m4a|ogg)$/i.test(n)) return 'audio';
    if (t.startsWith('video/') || /\.(mp4|webm|ogv)$/i.test(n)) return 'video';

    // extension fallback
    if (this.imageService.isSupportedExtension(n)) return 'image';
    return 'unsupported';
  }

  private extractNameFromUrl(url: string): string {
    const raw: string = String(url ?? '').trim();
    if (!raw) return 'unknown';

    try {
      const parsed: URL = new URL(raw);
      const segs: string[] = (parsed.pathname || '').split('/').filter(Boolean);
      return segs.length ? segs[segs.length - 1] : raw;
    } catch {
      // also works for "/uploads/..../file.pdf"
      const cleaned: string = raw.split('#')[0].split('?')[0];
      const segs: string[] = cleaned.split('/').filter(Boolean);
      return segs.length ? segs[segs.length - 1] : cleaned;
    }
  }
}
