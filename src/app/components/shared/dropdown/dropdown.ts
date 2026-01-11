// Path: src/app/components/shared/dropdown/dropdown.ts
// ============================================================================
// Reusable Dropzone (standalone, class-based, OnPush)
//
//  Fixes included:
//  1) Correct ngOnChanges keys (previewFilesURLs instead of previewImage)
//  2) Detect parent array mutations even AFTER render (IterableDiffers + DoCheck)
//     - Works even if parent does: arr.push(url)
//  3) OnPush-safe parent preview render (post-render markForCheck scheduling)
//  4) Revoke ONLY blob: URLs (never revoke http(s) or /uploads)
//  5) Normalize parent preview URLs so they are route-safe (/uploads/...)
//  6) Parent preview items always include a usable preview source
// ============================================================================

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DoCheck,
  ElementRef,
  EventEmitter,
  HostListener,
  Inject,
  Input,
  IterableDiffer,
  IterableDiffers,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  PLATFORM_ID,
  Renderer2,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatIcon } from '@angular/material/icon';

import { FilePreviewComponent } from '../file-preview/file-preview.component';
import {
  FileMetadataService,
  type FileMetadata,
} from '../../../services/fileMetadata/file-metadata.service';
import { DownloadService } from '../../../services/downloadService/download.service';

export type FileKind =
  | 'image'
  | 'pdf'
  | 'text'
  | 'csv'
  | 'audio'
  | 'video'
  | 'unsupported';

export type AcceptCategory = 'image' | 'documents' | 'video' | 'audio' | 'all';

export interface DropzonePreviewItem {
  file: File;
  previewDataUrl?: string;
  objectUrl?: string;
  mime?: string;
  kind: FileKind;
  isFromParent?: boolean;
  sourceUrl?: string;
  metaName?: string;
  metaSize?: number;
  metaWidth?: number;
  metaHeight?: number;
}

@Component( {
  selector: 'app-dropdown',
  standalone: true,
  imports: [ CommonModule, MatIcon, FilePreviewComponent ],
  templateUrl: './dropdown.html',
  styleUrl: './dropdown.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
} )
export class Dropdown implements OnInit, OnChanges, AfterViewInit, DoCheck, OnDestroy {
  // ─────────────────────────────────────────────────────────────
  // Inputs
  // ─────────────────────────────────────────────────────────────

  @Input() acceptCategory: AcceptCategory = 'all';

  /** Kept for backwards compatibility; overridden by acceptCategory */
  @Input() accept: string = '*/*';

  /** Also kept; overridden by acceptCategory */
  @Input() allowedMime: ReadonlyArray<string> = [];

  @Input() multiple: boolean = true;
  @Input() maxFiles: number = 12;
  @Input() maxSizeBytes: number = 10 * 1024 * 1024;
  @Input() showPreviews: boolean = true;
  @Input() compact: boolean = false;
  @Input() enablePaste: boolean = true;

  /** Parent previews: URLs/paths (http/https OR /uploads/... OR uploads/...) */
  @Input() previewFilesURLs: string[] = [];

  /** Parent previews: real File objects (optional) */
  @Input() previewFilesFromParent: File[] = [];

  // ─────────────────────────────────────────────────────────────
  // Outputs
  // ─────────────────────────────────────────────────────────────
  @Output() filesChange = new EventEmitter<File[]>();
  @Output() filesAdded = new EventEmitter<File[]>();
  @Output() fileRemoved = new EventEmitter<File>();

  // ─────────────────────────────────────────────────────────────
  // Refs & state
  // ─────────────────────────────────────────────────────────────
  @ViewChild( 'fileInput', { static: true } )
  public fileInput!: ElementRef<HTMLInputElement>;

  @ViewChild( 'dropHost', { static: true } )
  public dropHost!: ElementRef<HTMLElement>;

  protected isDragging = false;
  protected queue: DropzonePreviewItem[] = [];
  protected selected?: DropzonePreviewItem;

  private dragEnterUnsub?: () => void;
  private dragOverUnsub?: () => void;
  private dragLeaveUnsub?: () => void;
  private dropUnsub?: () => void;

  private readonly isBrowser: boolean;
  private readonly ACCEPT_DESC_MAX = 500;

