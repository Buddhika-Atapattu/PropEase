// TinyMCE wrapper: self-hosted, CVA-capable, and theme-aware
// Path: src/app/components/shared/text-editor/text-editor.component.ts

import {
  Component,
  forwardRef,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  PLATFORM_ID,
  Inject,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  AfterViewInit
} from '@angular/core';
import { Subscription } from 'rxjs';
import { NG_VALUE_ACCESSOR, ControlValueAccessor, FormsModule } from '@angular/forms';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { EditorComponent } from '@tinymce/tinymce-angular';
import { RichTextUploadService } from '../../../services/uploads/rich-text-upload.service';
import { environment } from '../../../../environments/environment';
import { WindowsRefService } from '../../../services/windowRef/windowRef.service';
import { EditorThemeService } from '../../../services/editorTheme/editor-theme.service';

// ── TinyMCE v7 local types (no external imports needed) ──────────────────────
type TinyMCEProgressFn = ( percent: number ) => void;
interface TinyMCEBlobInfo { blob(): Blob; base64(): string; filename(): string; }
type TinyMCEUploadHandler = ( blobInfo: TinyMCEBlobInfo, progress: TinyMCEProgressFn ) => Promise<string>;

// TinyMCE editor instance (loose type to avoid importing Tiny types)
type TinyEditor = any;

@Component( {
  selector: 'app-text-editor',
  standalone: true,
  imports: [ CommonModule, FormsModule, EditorComponent ],
  templateUrl: './text-editor.html',
  styleUrls: [ './text-editor.scss' ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef( () => TextEditorComponent ),
      multi: true,
    },
  ],
} )
export class TextEditorComponent implements ControlValueAccessor, OnInit, OnDestroy, AfterViewInit {
  // ── External API ───────────────────────────────────────────────────────────
  @Input() public id: string = 'pe-editor';
  @Input( { required: true } ) public name: string = 'description';
  @Input() public placeholder: string = 'Type here...';
  public disabled: boolean = false;

  @Input( { required: true } ) public set modelValue( val: string ) { this.writeValue( val ); }
  public get modelValue(): string { return this.innerValue; }
  @Output() public modelValueChange = new EventEmitter<string>();

  // Bound value used by <editor> [(ngModel)]
  public innerValue: string = '';

  // Whether we’re in a browser (guards DOM access)
  protected readonly isBrowser: boolean;

  // Theme subscription + editor ref used to re-apply body class on theme change
  private modeSub: Subscription | null = null;
  private editorRef: TinyEditor | null = null;

  // The init object is created in ngOnInit when DI/DOM are ready
  public init!: EditorComponent[ 'init' ];

  constructor (
    private readonly rtUpload: RichTextUploadService,
    private readonly windowRef: WindowsRefService,
    private readonly editorTheme: EditorThemeService,
    private readonly cdr: ChangeDetectorRef,
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    // Always build the init config — Tiny needs it even in SSR/hydration context.
    this.init = this.buildInitConfig();

    if ( this.isBrowser ) {
      this.modeSub = this.windowRef.mode$.subscribe( () => {
        if ( this.editorRef ) this.applyEditorThemeClass( this.editorRef );

      } );
    }

    // Ensure Angular picks up the new object before child components render.
    this.cdr.detectChanges();
  }

