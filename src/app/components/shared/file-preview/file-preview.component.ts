// Path: src/app/components/shared/file-preview/file-preview.component.ts
import {CommonModule, isPlatformBrowser} from '@angular/common';
import {Component, Inject, Input, OnDestroy, OnInit, PLATFORM_ID} from '@angular/core';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';

export interface FileEntry {
  /** Display name for UI */
  name: string;
  /** Absolute or relative URL (e.g., "public/uploads/...") */
  url: string;
  /** MIME type if known (recommended for accurate preview) */
  mime?: string;
  /** Optional size in bytes for display/badges */
  sizeBytes?: number;
}

type PreviewKind = 'pdf' | 'text' | 'csv' | 'audio' | 'video' | 'unsupported';

@Component({
  selector: 'app-file-preview',
  imports: [
    CommonModule,
  ],
  templateUrl: './file-preview.component.html',
  styleUrl: './file-preview.component.scss'
})
export class FilePreviewComponent implements OnInit, OnDestroy {
  /** Either a direct URL to your file or a Blob/File (URL preferred for SSR/Electron) */
  @Input() srcUrl?: string;
  /** Optional friendly name for download */
  @Input() fileName?: string;
  /** Optional MIME; improves detection (e.g., "application/pdf") */
  @Input() mime?: string;

  ready = false;
  kind: PreviewKind = 'unsupported';
  safeUrl?: SafeResourceUrl;
  textContent = '';
  csvHeader: string[] = [];
  csvRows: string[][] = [];
  private objectUrlToRevoke?: string;

  constructor (
    private sanitizer: DomSanitizer,
    @Inject(PLATFORM_ID) private pid: Object,
  ) {}

  ngOnInit(): void {
    if(!isPlatformBrowser(this.pid)) {this.ready = true; return;}
    const mime = this.detectMime();
    this.kind = this.pickKind(mime);

    if(['pdf', 'audio', 'video'].includes(this.kind)) {
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.srcUrl || '');
      this.ready = true;
      return;
    }
    if(this.kind === 'text') {this.loadText(); return;}
    if(this.kind === 'csv') {this.loadCsv(); return;}
    this.ready = true;
  }

  ngOnDestroy(): void {
    if(this.objectUrlToRevoke) URL.revokeObjectURL(this.objectUrlToRevoke);
  }

  private detectMime(): string {
    if(this.mime) return this.mime;
    const name = (this.fileName || this.srcUrl || '').toLowerCase();
    if(name.endsWith('.pdf')) return 'application/pdf';
    if(name.endsWith('.txt') || name.endsWith('.log') || name.endsWith('.md')) return 'text/plain';
    if(name.endsWith('.json')) return 'application/json';
    if(name.endsWith('.xml')) return 'application/xml';
    if(name.endsWith('.csv') || name.endsWith('.tsv')) return 'text/csv';
    if(/\.(mp3|wav|m4a|ogg)$/.test(name)) return 'audio/*';
    if(/\.(mp4|webm|ogv)$/.test(name)) return 'video/*';
    return '';
    // Note: Office files (docx/xlsx/pptx) should be converted to PDF server-side for preview.
  }

  private pickKind(m: string): PreviewKind {
    if(m === 'application/pdf') return 'pdf';
    if(m.startsWith('text/') || m === 'application/json' || m === 'application/xml') return 'text';
    if(m.includes('csv')) return 'csv';
    if(m.startsWith('audio/')) return 'audio';
    if(m.startsWith('video/')) return 'video';
    return 'unsupported';
  }

  private async loadText(): Promise<void> {
    try {
      if(!this.srcUrl) {this.ready = true; return;}
      const res = await fetch(this.srcUrl);
      const txt = await res.text();
      this.textContent = txt;
      this.ready = true;
    } catch {
      this.textContent = 'Failed to load text.';
      this.ready = true;
    }
  }

  private async loadCsv(): Promise<void> {
    try {
      if(!this.srcUrl) {this.ready = true; return;}
      const res = await fetch(this.srcUrl);
      const raw = await res.text();
      const rows = raw.split(/\r?\n/).filter(r => r.trim().length);
      if(!rows.length) {this.ready = true; return;}
      this.csvHeader = rows[0].split(',');
      this.csvRows = rows.slice(1).map(r => r.split(','));
      this.ready = true;
    } catch {
      this.kind = 'unsupported';
      this.ready = true;
    }
  }

  public download(): void {
    if(this.srcUrl) window.open(this.srcUrl, '_blank');
  }
}