  // Prevent race conditions when parent inputs change rapidly
  private previewBuildToken = 0;

  //  Differ machinery to detect parent array mutation even if reference stays same
  private urlsDiffer?: IterableDiffer<string>;
  private filesDiffer?: IterableDiffer<File>;

  //  Debounce rebuild requests (ngOnChanges + ngDoCheck can both trigger)
  private rebuildScheduled = false;

  public get acceptDescription(): string {
    return this.buildAcceptDescription( this.accept );
  }

  public constructor (
    private readonly renderer: Renderer2,
    private readonly cdr: ChangeDetectorRef,
    private readonly fileMeta: FileMetadataService,
    private readonly downloadService: DownloadService,
    private readonly differs: IterableDiffers,
    @Inject( PLATFORM_ID ) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser( platformId );
  }

  // ─────────────────────────────────────────────────────────────
  // Global drag/drop blockers (prevent browser from opening files)
  // ─────────────────────────────────────────────────────────────
  @HostListener( 'document:dragover', [ '$event' ] )
  protected onDocumentDragOver( e: DragEvent ): void {
    if ( !this.isBrowser ) return;
    e.preventDefault();
  }

  @HostListener( 'document:drop', [ '$event' ] )
  protected onDocumentDrop( e: DragEvent ): void {
    if ( !this.isBrowser ) return;
    e.preventDefault();
    e.stopPropagation();
  }

  @HostListener( 'window:dragover', [ '$event' ] )
  protected onWinDragOver( e: DragEvent ): void {
    e.preventDefault();
  }

  @HostListener( 'window:drop', [ '$event' ] )
  protected onWinDrop( e: DragEvent ): void {
    e.preventDefault();
    e.stopPropagation();
  }

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────
  public ngOnInit(): void {
    // AcceptCategory is the source of truth
    this.applyAcceptProfile();

    //  Setup differs so mutations can be detected later
    this.setupDiffers();

    // If previews already exist at init, request rebuild
    if ( this.hasAnyParentPreview() ) {
      this.requestParentPreviewRebuild( '[Info:] [Dropdown] ngOnInit parent previews present.\n' );
    }
  }

  public ngOnChanges( ch: SimpleChanges ): void {
    if ( ch[ 'acceptCategory' ] ) {
      this.applyAcceptProfile();
    }

    //  IMPORTANT: correct keys
    if ( ch[ 'previewFilesURLs' ] || ch[ 'previewFilesFromParent' ] ) {
      // When input reference changes, we should recreate differs (safe)
      this.setupDiffers();
      this.requestParentPreviewRebuild( '[Info:] [Dropdown] ngOnChanges parent preview inputs changed.\n' );
    }
  }

  public ngAfterViewInit(): void {
    if ( !this.isBrowser ) return;

    const host = this.dropHost?.nativeElement;
    if ( !host ) return;

    this.dragEnterUnsub = this.renderer.listen( host, 'dragenter', ( e: DragEvent ) =>
      this.onDragEnter( e )
    );
    this.dragOverUnsub = this.renderer.listen( host, 'dragover', ( e: DragEvent ) =>
      this.onDragOver( e )
    );
    this.dragLeaveUnsub = this.renderer.listen( host, 'dragleave', ( e: DragEvent ) =>
      this.onDragLeave( e )
    );
    this.dropUnsub = this.renderer.listen( host, 'drop', ( e: DragEvent ) =>
      this.onDrop( e )
    );

    // Critical: some parents populate previews AFTER view init (API results).
    // Even if ngOnChanges didn't fire due to mutation, differ will catch in DoCheck,
    // but we also do one safe attempt here if anything exists already.
    if ( this.hasAnyParentPreview() ) {
      this.requestParentPreviewRebuild( '[Info:] [Dropdown] ngAfterViewInit parent previews present.\n' );
    }
  }

  /**
   *  This is the missing piece for “works even after rendered”.
   * It detects mutations when parent does:
   *   this.previewFilesURLs.push(...)
   * (same array reference => ngOnChanges will NOT run)
   */
  public ngDoCheck(): void {
    let changed = false;

    if ( this.urlsDiffer ) {
      const diff = this.urlsDiffer.diff( this.previewFilesURLs ?? [] );
      if ( diff ) changed = true;
    }

    if ( this.filesDiffer ) {
      const diff = this.filesDiffer.diff( this.previewFilesFromParent ?? [] );
      if ( diff ) changed = true;
    }

    if ( changed ) {
      this.requestParentPreviewRebuild( '[Info:] [Dropdown] ngDoCheck detected parent preview mutation.\n' );
    }
  }