  ngAfterViewInit(): void {
    if ( !this.init ) {
      this.init = this.buildInitConfig();
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  // ── Build TinyMCE init (now safe to use DI, DOM) ──────────────────────────
  private buildInitConfig(): EditorComponent[ 'init' ] {
    const base = this.resolveTinyBaseUrl();
    const isDark = this.getIsDark();

    return {
      // Ensure TinyMCE loads from a route-proof base
      base_url: base,
      suffix: '.min',

      // We fully control the look with content_style + our SCSS (no external skin)
      // use the real skin files you host
      skin_url: `${ base }/skins/ui/${ isDark ? 'oxide-dark' : 'oxide' }`,
      content_css: `${ base }/skins/content/${ isDark ? 'dark' : 'default' }/content.css`,
      icons: 'default', // make sure `${base}/icons/default/icons.min.js` exists

      // Inject our theme class inside the iframe body
      body_class: this.getBodyClass(),

      // Detailed, theme-aware content CSS from the service (A4 “page” look)
      content_style: this.editorTheme.buildContentStyle( 'page' ),

      // (Optional) only if you’ve copied these assets under public/tinymce/*
      // theme: 'silver',
      // icons: 'default',

      height: 500,
      branding: false,
      statusbar: true,
      toolbar_mode: 'sliding',
      menubar: 'file edit view insert format tools table help',

      // Correct TinyMCE option name:
      font_size_formats: '6pt 8pt 10pt 11pt 12pt 13pt 14pt 16pt 18pt 20pt 24pt 28pt 32pt 34pt 36pt 38pt 40pt',

      // Free plugins (ensure files exist under public/tinymce/plugins/*)
      plugins: [
        'advlist', 'anchor', 'autolink', 'charmap', 'code', 'codesample',
        'directionality', 'emoticons', 'fullscreen', 'help', 'image',
        'importcss', 'insertdatetime', 'link', 'lists', 'media',
        'pagebreak', 'preview', 'quickbars', 'searchreplace',
        'table', 'visualblocks', 'visualchars', 'wordcount',
      ],

      // Rich toolbar
      toolbar: [
        'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough forecolor backcolor removeformat | superscript subscript lineheight formatpainter',
        '| alignleft aligncenter alignright alignjustify | outdent indent | bullist numlist checklist',
        '| link image media table | hr charmap emoticons | ltr rtl',
        '| searchreplace | toc pagebreak anchor | codesample code fullscreen preview help print'
      ].join( ' ' ),

      quickbars_selection_toolbar: 'bold italic underline | h2 h3 | blockquote quicklink',
      quickbars_insert_toolbar: 'image media table hr',
      file_picker_types: 'image',

      // Promise-based upload handler (TinyMCE v7)
      images_upload_handler: ( async ( blobInfo, progress ) => {
        progress( 5 );
        const url = await this.rtUpload.uploadImage( blobInfo.blob(), blobInfo.filename() );
        progress( 100 );
        return url; // Tiny inserts <img src="...">
      } ) as TinyMCEUploadHandler,

      // Capture editor ref and apply theme class on first init
      setup: ( ed: any ) => {
        this.editorRef = ed;
        ed.on( 'SkinLoaded', () => {
          const box = ed.getContainer?.();
          if ( box ) {
            box.style.visibility = 'visible';
            box.style.opacity = '1';
          }
        } );
        ed.on( 'init', () => this.applyEditorThemeClass( ed ) );
      }
    };
  }

  // ── Route-proof base path for TinyMCE assets ───────────────────────────────
  private resolveTinyBaseUrl(): string {
    if ( !this.isBrowser ) return 'tinymce';

    const isFile = typeof location !== 'undefined' && location.protocol === 'file:';
    const isElectron =
      ( typeof window !== 'undefined' && ( window as any ).process?.versions?.electron ) ||
      ( environment as any )?.electron;

    // Electron (file://) → relative works with baseHref "./"
    if ( isFile || isElectron ) return 'tinymce';

    // Web: honor <base href>. If not absolute, force absolute root.
    const baseEl = document.querySelector( 'base' );
    const href = baseEl?.getAttribute( 'href' )?.trim() || '/';

    if ( href.startsWith( '/' ) ) {
      const root = href.endsWith( '/' ) ? href : href + '/';
      return `${ root }tinymce`; // e.g. "/" -> "/tinymce", "/app/" -> "/app/tinymce"
    }
    return `/tinymce`; // normalize relative base to absolute
  }

  // ── Theme helpers ──────────────────────────────────────────────────────────
  private getIsDark(): boolean {
    if ( !this.isBrowser ) return false;
    try { return document.documentElement.classList.contains( 'dark' ); }
    catch { return false; }
  }

  private getBodyClass(): string {
    return this.getIsDark() ? 'pe-theme-dark' : 'pe-theme-light';
  }

  public applyEditorThemeClass( editor: TinyEditor ): void {
    try {
      const body = editor?.getBody?.();
      if ( !body ) return;
      body.classList.remove( 'pe-theme-light', 'pe-theme-dark' );
      body.classList.add( this.getIsDark() ? 'pe-theme-dark' : 'pe-theme-light' );
    } catch {/* no-op */ }
  }



  // ── CVA methods ────────────────────────────────────────────────────────────
  public writeValue( val: unknown ): void {
    this.innerValue = ( typeof val === 'string' ) ? val : ( val == null ? '' : String( val ) );
  }

  public registerOnChange( fn: ( val: string ) => void ): void { this.onChange = fn; }
  public registerOnTouched( fn: () => void ): void { this.onTouched = fn; }
  public setDisabledState( isDisabled: boolean ): void { this.disabled = !!isDisabled; }

  private onChange: ( val: string ) => void = () => {};
  private onTouched: () => void = () => {};

  // Relay editor value to both CVA and (modelValueChange)
  public onEditorValueChange( val: string ): void {
    this.innerValue = val ?? '';
    this.onChange( this.innerValue );
    this.modelValueChange.emit( this.innerValue );
  }
}
