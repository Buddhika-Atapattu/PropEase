// Path: src/app/services/imageService/image.service.ts
import {Inject, Injectable, PLATFORM_ID} from '@angular/core';
import {isPlatformBrowser} from '@angular/common';
import {HttpClient, HttpHeaders, HttpResponse} from '@angular/common/http';
import {firstValueFrom} from 'rxjs';
import {environment} from '../../../environments/environment';

export interface ImageMetadata {
  /** File name or last path segment for URLs */
  name: string;
  /** File size in bytes, or 0 when unknown (for URLs) */
  size: number;
  /** MIME type such as "image/jpeg" when known */
  mimeType: string | null;
  /** Natural pixel width of the image; 0 if unknown (SSR / failure) */
  width: number;
  /** Natural pixel height of the image; 0 if unknown (SSR / failure) */
  height: number;
  /** "file" when built from File object, "url" when loaded from remote URL */
  sourceType: 'file' | 'url';
  /** Original URL when sourceType === 'url', otherwise null */
  url: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class ImageService {

  /**
   * Root origin of the backend API, for example:
   *   http://localhost:3000
   *   https://api.propease.com
   * This is used to build full URLs to the /uploads folder.
   */
  private readonly backendRoot: string = environment.apiOrigin;

  /**
   * List of MIME types our app treats as "supported image types".
   * Extend this array if you add WebP, AVIF, etc.
   */
  private readonly supportedMimeTypes: ReadonlyArray<string> = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ];

  /**
   * Allowed file extensions (lowercased, without dot).
   * Used for quick checks on URLs and file names.
   */
  private readonly supportedExtensions: ReadonlyArray<string> = [
    'jpg',
    'jpeg',
    'png',
    'gif',
    'webp',
    'svg'
  ];

  /**
   * Flag to indicate if we are running in a real browser.
   * Must be true before we touch DOM APIs such as Image, URL.createObjectURL, etc.
   */
  private readonly isBrowser: boolean;