  public ngOnDestroy(): void {
    this.dragEnterUnsub?.();
    this.dragOverUnsub?.();
    this.dragLeaveUnsub?.();
    this.dropUnsub?.();

    this.revokeAllQueueObjectUrls( this.queue );
  }

  // ─────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────
  public clear(): void {
    this.revokeAllQueueObjectUrls( this.queue );

    this.queue = [];
    this.selected = undefined;
    this.isDragging = false;

    if ( this.fileInput?.nativeElement ) {
      this.fileInput.nativeElement.value = '';
    }

    this.emitAll();
    this.schedulePostRenderMarkForCheck();
  }

  public getFiles(): File[] {
    return this.queue.map( q => q.file );
  }

  // ─────────────────────────────────────────────────────────────
  // Template handlers
  // ─────────────────────────────────────────────────────────────
  protected onBrowseClick(): void {
    this.fileInput.nativeElement.click();
  }

  protected onFileInputChanged( ev: Event ): void {
    const input = ev.target as HTMLInputElement;
    if ( !input?.files || input.files.length === 0 ) return;

    const justAdded = this.ingestFileList( input.files );

    // Reset file input so selecting the same file again triggers change
    input.value = '';

    if ( justAdded.length > 0 ) {
      this.filesAdded.emit( justAdded );
      this.emitAll();
      this.schedulePostRenderMarkForCheck();
    }
  }

  private onDragEnter( e: DragEvent ): void {
    this.prevent( e );
    this.isDragging = true;
    this.schedulePostRenderMarkForCheck();
  }

  private onDragOver( e: DragEvent ): void {
    this.prevent( e );
    if ( e.dataTransfer ) e.dataTransfer.dropEffect = 'copy';
    this.isDragging = true;
    this.schedulePostRenderMarkForCheck();
  }

  private onDragLeave( e: DragEvent ): void {
    this.prevent( e );
    this.isDragging = false;
    this.schedulePostRenderMarkForCheck();
  }

  private onDrop( e: DragEvent ): void {
    this.prevent( e );
    this.isDragging = false;

    if ( !e.dataTransfer?.files || e.dataTransfer.files.length === 0 ) return;

    const justAdded = this.ingestFileList( e.dataTransfer.files );
    if ( justAdded.length > 0 ) {
      this.filesAdded.emit( justAdded );
      this.emitAll();
      this.schedulePostRenderMarkForCheck();
    }
  }

