// Path: src/app/services/asset/asset-url.service.ts
import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable( { providedIn: 'root' } )
export class AssetUrlService {
  // Runtime signals
  private readonly isBrowser: boolean;
  private readonly isElectron: boolean;

  // Config from environment
  private readonly apiOrigin: string;    // e.g., http://localhost:3000
  private readonly filesBaseUrl: string; // e.g., http://localhost:3000/uploads/

  public constructor ( @Inject( PLATFORM_ID ) pid: Object ) {
    this.isBrowser = isPlatformBrowser( pid );
    this.isElectron = !!environment.electron;
    this.apiOrigin = ( environment as any )?.apiOrigin ?? '';
    this.filesBaseUrl = ( environment as any )?.filesBaseUrl ?? '';
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC (BUNDLED) ASSETS  — logos, placeholders under top-level /public
  // Option B in angular.json: output:""  => web serves them at "/<file>"
  // Electron keeps "public/<file>" relative.
  // ─────────────────────────────────────────────────────────────

  /** Ensure a bundled asset path resolves correctly for our two targets. */
  public publicAssetUrl( input: string ): string {
    const rel = this.normalizePublicAsset( input );
    return this.prefixPublicForWebKeepRelativeForElectron( rel );
  }

  /** Normalize any given public-asset path to start with "public/..." (for Electron). */
  public normalizePublicAsset( path: string ): string {
    // Normalize developer inputs like "public/Images/..." or "Images/..."
    const raw = ( path || '' ).trim().replace( /^\/+/, '' );
    const withoutPublic = raw.startsWith( 'public/' ) ? raw.slice( 'public/'.length ) : raw;

    if ( this.isBrowser && !this.isElectron ) {
      // Web: absolute origin + flattened path
      const origin = this.apiOrigin.replace( /\/+$/, '' );
      if ( raw.includes( this.apiOrigin ) ) return `${ origin }/${ withoutPublic }`;
      else return withoutPublic;
    }
    // Electron: use flattened relative path
    return withoutPublic; // e.g., "Images/logo.webp"
  }

  /**
   * For web: strip "public/" and prefix with apiOrigin.
   * For Electron: keep "public/..." relative.
   */
  public prefixPublicForWebKeepRelativeForElectron( publicPath: string ): string {
    // Absolute schemes remain untouched
    if ( /^(https?:|data:|blob:|file:)/i.test( publicPath ) ) return publicPath;

    const trimmed = publicPath.replace( /^\/+/, '' );
    if ( this.isBrowser && !this.isElectron ) {
      // Web build: public/Images/foo -> http://host/Images/foo
      const withoutPublic = trimmed.startsWith( 'public/' )
        ? trimmed.slice( 'public/'.length )
        : trimmed;
      const origin = this.apiOrigin.replace( /\/+$/, '' );
      if ( publicPath.includes( this.apiOrigin ) ) return `${ origin }/${ withoutPublic }`;
      else return withoutPublic;
    }
    // Electron: keep "public/..." so it resolves relative to app root
    return trimmed;
  }

  // ─────────────────────────────────────────────────────────────
  // UPLOADS (BACKEND MEDIA) — everything under /uploads/**
  // Works with current five folders and future ones automatically.
  // ─────────────────────────────────────────────────────────────

  /**
   * Normalize any media path to a relative "uploads/..." form.
   * Repairs common variants:
   *   - "public/uploads/..."  -> "uploads/..."
   *   - "/uploads/..."        -> "uploads/..."
   *   - "uploads/..."         -> "uploads/..."
   *   - "<bucket>/..."        -> "uploads/<bucket>/..."  (e.g., users/, tenants/, leases/, properties/, richtext/, future buckets)
   * If absolute (http/https/data/blob/file), returns as-is.
   */
  public normalizeUploadRelative( path: string ): string {
    const raw = ( path || '' ).trim();
    if ( !raw ) return 'uploads/users/unknown/image.webp';

    // Absolute? keep original (caller may still call absoluteMediaUrl which preserves absolute)
    if ( /^(https?:|data:|blob:|file:)/i.test( raw ) ) return raw;

    // Strip leading slashes, lower only for tests; preserve original for final join
    const noSlash = raw.replace( /^\/+/, '' );
    const test = noSlash.toLowerCase();

    // If already "public/uploads/..." -> drop "public/"
    if ( test.startsWith( 'public/uploads/' ) ) {
      return noSlash.slice( 'public/'.length );
    }

    // Already "uploads/..." -> keep
    if ( test.startsWith( 'uploads/' ) ) {
      return noSlash;
    }

    // If it starts with a known or future bucket (e.g., users/, tenants/, leases/, properties/, richtext/, etc.)
    // we just prefix "uploads/".
    const bucket = test.split( '/' )[ 0 ] || '';
    // Safety: bucket must be a simple segment (no dots to avoid "foo.png").
    if ( bucket && !bucket.includes( '.' ) ) {
      return `uploads/${ noSlash }`;
    }

    // Last resort: treat as a file under uploads root
    return `uploads/${ noSlash }`;
  }

  /**
   * Build a final URL for media:
   * - Web: ABSOLUTE (uses environment.filesBaseUrl which already ends with "/uploads/")
   * - Electron: RELATIVE ("uploads/...") so the path never drops the "uploads" segment
   * If an absolute URL is provided, it is returned unchanged.
   */
  public absoluteMediaUrl( relOrAbs: string ): string {
    // Already absolute -> return as-is
    if ( /^(https?:|data:|blob:|file:)/i.test( relOrAbs ) ) return relOrAbs;

    // Normalize to "uploads/..." (repairs 'public/uploads/...', '/uploads/...', 'users/...', etc.)
    const normalized = this.normalizeUploadRelative( relOrAbs ); // -> "uploads/..."; guaranteed

    // Choose base: prefer filesBaseUrl, else apiOrigin + '/uploads/'
    const baseExplicit = ( this.filesBaseUrl || '' ).replace( /\/+$/, '' ); // may already end with /uploads
    const baseFallback = ( this.apiOrigin || '' ).replace( /\/+$/, '' ) + '/uploads';
    const base = ( baseExplicit || baseFallback ).replace( /\/+$/, '' );

    // If base ends with /uploads, strip exactly one "uploads/" from suffix to avoid duplication
    const baseEndsWithUploads = /\/uploads$/i.test( base );
    const suffix = baseEndsWithUploads
      ? normalized.replace( /^\/?uploads\/?/, '' )  // remove one uploads/
      : normalized;                                // keep uploads/ in path

    return `${ base }/${ suffix.replace( /^\/+/, '' ) }`;
  }


  /** Helper for user avatars by username or id. */
  public userAvatar( usernameOrId?: string ): string {
    if ( !usernameOrId ) return 'uploads/users/unknown/image.webp';
    return `uploads/users/${ encodeURIComponent( usernameOrId ) }/image.webp`;
  }
}
