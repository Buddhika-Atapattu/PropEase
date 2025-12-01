// Path: src/app/components/shared/dropdown/dropdown.ts
import {
  Component,
  ChangeDetectionStrategy,
  Input,
  Output,
  ChangeDetectorRef,
  EventEmitter,
  ViewChild,
  ElementRef,
  Renderer2,
  AfterViewInit,
  OnDestroy,
  HostListener,
  Inject,
  PLATFORM_ID,
  OnInit,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { FilePreviewComponent } from '../file-preview/file-preview.component';

export type FileKind = 'image' | 'pdf' | 'text' | 'csv' | 'audio' | 'video' | 'unsupported';

/** Exactly the five modes you requested */
export type AcceptCategory = 'image' | 'documents' | 'video' | 'audio' | 'all';

export interface DropzonePreviewItem {
  file: File;
  /** Data URL thumbnail for images */
  previewDataUrl?: string;
  /** Blob URL used by <app-file-preview> for non-images */
  objectUrl?: string;
  /** MIME (from File.type; may be empty) */
  mime?: string;
  /** Derived kind to drive UI */
  kind: FileKind;
}

@Component( {
  selector: 'app-dropdown',
  standalone: true,
  imports: [ CommonModule, MatIcon, FilePreviewComponent ],
  templateUrl: './dropdown.html',
  styleUrl: './dropdown.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
} )
export class Dropdown implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  // ─────────────────────────────────────────────────────────────
  // Inputs
  // ─────────────────────────────────────────────────────────────

  /**
   * Single source of truth for what the dropzone accepts.
   * - 'image'     -> images only
   * - 'documents' -> pdf + text-ish + office docs
   * - 'video'     -> video/*
   * - 'audio'     -> audio/*
   * - 'all'       -> images + documents + audio + video
   */
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

  // ─────────────────────────────────────────────────────────────
  // Outputs
  // ─────────────────────────────────────────────────────────────
  @Output() filesChange = new EventEmitter<File[]>();
  @Output() filesAdded = new EventEmitter<File[]>();
  @Output() fileRemoved = new EventEmitter<File>();

  // ─────────────────────────────────────────────────────────────
  // Refs & state
  // ─────────────────────────────────────────────────────────────
  @ViewChild( 'fileInput', { static: true } ) fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild( 'dropHost', { static: true } ) dropHost!: ElementRef<HTMLElement>;

  protected isDragging = false;
  protected queue: DropzonePreviewItem[] = [];
  protected selected?: DropzonePreviewItem;

  private dragEnterUnsub?: () => void;
  private dragOverUnsub?: () => void;
  private dragLeaveUnsub?: () => void;
  private dropUnsub?: () => void;

  private readonly isBrowser: boolean;

  public constructor (
    private readonly renderer: Renderer2,
    private readonly cdr: ChangeDetectorRef,
    @Inject( PLATFORM_ID ) platformId: Object,
  ) {
    this.isBrowser = isPlatformBrowser( platformId );
  }

  // ─────────────────────────────────────────────────────────────
  // Document-level drag/drop blockers (Option A)
  // Prevent browser from opening files when user drops outside the zone
  // ─────────────────────────────────────────────────────────────
  @HostListener( 'document:dragover', [ '$event' ] )
  protected onDocumentDragOver( e: DragEvent ): void {
    if ( !this.isBrowser ) return;
    // Optional: only intercept real file drags
    // if (!e.dataTransfer?.types.includes('Files')) return;
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
  ngOnInit(): void {
    this.applyAcceptProfile();
  }

  ngOnChanges( ch: SimpleChanges ): void {
    if ( ch[ 'acceptCategory' ] ) this.applyAcceptProfile();
  }

  ngAfterViewInit(): void {
    if ( !this.isBrowser ) return;
    const host = this.dropHost?.nativeElement;
    if ( !host ) return;

    this.dragEnterUnsub = this.renderer.listen( host, 'dragenter', ( e: DragEvent ) => this.onDragEnter( e ) );
    this.dragOverUnsub = this.renderer.listen( host, 'dragover', ( e: DragEvent ) => this.onDragOver( e ) );
    this.dragLeaveUnsub = this.renderer.listen( host, 'dragleave', ( e: DragEvent ) => this.onDragLeave( e ) );
    this.dropUnsub = this.renderer.listen( host, 'drop', ( e: DragEvent ) => this.onDrop( e ) );
  }

  ngOnDestroy(): void {
    this.dragEnterUnsub?.();
    this.dragOverUnsub?.();
    this.dragLeaveUnsub?.();
    this.dropUnsub?.();
    for ( const it of this.queue ) if ( it.objectUrl ) URL.revokeObjectURL( it.objectUrl );
  }

  // ─────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────
  public clear(): void {
    // Revoke any object URLs
    for ( const it of this.queue ) {
      if ( it.objectUrl ) {
        URL.revokeObjectURL( it.objectUrl );
      }
    }

    // Reset internal state
    this.queue = [];
    this.selected = undefined;
    this.isDragging = false;

    // Clear the native file input value (extra safety)
    if ( this.fileInput?.nativeElement ) {
      this.fileInput.nativeElement.value = '';
    }

    // Emit empty file list to parent
    this.emitAll();

    // IMPORTANT: Tell Angular to update this OnPush component
    this.cdr.markForCheck();
  }

  public getFiles(): File[] { return this.queue.map( q => q.file ); }

  // ─────────────────────────────────────────────────────────────
  // Template handlers
  // ─────────────────────────────────────────────────────────────
  protected onBrowseClick(): void { this.fileInput.nativeElement.click(); }

  protected onFileInputChanged( ev: Event ): void {
    const input = ev.target as HTMLInputElement;
    if ( !input?.files || input.files.length === 0 ) return;
    const justAdded = this.ingestFileList( input.files );
    input.value = '';
    if ( justAdded.length > 0 ) { this.filesAdded.emit( justAdded ); this.emitAll(); }
  }

  private onDragEnter( e: DragEvent ): void { this.prevent( e ); this.isDragging = true; }

  private onDragOver( e: DragEvent ): void {
    this.prevent( e );
    if ( e.dataTransfer ) e.dataTransfer.dropEffect = 'copy'; // UX hint
    this.isDragging = true;
  }

  private onDragLeave( e: DragEvent ): void { this.prevent( e ); this.isDragging = false; }

  private onDrop( e: DragEvent ): void {
    this.prevent( e );
    this.isDragging = false;
    if ( !e.dataTransfer?.files || e.dataTransfer.files.length === 0 ) return;
    const justAdded = this.ingestFileList( e.dataTransfer.files );
    if ( justAdded.length > 0 ) { this.filesAdded.emit( justAdded ); this.emitAll(); }
  }

  @HostListener( 'document:paste', [ '$event' ] )
  protected onPaste( e: ClipboardEvent ): void {
    if ( !this.enablePaste ) return;
    const target = e.target as HTMLElement | null;
    if ( target && ( target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.hasAttribute( 'contenteditable' ) ) ) return;

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
      if ( justAdded.length > 0 ) { this.filesAdded.emit( justAdded ); this.emitAll(); }
      e.preventDefault();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Ingest + validation + preview
  // ─────────────────────────────────────────────────────────────
  private ingestFileList( list: FileList ): File[] { return this.ingestFiles( Array.from( list ) ); }

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
          .then( url => { this.queue = [ ...this.queue, { file, previewDataUrl: url, kind, mime } ]; this.emitAll(); } )
          .catch( () => { this.queue = [ ...this.queue, { file, kind, mime } ]; this.emitAll(); } );
      } else {
        const obj = URL.createObjectURL( file );
        this.queue = [ ...this.queue, { file, objectUrl: obj, kind, mime } ];
      }
    }

    return newOnes;
  }

  protected removeAt( i: number ): void {
    if ( i < 0 || i >= this.queue.length ) return;
    const removed = this.queue[ i ];
    if ( removed.objectUrl ) URL.revokeObjectURL( removed.objectUrl );
    const next = [ ...this.queue ]; next.splice( i, 1 ); this.queue = next;
    if ( this.selected && this.selected.file === removed.file ) this.selected = undefined;
    this.fileRemoved.emit( removed.file );
    this.emitAll();
  }

  private emitAll(): void { this.filesChange.emit( this.getFiles() ); }

  // ─────────────────────────────────────────────────────────────
  // Selection / preview panel
  // ─────────────────────────────────────────────────────────────
  protected openPreview( index: number ): void {
    if ( index < 0 || index >= this.queue.length ) return;
    this.selected = this.queue[ index ];
  }

  protected closePreview(): void { this.selected = undefined; }

  protected downloadSelected(): void {
    if ( !this.selected ) return;
    if ( this.selected.objectUrl ) {
      const a = document.createElement( 'a' );
      a.href = this.selected.objectUrl;
      a.download = this.selected.file.name;
      a.click();
      return;
    }
    if ( this.selected.previewDataUrl ) window.open( this.selected.previewDataUrl, '_blank' );
  }

  // ─────────────────────────────────────────────────────────────
  // Accept profile machinery (single source of truth)
  // ─────────────────────────────────────────────────────────────
  private applyAcceptProfile(): void {
    const prof = this.buildProfile( this.acceptCategory );
    this.accept = prof.acceptString;
    this.allowedMime = prof.allowedMime;
  }

  private buildProfile( cat: AcceptCategory ): { acceptString: string; allowedMime: ReadonlyArray<string>; } {
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
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];
    const OFFICE_EXT = [ '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx' ];

    const acceptSet = new Set<string>();
    const allowedSet = new Set<string>();

    const add = ( arr: ReadonlyArray<string> ) => arr.forEach( v => { acceptSet.add( v ); allowedSet.add( v ); } );
    const addAcceptOnly = ( arr: ReadonlyArray<string> ) => arr.forEach( v => acceptSet.add( v ) );

    switch ( cat ) {
      case 'image':
        add( IMAGES );
        break;
      case 'documents':
        add( PDF ); add( TEXTISH ); add( OFFICE_MIME );
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
        add( IMAGES ); add( PDF ); add( TEXTISH ); add( AUDIO ); add( VIDEO ); add( OFFICE_MIME );
        addAcceptOnly( OFFICE_EXT );
        break;
    }

    return {
      acceptString: Array.from( acceptSet ).join( ',' ),
      allowedMime: Array.from( allowedSet ),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────────
  private prevent( e: Event ): void { e.preventDefault(); e.stopPropagation(); }

  private resolveAllowedMime(): ReadonlyArray<string> {
    if ( this.allowedMime.length > 0 ) return this.allowedMime;
    const raw = ( this.accept || '' ).split( ',' ).map( s => s.trim() ).filter( Boolean );
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
      } else if ( rule === type ) return true;
    }
    if ( !type ) {
      const n = file.name.toLowerCase();
      if ( /\.(png|jpe?g|gif|webp|avif|svg)$/.test( n ) && allow.some( r => r.startsWith( 'image/' ) ) ) return true;
      if ( n.endsWith( '.pdf' ) && ( allow.includes( 'application/pdf' ) || allow.includes( '*/*' ) ) ) return true;
      if ( /\.(txt|log|md|json|xml|csv|tsv)$/.test( n ) && ( allow.includes( 'text/plain' ) || allow.includes( 'application/json' ) || allow.includes( 'application/xml' ) || allow.includes( 'text/csv' ) || allow.includes( '*/*' ) ) ) return true;
      if ( /\.(mp3|wav|m4a|ogg)$/.test( n ) && allow.some( r => r.startsWith( 'audio/' ) ) ) return true;
      if ( /\.(mp4|webm|ogv)$/.test( n ) && allow.some( r => r.startsWith( 'video/' ) ) ) return true;
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
    if ( t.startsWith( 'text/' ) || t === 'application/json' || t === 'application/xml' || /\.(txt|log|md|json|xml)$/i.test( n ) ) return 'text';
    if ( t.includes( 'csv' ) || /\.(csv|tsv)$/i.test( n ) ) return 'csv';
    if ( t.startsWith( 'audio/' ) || /\.(mp3|wav|m4a|ogg)$/i.test( n ) ) return 'audio';
    if ( t.startsWith( 'video/' ) || /\.(mp4|webm|ogv)$/i.test( n ) ) return 'video';
    return 'unsupported';
  }

  protected fileIconFor( kind: FileKind ): string {
    switch ( kind ) {
      case 'pdf': return 'picture_as_pdf';
      case 'text': return 'description';
      case 'csv': return 'table_chart';
      case 'audio': return 'audiotrack';
      case 'video': return 'movie';
      default: return 'insert_drive_file';
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
}