  @HostListener( 'document:paste', [ '$event' ] )
  protected onPaste( e: ClipboardEvent ): void {
    if ( !this.enablePaste ) return;

    const target = e.target as HTMLElement | null;
    if (
      target &&
      ( target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.hasAttribute( 'contenteditable' ) )
    ) {
      return;
    }

    const items = e.clipboardData?.items;
    if ( !items || items.length === 0 ) return;

    const toAdd: File[] = [];

    for ( const item of items ) {
      if ( item.kind !== 'file' ) continue;
      const file = item.getAsFile();
      if ( file ) toAdd.push( file );
    }

    if ( toAdd.length ) {
      const justAdded = this.ingestFiles( toAdd );
      if ( justAdded.length > 0 ) {
        this.filesAdded.emit( justAdded );
        this.emitAll();
        this.schedulePostRenderMarkForCheck();
      }
      e.preventDefault();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Parent previews: rebuild
  // ─────────────────────────────────────────────────────────────

  private setupDiffers(): void {
    // IterableDiffer tracks changes inside an array even if reference stays the same.
    // This solves the "push/splice doesn't trigger ngOnChanges" issue.
    this.urlsDiffer = this.differs.find( this.previewFilesURLs ?? [] ).create<string>();
    this.filesDiffer = this.differs.find( this.previewFilesFromParent ?? [] ).create<File>();
  }

  private hasAnyParentPreview(): boolean {
    return (
      ( Array.isArray( this.previewFilesURLs ) && this.previewFilesURLs.length > 0 ) ||
      ( Array.isArray( this.previewFilesFromParent ) && this.previewFilesFromParent.length > 0 )
    );
  }

  private requestParentPreviewRebuild( logMsg?: string ): void {
    // Debounce: ngOnChanges + ngDoCheck could fire in same tick
    if ( this.rebuildScheduled ) return;
    this.rebuildScheduled = true;

    queueMicrotask( () => {
      this.rebuildScheduled = false;

      // If parent previews are empty, we still want to clear queue
      this.rebuildParentPreviews().catch( ( err: unknown ) => {
        // eslint-disable-next-line no-console
        console.error( '[Error:] [Dropdown] rebuildParentPreviews failed.\n', err );
      } );
    } );
  }

  private async rebuildParentPreviews(): Promise<void> {
    const token = ++this.previewBuildToken;

    const nextQueue: DropzonePreviewItem[] = await this.buildQueueFromParentPreviews();

    // If a newer rebuild started, drop this result
    if ( token !== this.previewBuildToken ) {
      this.revokeAllQueueObjectUrls( nextQueue );
      return;
    }

    // Replace queue safely
    this.revokeAllQueueObjectUrls( this.queue );
    this.queue = nextQueue;

    // Auto-select first item
    this.selected = this.queue.length ? this.queue[ 0 ] : undefined;

    // Emit only real user-selected files
    this.emitAll();

    // OnPush-safe: force re-check after async build AND after paint.
    this.schedulePostRenderMarkForCheck();
  }

  private async buildQueueFromParentPreviews(): Promise<DropzonePreviewItem[]> {
    const nextQueue: DropzonePreviewItem[] = [];

    // 1) Files from parent
    const parentFiles: File[] = Array.isArray( this.previewFilesFromParent )
      ? this.previewFilesFromParent.filter( Boolean )
      : [];

    for ( const f of parentFiles ) {
      if ( nextQueue.length >= this.maxFiles ) break;

      const item: DropzonePreviewItem | null = await this.buildItemFromFile( f, true );
      if ( item ) nextQueue.push( item );
    }

    // 2) URLs from parent
    const urls: string[] = Array.isArray( this.previewFilesURLs )
      ? this.previewFilesURLs
        .map( v => String( v ?? '' ).trim() )
        .filter( v => v.length > 0 )
      : [];

    for ( const url of urls ) {
      if ( nextQueue.length >= this.maxFiles ) break;

      const item: DropzonePreviewItem | null = await this.buildItemFromUrl( url, true );
      if ( item ) nextQueue.push( item );
    }

    return nextQueue;
  }

  private async buildItemFromFile(
    file: File,
    isFromParent: boolean
  ): Promise<DropzonePreviewItem | null> {
    try {
      const meta: FileMetadata = await this.fileMeta.fromFile( file );

      if ( !this.isBrowser ) {
        return {
          file,
          kind: meta.kind,
          mime: meta.mimeType ?? undefined,
          isFromParent,
          metaName: meta.name,
          metaSize: meta.size,
          metaWidth: meta.width,
          metaHeight: meta.height,
        };
      }

      if ( this.showPreviews && meta.kind === 'image' ) {
        try {
          const url: string = await this.readAsDataURL( file );
          return {
            file,
            previewDataUrl: url,
            kind: meta.kind,
            mime: meta.mimeType ?? undefined,
            isFromParent,
            metaName: meta.name,
            metaSize: meta.size,
            metaWidth: meta.width,
            metaHeight: meta.height,
          };
        } catch {
          // fallback to object URL
        }
      }

      const obj: string = URL.createObjectURL( file );

      return {
        file,
        objectUrl: obj,
        kind: meta.kind,
        mime: meta.mimeType ?? undefined,
        isFromParent,
        metaName: meta.name,
        metaSize: meta.size,
        metaWidth: meta.width,
        metaHeight: meta.height,
      };
    } catch ( error: unknown ) {
      // eslint-disable-next-line no-console
      console.error( '[Error:] [Dropdown] buildItemFromFile failed.\n', error );
      return null;
    }
  }

  private async buildItemFromUrl(
    url: string,
    isFromParent: boolean
  ): Promise<DropzonePreviewItem | null> {
    const raw: string = String( url ?? '' ).trim();
    if ( !raw ) return null;

    const resolvedUrl: string = this.normalizeParentPreviewUrl( raw );

    try {
      const meta: FileMetadata = await this.fileMeta.fromUrl( resolvedUrl );

      // Placeholder File for UI consistency only
      const fake: File = new File( [], meta.name, { type: meta.mimeType ?? '' } );

      const item: DropzonePreviewItem = {
        file: fake,
        kind: meta.kind,
        mime: meta.mimeType ?? undefined,
        isFromParent,
        sourceUrl: resolvedUrl,
        metaName: meta.name,
        metaSize: meta.size,
        metaWidth: meta.width,
        metaHeight: meta.height,

        // Preview panel must have a renderable src.
        objectUrl: resolvedUrl,
      };

      if ( meta.kind === 'image' ) {
        item.previewDataUrl = resolvedUrl;
      }

      return item;
    } catch ( error: unknown ) {
      // eslint-disable-next-line no-console
      console.error( '[Error:] [Dropdown] buildItemFromUrl failed.\n', error );
      return null;
    }
  }

  private normalizeParentPreviewUrl( input: string ): string {
    const u: string = String( input ?? '' ).trim();
    if ( !u ) return '';

    if ( /^https?:\/\//i.test( u ) || /^data:/i.test( u ) || /^blob:/i.test( u ) ) {
      return u;
    }

    if ( !u.startsWith( '/' ) ) {
      return '/' + u;
    }

    return u;
  }

  // ─────────────────────────────────────────────────────────────
  // Selection / preview panel
  // ─────────────────────────────────────────────────────────────
  protected openPreview( index: number ): void {
    if ( index < 0 || index >= this.queue.length ) return;
    this.selected = this.queue[ index ];
    this.schedulePostRenderMarkForCheck();
  }

  protected closePreview(): void {
    this.selected = undefined;
    this.schedulePostRenderMarkForCheck();
  }

  protected downloadSelected(): void {
    if ( !this.isBrowser || !this.selected ) return;

    if ( this.selected.sourceUrl ) {
      this.downloadService.downloadFromUrl( this.selected.sourceUrl, this.selected.file.name ?? '' );
      return;
    }

    if ( this.isRevokableObjectUrl( this.selected.objectUrl ) ) {
      const a = document.createElement( 'a' );
      a.href = this.selected.objectUrl as string;
      a.download = this.selected.file.name;
      a.click();
      return;
    }

    if ( this.selected.objectUrl ) {
      this.downloadService.downloadFromUrl( this.selected.objectUrl, this.selected.file.name ?? '' );
      return;
    }

    if ( this.selected.previewDataUrl ) {
      this.downloadService.downloadFromUrl( this.selected.previewDataUrl, this.selected.file.name ?? '' );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Remove
  // ─────────────────────────────────────────────────────────────
  protected removeAt( i: number ): void {
    if ( i < 0 || i >= this.queue.length ) return;

    const removed = this.queue[ i ];

    if ( this.isRevokableObjectUrl( removed.objectUrl ) ) {
      try {
        URL.revokeObjectURL( removed.objectUrl as string );
      } catch {
        // ignore
      }
    }

    const next = [ ...this.queue ];
    next.splice( i, 1 );
    this.queue = next;

    if ( this.selected && this.selected.file === removed.file ) {
      this.selected = this.queue.length ? this.queue[ 0 ] : undefined;
    }

    // Emit only for real user files (NOT url placeholders)
    if ( !( removed.isFromParent && !!removed.sourceUrl ) ) {
      this.fileRemoved.emit( removed.file );
    }

    this.emitAll();
    this.schedulePostRenderMarkForCheck();
  }

  // ─────────────────────────────────────────────────────────────
  // Emit
  // ─────────────────────────────────────────────────────────────
  private emitAll(): void {
    const realFiles: File[] = this.queue
      .filter( it => !( it.isFromParent && !!it.sourceUrl ) )
      .map( it => it.file );

    this.filesChange.emit( realFiles );
  }

  // ─────────────────────────────────────────────────────────────
  // Accept profile machinery
  // ─────────────────────────────────────────────────────────────
  private applyAcceptProfile(): void {
    const prof = this.buildProfile( this.acceptCategory );
    this.accept = prof.acceptString;
    this.allowedMime = prof.allowedMime;
  }

  private buildProfile( cat: AcceptCategory ): {
    acceptString: string;
    allowedMime: ReadonlyArray<string>;
  } {
    const IMAGES = [ 'image/*' ];
    const PDF = [ 'application/pdf' ];
    const TEXTISH = [ 'text/plain', 'application/json', 'application/xml', 'text/csv' ];
    const AUDIO = [ 'audio/*' ];
    const VIDEO = [ 'video/*' ];

    const OFFICE_MIME = [
      'application/msword',
      'application/vnd.ms-excel',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];

    const OFFICE_EXT = [ '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx' ];

    const acceptSet = new Set<string>();
    const allowedSet = new Set<string>();

    const add = ( arr: ReadonlyArray<string> ): void => {
      for ( const v of arr ) {
        acceptSet.add( v );
        allowedSet.add( v );
      }
    };

    const addAcceptOnly = ( arr: ReadonlyArray<string> ): void => {
      for ( const v of arr ) acceptSet.add( v );
    };

    switch ( cat ) {
      case 'image':
        add( IMAGES );
        break;
      case 'documents':
        add( PDF );
        add( TEXTISH );
        add( OFFICE_MIME );
        addAcceptOnly( OFFICE_EXT );
        break;
      case 'video':
        add( VIDEO );
        break;
      case 'audio':
        add( AUDIO );
        break;
      case 'all':
      default:
        add( IMAGES );
        add( PDF );
        add( TEXTISH );
        add( AUDIO );
        add( VIDEO );
        add( OFFICE_MIME );
        addAcceptOnly( OFFICE_EXT );
        break;
    }

    return {
      acceptString: Array.from( acceptSet ).join( ',' ),
      allowedMime: Array.from( allowedSet ),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Ingest + validation + preview
  // ─────────────────────────────────────────────────────────────
  private ingestFileList( list: FileList ): File[] {
    return this.ingestFiles( Array.from( list ) );
  }

  private ingestFiles( files: File[] ): File[] {
    const allowed = this.resolveAllowedMime();
    const newOnes: File[] = [];

    for ( const f of files ) {
      if ( this.queue.length >= this.maxFiles ) break;
      if ( !this.isAllowed( f, allowed ) ) continue;
      if ( f.size > this.maxSizeBytes ) continue;

      const exists = this.queue.some( q => q.file.name === f.name && q.file.size === f.size );
      if ( exists ) continue;

      newOnes.push( f );
    }

    if ( !newOnes.length ) return [];

    for ( const file of newOnes ) {
      const kind = this.kindFromFile( file );
      const mime = file.type || undefined;

      if ( this.showPreviews && kind === 'image' ) {
        this.readAsDataURL( file )
          .then( url => {
            this.queue = [ ...this.queue, { file, previewDataUrl: url, kind, mime } ];
            this.emitAll();
            this.schedulePostRenderMarkForCheck();
          } )
          .catch( () => {
            this.queue = [ ...this.queue, { file, kind, mime } ];
            this.emitAll();
            this.schedulePostRenderMarkForCheck();
          } );
      } else {
        const obj = URL.createObjectURL( file );
        this.queue = [ ...this.queue, { file, objectUrl: obj, kind, mime } ];
        this.emitAll();
        this.schedulePostRenderMarkForCheck();
      }
    }

    return newOnes;
  }

  // ─────────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────────
  private prevent( e: Event | null | undefined ): void {
    if ( !e ) return;
    e.preventDefault();
    e.stopPropagation();
  }

  private schedulePostRenderMarkForCheck(): void {
    this.cdr.markForCheck();

    if ( !this.isBrowser ) return;

    queueMicrotask( () => {
      this.cdr.markForCheck();
    } );

    requestAnimationFrame( () => {
      this.cdr.markForCheck();
    } );
  }

  private isRevokableObjectUrl( url: string | undefined ): boolean {
    return typeof url === 'string' && url.startsWith( 'blob:' );
  }

  private resolveAllowedMime(): ReadonlyArray<string> {
    if ( this.allowedMime.length > 0 ) return this.allowedMime;

    const raw = ( this.accept || '' )
      .split( ',' )
      .map( s => s.trim() )
      .filter( Boolean );

    const mimes = raw.filter( x => !x.startsWith( '.' ) );
    return mimes.length > 0 ? mimes : [ '*/*' ];
  }

  private isAllowed( file: File, allow: ReadonlyArray<string> ): boolean {
    if ( allow.includes( '*/*' ) ) return true;

    const type = file.type || '';

    for ( const rule of allow ) {
      if ( rule.endsWith( '/*' ) ) {
        const base = rule.replace( '/*', '' );
        if ( type.startsWith( base + '/' ) ) return true;
      } else if ( rule === type ) {
        return true;
      }
    }

    if ( !type ) {
      const n = file.name.toLowerCase();

      if ( /\.(png|jpe?g|gif|webp|avif|svg)$/.test( n ) && allow.some( r => r.startsWith( 'image/' ) ) ) {
        return true;
      }

      if ( n.endsWith( '.pdf' ) && ( allow.includes( 'application/pdf' ) || allow.includes( '*/*' ) ) ) {
        return true;
      }

      if (
        /\.(txt|log|md|json|xml|csv|tsv)$/.test( n ) &&
        ( allow.includes( 'text/plain' ) ||
          allow.includes( 'application/json' ) ||
          allow.includes( 'application/xml' ) ||
          allow.includes( 'text/csv' ) ||
          allow.includes( '*/*' ) )
      ) {
        return true;
      }

      if ( /\.(mp3|wav|m4a|ogg)$/.test( n ) && allow.some( r => r.startsWith( 'audio/' ) ) ) {
        return true;
      }

      if ( /\.(mp4|webm|ogv)$/.test( n ) && allow.some( r => r.startsWith( 'video/' ) ) ) {
        return true;
      }
    }

    return allow.includes( '*/*' );
  }

  private readAsDataURL( file: File ): Promise<string> {
    return new Promise( ( resolve, reject ) => {
      const fr = new FileReader();
      fr.onerror = () => reject( new Error( 'readAsDataURL failed' ) );
      fr.onload = () => resolve( String( fr.result ) );
      fr.readAsDataURL( file );
    } );
  }

  private kindFromFile( file: File ): FileKind {
    const t = ( file.type || '' ).toLowerCase();
    const n = file.name.toLowerCase();

    if ( t.startsWith( 'image/' ) ) return 'image';
    if ( t === 'application/pdf' || n.endsWith( '.pdf' ) ) return 'pdf';
    if (
      t.startsWith( 'text/' ) ||
      t === 'application/json' ||
      t === 'application/xml' ||
      /\.(txt|log|md|json|xml)$/i.test( n )
    ) {
      return 'text';
    }
    if ( t.includes( 'csv' ) || /\.(csv|tsv)$/i.test( n ) ) return 'csv';
    if ( t.startsWith( 'audio/' ) || /\.(mp3|wav|m4a|ogg)$/i.test( n ) ) return 'audio';
    if ( t.startsWith( 'video/' ) || /\.(mp4|webm|ogv)$/i.test( n ) ) return 'video';

    return 'unsupported';
  }

  protected fileIconFor( kind: FileKind ): string {
    switch ( kind ) {
      case 'pdf':
        return 'picture_as_pdf';
      case 'text':
        return 'description';
      case 'csv':
        return 'table_chart';
      case 'audio':
        return 'audiotrack';
      case 'video':
        return 'movie';
      default:
        return 'insert_drive_file';
    }
  }

  protected fileExt( name: string ): string {
    const i = name.lastIndexOf( '.' );
    return i > -1 ? name.slice( i + 1 ).toUpperCase() : 'FILE';
  }

  public formatSize( bytes: number ): string {
    if ( bytes < 1024 ) return `${ bytes } B`;
    if ( bytes < 1024 * 1024 ) return `${ ( bytes / 1024 ).toFixed( 1 ) } KB`;
    if ( bytes < 1024 * 1024 * 1024 ) return `${ ( bytes / 1024 / 1024 ).toFixed( 1 ) } MB`;
    return `${ ( bytes / 1024 / 1024 / 1024 ).toFixed( 1 ) } GB`;
  }

  private revokeAllQueueObjectUrls( items: DropzonePreviewItem[] ): void {
    if ( !this.isBrowser ) return;

    for ( const it of items ) {
      if ( !this.isRevokableObjectUrl( it.objectUrl ) ) continue;
      try {
        URL.revokeObjectURL( it.objectUrl as string );
      } catch {
        // ignore
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Accept description helpers
  // ─────────────────────────────────────────────────────────────
  private buildAcceptDescription( accept: string | null | undefined ): string {
    const raw = ( accept ?? '' ).trim();
    if ( !raw || raw === '*/*' ) return 'All file types';

    const tokens = raw
      .split( ',' )
      .map( t => t.trim().toLowerCase() )
      .filter( Boolean );

    if ( tokens.length === 0 ) return 'All file types';

    // Collapse wildcard categories first (EXACT output)
    const hasImages = tokens.includes( 'image/*' );
    const hasVideo = tokens.includes( 'video/*' );
    const hasAudio = tokens.includes( 'audio/*' );

    // If accept contains only image/* (or image/* alongside other junk), be explicit:
    if ( hasImages && !hasVideo && !hasAudio ) {
      return 'Images (JPG, JPEG, PNG, GIF, WebP, SVG, …)';
    }
    if ( hasVideo && !hasImages && !hasAudio ) {
      return 'Videos (MP4, WebM, …)';
    }
    if ( hasAudio && !hasImages && !hasVideo ) {
      return 'Audio files (MP3, WAV, …)';
    }

    // If multiple wildcard groups exist, show them clearly instead of "18 formats"
    if ( hasImages || hasVideo || hasAudio ) {
      const groups: string[] = [];
      if ( hasImages ) groups.push( 'Images' );
      if ( hasVideo ) groups.push( 'Videos' );
      if ( hasAudio ) groups.push( 'Audio' );
      return groups.join( ', ' );
    }

    // Otherwise fallback to your detailed token labels
    const labels: string[] = [];

    for ( const token of tokens ) {
      if ( token.startsWith( '.' ) ) labels.push( this.describeExtension( token ) );
      else if ( token.includes( '/' ) ) labels.push( this.describeMime( token ) );
      else labels.push( token );
    }

    const unique = Array.from( new Set( labels.filter( Boolean ) ) );

    // Instead of “18 formats allowed”, show a readable list
    // If it's too long, we still truncate but keep meaning.
    const joined = unique.join( ', ' );
    return this.truncateDesc( joined );
  }


  private describeMime( mime: string ): string {
    if ( mime === 'image/*' ) return 'Images (JPG, PNG, …)';
    if ( mime === 'video/*' ) return 'Videos (MP4, WebM, …)';
    if ( mime === 'audio/*' ) return 'Audio files (MP3, WAV, …)';

    const map: Record<string, string> = {
      'image/jpeg': 'JPEG images',
      'image/png': 'PNG images',
      'image/gif': 'GIF images',
      'image/webp': 'WebP images',
      'application/pdf': 'PDF documents',
      'application/msword': 'Word documents (.doc)',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        'Word documents (.docx)',
      'application/vnd.ms-excel': 'Excel spreadsheets (.xls)',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        'Excel spreadsheets (.xlsx)',
      'text/plain': 'Text files (.txt)',
      'text/csv': 'CSV files',
    };

    const label = map[ mime ];
    if ( label ) return label;

    return `${ mime } ${ this.multiple ? 'files' : 'file' }`;
  }

  private describeExtension( ext: string ): string {
    const imageExts = [ '.jpg', '.jpeg', '.png', '.gif', '.webp' ];
    const docExts = [ '.doc', '.docx', '.odt', '.rtf' ];
    const sheetExts = [ '.xls', '.xlsx', '.ods' ];

    if ( imageExts.includes( ext ) ) return 'Images';
    if ( ext === '.pdf' ) return 'PDF documents';
    if ( docExts.includes( ext ) ) return 'Word / document files';
    if ( sheetExts.includes( ext ) ) return 'Spreadsheet files';
    if ( ext === '.txt' ) return 'Text files (.TXT)';
    if ( ext === '.csv' ) return 'CSV files';

    return `Files (*${ ext })`;
  }

  private truncateDesc( text: string ): string {
    if ( text.length <= this.ACCEPT_DESC_MAX ) return text;
    return text.slice( 0, this.ACCEPT_DESC_MAX - 1 ) + '…';
  }
}