  constructor (
    @Inject(PLATFORM_ID) platformId: Object,
    private readonly http: HttpClient
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  public async universalImageCheck(input: unknown): Promise<boolean> {
    try {
      // 1) Make sure input is a string
      if(typeof input !== 'string') {
        throw new Error('Invalid image URL type!');
      }

      const safeUrl: string = input.trim();
      if(!safeUrl) {
        throw new Error('Invalid image URL!');
      }

      // 2) We use a union type so it can hold both HEAD and GET responses safely
      let response: HttpResponse<void> | HttpResponse<Blob>;

      try {
        // First try: HEAD (cheap, no body)
        response = await firstValueFrom(
          this.http.head<void>(safeUrl, {
            observe: 'response'
          })
        );
      } catch(headErr) {
        console.warn('HEAD request failed, trying GET blob fallback:', headErr);

        // Fallback: GET with blob body
        response = await firstValueFrom(
          this.http.get(safeUrl, {
            observe: 'response',
            responseType: 'blob'
          })
        );
      }

      if(!response.ok) {
        throw new Error('Failed to fetch image data!');
      }

      const headers: HttpHeaders = response.headers;
      const contentType: string | null = headers.get('Content-Type');

      // 3) If Content-Type header is present, use it
      if(contentType && this.isSupportedMimeType(contentType)) {
        return true;
      }

      // 4) If we used GET blob fallback, we may also have MIME type on the blob itself
      const body: unknown = response.body;
      if(body instanceof Blob && this.isSupportedMimeType(body.type)) {
        return true;
      }

      throw new Error('Invalid content type!');
    }
    catch(err) {
      console.error('universalImageCheck error:', err);
      return false;
    }
  }


  private buildBackendUrlIfNeeded(raw: string): string {
    const trimmed = raw.trim();

    // Already a full URL → return as-is
    if(trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }

    // Relative backend uploads path
    if(trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/')) {
      const backendRoot = this.backendRoot.replace(/\/+$/, '');
      const normalized = trimmed.startsWith('/')
        ? trimmed.substring(1)
        : trimmed;
      return `${backendRoot}/${normalized}`;
    }

    return trimmed; // Not modified
  }



  // ───────────────────────────────────────────────
  // 1) BASIC TYPE / EXTENSION CHECKS
  // ───────────────────────────────────────────────

  /**
   * Check whether a given MIME type is a supported image type.
   * Example: "image/jpeg", "image/png".
   */
  public isSupportedMimeType(mimeType: string | null | undefined): boolean {
    if(!mimeType) {
      return false;
    }
    const safeMime: string = mimeType.toLowerCase().trim();
    return this.supportedMimeTypes.includes(safeMime);
  }

  /**
   * Check whether the file name has an allowed image extension.
   */
  public isSupportedExtension(fileName: string | null | undefined): boolean {
    if(!fileName) {
      return false;
    }
    const extension: string | null = this.getExtension(fileName);
    if(!extension) {
      return false;
    }
    return this.supportedExtensions.includes(extension);
  }

  /**
   * True when the provided File object looks like a real, supported image file.
   * - non-empty
   * - file.type is a supported image MIME or file name uses a supported extension
   */
  public isValidImageFile(file: File | null | undefined): boolean {
    if(!file) {
      return false;
    }

    const hasSize: boolean = typeof file.size === 'number' && file.size > 0;
    const mimeOk: boolean = this.isSupportedMimeType(file.type);
    const extOk: boolean = this.isSupportedExtension(file.name);

    // We accept either a known image MIME type or a supported extension.
    return hasSize && (mimeOk || extOk);
  }

  // ───────────────────────────────────────────────
  // 2) URL FORMAT CHECKS
  // ───────────────────────────────────────────────

  /**
   * Check if a string is a syntactically valid URL.
   * Uses the native URL constructor (when available).
   */
  public isValidUrl(candidate: string | null | undefined): boolean {
    if(!candidate) {
      return false;
    }
    const value: string = candidate.trim();
    if(!value) {
      return false;
    }

    try {
      // Handles normal URLs: http://localhost:3000, https://example.com/img.png, etc.
      // eslint-disable-next-line no-new
      new URL(value);
      return true;
    } catch {
      // Fallback for dev URLs like "localhost:3000" (no protocol)
      if(this.looksLikeLocalHostWithoutProtocol(value)) {
        try {
          // Try with "http://" prefixed
          // eslint-disable-next-line no-new
          new URL(`http://${value}`);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  /**
   * Detect values that look like "localhost:3000" or "127.0.0.1:3000"
   * but are missing the protocol.
   */
  private looksLikeLocalHostWithoutProtocol(value: string): boolean {
    const lowered: string = value.toLowerCase();

    if(lowered.startsWith('localhost:')) {
      return true;
    }
    if(lowered.startsWith('127.0.0.1:')) {
      return true;
    }
    if(lowered.startsWith('::1')) {
      return true;
    }
    return false;
  }

  /**
   * More relaxed check that works with:
   * - full URLs  (http://localhost:3000/uploads/..../image.webp)
   * - protocol-less dev URLs (localhost:3000/uploads/.../image.png)
   * - relative paths (/uploads/.../image.jpg or uploads/image.jpg)
   *
   * It ONLY cares about "has a supported image extension".
   */
  public isLikelyImagePathOrUrl(candidate: string | null | undefined): boolean {
    if(!candidate) {
      return false;
    }
    const value: string = candidate.trim();
    if(!value) {
      return false;
    }

    const extension: string | null = this.getExtension(value);
    if(!extension) {
      return false;
    }
    return this.supportedExtensions.includes(extension);
  }

  /**
   * Check whether a URL "looks like" an image URL:
   * - valid URL format (or allowed localhost)
   * - has a supported image extension at the end
   * This does NOT guarantee that the remote server actually returns an image,
   * but it is a useful quick check.
   */
  public isLikelyImageUrl(candidate: string | null | undefined): boolean {
    if(!candidate) {
      return false;
    }

    const value: string = candidate.trim();

    // Allow localhost URLs without strict URL() validation
    if(this.isLocalhostUrl(value)) {
      const extLocal: string | null = this.getExtension(value);
      return !!extLocal && this.supportedExtensions.includes(extLocal);
    }

    // Fallback for normal URLs
    try {
      // eslint-disable-next-line no-new
      new URL(value);
    } catch {
      return false;
    }

    const extension: string | null = this.getExtension(value);
    return !!extension && this.supportedExtensions.includes(extension);
  }

  /**
   * Returns true when the given string clearly points into the backend
   * /uploads root. It supports:
   * - Full URLs:  http://localhost:3000/uploads/...
   * - Relative:   /uploads/...  or  uploads/...
   */
  public isBackendUploadsUrl(candidate: string | null | undefined): boolean {
    if(!candidate) {
      return false;
    }

    const value: string = candidate.trim();
    if(!value) {
      return false;
    }

    // Normalize backend root without trailing slash
    const backendRootSafe: string = this.backendRoot.replace(/\/+$/, '');

    if(value.startsWith(backendRootSafe + '/uploads/')) {
      return true;
    }
    if(value.startsWith('/uploads/') || value.startsWith('uploads/')) {
      return true;
    }
    return false;
  }

  // ───────────────────────────────────────────────
  // 3) RUNTIME CHECKS (LOAD IMAGE IN BROWSER)
  // ───────────────────────────────────────────────

  /**
   * Try to load a remote image and resolve true/false.
   * - true  => image loaded successfully within timeout
   * - false => failed to load, invalid URL, CORS blocked, or not running in browser
   *
   * NOTE: This method trusts the browser <img> implementation, so it works with:
   * - absolute URLs
   * - relative paths
   * - localhost + backend uploads paths
   */
  public async canLoadImageFromUrl(
    url: string,
    timeoutMs: number = 8000
  ): Promise<boolean> {
    if(!this.isBrowser) {
      // In SSR / Node / Electron main, we cannot create an Image element.
      return false;
    }

    const safeUrl: string = (url || '').trim();
    if(!safeUrl) {
      return false;
    }

    try {
      await this.createImageElement(safeUrl, timeoutMs);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Load a remote image and return its metadata (width, height, etc.).
   * Throws an error when:
   * - not running in a browser
   * - URL is invalid or looks unsupported
   * - image fails to load or times out
   */
  public async getImageMetadataFromUrl(
    url: string,
    timeoutMs: number = 8000
  ): Promise<ImageMetadata> {
    if(!this.isBrowser) {
      throw new Error('Image loading from URL is only available in the browser.');
    }

    const safeUrl: string = url.trim();
    if(!this.isValidUrl(safeUrl) && !this.isBackendUploadsUrl(safeUrl)) {
      throw new Error('Invalid image URL.');
    }

    // Optional: Reject early if URL extension clearly unsupported.
    if(!this.isLikelyImagePathOrUrl(safeUrl)) {
      throw new Error('Unsupported image URL extension.');
    }

    const imageEl: HTMLImageElement = await this.createImageElement(safeUrl, timeoutMs);

    const lastSegment: string = this.extractNameFromUrl(safeUrl);

    const metadata: ImageMetadata = {
      name: lastSegment,
      size: 0, // We do not know the size from <img> alone
      mimeType: imageEl.currentSrc ? this.guessMimeFromExtension(lastSegment) : null,
      width: imageEl.naturalWidth || 0,
      height: imageEl.naturalHeight || 0,
      sourceType: 'url',
      url: safeUrl
    };

    return metadata;
  }

  // ───────────────────────────────────────────────
  // 3b) NEW: BACKEND HEADER PROBE FOR /uploads
  // ───────────────────────────────────────────────

  /**
   * Build a full backend URL to the uploads folder, from:
   * - full URLs   → returned as-is
   * - "/uploads/..." or "uploads/..." → prefixed with backendRoot
   *
   * Example:
   *   backendRoot: http://localhost:3000
   *   path:        /uploads/properties/..../image.webp
   *   result:      http://localhost:3000/uploads/properties/..../image.webp
   */
  private buildBackendUploadsUrl(pathOrUrl: string): string {
    const raw: string = (pathOrUrl || '').trim();

    if(!raw) {
      return this.backendRoot.replace(/\/+$/, '');
    }

    // If already an absolute URL, just return it.
    if(raw.startsWith('http://') || raw.startsWith('https://')) {
      return raw;
    }

    const backendRootSafe: string = this.backendRoot.replace(/\/+$/, '');

    // Normalize leading slash on the path
    const normalizedPath: string = raw.startsWith('/') ? raw.substring(1) : raw;

    return `${backendRootSafe}/${normalizedPath}`;
  }

  /**
   * PUBLIC METHOD YOU ASKED FOR:
   * Send a HEAD request to the backend uploads URL and retrieve headers.
   *
   * It is "registered" only for backend uploads in the sense that:
   * - It always builds the final URL under environment.apiOrigin
   * - You can pass either a full URL or a "/uploads/..." path
   *
   * Usage:
   *   const info = await imageService.getBackendImageHeaders(
   *     '/uploads/properties/PROP-.../image.webp'
   *   );
   *
   *   if (info.ok && imageService.isSupportedMimeType(info.contentType)) { ... }
   */
  public async getBackendImageHeaders(
    pathOrUrl: string
  ): Promise<{
    ok: boolean;
    url: string;
    contentType: string | null;
    contentLength: number | null;
    headers: HttpHeaders | null;
  }> {
    const targetUrl: string = this.buildBackendUploadsUrl(pathOrUrl);

    try {
      const response: HttpResponse<void> = await firstValueFrom(
        this.http.head<void>(targetUrl, {
          observe: 'response'
        })
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

      return {
        ok: response.ok,
        url: targetUrl,
        contentType,
        contentLength,
        headers
      };
    } catch(err) {
      console.error('Failed to fetch image headers from backend uploads root:', err);
      return {
        ok: false,
        url: targetUrl,
        contentType: null,
        contentLength: null,
        headers: null
      };
    }
  }

  // ───────────────────────────────────────────────
  // 4) FILE → METADATA (FROM <input type="file">)
  // ───────────────────────────────────────────────

  /**
   * Create metadata from a File.
   * In the browser we also read width/height by loading the file via an object URL.
   * On SSR / non-browser, width/height will be 0.
   */
  public async getImageMetadataFromFile(file: File): Promise<ImageMetadata> {
    if(!this.isValidImageFile(file)) {
      throw new Error('Unsupported or invalid image file.');
    }

    // SSR-safe: when not in browser, skip DOM-based width/height detection.
    if(!this.isBrowser) {
      const fallback: ImageMetadata = {
        name: file.name,
        size: file.size,
        mimeType: file.type || null,
        width: 0,
        height: 0,
        sourceType: 'file',
        url: null
      };
      return fallback;
    }

    // Browser path: create an object URL and load it into an Image element.
    const objectUrl: string = window.URL.createObjectURL(file);

    try {
      const imageEl: HTMLImageElement = await this.createImageElement(objectUrl, 8000);

      const metadata: ImageMetadata = {
        name: file.name,
        size: file.size,
        mimeType: file.type || null,
        width: imageEl.naturalWidth || 0,
        height: imageEl.naturalHeight || 0,
        sourceType: 'file',
        url: null
      };

      return metadata;
    } finally {
      // Always revoke object URL to avoid memory leaks.
      window.URL.revokeObjectURL(objectUrl);
    }
  }

  // ───────────────────────────────────────────────
  // 5) PRIVATE HELPERS
  // ───────────────────────────────────────────────

  /**
   * Create and load an <img> element pointing to the given URL and resolve
   * once it either loads successfully or reject on error/timeout.
   */
  private createImageElement(
    src: string,
    timeoutMs: number
  ): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      if(!this.isBrowser) {
        reject(new Error('Not running in a browser environment.'));
        return;
      }

      const img: HTMLImageElement = new Image();
      let timeoutHandle: number | undefined;

      const clearAll = (): void => {
        if(typeof timeoutHandle === 'number') {
          window.clearTimeout(timeoutHandle);
        }
        // Clean up handlers to avoid leaks.
        img.onload = null;
        img.onerror = null;
      };

      img.onload = (): void => {
        clearAll();
        resolve(img);
      };

      img.onerror = (): void => {
        clearAll();
        reject(new Error('Image failed to load.'));
      };

      timeoutHandle = window.setTimeout(() => {
        clearAll();
        reject(new Error('Image load timed out.'));
      }, timeoutMs);

      img.src = src;
    });
  }

  /**
   * Get the lowercased extension without the dot from a file name or URL:
   * "photo.JPG" → "jpg"
   * "https://example.com/img.png?x=1" → "png"
   */
  private getExtension(path: string): string | null {
    if(!path) {
      return null;
    }

    // Strip query string and hash (#) fragments.
    const cleaned: string = path.split('#')[0].split('?')[0];

    const lastDotIndex: number = cleaned.lastIndexOf('.');
    if(lastDotIndex < 0 || lastDotIndex === cleaned.length - 1) {
      return null;
    }

    const ext: string = cleaned.substring(lastDotIndex + 1).toLowerCase().trim();
    return ext || null;
  }

  /**
   * Extract the "file name" part from a URL for display/metadata.
   * Example:
   *   https://example.com/images/avatar.png?x=1 → "avatar.png"
   */
  private extractNameFromUrl(url: string): string {
    try {
      const parsed: URL = new URL(url);
      const path: string = parsed.pathname || '';
      const segments: string[] = path.split('/').filter((segment) => segment.length > 0);
      if(segments.length === 0) {
        return url;
      }
      return segments[segments.length - 1];
    } catch {
      // Fallback: if URL parsing fails for some reason, return the original string.
      return url;
    }
  }

  /**
   * Best-effort guess of MIME type from a file name or URL.
   * This is only used as a helper when we do not have an explicit Content-Type header.
   */
  private guessMimeFromExtension(nameOrPath: string): string | null {
    const ext: string | null = this.getExtension(nameOrPath);
    if(!ext) {
      return null;
    }

    switch(ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'svg':
        return 'image/svg+xml';
      default:
        return null;
    }
  }

  private isLocalhostUrl(url: string): boolean {
    return url.startsWith('http://localhost') ||
      url.startsWith('http://127.0.0.1') ||
      url.startsWith('http://::1');
  }
}
