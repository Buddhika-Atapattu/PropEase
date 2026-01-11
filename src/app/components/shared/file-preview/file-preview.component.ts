import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  SimpleChanges,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

export type PreviewKind = 'pdf' | 'text' | 'csv' | 'audio' | 'video' | 'unsupported';

@Component({
  selector: 'app-file-preview',
  standalone: true,
  imports: [ CommonModule ],
  templateUrl: './file-preview.component.html',
  styleUrl: './file-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilePreviewComponent implements OnInit, OnChanges, OnDestroy {
  /**
   * URL to preview. (Can be http/https, /uploads/..., or blob:)
   * For best results pass: selected.objectUrl || selected.sourceUrl
   */
  @Input() srcUrl?: string;

  /** Friendly file name for UI + extension based detection */
  @Input() fileName?: string;

  /** Optional MIME type (best for accurate preview) */
  @Input() mime?: string;

  protected ready = false;
  protected kind: PreviewKind = 'unsupported';
  protected safeUrl?: SafeResourceUrl;

  protected textContent = '';
  protected csvHeader: string[] = [];
  protected csvRows: string[][] = [];

  private readonly isBrowser: boolean;

  private abort?: AbortController;
  private objectUrlToRevoke?: string;

  public constructor (
    private readonly sanitizer: DomSanitizer,
    private readonly cdr: ChangeDetectorRef,
    @Inject( PLATFORM_ID ) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser( platformId );
  }

  public ngOnInit(): void {
    this.rebuild();
  }

  public ngOnChanges( changes: SimpleChanges ): void {
    if ( changes[ 'srcUrl' ] || changes[ 'fileName' ] || changes[ 'mime' ] ) {
      this.rebuild();
    }
  }

  public ngOnDestroy(): void {
    this.abort?.abort();

    if ( this.objectUrlToRevoke ) {
      try {
        URL.revokeObjectURL( this.objectUrlToRevoke );
      } catch {
        // ignore
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Core flow
  // ─────────────────────────────────────────────────────────────
  private rebuild(): void {
    // Reset
    this.abort?.abort();
    this.abort = undefined;

    this.ready = false;
    this.kind = 'unsupported';
    this.safeUrl = undefined;

    this.textContent = '';
    this.csvHeader = [];
    this.csvRows = [];

    // SSR: show fallback immediately
    if ( !this.isBrowser ) {
      this.ready = true;
      this.cdr.markForCheck();
      return;
    }

    const url: string = ( this.srcUrl ?? '' ).trim();
    if ( !url ) {
      this.ready = true;
      this.cdr.markForCheck();
      return;
    }

    const detectedMime: string = this.detectMime();
    this.kind = this.pickKind( detectedMime );

    // Media / PDF are iframe/audio/video based → just trust resource url
    if ( this.kind === 'pdf' || this.kind === 'audio' || this.kind === 'video' ) {
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl( url );
      this.ready = true;
      this.cdr.markForCheck();
      return;
    }

    // Text / CSV require fetch
    if ( this.kind === 'text' ) {
      void this.loadText( url );
      return;
    }

    if ( this.kind === 'csv' ) {
      void this.loadCsv( url );
      return;
    }

    // Unsupported
    this.ready = true;
    this.cdr.markForCheck();
  }

  // ─────────────────────────────────────────────────────────────
  // MIME detection
  // ─────────────────────────────────────────────────────────────
  private detectMime(): string {
    if ( typeof this.mime === 'string' && this.mime.trim() ) {
      return this.mime.trim().toLowerCase();
    }

    const name: string = ( this.fileName || this.srcUrl || '' ).toLowerCase();

    if ( name.endsWith( '.pdf' ) ) return 'application/pdf';

    if ( name.endsWith( '.txt' ) || name.endsWith( '.log' ) || name.endsWith( '.md' ) ) return 'text/plain';
    if ( name.endsWith( '.json' ) ) return 'application/json';
    if ( name.endsWith( '.xml' ) ) return 'application/xml';

    if ( name.endsWith( '.csv' ) || name.endsWith( '.tsv' ) ) return 'text/csv';

    if ( /\.(mp3|wav|m4a|ogg)$/.test( name ) ) return 'audio/*';
    if ( /\.(mp4|webm|ogv)$/.test( name ) ) return 'video/*';

    // Office files (docx/xlsx/pptx) should be converted server-side for preview
    return '';
  }

  private pickKind(m: string): PreviewKind {
    const mime = ( m || '' ).toLowerCase();

    if ( mime === 'application/pdf' ) return 'pdf';
    if ( mime.startsWith( 'text/' ) || mime === 'application/json' || mime === 'application/xml' ) return 'text';
    if ( mime.includes( 'csv' ) ) return 'csv';
    if ( mime.startsWith( 'audio/' ) ) return 'audio';
    if ( mime.startsWith( 'video/' ) ) return 'video';

    return 'unsupported';
  }

  // ─────────────────────────────────────────────────────────────
  // Loaders (fetch)
  // ─────────────────────────────────────────────────────────────
  private async loadText( url: string ): Promise<void> {
    this.abort = new AbortController();

    try {
      const res: Response = await fetch( url, { signal: this.abort.signal } );
      if ( !res.ok ) {
        this.textContent = `Failed to load text. (${ res.status })`;
        this.ready = true;
        this.cdr.markForCheck();
        return;
      }

      const txt: string = await res.text();
      this.textContent = txt;
      this.ready = true;
      this.cdr.markForCheck();
    } catch ( error ) {
      // Ignore abort errors
      if ( this.isAbortError( error ) ) return;

      // eslint-disable-next-line no-console
      console.error( '[Error:] [FilePreview] loadText failed.\n', error );

      this.textContent = 'Failed to load text.';
      this.ready = true;
      this.cdr.markForCheck();
    }
  }

  private async loadCsv( url: string ): Promise<void> {
    this.abort = new AbortController();

    try {
      const res: Response = await fetch( url, { signal: this.abort.signal } );
      if ( !res.ok ) {
        this.kind = 'unsupported';
        this.ready = true;
        this.cdr.markForCheck();
        return;
      }

      const raw: string = await res.text();
      const rows: string[] = raw.split( /\r?\n/ ).map( r => r.trim() ).filter( r => r.length > 0 );

      if ( !rows.length ) {
        this.ready = true;
        this.cdr.markForCheck();
        return;
      }

      const delimiter: string = this.detectCsvDelimiter( rows[ 0 ] );
      const header = this.safeSplitCsvRow( rows[ 0 ], delimiter );

      this.csvHeader = header;
      this.csvRows = rows.slice( 1 ).map( r => this.safeSplitCsvRow( r, delimiter ) );

      this.ready = true;
      this.cdr.markForCheck();
    } catch ( error ) {
      if ( this.isAbortError( error ) ) return;

      // eslint-disable-next-line no-console
      console.error( '[Error:] [FilePreview] loadCsv failed.\n', error );

      this.kind = 'unsupported';
      this.ready = true;
      this.cdr.markForCheck();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // CSV helpers (basic but safer than raw split(','))
  // ─────────────────────────────────────────────────────────────
  private detectCsvDelimiter( firstLine: string ): string {
    // Basic heuristic: TSV if contains tabs
    if ( firstLine.includes( '\t' ) ) return '\t';
    return ',';
  }

  private safeSplitCsvRow( line: string, delimiter: string ): string[] {
    // Minimal CSV parsing: supports quoted values with delimiter inside quotes
    // Not a full RFC parser, but avoids the worst UI breakages.
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;

    for ( let i = 0; i < line.length; i++ ) {
      const ch = line[ i ];

      if ( ch === '"' ) {
        // Double quotes inside quoted value -> keep one
        const next = line[ i + 1 ];
        if ( inQuotes && next === '"' ) {
          cur += '"';
          i++;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }

      if ( !inQuotes && ch === delimiter ) {
        out.push( cur.trim() );
        cur = '';
        continue;
      }

      cur += ch;
    }

    out.push( cur.trim() );
    return out;
  }

  private isAbortError( error: unknown ): boolean {
    // DOMException name: AbortError
    // In some environments can be generic Error
    if ( !error ) return false;
    const anyErr = error as { name?: string; };
    return anyErr?.name === 'AbortError';
  }

  // ─────────────────────────────────────────────────────────────
  // Public action
  // ─────────────────────────────────────────────────────────────
  public download(): void {
    if ( !this.isBrowser ) return;

    const url: string = ( this.srcUrl ?? '' ).trim();
    if ( !url ) return;

    window.open( url, '_blank' );
  }
}
